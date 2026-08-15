import {
  AITurnProposalValidationError,
  maxPlayerActionLength,
  runDeterministicTurn,
  validateAITurnProposal,
  type AITurnProposal,
  type GameStateSnapshot,
  type GeneratedWorldEvent,
  type StatePatch
} from "@ai-novel/domain";
import {
  AIInvalidResponseError,
  type AIGateway,
  type GenerationResult
} from "@ai-novel/ai-engine";
import type {
  DatabaseClient,
  GameMessageRecord,
  GameStateRecord,
  RepositoryContext,
  Repositories,
  StoryCharacterRecord,
  StoryRecord
} from "@ai-novel/db";
import { StateVersionConflictError, withTransaction } from "@ai-novel/db";
import {
  BadRequestError,
  ConflictApplicationError,
  ResourceNotFoundError,
  ServiceUnavailableError
} from "../../errors.js";
import type { CurrentUser } from "../auth/dto.js";
import type { BudgetService } from "../ai/budget-service.js";
import {
  toGameMessageDto,
  toGameStateDto,
  toWorldEventDto,
  type GameplayTurnResponseDto
} from "./dto.js";
import { buildAITurnGenerationRequest } from "./ai-turn-prompt.js";
import { toStateSnapshot } from "./memory-context-builder.js";
import type { MemoryContextBuilder } from "./memory-context-builder.js";
import type { SummaryService } from "./summary-service.js";
import type { TransactionRunner } from "./service.js";

export type SubmitTurnInputDto = {
  readonly action: string;
};

export type GameplayEngineMode = "deterministic" | "ai";

export type GameplayServiceOptions = {
  readonly engineMode?: GameplayEngineMode;
  readonly aiGateway?: AIGateway;
  readonly budgetService?: BudgetService;
  readonly memoryContextBuilder?: MemoryContextBuilder;
  readonly summaryService?: SummaryService;
};

export class GameplayService {
  private readonly runInTransaction: TransactionRunner;
  private readonly engineMode: GameplayEngineMode;
  private readonly aiGateway: AIGateway | undefined;
  private readonly budgetService: BudgetService | undefined;
  private readonly memoryContextBuilder: MemoryContextBuilder | undefined;
  private readonly summaryService: SummaryService | undefined;

  constructor(
    private readonly repositories: Repositories,
    database?: DatabaseClient,
    transactionRunner?: TransactionRunner,
    options: GameplayServiceOptions = {}
  ) {
    this.engineMode = options.engineMode ?? "deterministic";
    this.aiGateway = options.aiGateway;
    this.budgetService = options.budgetService;
    this.memoryContextBuilder = options.memoryContextBuilder;
    this.summaryService = options.summaryService;
    this.runInTransaction =
      transactionRunner ??
      (database
        ? (work) => withTransaction(database, work)
        : async () => {
            throw new ServiceUnavailableError(
              "Gameplay turns require database transaction support."
            );
          });
  }

  async submitTurn(
    user: CurrentUser,
    sessionId: string,
    input: SubmitTurnInputDto
  ): Promise<GameplayTurnResponseDto> {
    const action = validatePlayerAction(input.action);

    if (this.engineMode === "ai") {
      return this.submitAITurn(user, sessionId, action);
    }

    return this.submitDeterministicTurn(user, sessionId, action);
  }

  private async submitDeterministicTurn(
    user: CurrentUser,
    sessionId: string,
    action: string
  ): Promise<GameplayTurnResponseDto> {
    try {
      return await this.runInTransaction(async (context) => {
        const { session, state, story, character } =
          await loadOwnedActiveTurnSnapshot(context, user, sessionId);

        const previousLastTurn =
          await context.repositories.gameMessages.getLastTurnNumber(session.id);
        const turnNumber = (previousLastTurn ?? 0) + 1;
        const playerMessage = await context.repositories.gameMessages.append({
          sessionId: session.id,
          role: "player",
          content: action,
          turnNumber
        });
        const engineResult = runDeterministicTurn(
          { text: action },
          {
            story: {
              id: story.id,
              title: story.title,
              slug: story.slug,
              description: story.description,
              genre: story.genre
            },
            character: character
              ? {
                  id: character.id,
                  name: character.name,
                  description: character.description
                }
              : null,
            state: toStateSnapshot(state),
            turnNumber
          }
        );
        const statePatch = validateStatePatch(engineResult.statePatch);

        return persistTurn(context, {
          sessionId: session.id,
          expectedVersion: state.version,
          turnNumber,
          action,
          resultText: engineResult.resultText,
          statePatch,
          events: engineResult.events,
          preAppendedPlayerMessage: playerMessage
        });
      });
    } catch (error) {
      if (error instanceof StateVersionConflictError) {
        throw new ConflictApplicationError("Game state changed before this turn was saved.");
      }

      throw error;
    }
  }

  private async submitAITurn(
    user: CurrentUser,
    sessionId: string,
    action: string
  ): Promise<GameplayTurnResponseDto> {
    if (!this.aiGateway) {
      throw new ServiceUnavailableError("AI gameplay mode requires an AI gateway.");
    }

    const snapshot = await this.loadAITurnSnapshot(user, sessionId);
    const expectedVersion = snapshot.state.version;
    const stateSnapshot = toStateSnapshot(snapshot.state);
    const context = await (this.memoryContextBuilder
      ? this.memoryContextBuilder.buildForTurn({
          userId: user.userId,
          sessionId: snapshot.session.id,
          state: snapshot.state,
          action
        })
      : Promise.resolve({
          state: stateSnapshot,
          recentMessages: [],
          summary: null,
          memories: [],
          worldEvents: [],
          budget: {
            maxRecentMessages: 0,
            maxMemories: 0,
            maxWorldEvents: 0,
            maxSummaryChars: 0,
            maxMemoryChars: 0
          }
        }));

    await this.budgetService?.checkBeforeAI({
      userId: user.userId,
      sessionId: snapshot.session.id
    });

    const request = buildAITurnGenerationRequest({
      userId: user.userId,
      sessionId: snapshot.session.id,
      story: snapshot.story,
      character: snapshot.character,
      context,
      action
    });
    const result = await this.aiGateway.generate<AITurnProposal>(request);
    const proposal = getStructuredProposal(result);
    const validatedProposal = validateProposalForCurrentState(
      proposal,
      stateSnapshot
    );

    try {
      const turnResponse = await this.runInTransaction(async (transactionContext) => {
        const { session, state } = await loadOwnedActiveTurnSnapshot(
          transactionContext,
          user,
          sessionId
        );

        if (state.version !== expectedVersion) {
          throw new ConflictApplicationError(
            "Game state changed before this AI turn was saved."
          );
        }

        const previousLastTurn =
          await transactionContext.repositories.gameMessages.getLastTurnNumber(session.id);
        const turnNumber = (previousLastTurn ?? 0) + 1;

        return persistTurn(transactionContext, {
          sessionId: session.id,
          expectedVersion,
          turnNumber,
          action,
          resultText: validatedProposal.resultText,
          statePatch: validatedProposal.statePatch,
          events: validatedProposal.events
        });
      });

      await this.refreshSummaryAfterTurn(user, sessionId, turnResponse.turnNumber);

      return turnResponse;
    } catch (error) {
      if (error instanceof StateVersionConflictError) {
        throw new ConflictApplicationError(
          "Game state changed before this AI turn was saved."
        );
      }

      throw error;
    }
  }

  private async loadAITurnSnapshot(
    user: CurrentUser,
    sessionId: string
  ): Promise<{
    readonly session: Awaited<ReturnType<Repositories["gameSessions"]["getById"]>> & {};
    readonly state: GameStateRecord;
    readonly story: StoryRecord;
    readonly character: StoryCharacterRecord | null;
  }> {
    const session = await this.repositories.gameSessions.getById(sessionId);

    if (!session || session.userId !== user.userId) {
      throw new ResourceNotFoundError("Game session was not found.");
    }

    if (session.status !== "active") {
      throw new BadRequestError("Only active sessions can receive turns.");
    }

    const state = await this.repositories.gameStates.getCurrentState(session.id);

    if (!state) {
      throw new ResourceNotFoundError("Game state was not found.");
    }

    const { story, character } = await loadTurnReferences(this.repositories, {
      storyId: session.storyId,
      selectedCharacterId: session.selectedCharacterId
    });
    return {
      session,
      state,
      story,
      character
    };
  }

  private async refreshSummaryAfterTurn(
    user: CurrentUser,
    sessionId: string,
    turnNumber: number
  ): Promise<void> {
    try {
      await this.summaryService?.refreshIfDue({
        userId: user.userId,
        sessionId,
        targetTurn: turnNumber
      });
    } catch {
      // Summary refresh is best-effort in the request path. Gameplay persistence
      // has already completed and must not be rolled back by memory maintenance.
    }
  }
}

function validatePlayerAction(action: string): string {
  const normalized = action.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new BadRequestError("Action is required.");
  }

  if (normalized.length > maxPlayerActionLength) {
    throw new BadRequestError(
      `Action must be at most ${maxPlayerActionLength} characters.`
    );
  }

  return normalized;
}

async function loadTurnReferences(
  source: RepositoryContext | Repositories,
  input: {
    readonly storyId: string;
    readonly selectedCharacterId: string | null;
  }
): Promise<{
  readonly story: StoryRecord;
  readonly character: StoryCharacterRecord | null;
}> {
  const repositories = "repositories" in source ? source.repositories : source;
  const story = await repositories.stories.getById(input.storyId);

  if (!story) {
    throw new ResourceNotFoundError("Story was not found.");
  }

  const character = input.selectedCharacterId
    ? await repositories.stories.getCharacterForStory(
        story.id,
        input.selectedCharacterId
      )
    : null;

  return { story, character };
}

async function loadOwnedActiveTurnSnapshot(
  context: RepositoryContext,
  user: CurrentUser,
  sessionId: string
): Promise<{
  readonly session: NonNullable<
    Awaited<ReturnType<Repositories["gameSessions"]["getById"]>>
  >;
  readonly state: GameStateRecord;
  readonly story: StoryRecord;
  readonly character: StoryCharacterRecord | null;
}> {
  const session = await context.repositories.gameSessions.getById(sessionId);

  if (!session || session.userId !== user.userId) {
    throw new ResourceNotFoundError("Game session was not found.");
  }

  if (session.status !== "active") {
    throw new BadRequestError("Only active sessions can receive turns.");
  }

  const state = await context.repositories.gameStates.getCurrentState(session.id);

  if (!state) {
    throw new ResourceNotFoundError("Game state was not found.");
  }

  const { story, character } = await loadTurnReferences(context, {
    storyId: session.storyId,
    selectedCharacterId: session.selectedCharacterId
  });

  return { session, state, story, character };
}

async function persistTurn(
  context: RepositoryContext,
  input: {
    readonly sessionId: string;
    readonly expectedVersion: number;
    readonly turnNumber: number;
    readonly action: string;
    readonly resultText: string;
    readonly statePatch: StatePatch;
    readonly events: readonly GeneratedWorldEvent[];
    readonly preAppendedPlayerMessage?: GameMessageRecord;
  }
): Promise<GameplayTurnResponseDto> {
  const playerMessage =
    input.preAppendedPlayerMessage ??
    (await context.repositories.gameMessages.append({
      sessionId: input.sessionId,
      role: "player",
      content: input.action,
      turnNumber: input.turnNumber
    }));
  const updatedState = await context.repositories.gameStates.updateStateWithVersion({
    sessionId: input.sessionId,
    expectedVersion: input.expectedVersion,
    ...input.statePatch
  });
  const events = [];

  for (const event of input.events) {
    events.push(
      await context.repositories.worldEvents.append({
        sessionId: input.sessionId,
        eventType: event.eventType,
        title: event.title,
        description: event.description,
        importance: event.importance,
        payload: event.payload,
        turnNumber: input.turnNumber
      })
    );
  }

  const resultMessage = await context.repositories.gameMessages.append({
    sessionId: input.sessionId,
    role: "assistant",
    content: input.resultText,
    turnNumber: input.turnNumber
  });

  await context.repositories.gameSessions.incrementTurnCount(input.sessionId);
  await context.repositories.gameSessions.touchLastPlayedAt(input.sessionId);

  return {
    turnNumber: input.turnNumber,
    playerMessage: toGameMessageDto(playerMessage),
    resultMessage: toGameMessageDto(resultMessage),
    state: toGameStateDto(updatedState),
    events: events.map(toWorldEventDto)
  };
}

function validateStatePatch(patch: StatePatch): StatePatch {
  const validated: StatePatch = {};

  if (patch.location !== undefined) {
    const location = patch.location.trim();

    if (!location || location.length > 120) {
      throw new BadRequestError("Generated location is invalid.");
    }

    Object.assign(validated, { location });
  }

  if (patch.worldTime !== undefined) {
    Object.assign(validated, { worldTime: patch.worldTime });
  }

  if (patch.playerStats !== undefined) {
    Object.assign(validated, { playerStats: copyJsonObject(patch.playerStats) });
  }

  if (patch.flags !== undefined) {
    Object.assign(validated, { flags: copyJsonObject(patch.flags) });
  }

  if (patch.stateData !== undefined) {
    Object.assign(validated, { stateData: copyJsonObject(patch.stateData) });
  }

  return validated;
}

function getStructuredProposal(
  result: GenerationResult<AITurnProposal>
): AITurnProposal {
  if (!result.structuredOutput) {
    throw new AIInvalidResponseError("AI response did not include a turn proposal.");
  }

  return result.structuredOutput;
}

function validateProposalForCurrentState(
  proposal: AITurnProposal,
  state: GameStateSnapshot
) {
  try {
    return validateAITurnProposal(proposal, state);
  } catch (error) {
    if (error instanceof AITurnProposalValidationError) {
      throw new AIInvalidResponseError(error.message, error);
    }

    throw error;
  }
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

import {
  AITurnProposalValidationError,
  ConsequenceValidationError,
  assertQuestStatusTransition,
  maxPlayerActionLength,
  runDeterministicTurn,
  validateAITurnProposal,
  type AITurnProposal,
  type EntityReference,
  type GameStateSnapshot,
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
  SessionMemoryRecord,
  StoryCharacterRecord,
  StoryRecord
} from "@ai-novel/db";
import {
  ConflictError,
  StateVersionConflictError,
  ValidationError,
  withTransaction
} from "@ai-novel/db";
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
import {
  ConsequenceEngine,
  type InternalTurnPersistencePlan
} from "./consequence-engine.js";
import { toStateSnapshot } from "./memory-context-builder.js";
import type { MemoryContextBuilder } from "./memory-context-builder.js";
import type { NPCReactionService } from "./npc-reaction-service.js";
import type { SummaryService } from "./summary-service.js";
import type { TransactionRunner } from "./service.js";
import type { WorldSimulationService } from "./world-simulation-service.js";

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
  readonly npcReactionService?: NPCReactionService;
  readonly consequenceEngine?: ConsequenceEngine;
  readonly worldSimulationService?: WorldSimulationService;
};

type PersistedTurnResult = {
  readonly response: GameplayTurnResponseDto;
  readonly memories: readonly SessionMemoryRecord[];
};

export class GameplayService {
  private readonly runInTransaction: TransactionRunner;
  private readonly engineMode: GameplayEngineMode;
  private readonly aiGateway: AIGateway | undefined;
  private readonly budgetService: BudgetService | undefined;
  private readonly memoryContextBuilder: MemoryContextBuilder | undefined;
  private readonly summaryService: SummaryService | undefined;
  private readonly npcReactionService: NPCReactionService | undefined;
  private readonly consequenceEngine: ConsequenceEngine;
  private readonly worldSimulationService: WorldSimulationService | undefined;

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
    this.npcReactionService = options.npcReactionService;
    this.consequenceEngine = options.consequenceEngine ?? new ConsequenceEngine();
    this.worldSimulationService = options.worldSimulationService;
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
      const persisted = await this.runInTransaction(async (context) => {
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
        const plan = this.consequenceEngine.buildPlan({
          state,
          action,
          assistantNarrative: engineResult.resultText,
          baseStatePatch: statePatch,
          baseEvents: engineResult.events
        });

        return persistTurn(context, {
          sessionId: session.id,
          expectedVersion: state.version,
          turnNumber,
          action,
          plan,
          preAppendedPlayerMessage: playerMessage
        });
      });

      await this.runWorldTickAfterTurn({
        userId: user.userId,
        sessionId,
        turnNumber: persisted.response.turnNumber,
        events: persisted.response.events.map((event) => ({
          eventType: event.eventType,
          title: event.title,
          description: event.description,
          importance: event.importance,
          payload: event.payload
        }))
      });

      return persisted.response;
    } catch (error) {
      if (error instanceof StateVersionConflictError) {
        throw new ConflictApplicationError("Game state changed before this turn was saved.");
      }

      if (
        error instanceof ConflictError ||
        error instanceof ValidationError ||
        error instanceof ConsequenceValidationError
      ) {
        throw new ConflictApplicationError(error.message);
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
    const previousLastTurn =
      await this.repositories.gameMessages.getLastTurnNumber(snapshot.session.id);
    const turnNumber = (previousLastTurn ?? 0) + 1;
    const npcReactions = await this.npcReactionService?.generateReactions({
      userId: user.userId,
      sessionId: snapshot.session.id,
      state: snapshot.state,
      action,
      turnNumber
    });

    try {
      const plan = this.consequenceEngine.buildPlan({
        state: snapshot.state,
        action,
        assistantNarrative: composeResultText(
          validatedProposal.resultText,
          npcReactions?.dialogueBlocks ?? []
        ),
        baseStatePatch: validatedProposal.statePatch,
        baseEvents: validatedProposal.events,
        npcReactions: npcReactions?.reactions ?? [],
        npcEvents: npcReactions?.events ?? []
      });
      const persisted = await this.runInTransaction(async (transactionContext) => {
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

        return persistTurn(transactionContext, {
          sessionId: session.id,
          expectedVersion,
          turnNumber,
          action,
          plan
        });
      });

      await this.npcReactionService?.embedMemoriesBestEffort({
        userId: user.userId,
        sessionId,
        memories: persisted.memories
      });
      await this.runWorldTickAfterTurn({
        userId: user.userId,
        sessionId,
        turnNumber: persisted.response.turnNumber,
        events: persisted.response.events.map((event) => ({
          eventType: event.eventType,
          title: event.title,
          description: event.description,
          importance: event.importance,
          payload: event.payload
        }))
      });
      await this.refreshSummaryAfterTurn(user, sessionId, persisted.response.turnNumber);

      return persisted.response;
    } catch (error) {
      if (error instanceof StateVersionConflictError) {
        throw new ConflictApplicationError(
          "Game state changed before this AI turn was saved."
        );
      }

      if (
        error instanceof ConflictError ||
        error instanceof ValidationError ||
        error instanceof ConsequenceValidationError
      ) {
        throw new ConflictApplicationError(error.message);
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

  private async runWorldTickAfterTurn(input: {
    readonly userId: string;
    readonly sessionId: string;
    readonly turnNumber: number;
    readonly events: readonly {
      readonly eventType: string;
      readonly title: string;
      readonly description: string;
      readonly importance: number;
      readonly payload: Record<string, unknown>;
    }[];
  }): Promise<void> {
    try {
      await this.worldSimulationService?.runIfDue({
        userId: input.userId,
        sessionId: input.sessionId,
        turnNumber: input.turnNumber,
        reason: "gameplay_turn",
        turnEvents: input.events
      });
    } catch {
      // World simulation is post-turn maintenance. A completed gameplay turn
      // must remain committed if a bounded world tick fails.
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
    readonly plan: InternalTurnPersistencePlan;
    readonly preAppendedPlayerMessage?: GameMessageRecord;
  }
): Promise<PersistedTurnResult> {
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
    ...input.plan.statePatch
  });
  const events = [];

  const consequenceMemories = await persistConsequences(context, {
    sessionId: input.sessionId,
    turnNumber: input.turnNumber,
    consequences: input.plan.consequences,
    memories: input.plan.memories
  });

  for (const event of input.plan.events) {
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
    content: input.plan.assistantNarrative,
    turnNumber: input.turnNumber
  });

  await context.repositories.gameSessions.incrementTurnCount(input.sessionId);
  await context.repositories.gameSessions.touchLastPlayedAt(input.sessionId);

  return {
    response: {
      turnNumber: input.turnNumber,
      playerMessage: toGameMessageDto(playerMessage),
      resultMessage: toGameMessageDto(resultMessage),
      state: toGameStateDto(updatedState),
      events: events.map(toWorldEventDto),
      consequences: input.plan.summaries
    },
    memories: consequenceMemories
  };
}

async function persistConsequences(
  context: RepositoryContext,
  input: {
    readonly sessionId: string;
    readonly turnNumber: number;
    readonly consequences: InternalTurnPersistencePlan["consequences"];
    readonly memories: InternalTurnPersistencePlan["memories"];
  }
): Promise<SessionMemoryRecord[]> {
  const memories: SessionMemoryRecord[] = [];

  for (const consequence of input.consequences) {
    if (
      consequence.type === "quest_activate" ||
      consequence.type === "quest_progress" ||
      consequence.type === "quest_complete" ||
      consequence.type === "quest_fail"
    ) {
      await applyQuestConsequence(context, input.sessionId, consequence);
    }

    if (consequence.type === "inventory_add" || consequence.type === "inventory_remove") {
      await applyInventoryConsequence(context, input.sessionId, consequence);
    }

    if (consequence.type === "relationship_delta") {
      await applyRelationshipDelta(context, input.sessionId, consequence);
    }

    if (consequence.type === "npc_state_change" && consequence.npcId) {
      await applyNPCStateConsequence(context, input.sessionId, input.turnNumber, consequence);
    }
  }

  for (const memory of input.memories) {
    memories.push(
      await upsertMemoryCandidate(context, {
        sessionId: input.sessionId,
        turnNumber: input.turnNumber,
        memory
      })
    );
  }

  return memories;
}

async function applyRelationshipDelta(
  context: RepositoryContext,
  sessionId: string,
  consequence: InternalTurnPersistencePlan["consequences"][number]
): Promise<void> {
  if (
    consequence.type !== "relationship_delta" ||
    !consequence.sourceEntity ||
    !consequence.targetEntity
  ) {
    return;
  }

  await assertEntityExists(context, sessionId, consequence.sourceEntity);
  await assertEntityExists(context, sessionId, consequence.targetEntity);

  const source = toDbEntityRef(consequence.sourceEntity);
  const target = toDbEntityRef(consequence.targetEntity);
  const existing = await context.repositories.relationships.getRelationshipEdge(
    sessionId,
    source,
    target
  );

  await context.repositories.relationships.upsertRelationship({
    sessionId,
    source,
    target,
    affinity: clampRelationship(
      (existing?.affinity ?? 0) + (consequence.affinityDelta ?? 0),
      -100,
      100
    ),
    trust: clampRelationship(
      (existing?.trust ?? 0) + (consequence.trustDelta ?? 0),
      -100,
      100
    ),
    fear: clampRelationship((existing?.fear ?? 0) + (consequence.fearDelta ?? 0), 0, 100),
    metadata: {
      ...(existing?.metadata ?? {}),
      source: consequence.source,
      lastConsequenceTurn: new Date().toISOString()
    }
  });
}

async function applyQuestConsequence(
  context: RepositoryContext,
  sessionId: string,
  consequence: InternalTurnPersistencePlan["consequences"][number]
): Promise<void> {
  const questKey = consequence.questKey;

  if (!questKey) {
    return;
  }

  const existing = await context.repositories.quests.getByQuestKey(sessionId, questKey);

  if (consequence.type === "quest_activate") {
    if (!existing) {
      await context.repositories.quests.create({
        sessionId,
        questKey,
        title: consequence.title ?? questKey,
        description: consequence.description ?? "",
        status: "active",
        progress: consequence.progress ?? {}
      });
      return;
    }

    assertQuestStatusTransition(existing.status, "active");
    await context.repositories.quests.updateStatusOrProgress({
      sessionId,
      questKey,
      status: "active",
      progress: mergeQuestProgress(existing.progress, consequence.progress ?? {})
    });
    return;
  }

  if (!existing) {
    throw new ConflictApplicationError(`Quest ${questKey} does not exist.`);
  }

  if (consequence.type === "quest_progress") {
    assertQuestStatusTransition(existing.status, "active");
    await context.repositories.quests.updateStatusOrProgress({
      sessionId,
      questKey,
      status: existing.status,
      progress: mergeQuestProgress(existing.progress, consequence.progress ?? {})
    });
    return;
  }

  if (consequence.type === "quest_complete" || consequence.type === "quest_fail") {
    const status = consequence.type === "quest_complete" ? "completed" : "failed";
    assertQuestStatusTransition(existing.status, status);
    await context.repositories.quests.updateStatusOrProgress({
      sessionId,
      questKey,
      status,
      progress: mergeQuestProgress(existing.progress, consequence.progress ?? {})
    });
  }
}

async function applyInventoryConsequence(
  context: RepositoryContext,
  sessionId: string,
  consequence: InternalTurnPersistencePlan["consequences"][number]
): Promise<void> {
  if (
    (consequence.type !== "inventory_add" &&
      consequence.type !== "inventory_remove") ||
    !consequence.owner ||
    !consequence.itemKey ||
    !consequence.quantity
  ) {
    return;
  }

  await assertEntityExists(context, sessionId, consequence.owner);
  const owner = toDbEntityRef(consequence.owner);

  if (consequence.type === "inventory_add") {
    await context.repositories.inventory.addOrUpdateQuantity({
      sessionId,
      ownerType: owner.type,
      ownerId: owner.id ?? null,
      itemKey: consequence.itemKey,
      name: consequence.itemName ?? consequence.itemKey,
      description: consequence.description,
      quantity: consequence.quantity,
      metadata: consequence.metadata ?? {}
    });
    return;
  }

  await context.repositories.inventory.changeQuantity({
    sessionId,
    owner,
    itemKey: consequence.itemKey,
    delta: -consequence.quantity
  });
}

async function applyNPCStateConsequence(
  context: RepositoryContext,
  sessionId: string,
  turnNumber: number,
  consequence: InternalTurnPersistencePlan["consequences"][number]
): Promise<void> {
  if (consequence.type !== "npc_state_change" || !consequence.npcId) {
    return;
  }

  const npc = await context.repositories.npcs.getByIdForSession(
    sessionId,
    consequence.npcId
  );

  if (!npc) {
    throw new ConflictApplicationError("NPC consequence target was not found.");
  }

  await context.repositories.npcs.updateRuntimeState({
    sessionId,
    npcId: consequence.npcId,
    currentState: {
      ...copyJsonObject(npc.currentState),
      ...copyJsonObject(consequence.statePatch ?? {}),
      lastInteractionTurn: turnNumber
    }
  });
}

async function upsertMemoryCandidate(
  context: RepositoryContext,
  input: {
    readonly sessionId: string;
    readonly turnNumber: number;
    readonly memory: InternalTurnPersistencePlan["memories"][number];
  }
): Promise<SessionMemoryRecord> {
  const existing = input.memory.key
    ? await context.repositories.memories.findByKey(input.sessionId, input.memory.key)
    : null;

  if (existing) {
    return context.repositories.memories.updateMemory({
      sessionId: input.sessionId,
      memoryId: existing.id,
      content: input.memory.content,
      importance: Math.max(existing.importance, input.memory.importance),
      lastConfirmedTurn: input.turnNumber,
      active: true,
      metadata: {
        ...existing.metadata,
        source: "consequence_engine"
      }
    });
  }

  return context.repositories.memories.createMemory({
    sessionId: input.sessionId,
    memoryType: input.memory.memoryType,
    subjectType: input.memory.subjectType ?? null,
    subjectId: input.memory.subjectId ?? null,
    key: input.memory.key ?? null,
    content: input.memory.content,
    importance: input.memory.importance,
    firstObservedTurn: input.turnNumber,
    lastConfirmedTurn: input.turnNumber,
    metadata: {
      ...(input.memory.metadata ?? {}),
      source: "consequence_engine"
    }
  });
}

async function assertEntityExists(
  context: RepositoryContext,
  sessionId: string,
  entity: EntityReference
): Promise<void> {
  if (entity.type === "player") {
    return;
  }

  const npc = await context.repositories.npcs.getByIdForSession(
    sessionId,
    entity.id ?? ""
  );

  if (!npc) {
    throw new ConflictApplicationError("Consequence target was not found.");
  }
}

function toDbEntityRef(entity: EntityReference) {
  return entity.type === "player"
    ? { type: "player" as const, id: null }
    : { type: "npc" as const, id: entity.id };
}

function mergeQuestProgress(
  current: Record<string, unknown>,
  next: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...copyJsonObject(current),
    ...copyJsonObject(next)
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

function composeResultText(
  mainNarrative: string,
  npcDialogueBlocks: readonly string[]
): string {
  if (npcDialogueBlocks.length === 0) {
    return mainNarrative;
  }

  return [mainNarrative, ...npcDialogueBlocks].join("\n\n");
}

function clampRelationship(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
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

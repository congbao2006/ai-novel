import {
  maxPlayerActionLength,
  runDeterministicTurn,
  type GameStateSnapshot,
  type StatePatch
} from "@ai-novel/domain";
import type {
  DatabaseClient,
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
import {
  toGameMessageDto,
  toGameStateDto,
  toWorldEventDto,
  type GameplayTurnResponseDto
} from "./dto.js";
import type { TransactionRunner } from "./service.js";

export type SubmitTurnInputDto = {
  readonly action: string;
};

export class GameplayService {
  private readonly runInTransaction: TransactionRunner;

  constructor(
    private readonly repositories: Repositories,
    database?: DatabaseClient,
    transactionRunner?: TransactionRunner
  ) {
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

    try {
      return await this.runInTransaction(async (context) => {
        const session = await context.repositories.gameSessions.getById(sessionId);

        if (!session || session.userId !== user.userId) {
          throw new ResourceNotFoundError("Game session was not found.");
        }

        if (session.status !== "active") {
          throw new BadRequestError("Only active sessions can receive turns.");
        }

        const state = await context.repositories.gameStates.getCurrentState(
          session.id
        );

        if (!state) {
          throw new ResourceNotFoundError("Game state was not found.");
        }

        const { story, character } = await loadTurnReferences(context, {
          storyId: session.storyId,
          selectedCharacterId: session.selectedCharacterId
        });
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
        const updatedState =
          await context.repositories.gameStates.updateStateWithVersion({
            sessionId: session.id,
            expectedVersion: state.version,
            ...statePatch
          });
        const events = [];

        for (const event of engineResult.events) {
          events.push(
            await context.repositories.worldEvents.append({
              sessionId: session.id,
              eventType: event.eventType,
              title: event.title,
              description: event.description,
              importance: event.importance,
              payload: event.payload,
              turnNumber
            })
          );
        }

        const resultMessage = await context.repositories.gameMessages.append({
          sessionId: session.id,
          role: "assistant",
          content: engineResult.resultText,
          turnNumber
        });

        await context.repositories.gameSessions.incrementTurnCount(session.id);
        await context.repositories.gameSessions.touchLastPlayedAt(session.id);

        return {
          turnNumber,
          playerMessage: toGameMessageDto(playerMessage),
          resultMessage: toGameMessageDto(resultMessage),
          state: toGameStateDto(updatedState),
          events: events.map(toWorldEventDto)
        };
      });
    } catch (error) {
      if (error instanceof StateVersionConflictError) {
        throw new ConflictApplicationError("Game state changed before this turn was saved.");
      }

      throw error;
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
  context: RepositoryContext,
  input: {
    readonly storyId: string;
    readonly selectedCharacterId: string | null;
  }
): Promise<{
  readonly story: StoryRecord;
  readonly character: StoryCharacterRecord | null;
}> {
  const story = await context.repositories.stories.getById(input.storyId);

  if (!story) {
    throw new ResourceNotFoundError("Story was not found.");
  }

  const character = input.selectedCharacterId
    ? await context.repositories.stories.getCharacterForStory(
        story.id,
        input.selectedCharacterId
      )
    : null;

  return { story, character };
}

function toStateSnapshot(state: GameStateRecord): GameStateSnapshot {
  return {
    version: state.version,
    location: state.location,
    worldTime: state.worldTime,
    playerStats: copyJsonObject(state.playerStats),
    flags: copyJsonObject(state.flags),
    stateData: copyJsonObject(state.stateData)
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

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

import type {
  DatabaseClient,
  GameMessageRecord,
  GameSessionRecord,
  GameStateRecord,
  RepositoryContext,
  Repositories,
  StoryCharacterRecord,
  StoryRecord,
  StoryVersionCharacterRecord,
  StoryVersionRecord
} from "@ai-novel/db";
import { withTransaction } from "@ai-novel/db";
import {
  buildInitialAbilityRuntimeState,
  type AbilityCategory,
  type AbilityDefinition
} from "@ai-novel/domain";
import {
  BadRequestError,
  ResourceNotFoundError,
  ServiceUnavailableError
} from "../../errors.js";
import type { CurrentUser } from "../auth/dto.js";
import { buildInitialGameState } from "./initial-state.js";
import type { FactionInitializationService } from "./faction-initialization-service.js";
import type { NPCInitializationService } from "./npc-initialization-service.js";
import {
  abilityAttemptsByTurnFromStateData,
  toGameMessageDto,
  toGameStateDto,
  toFactionDto,
  toInventoryItemDto,
  toQuestDto,
  toSessionListItemDto,
  type CreateSessionResponseDto,
  type FactionListResponseDto,
  type InventoryResponseDto,
  type QuestListResponseDto,
  type SessionDetailDto,
  type SessionListResponseDto
} from "./dto.js";

export type CreateSessionInputDto = {
  readonly storyId: string;
  readonly characterId: string;
};

export type TransactionRunner = <T>(
  work: (context: RepositoryContext) => Promise<T>
) => Promise<T>;

export class SessionService {
  private readonly runInTransaction: TransactionRunner;

  constructor(
    private readonly repositories: Repositories,
    database?: DatabaseClient,
    transactionRunner?: TransactionRunner,
    private readonly npcInitializationService?: NPCInitializationService,
    private readonly factionInitializationService?: FactionInitializationService
  ) {
    this.runInTransaction =
      transactionRunner ??
      (database
        ? (work) => withTransaction(database, work)
        : async () => {
            throw new ServiceUnavailableError(
              "Session creation requires database transaction support."
            );
          });
  }

  async createSession(
    user: CurrentUser,
    input: CreateSessionInputDto
  ): Promise<CreateSessionResponseDto> {
    const { story, version } = await this.getPlayableStoryVersion(input.storyId);
    const character = await this.repositories.storyVersionCharacters.getForVersion(
      version.id,
      input.characterId
    );

    if (!character) {
      throw new BadRequestError("Selected character does not belong to this story.");
    }

    if (character.characterType !== "playable") {
      throw new BadRequestError("Selected character is not playable.");
    }

    const session = await this.runInTransaction(async (context) => {
      const [versionAbilities, characterAbilities] = await Promise.all([
        context.repositories.storyVersionAbilities?.listForVersion(version.id) ??
          Promise.resolve([]),
        context.repositories.storyVersionCharacterAbilities?.listForVersionCharacter(
          character.id
        ) ?? Promise.resolve([])
      ]);
      const versionAbilitiesById = new Map(
        versionAbilities.map((ability) => [ability.id, ability])
      );
      const abilityRuntimeState = buildInitialAbilityRuntimeState({
        definitions: versionAbilities.map(toAbilityDefinition),
        characterAbilities: characterAbilities.flatMap((assignment) => {
          const ability = versionAbilitiesById.get(assignment.versionAbilityId);
          return ability
            ? [
                {
                  abilityKey: ability.abilityKey,
                  rank: assignment.rank,
                  unlocked: assignment.unlocked,
                  enabled: assignment.enabled
                }
              ]
            : [];
        })
      });
      const createdSession = await context.repositories.gameSessions.create({
        userId: user.userId,
        storyId: story.id,
        storyVersionId: version.id,
        selectedCharacterId: character.sourceCharacterId,
        selectedVersionCharacterId: character.id,
        title: story.title
      });

      await context.repositories.gameStates.createInitialState(
        buildInitialGameState(
          createdSession.id,
          {
            storyId: story.id,
            storySlug: story.slug,
            storyVersionId: version.id,
            storyVersionNumber: version.versionNumber,
            settings: version.settings
          },
          character,
          abilityRuntimeState
        )
      );
      await this.npcInitializationService?.initializeForSession({
        context,
        sessionId: createdSession.id,
        storyVersionId: version.id,
        selectedVersionCharacterId: character.id
      });
      await this.factionInitializationService?.initializeForSession({
        context,
        sessionId: createdSession.id,
        storyVersionId: version.id
      });

      return createdSession;
    });

    const detail = await this.buildSessionDetail(user.userId, session);

    return {
      session: detail
    };
  }

  async listSessions(user: CurrentUser): Promise<SessionListResponseDto> {
    const sessions = await this.repositories.gameSessions.listForUser(user.userId);
    const statesBySessionId = await loadStatesBySessionId(
      this.repositories,
      sessions.map((session) => session.id)
    );
    const items = await Promise.all(
      sessions.map(async (session) => {
        const { story, storyVersion, character } =
          await this.loadSessionReferences(session);
        return toSessionListItemDto({
          session,
          story,
          character,
          storyVersion,
          currentState: statesBySessionId.get(session.id) ?? null
        });
      })
    );

    return {
      sessions: items
    };
  }

  async getSession(user: CurrentUser, sessionId: string): Promise<SessionDetailDto> {
    const session = await this.repositories.gameSessions.getById(sessionId);

    if (!session || session.userId !== user.userId) {
      throw new ResourceNotFoundError("Game session was not found.");
    }

    return this.buildSessionDetail(user.userId, session);
  }

  async listSessionQuests(
    user: CurrentUser,
    sessionId: string
  ): Promise<QuestListResponseDto> {
    await this.requireOwnedSession(user.userId, sessionId);
    const quests = await this.repositories.quests.listSessionQuests(sessionId);

    return {
      quests: quests.map(toQuestDto)
    };
  }

  async listPlayerInventory(
    user: CurrentUser,
    sessionId: string
  ): Promise<InventoryResponseDto> {
    await this.requireOwnedSession(user.userId, sessionId);
    const items = await this.repositories.inventory.listInventoryByOwner(
      sessionId,
      { type: "player", id: null }
    );

    return {
      items: items.map(toInventoryItemDto)
    };
  }

  async listSessionFactions(
    user: CurrentUser,
    sessionId: string
  ): Promise<FactionListResponseDto> {
    await this.requireOwnedSession(user.userId, sessionId);
    const factions = await this.repositories.factions.listBySession(sessionId);

    return {
      factions: factions.map(toFactionDto)
    };
  }

  private async getPlayableStoryVersion(storyId: string): Promise<{
    readonly story: StoryRecord;
    readonly version: StoryVersionRecord;
  }> {
    const story = await this.repositories.stories.getById(storyId);

    if (!story || story.status === "archived") {
      throw new ResourceNotFoundError("Story was not found.");
    }

    const version = await this.repositories.storyVersions.getCurrentPublishedVersion(
      story.id
    );
    if (!version) {
      throw new ResourceNotFoundError("Story was not found.");
    }

    return { story, version };
  }

  private async requireOwnedSession(
    userId: string,
    sessionId: string
  ): Promise<GameSessionRecord> {
    const session = await this.repositories.gameSessions.getById(sessionId);

    if (!session || session.userId !== userId) {
      throw new ResourceNotFoundError("Game session was not found.");
    }

    return session;
  }

  private async loadSessionReferences(session: GameSessionRecord): Promise<{
    readonly story: StoryRecord;
    readonly storyVersion: StoryVersionRecord | null;
    readonly character: StoryCharacterRecord | StoryVersionCharacterRecord | null;
  }> {
    const story = await this.repositories.stories.getById(session.storyId);

    if (!story) {
      throw new ResourceNotFoundError("Story was not found.");
    }

    const storyVersion = session.storyVersionId
      ? await this.repositories.storyVersions.getById(session.storyVersionId)
      : null;
    const character =
      storyVersion && session.selectedVersionCharacterId
        ? await this.repositories.storyVersionCharacters.getForVersion(
            storyVersion.id,
            session.selectedVersionCharacterId
          )
        : session.selectedCharacterId
          ? await this.repositories.stories.getCharacterForStory(
              session.storyId,
              session.selectedCharacterId
            )
          : null;

    return { story, storyVersion, character };
  }

  private async buildSessionDetail(
    userId: string,
    session: GameSessionRecord
  ): Promise<SessionDetailDto> {
    if (session.userId !== userId) {
      throw new ResourceNotFoundError("Game session was not found.");
    }

    const { story, storyVersion, character } = await this.loadSessionReferences(
      session
    );
    const [currentState, recentMessages] = await Promise.all([
      this.repositories.gameStates.getCurrentState(session.id),
      this.repositories.gameMessages.getRecentMessages(session.id, 50)
    ]);
    const abilityAttemptsByTurn = currentState
      ? abilityAttemptsByTurnFromStateData(
          (currentState as GameStateRecord).stateData
        )
      : new Map();

    return {
      ...toSessionListItemDto({ session, story, character, storyVersion }),
      currentState: currentState
        ? toGameStateDto(currentState as GameStateRecord)
        : null,
      recentMessages: [...(recentMessages as GameMessageRecord[])]
        .sort(compareMessagesForTranscript)
        .map((message) => toGameMessageDto(message, abilityAttemptsByTurn))
    };
  }
}

async function loadStatesBySessionId(
  repositories: Repositories,
  sessionIds: readonly string[]
): Promise<ReadonlyMap<string, GameStateRecord>> {
  if (sessionIds.length === 0) {
    return new Map();
  }

  const repository = repositories.gameStates as typeof repositories.gameStates & {
    readonly listBySessionIds?: (
      sessionIds: readonly string[]
    ) => Promise<GameStateRecord[]>;
  };
  const states = repository.listBySessionIds
    ? await repository.listBySessionIds(sessionIds)
    : await Promise.all(
        sessionIds.map((sessionId) =>
          repositories.gameStates.getCurrentState(sessionId)
        )
      );

  return new Map(
    states
      .filter((state): state is GameStateRecord => state !== null)
      .map((state) => [state.sessionId, state])
  );
}

function compareMessagesForTranscript(
  left: GameMessageRecord,
  right: GameMessageRecord
): number {
  if (left.turnNumber !== right.turnNumber) {
    return left.turnNumber - right.turnNumber;
  }

  return messageRoleOrder(left.role) - messageRoleOrder(right.role);
}

function messageRoleOrder(role: GameMessageRecord["role"]): number {
  if (role === "player") {
    return 0;
  }

  if (role === "assistant") {
    return 1;
  }

  return 2;
}

function toAbilityDefinition(
  ability: Awaited<
    ReturnType<Repositories["storyVersionAbilities"]["listForVersion"]>
  >[number]
): AbilityDefinition {
  return {
    key: ability.abilityKey,
    name: ability.name,
    description: ability.description,
    category: ability.category as AbilityCategory,
    rank: ability.rank,
    resourceCost:
      ability.resourceCost &&
      typeof ability.resourceCost.statKey === "string" &&
      typeof ability.resourceCost.amount === "number"
        ? {
            statKey: ability.resourceCost.statKey,
            amount: ability.resourceCost.amount
          }
        : null,
    cooldownTurns: ability.cooldownTurns,
    tags: ability.tags.map(String),
    effects: copyJsonObject(ability.effects),
    requirements: copyJsonObject(ability.requirements),
    enabled: ability.enabled,
    metadata: copyJsonObject(ability.metadata)
  };
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

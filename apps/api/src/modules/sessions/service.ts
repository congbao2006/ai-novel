import type {
  DatabaseClient,
  GameMessageRecord,
  GameSessionRecord,
  GameStateRecord,
  RepositoryContext,
  Repositories,
  StoryCharacterRecord,
  StoryRecord
} from "@ai-novel/db";
import { withTransaction } from "@ai-novel/db";
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
    const story = await this.getPublishedStory(input.storyId);
    const character = await this.repositories.stories.getCharacterForStory(
      story.id,
      input.characterId
    );

    if (!character) {
      throw new BadRequestError("Selected character does not belong to this story.");
    }

    if (character.characterType !== "playable") {
      throw new BadRequestError("Selected character is not playable.");
    }

    const session = await this.runInTransaction(async (context) => {
      const createdSession = await context.repositories.gameSessions.create({
        userId: user.userId,
        storyId: story.id,
        selectedCharacterId: character.id,
        title: story.title
      });

      await context.repositories.gameStates.createInitialState(
        buildInitialGameState(createdSession.id, story, character)
      );
      await this.npcInitializationService?.initializeForSession({
        context,
        sessionId: createdSession.id,
        story,
        selectedCharacterId: character.id
      });
      await this.factionInitializationService?.initializeForSession({
        context,
        sessionId: createdSession.id,
        story
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
    const items = await Promise.all(
      sessions.map(async (session) => {
        const { story, character } = await this.loadSessionReferences(session);
        return toSessionListItemDto({ session, story, character });
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

  private async getPublishedStory(storyId: string): Promise<StoryRecord> {
    const story = await this.repositories.stories.getById(storyId);

    if (!story || story.status !== "published") {
      throw new ResourceNotFoundError("Story was not found.");
    }

    return story;
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
    readonly character: StoryCharacterRecord | null;
  }> {
    const story = await this.repositories.stories.getById(session.storyId);

    if (!story) {
      throw new ResourceNotFoundError("Story was not found.");
    }

    const character = session.selectedCharacterId
      ? await this.repositories.stories.getCharacterForStory(
          session.storyId,
          session.selectedCharacterId
        )
      : null;

    return { story, character };
  }

  private async buildSessionDetail(
    userId: string,
    session: GameSessionRecord
  ): Promise<SessionDetailDto> {
    if (session.userId !== userId) {
      throw new ResourceNotFoundError("Game session was not found.");
    }

    const { story, character } = await this.loadSessionReferences(session);
    const [currentState, recentMessages] = await Promise.all([
      this.repositories.gameStates.getCurrentState(session.id),
      this.repositories.gameMessages.getRecentMessages(session.id, 50)
    ]);

    return {
      ...toSessionListItemDto({ session, story, character }),
      currentState: currentState
        ? toGameStateDto(currentState as GameStateRecord)
        : null,
      recentMessages: [...(recentMessages as GameMessageRecord[])]
        .sort(compareMessagesForTranscript)
        .map(toGameMessageDto)
    };
  }
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

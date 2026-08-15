import { and, desc, eq, gt, gte, isNull, lte, sql } from "drizzle-orm";
import type { DbExecutor } from "./context.js";
import {
  ConflictError,
  DataAccessError,
  NotFoundError,
  StateVersionConflictError,
  ValidationError
} from "./errors.js";
import {
  assertInventoryDelta,
  assertPositiveLimit,
  entityRefPredicate,
  firstOrNull,
  firstOrThrow,
  normalizeEntityId,
  relationshipEntityPredicate
} from "./helpers.js";
import type {
  AddInventoryItemInput,
  AIUsageQueryInput,
  AIUsageRecordRecord,
  AppendMessageInput,
  AppendWorldEventInput,
  AuthSessionRecord,
  AuthUserRecord,
  ChangeInventoryQuantityInput,
  CreateAuthSessionInput,
  CreateInitialStateInput,
  CreateMemoryInput,
  CreateNpcInput,
  CreateQuestInput,
  CreateSessionInput,
  CreateUserInput,
  EntityRef,
  GameMessageRecord,
  GameSessionRecord,
  GameStateRecord,
  InventoryItemRecord,
  MemoryEmbeddingRecord,
  MessagePageInput,
  NpcRecord,
  QuestRecord,
  RecordAIUsageInput,
  RelationshipRecord,
  SearchSimilarMemoriesInput,
  SemanticMemorySearchResult,
  SessionMemoryRecord,
  SessionSummaryRecord,
  StoryRecord,
  StoryCharacterRecord,
  StoryListPageInput,
  UpdateNpcRuntimeStateInput,
  UpdateQuestInput,
  UpdateSessionMetadataInput,
  UpdateStateInput,
  UpdateMemoryInput,
  UpdateSessionSummaryWithVersionInput,
  UpsertMemoryEmbeddingInput,
  UpsertSessionSummaryInput,
  UpsertRelationshipInput,
  UserRecord,
  WorldEventRecord
} from "./types.js";
import {
  aiUsageRecords,
  authSessions,
  gameMessages,
  gameSessions,
  gameStates,
  inventoryItems,
  memoryEmbeddings,
  npcs,
  quests,
  relationships,
  sessionMemories,
  sessionSummaries,
  stories,
  storyCharacters,
  users,
  worldEvents
} from "../schema/index.js";
import type {
  AIUsageRepository,
  AuthSessionRepository,
  GameMessageRepository,
  GameSessionRepository,
  GameStateRepository,
  InventoryRepository,
  MemoryRepository,
  NPCRepository,
  QuestRepository,
  RelationshipRepository,
  SemanticMemoryRepository,
  SessionSummaryRepository,
  StoryRepository,
  UserRepository,
  WorldEventRepository
} from "./contracts.js";

const publicUserColumns = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  emailVerifiedAt: users.emailVerifiedAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt
};

const memoryEmbeddingPublicColumns = {
  id: memoryEmbeddings.id,
  memoryId: memoryEmbeddings.memoryId,
  provider: memoryEmbeddings.provider,
  model: memoryEmbeddings.model,
  dimensions: memoryEmbeddings.dimensions,
  contentHash: memoryEmbeddings.contentHash,
  createdAt: memoryEmbeddings.createdAt,
  updatedAt: memoryEmbeddings.updatedAt
};

abstract class BaseRepository {
  constructor(protected readonly db: DbExecutor) {}

  protected async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof DataAccessError) {
        throw error;
      }

      throw new DataAccessError("Database operation failed.", error);
    }
  }
}

export class DrizzleUserRepository
  extends BaseRepository
  implements UserRepository
{
  getById(id: string): Promise<UserRecord | null> {
    return this.run(async () =>
      firstOrNull(
        await this.db
          .select(publicUserColumns)
          .from(users)
          .where(eq(users.id, id))
          .limit(1)
      )
    );
  }

  getByEmail(email: string): Promise<UserRecord | null> {
    return this.run(async () =>
      firstOrNull(
        await this.db
          .select(publicUserColumns)
          .from(users)
          .where(eq(users.email, email))
          .limit(1)
      )
    );
  }

  getByEmailForAuth(email: string): Promise<AuthUserRecord | null> {
    return this.run(async () =>
      firstOrNull(
        await this.db.select().from(users).where(eq(users.email, email)).limit(1)
      )
    );
  }

  create(input: CreateUserInput): Promise<UserRecord> {
    return this.run(async () =>
      firstOrThrow(
        await this.db.insert(users).values(input).returning(publicUserColumns),
        new ConflictError("User could not be created.")
      )
    );
  }
}

export class DrizzleAuthSessionRepository
  extends BaseRepository
  implements AuthSessionRepository
{
  create(input: CreateAuthSessionInput): Promise<AuthSessionRecord> {
    return this.run(async () =>
      firstOrThrow(
        await this.db.insert(authSessions).values(input).returning(),
        new ConflictError("Auth session could not be created.")
      )
    );
  }

  getValidSessionByTokenHash(
    tokenHash: string,
    now = new Date()
  ): Promise<AuthSessionRecord | null> {
    return this.run(async () =>
      firstOrNull(
        await this.db
          .select()
          .from(authSessions)
          .where(
            and(
              eq(authSessions.tokenHash, tokenHash),
              isNull(authSessions.revokedAt),
              gt(authSessions.expiresAt, now)
            )
          )
          .limit(1)
      )
    );
  }

  async revokeByTokenHash(tokenHash: string, now = new Date()): Promise<void> {
    await this.run(async () => {
      await this.db
        .update(authSessions)
        .set({ revokedAt: now, lastUsedAt: now })
        .where(eq(authSessions.tokenHash, tokenHash));
    });
  }

  async revokeAllForUser(userId: string, now = new Date()): Promise<void> {
    await this.run(async () => {
      await this.db
        .update(authSessions)
        .set({ revokedAt: now, lastUsedAt: now })
        .where(
          and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt))
        );
    });
  }

  async touchLastUsedAt(sessionId: string, now = new Date()): Promise<void> {
    await this.run(async () => {
      await this.db
        .update(authSessions)
        .set({ lastUsedAt: now })
        .where(eq(authSessions.id, sessionId));
    });
  }
}

export class DrizzleStoryRepository
  extends BaseRepository
  implements StoryRepository
{
  getById(id: string): Promise<StoryRecord | null> {
    return this.run(async () =>
      firstOrNull(await this.db.select().from(stories).where(eq(stories.id, id)).limit(1))
    );
  }

  getBySlug(slug: string): Promise<StoryRecord | null> {
    return this.run(async () =>
      firstOrNull(
        await this.db.select().from(stories).where(eq(stories.slug, slug)).limit(1)
      )
    );
  }

  listPublishedPage(input: StoryListPageInput): Promise<StoryRecord[]> {
    assertPositiveLimit(input.limit);

    if (input.offset < 0) {
      throw new ValidationError("Offset must be non-negative.");
    }

    const predicates = [eq(stories.status, "published")];

    if (input.genre) {
      predicates.push(eq(stories.genre, input.genre));
    }

    return this.run(async () =>
      this.db
        .select()
        .from(stories)
        .where(and(...predicates))
        .orderBy(stories.createdAt, stories.id)
        .limit(input.limit)
        .offset(input.offset)
    );
  }

  listPublished(limit = 50): Promise<StoryRecord[]> {
    assertPositiveLimit(limit);
    return this.run(async () =>
      this.db
        .select()
        .from(stories)
        .where(eq(stories.status, "published"))
        .limit(limit)
    );
  }

  listByGenre(genre: string, limit = 50): Promise<StoryRecord[]> {
    assertPositiveLimit(limit);
    return this.run(async () =>
      this.db
        .select()
        .from(stories)
        .where(and(eq(stories.genre, genre), eq(stories.status, "published")))
        .limit(limit)
    );
  }

  listCreatedByUser(userId: string): Promise<StoryRecord[]> {
    return this.run(async () =>
      this.db
        .select()
        .from(stories)
        .where(eq(stories.createdByUserId, userId))
    );
  }

  listCharactersForStory(storyId: string): Promise<StoryCharacterRecord[]> {
    return this.run(async () =>
      this.db
        .select()
        .from(storyCharacters)
        .where(eq(storyCharacters.storyId, storyId))
        .orderBy(storyCharacters.createdAt, storyCharacters.id)
    );
  }

  getCharacterForStory(
    storyId: string,
    characterId: string
  ): Promise<StoryCharacterRecord | null> {
    return this.run(async () =>
      firstOrNull(
        await this.db
          .select()
          .from(storyCharacters)
          .where(
            and(
              eq(storyCharacters.storyId, storyId),
              eq(storyCharacters.id, characterId)
            )
          )
          .limit(1)
      )
    );
  }
}

export class DrizzleGameSessionRepository
  extends BaseRepository
  implements GameSessionRepository
{
  create(input: CreateSessionInput): Promise<GameSessionRecord> {
    return this.run(async () =>
      firstOrThrow(
        await this.db.insert(gameSessions).values(input).returning(),
        new ConflictError("Game session could not be created.")
      )
    );
  }

  getById(id: string): Promise<GameSessionRecord | null> {
    return this.run(async () =>
      firstOrNull(
        await this.db
          .select()
          .from(gameSessions)
          .where(eq(gameSessions.id, id))
          .limit(1)
      )
    );
  }

  listForUser(userId: string): Promise<GameSessionRecord[]> {
    return this.run(async () =>
      this.db
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.userId, userId))
        .orderBy(desc(gameSessions.lastPlayedAt))
    );
  }

  updateMetadata(
    sessionId: string,
    input: UpdateSessionMetadataInput
  ): Promise<GameSessionRecord> {
    return this.run(async () => {
      const updates: Partial<typeof gameSessions.$inferInsert> = {
        updatedAt: new Date()
      };

      if ("title" in input) {
        updates.title = input.title;
      }

      if (input.status) {
        updates.status = input.status;
      }

      return firstOrThrow(
        await this.db
          .update(gameSessions)
          .set(updates)
          .where(eq(gameSessions.id, sessionId))
          .returning(),
        new NotFoundError("Game session")
      );
    });
  }

  touchLastPlayedAt(sessionId: string, at = new Date()): Promise<GameSessionRecord> {
    return this.run(async () =>
      firstOrThrow(
        await this.db
          .update(gameSessions)
          .set({ lastPlayedAt: at, updatedAt: at })
          .where(eq(gameSessions.id, sessionId))
          .returning(),
        new NotFoundError("Game session")
      )
    );
  }

  incrementTurnCount(sessionId: string): Promise<GameSessionRecord> {
    return this.run(async () =>
      firstOrThrow(
        await this.db
          .update(gameSessions)
          .set({
            turnCount: sql`${gameSessions.turnCount} + 1`,
            updatedAt: new Date()
          })
          .where(eq(gameSessions.id, sessionId))
          .returning(),
        new NotFoundError("Game session")
      )
    );
  }
}

export class DrizzleGameMessageRepository
  extends BaseRepository
  implements GameMessageRepository
{
  append(input: AppendMessageInput): Promise<GameMessageRecord> {
    return this.run(async () =>
      firstOrThrow(
        await this.db.insert(gameMessages).values(input).returning(),
        new ConflictError("Game message could not be appended.")
      )
    );
  }

  getRecentMessages(
    sessionId: string,
    limit: number
  ): Promise<GameMessageRecord[]> {
    assertPositiveLimit(limit);
    return this.run(async () =>
      this.db
        .select()
        .from(gameMessages)
        .where(eq(gameMessages.sessionId, sessionId))
        .orderBy(desc(gameMessages.turnNumber), desc(gameMessages.createdAt))
        .limit(limit)
    );
  }

  getMessagesForSession(input: MessagePageInput): Promise<GameMessageRecord[]> {
    assertPositiveLimit(input.limit);
    return this.run(async () => {
      const predicates = [eq(gameMessages.sessionId, input.sessionId)];

      if (input.afterTurnNumber !== undefined) {
        predicates.push(gt(gameMessages.turnNumber, input.afterTurnNumber));
      }

      return this.db
        .select()
        .from(gameMessages)
        .where(and(...predicates))
        .orderBy(gameMessages.turnNumber, gameMessages.createdAt)
        .limit(input.limit);
    });
  }

  getLastTurnNumber(sessionId: string): Promise<number | null> {
    return this.run(async () => {
      const row = firstOrNull(
        await this.db
          .select({ turnNumber: gameMessages.turnNumber })
          .from(gameMessages)
          .where(eq(gameMessages.sessionId, sessionId))
          .orderBy(desc(gameMessages.turnNumber))
          .limit(1)
      );

      return row?.turnNumber ?? null;
    });
  }
}

export class DrizzleGameStateRepository
  extends BaseRepository
  implements GameStateRepository
{
  createInitialState(input: CreateInitialStateInput): Promise<GameStateRecord> {
    return this.run(async () =>
      firstOrThrow(
        await this.db.insert(gameStates).values(input).returning(),
        new ConflictError("Initial game state could not be created.")
      )
    );
  }

  getCurrentState(sessionId: string): Promise<GameStateRecord | null> {
    return this.run(async () =>
      firstOrNull(
        await this.db
          .select()
          .from(gameStates)
          .where(eq(gameStates.sessionId, sessionId))
          .limit(1)
      )
    );
  }

  updateStateWithVersion(input: UpdateStateInput): Promise<GameStateRecord> {
    return this.run(async () => {
      const updates = {
        version: sql`${gameStates.version} + 1`,
        updatedAt: new Date()
      };

      if (input.location !== undefined) {
        Object.assign(updates, { location: input.location });
      }

      if (input.worldTime !== undefined) {
        Object.assign(updates, { worldTime: input.worldTime });
      }

      if (input.playerStats !== undefined) {
        Object.assign(updates, { playerStats: input.playerStats });
      }

      if (input.flags !== undefined) {
        Object.assign(updates, { flags: input.flags });
      }

      if (input.stateData !== undefined) {
        Object.assign(updates, { stateData: input.stateData });
      }

      return firstOrThrow(
        await this.db
          .update(gameStates)
          .set(updates)
          .where(
            and(
              eq(gameStates.sessionId, input.sessionId),
              eq(gameStates.version, input.expectedVersion)
            )
          )
          .returning(),
        new StateVersionConflictError(input.sessionId, input.expectedVersion)
      );
    });
  }
}

export class DrizzleNPCRepository
  extends BaseRepository
  implements NPCRepository
{
  create(input: CreateNpcInput): Promise<NpcRecord> {
    return this.run(async () =>
      firstOrThrow(
        await this.db.insert(npcs).values(input).returning(),
        new ConflictError("NPC could not be created.")
      )
    );
  }

  listBySession(sessionId: string): Promise<NpcRecord[]> {
    return this.run(async () =>
      this.db.select().from(npcs).where(eq(npcs.sessionId, sessionId))
    );
  }

  getByIdForSession(sessionId: string, npcId: string): Promise<NpcRecord | null> {
    return this.run(async () =>
      firstOrNull(
        await this.db
          .select()
          .from(npcs)
          .where(and(eq(npcs.sessionId, sessionId), eq(npcs.id, npcId)))
          .limit(1)
      )
    );
  }

  updateRuntimeState(input: UpdateNpcRuntimeStateInput): Promise<NpcRecord> {
    return this.run(async () => {
      const updates: Partial<typeof npcs.$inferInsert> = {
        updatedAt: new Date()
      };

      if (input.personality !== undefined) {
        updates.personality = input.personality;
      }

      if (input.goals !== undefined) {
        updates.goals = input.goals;
      }

      if (input.secrets !== undefined) {
        updates.secrets = input.secrets;
      }

      if (input.currentState !== undefined) {
        updates.currentState = input.currentState;
      }

      if (input.alive !== undefined) {
        updates.alive = input.alive;
      }

      return firstOrThrow(
        await this.db
          .update(npcs)
          .set(updates)
          .where(and(eq(npcs.sessionId, input.sessionId), eq(npcs.id, input.npcId)))
          .returning(),
        new NotFoundError("NPC")
      );
    });
  }
}

export class DrizzleRelationshipRepository
  extends BaseRepository
  implements RelationshipRepository
{
  getRelationshipEdge(
    sessionId: string,
    source: EntityRef,
    target: EntityRef
  ): Promise<RelationshipRecord | null> {
    return this.run(async () =>
      firstOrNull(
        await this.db
          .select()
          .from(relationships)
          .where(
            and(
              eq(relationships.sessionId, sessionId),
              entityRefPredicate(relationships.sourceType, relationships.sourceId, source),
              entityRefPredicate(relationships.targetType, relationships.targetId, target)
            )
          )
          .limit(1)
      )
    );
  }

  listRelationshipsForEntity(
    sessionId: string,
    entity: EntityRef
  ): Promise<RelationshipRecord[]> {
    return this.run(async () =>
      this.db
        .select()
        .from(relationships)
        .where(
          and(
            eq(relationships.sessionId, sessionId),
            relationshipEntityPredicate(
              relationships.sourceType,
              relationships.sourceId,
              relationships.targetType,
              relationships.targetId,
              entity
            )
          )
        )
    );
  }

  upsertRelationship(input: UpsertRelationshipInput): Promise<RelationshipRecord> {
    return this.run(async () => {
      const sourceId = normalizeEntityId(input.source);
      const targetId = normalizeEntityId(input.target);
      const existing = await this.getRelationshipEdge(
        input.sessionId,
        input.source,
        input.target
      );

      const values = {
        sessionId: input.sessionId,
        sourceType: input.source.type,
        sourceId,
        targetType: input.target.type,
        targetId,
        affinity: input.affinity ?? 0,
        trust: input.trust ?? 0,
        fear: input.fear ?? 0,
        metadata: input.metadata ?? {},
        updatedAt: new Date()
      };

      if (existing) {
        return firstOrThrow(
          await this.db
            .update(relationships)
            .set(values)
            .where(eq(relationships.id, existing.id))
            .returning(),
          new ConflictError("Relationship could not be updated.")
        );
      }

      return firstOrThrow(
        await this.db.insert(relationships).values(values).returning(),
        new ConflictError("Relationship could not be created.")
      );
    });
  }
}

export class DrizzleInventoryRepository
  extends BaseRepository
  implements InventoryRepository
{
  listInventoryByOwner(
    sessionId: string,
    owner: EntityRef
  ): Promise<InventoryItemRecord[]> {
    return this.run(async () =>
      this.db
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.sessionId, sessionId),
            entityRefPredicate(inventoryItems.ownerType, inventoryItems.ownerId, owner)
          )
        )
    );
  }

  addOrUpdateQuantity(input: AddInventoryItemInput): Promise<InventoryItemRecord> {
    return this.run(async () => {
      if (!Number.isInteger(input.quantity) || input.quantity < 1) {
        throw new ValidationError("Inventory quantity must be a positive integer.");
      }

      const owner: EntityRef =
        input.ownerId === undefined
          ? { type: input.ownerType }
          : { type: input.ownerType, id: input.ownerId };
      const ownerId = normalizeEntityId(owner);
      const existing = firstOrNull(
        await this.db
          .select()
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.sessionId, input.sessionId),
              entityRefPredicate(inventoryItems.ownerType, inventoryItems.ownerId, owner),
              eq(inventoryItems.itemKey, input.itemKey)
            )
          )
          .limit(1)
      );

      if (existing) {
        return firstOrThrow(
          await this.db
            .update(inventoryItems)
            .set({
              quantity: existing.quantity + input.quantity,
              name: input.name,
              description: input.description,
              metadata: input.metadata ?? existing.metadata,
              updatedAt: new Date()
            })
            .where(eq(inventoryItems.id, existing.id))
            .returning(),
          new ConflictError("Inventory item could not be updated.")
        );
      }

      return firstOrThrow(
        await this.db
          .insert(inventoryItems)
          .values({ ...input, ownerId })
          .returning(),
        new ConflictError("Inventory item could not be added.")
      );
    });
  }

  changeQuantity(
    input: ChangeInventoryQuantityInput
  ): Promise<InventoryItemRecord | null> {
    return this.run(async () => {
      assertInventoryDelta(input.delta);
      const existing = firstOrNull(
        await this.db
          .select()
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.sessionId, input.sessionId),
              entityRefPredicate(
                inventoryItems.ownerType,
                inventoryItems.ownerId,
                input.owner
              ),
              eq(inventoryItems.itemKey, input.itemKey)
            )
          )
          .limit(1)
      );

      if (!existing) {
        throw new NotFoundError("Inventory item");
      }

      const nextQuantity = existing.quantity + input.delta;

      if (nextQuantity < 0) {
        throw new ConflictError("Inventory quantity cannot become negative.");
      }

      if (nextQuantity === 0) {
        await this.db
          .delete(inventoryItems)
          .where(eq(inventoryItems.id, existing.id));
        return null;
      }

      return firstOrThrow(
        await this.db
          .update(inventoryItems)
          .set({ quantity: nextQuantity, updatedAt: new Date() })
          .where(eq(inventoryItems.id, existing.id))
          .returning(),
        new ConflictError("Inventory item could not be updated.")
      );
    });
  }
}

export class DrizzleQuestRepository
  extends BaseRepository
  implements QuestRepository
{
  listSessionQuests(sessionId: string): Promise<QuestRecord[]> {
    return this.run(async () =>
      this.db.select().from(quests).where(eq(quests.sessionId, sessionId))
    );
  }

  getByQuestKey(sessionId: string, questKey: string): Promise<QuestRecord | null> {
    return this.run(async () =>
      firstOrNull(
        await this.db
          .select()
          .from(quests)
          .where(and(eq(quests.sessionId, sessionId), eq(quests.questKey, questKey)))
          .limit(1)
      )
    );
  }

  create(input: CreateQuestInput): Promise<QuestRecord> {
    return this.run(async () =>
      firstOrThrow(
        await this.db.insert(quests).values(input).returning(),
        new ConflictError("Quest could not be created.")
      )
    );
  }

  updateStatusOrProgress(input: UpdateQuestInput): Promise<QuestRecord> {
    return this.run(async () => {
      const updates: Partial<typeof quests.$inferInsert> = {
        updatedAt: new Date()
      };

      if (input.status !== undefined) {
        updates.status = input.status;
      }

      if (input.progress !== undefined) {
        updates.progress = input.progress;
      }

      return firstOrThrow(
        await this.db
          .update(quests)
          .set(updates)
          .where(and(eq(quests.sessionId, input.sessionId), eq(quests.questKey, input.questKey)))
          .returning(),
        new NotFoundError("Quest")
      );
    });
  }
}

export class DrizzleWorldEventRepository
  extends BaseRepository
  implements WorldEventRepository
{
  append(input: AppendWorldEventInput): Promise<WorldEventRecord> {
    return this.run(async () => {
      if (
        !Number.isInteger(input.importance) ||
        input.importance < 1 ||
        input.importance > 5
      ) {
        throw new ValidationError("World event importance must be between 1 and 5.");
      }

      return firstOrThrow(
        await this.db.insert(worldEvents).values(input).returning(),
        new ConflictError("World event could not be appended.")
      );
    });
  }

  getRecentEvents(sessionId: string, limit: number): Promise<WorldEventRecord[]> {
    assertPositiveLimit(limit);
    return this.run(async () =>
      this.db
        .select()
        .from(worldEvents)
        .where(eq(worldEvents.sessionId, sessionId))
        .orderBy(desc(worldEvents.turnNumber), desc(worldEvents.createdAt))
        .limit(limit)
    );
  }

  getImportantEvents(
    sessionId: string,
    minimumImportance: number,
    limit = 50
  ): Promise<WorldEventRecord[]> {
    assertPositiveLimit(limit);
    return this.run(async () => {
      if (
        !Number.isInteger(minimumImportance) ||
        minimumImportance < 1 ||
        minimumImportance > 5
      ) {
        throw new ValidationError("Minimum importance must be between 1 and 5.");
      }

      return this.db
        .select()
        .from(worldEvents)
        .where(
          and(
            eq(worldEvents.sessionId, sessionId),
            gte(worldEvents.importance, minimumImportance)
          )
        )
        .orderBy(desc(worldEvents.importance), desc(worldEvents.createdAt))
        .limit(limit);
    });
  }
}

export class DrizzleAIUsageRepository
  extends BaseRepository
  implements AIUsageRepository
{
  recordSuccess(
    input: Omit<RecordAIUsageInput, "status" | "errorCode">
  ): Promise<AIUsageRecordRecord> {
    return this.record({
      ...input,
      status: "success",
      errorCode: null
    });
  }

  recordFailure(
    input: Omit<RecordAIUsageInput, "status">
  ): Promise<AIUsageRecordRecord> {
    return this.record({
      ...input,
      status: "failed"
    });
  }

  getUsageForUser(
    input: AIUsageQueryInput & { readonly userId: string }
  ): Promise<AIUsageRecordRecord[]> {
    return this.listUsage({
      ...input,
      userId: input.userId
    });
  }

  getUsageForSession(
    input: AIUsageQueryInput & { readonly sessionId: string }
  ): Promise<AIUsageRecordRecord[]> {
    return this.listUsage({
      ...input,
      sessionId: input.sessionId
    });
  }

  getUserCostSince(userId: string, since: Date): Promise<number | null> {
    return this.sumCost({
      userId,
      since
    });
  }

  getSessionCostSince(sessionId: string, since: Date): Promise<number | null> {
    return this.sumCost({
      sessionId,
      since
    });
  }

  private record(input: RecordAIUsageInput): Promise<AIUsageRecordRecord> {
    return this.run(async () => {
      validateAIUsageInput(input);

      return firstOrThrow(
        await this.db.insert(aiUsageRecords).values(input).returning(),
        new ConflictError("AI usage record could not be created.")
      );
    });
  }

  private listUsage(input: AIUsageQueryInput): Promise<AIUsageRecordRecord[]> {
    const limit = input.limit ?? 100;
    assertPositiveLimit(limit);

    return this.run(async () =>
      this.db
        .select()
        .from(aiUsageRecords)
        .where(and(...aiUsagePredicates(input)))
        .orderBy(desc(aiUsageRecords.createdAt), desc(aiUsageRecords.id))
        .limit(limit)
    );
  }

  private async sumCost(input: AIUsageQueryInput): Promise<number | null> {
    const result = await this.run(async () =>
      firstOrNull(
        await this.db
          .select({
            total: sql<number>`coalesce(sum(${aiUsageRecords.estimatedCostMicros}), 0)::bigint`
          })
          .from(aiUsageRecords)
          .where(and(...aiUsagePredicates(input)))
      )
    );

    return result?.total ?? null;
  }
}

export class DrizzleSessionSummaryRepository
  extends BaseRepository
  implements SessionSummaryRepository
{
  getForSession(sessionId: string): Promise<SessionSummaryRecord | null> {
    return this.run(async () =>
      firstOrNull(
        await this.db
          .select()
          .from(sessionSummaries)
          .where(eq(sessionSummaries.sessionId, sessionId))
          .limit(1)
      )
    );
  }

  upsertSummary(input: UpsertSessionSummaryInput): Promise<SessionSummaryRecord> {
    return this.run(async () => {
      validateSummaryInput(input);
      const now = new Date();

      return firstOrThrow(
        await this.db
          .insert(sessionSummaries)
          .values({
            ...input,
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: sessionSummaries.sessionId,
            set: {
              summaryText: input.summaryText,
              summarizedThroughTurn: input.summarizedThroughTurn,
              version: sql`${sessionSummaries.version} + 1`,
              updatedAt: now
            }
          })
          .returning(),
        new ConflictError("Session summary could not be upserted.")
      );
    });
  }

  updateWithVersion(
    input: UpdateSessionSummaryWithVersionInput
  ): Promise<SessionSummaryRecord> {
    return this.run(async () => {
      validateSummaryInput(input);

      return firstOrThrow(
        await this.db
          .update(sessionSummaries)
          .set({
            summaryText: input.summaryText,
            summarizedThroughTurn: input.summarizedThroughTurn,
            version: sql`${sessionSummaries.version} + 1`,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(sessionSummaries.sessionId, input.sessionId),
              eq(sessionSummaries.version, input.expectedVersion)
            )
          )
          .returning(),
        new ConflictError("Session summary version conflict.")
      );
    });
  }
}

export class DrizzleMemoryRepository
  extends BaseRepository
  implements MemoryRepository
{
  createMemory(input: CreateMemoryInput): Promise<SessionMemoryRecord> {
    return this.run(async () => {
      validateMemoryInput(input);

      return firstOrThrow(
        await this.db.insert(sessionMemories).values(input).returning(),
        new ConflictError("Session memory could not be created.")
      );
    });
  }

  listActiveForSession(
    sessionId: string,
    limit: number
  ): Promise<SessionMemoryRecord[]> {
    assertPositiveLimit(limit);
    return this.run(async () =>
      this.db
        .select()
        .from(sessionMemories)
        .where(
          and(eq(sessionMemories.sessionId, sessionId), eq(sessionMemories.active, true))
        )
        .orderBy(desc(sessionMemories.lastConfirmedTurn), desc(sessionMemories.createdAt))
        .limit(limit)
    );
  }

  listImportantForSession(
    sessionId: string,
    limit: number
  ): Promise<SessionMemoryRecord[]> {
    assertPositiveLimit(limit);
    return this.run(async () =>
      this.db
        .select()
        .from(sessionMemories)
        .where(
          and(eq(sessionMemories.sessionId, sessionId), eq(sessionMemories.active, true))
        )
        .orderBy(
          desc(sessionMemories.importance),
          desc(sessionMemories.lastConfirmedTurn),
          desc(sessionMemories.updatedAt)
        )
        .limit(limit)
    );
  }

  findByKey(sessionId: string, key: string): Promise<SessionMemoryRecord | null> {
    return this.run(async () =>
      firstOrNull(
        await this.db
          .select()
          .from(sessionMemories)
          .where(and(eq(sessionMemories.sessionId, sessionId), eq(sessionMemories.key, key)))
          .limit(1)
      )
    );
  }

  deactivateMemory(
    sessionId: string,
    memoryId: string
  ): Promise<SessionMemoryRecord> {
    return this.updateMemory({
      sessionId,
      memoryId,
      active: false
    });
  }

  updateMemory(input: UpdateMemoryInput): Promise<SessionMemoryRecord> {
    return this.run(async () => {
      const updates: Partial<typeof sessionMemories.$inferInsert> = {
        updatedAt: new Date()
      };

      if (input.content !== undefined) {
        validateMemoryText(input.content);
        updates.content = input.content;
      }

      if (input.importance !== undefined) {
        validateImportance(input.importance);
        updates.importance = input.importance;
      }

      if (input.lastConfirmedTurn !== undefined) {
        updates.lastConfirmedTurn = input.lastConfirmedTurn;
      }

      if (input.active !== undefined) {
        updates.active = input.active;
      }

      if (input.metadata !== undefined) {
        updates.metadata = input.metadata;
      }

      return firstOrThrow(
        await this.db
          .update(sessionMemories)
          .set(updates)
          .where(
            and(
              eq(sessionMemories.sessionId, input.sessionId),
              eq(sessionMemories.id, input.memoryId)
            )
          )
          .returning(),
        new NotFoundError("Session memory")
      );
    });
  }

  confirmMemory(
    sessionId: string,
    memoryId: string,
    turnNumber: number
  ): Promise<SessionMemoryRecord> {
    if (!Number.isInteger(turnNumber) || turnNumber < 0) {
      throw new ValidationError("Memory turn number must be non-negative.");
    }

    return this.updateMemory({
      sessionId,
      memoryId,
      lastConfirmedTurn: turnNumber,
      active: true
    });
  }
}

export class DrizzleSemanticMemoryRepository
  extends BaseRepository
  implements SemanticMemoryRepository
{
  getEmbeddingForMemory(
    memoryId: string,
    provider: string,
    model: string
  ): Promise<MemoryEmbeddingRecord | null> {
    return this.run(async () =>
      firstOrNull(
        await this.db
          .select(memoryEmbeddingPublicColumns)
          .from(memoryEmbeddings)
          .where(
            and(
              eq(memoryEmbeddings.memoryId, memoryId),
              eq(memoryEmbeddings.provider, provider),
              eq(memoryEmbeddings.model, model)
            )
          )
          .limit(1)
      )
    );
  }

  upsertEmbedding(
    input: UpsertMemoryEmbeddingInput
  ): Promise<MemoryEmbeddingRecord> {
    return this.run(async () => {
      validateMemoryEmbeddingInput(input);
      const now = new Date();

      return firstOrThrow(
        await this.db
          .insert(memoryEmbeddings)
          .values({
            ...input,
            embedding: [...input.embedding],
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: [
              memoryEmbeddings.memoryId,
              memoryEmbeddings.provider,
              memoryEmbeddings.model
            ],
            set: {
              dimensions: input.dimensions,
              embedding: [...input.embedding],
              contentHash: input.contentHash,
              updatedAt: now
            }
          })
          .returning(memoryEmbeddingPublicColumns),
        new ConflictError("Memory embedding could not be upserted.")
      );
    });
  }

  listActiveMemoriesMissingEmbedding(
    provider: string,
    model: string,
    limit: number
  ): Promise<SessionMemoryRecord[]> {
    assertPositiveLimit(limit);

    return this.run(async () => {
      const rows = await this.db
        .select({ memory: sessionMemories })
        .from(sessionMemories)
        .leftJoin(
          memoryEmbeddings,
          and(
            eq(memoryEmbeddings.memoryId, sessionMemories.id),
            eq(memoryEmbeddings.provider, provider),
            eq(memoryEmbeddings.model, model)
          )
        )
        .where(
          and(
            eq(sessionMemories.active, true),
            isNull(memoryEmbeddings.id)
          )
        )
        .orderBy(desc(sessionMemories.importance), desc(sessionMemories.updatedAt))
        .limit(limit);

      return rows.map((row) => row.memory);
    });
  }

  searchSimilar(
    input: SearchSimilarMemoriesInput
  ): Promise<SemanticMemorySearchResult[]> {
    validateSemanticSearchInput(input);
    const vectorParam = vectorSqlParam(input.queryEmbedding);
    const similarity = sql<number>`(1 - (${memoryEmbeddings.embedding} <=> ${vectorParam}::vector))`;

    return this.run(async () => {
      const rows = await this.db
        .select({
          memory: sessionMemories,
          semanticScore: similarity
        })
        .from(memoryEmbeddings)
        .innerJoin(sessionMemories, eq(memoryEmbeddings.memoryId, sessionMemories.id))
        .where(
          and(
            eq(sessionMemories.sessionId, input.sessionId),
            input.activeOnly === false
              ? undefined
              : eq(sessionMemories.active, true),
            eq(memoryEmbeddings.provider, input.provider),
            eq(memoryEmbeddings.model, input.model),
            eq(memoryEmbeddings.dimensions, input.dimensions),
            gte(similarity, input.minScore)
          )
        )
        .orderBy(desc(similarity))
        .limit(input.limit);

      return rows.map((row) => ({
        memory: row.memory,
        semanticScore: row.semanticScore
      }));
    });
  }
}

function aiUsagePredicates(input: AIUsageQueryInput) {
  const predicates = [];

  if (input.userId) {
    predicates.push(eq(aiUsageRecords.userId, input.userId));
  }

  if (input.sessionId) {
    predicates.push(eq(aiUsageRecords.sessionId, input.sessionId));
  }

  if (input.since) {
    predicates.push(gte(aiUsageRecords.createdAt, input.since));
  }

  if (input.until) {
    predicates.push(lte(aiUsageRecords.createdAt, input.until));
  }

  return predicates;
}

function validateAIUsageInput(input: RecordAIUsageInput): void {
  if (!input.provider.trim() || !input.model.trim()) {
    throw new ValidationError("AI usage provider and model are required.");
  }

  for (const [field, value] of Object.entries({
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens: input.totalTokens,
    estimatedCostMicros: input.estimatedCostMicros,
    latencyMs: input.latencyMs
  })) {
    if (value !== null && value !== undefined && value < 0) {
      throw new ValidationError(`AI usage ${field} must be non-negative.`);
    }
  }
}

function validateSummaryInput(input: {
  readonly summaryText: string;
  readonly summarizedThroughTurn: number;
}): void {
  if (!input.summaryText.trim()) {
    throw new ValidationError("Session summary text is required.");
  }

  if (
    !Number.isInteger(input.summarizedThroughTurn) ||
    input.summarizedThroughTurn < 0
  ) {
    throw new ValidationError("Summarized turn must be non-negative.");
  }
}

function validateMemoryInput(input: CreateMemoryInput): void {
  validateMemoryText(input.content);
  validateImportance(input.importance);

  if (
    input.firstObservedTurn !== null &&
    input.firstObservedTurn !== undefined &&
    (!Number.isInteger(input.firstObservedTurn) || input.firstObservedTurn < 0)
  ) {
    throw new ValidationError("First observed turn must be non-negative.");
  }

  if (
    input.lastConfirmedTurn !== null &&
    input.lastConfirmedTurn !== undefined &&
    (!Number.isInteger(input.lastConfirmedTurn) || input.lastConfirmedTurn < 0)
  ) {
    throw new ValidationError("Last confirmed turn must be non-negative.");
  }
}

function validateMemoryEmbeddingInput(input: UpsertMemoryEmbeddingInput): void {
  if (!input.provider.trim() || !input.model.trim()) {
    throw new ValidationError("Memory embedding provider and model are required.");
  }

  if (!input.contentHash.trim()) {
    throw new ValidationError("Memory embedding content hash is required.");
  }

  if (!Number.isInteger(input.dimensions) || input.dimensions < 1) {
    throw new ValidationError("Memory embedding dimensions must be positive.");
  }

  validateEmbeddingVector(input.embedding, input.dimensions);
}

function validateSemanticSearchInput(input: SearchSimilarMemoriesInput): void {
  assertPositiveLimit(input.limit);

  if (!input.provider.trim() || !input.model.trim()) {
    throw new ValidationError("Semantic search provider and model are required.");
  }

  if (input.minScore < 0 || input.minScore > 1) {
    throw new ValidationError("Semantic search minimum score must be between 0 and 1.");
  }

  validateEmbeddingVector(input.queryEmbedding, input.dimensions);
}

function validateEmbeddingVector(
  embedding: readonly number[],
  dimensions: number
): void {
  if (
    embedding.length !== dimensions ||
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new ValidationError("Embedding vector dimensions are invalid.");
  }
}

function vectorSqlParam(embedding: readonly number[]): string {
  return `[${embedding.join(",")}]`;
}

function validateMemoryText(content: string): void {
  if (!content.trim() || content.length > 1000) {
    throw new ValidationError("Session memory content is invalid.");
  }
}

function validateImportance(importance: number): void {
  if (!Number.isInteger(importance) || importance < 1 || importance > 5) {
    throw new ValidationError("Memory importance must be between 1 and 5.");
  }
}

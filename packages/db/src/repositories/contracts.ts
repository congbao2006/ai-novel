import type {
  AddInventoryItemInput,
  AppendMessageInput,
  AppendWorldEventInput,
  AuthSessionRecord,
  AuthUserRecord,
  ChangeInventoryQuantityInput,
  CreateAuthSessionInput,
  CreateInitialStateInput,
  CreateNpcInput,
  CreateQuestInput,
  CreateSessionInput,
  CreateUserInput,
  EntityRef,
  GameMessageRecord,
  GameSessionRecord,
  GameStateRecord,
  InventoryItemRecord,
  MessagePageInput,
  NpcRecord,
  QuestRecord,
  RelationshipRecord,
  StoryRecord,
  UpdateNpcRuntimeStateInput,
  UpdateQuestInput,
  UpdateSessionMetadataInput,
  UpdateStateInput,
  UpsertRelationshipInput,
  UserRecord,
  WorldEventRecord
} from "./types.js";

export type UserRepository = {
  getById(id: string): Promise<UserRecord | null>;
  getByEmail(email: string): Promise<UserRecord | null>;
  getByEmailForAuth(email: string): Promise<AuthUserRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
};

export type AuthSessionRepository = {
  create(input: CreateAuthSessionInput): Promise<AuthSessionRecord>;
  getValidSessionByTokenHash(tokenHash: string, now?: Date): Promise<AuthSessionRecord | null>;
  revokeByTokenHash(tokenHash: string, now?: Date): Promise<void>;
  revokeAllForUser(userId: string, now?: Date): Promise<void>;
  touchLastUsedAt(sessionId: string, now?: Date): Promise<void>;
};

export type StoryRepository = {
  getById(id: string): Promise<StoryRecord | null>;
  getBySlug(slug: string): Promise<StoryRecord | null>;
  listPublished(limit?: number): Promise<StoryRecord[]>;
  listByGenre(genre: string, limit?: number): Promise<StoryRecord[]>;
  listCreatedByUser(userId: string): Promise<StoryRecord[]>;
};

export type GameSessionRepository = {
  create(input: CreateSessionInput): Promise<GameSessionRecord>;
  getById(id: string): Promise<GameSessionRecord | null>;
  listForUser(userId: string): Promise<GameSessionRecord[]>;
  updateMetadata(
    sessionId: string,
    input: UpdateSessionMetadataInput
  ): Promise<GameSessionRecord>;
  touchLastPlayedAt(sessionId: string, at?: Date): Promise<GameSessionRecord>;
  incrementTurnCount(sessionId: string): Promise<GameSessionRecord>;
};

export type GameMessageRepository = {
  append(input: AppendMessageInput): Promise<GameMessageRecord>;
  getRecentMessages(
    sessionId: string,
    limit: number
  ): Promise<GameMessageRecord[]>;
  getMessagesForSession(input: MessagePageInput): Promise<GameMessageRecord[]>;
  getLastTurnNumber(sessionId: string): Promise<number | null>;
};

export type GameStateRepository = {
  createInitialState(input: CreateInitialStateInput): Promise<GameStateRecord>;
  getCurrentState(sessionId: string): Promise<GameStateRecord | null>;
  updateStateWithVersion(input: UpdateStateInput): Promise<GameStateRecord>;
};

export type NPCRepository = {
  create(input: CreateNpcInput): Promise<NpcRecord>;
  listBySession(sessionId: string): Promise<NpcRecord[]>;
  getByIdForSession(sessionId: string, npcId: string): Promise<NpcRecord | null>;
  updateRuntimeState(input: UpdateNpcRuntimeStateInput): Promise<NpcRecord>;
};

export type RelationshipRepository = {
  getRelationshipEdge(
    sessionId: string,
    source: EntityRef,
    target: EntityRef
  ): Promise<RelationshipRecord | null>;
  listRelationshipsForEntity(
    sessionId: string,
    entity: EntityRef
  ): Promise<RelationshipRecord[]>;
  upsertRelationship(
    input: UpsertRelationshipInput
  ): Promise<RelationshipRecord>;
};

export type InventoryRepository = {
  listInventoryByOwner(
    sessionId: string,
    owner: EntityRef
  ): Promise<InventoryItemRecord[]>;
  addOrUpdateQuantity(input: AddInventoryItemInput): Promise<InventoryItemRecord>;
  changeQuantity(
    input: ChangeInventoryQuantityInput
  ): Promise<InventoryItemRecord | null>;
};

export type QuestRepository = {
  listSessionQuests(sessionId: string): Promise<QuestRecord[]>;
  getByQuestKey(sessionId: string, questKey: string): Promise<QuestRecord | null>;
  create(input: CreateQuestInput): Promise<QuestRecord>;
  updateStatusOrProgress(input: UpdateQuestInput): Promise<QuestRecord>;
};

export type WorldEventRepository = {
  append(input: AppendWorldEventInput): Promise<WorldEventRecord>;
  getRecentEvents(sessionId: string, limit: number): Promise<WorldEventRecord[]>;
  getImportantEvents(
    sessionId: string,
    minimumImportance: number,
    limit?: number
  ): Promise<WorldEventRecord[]>;
};

import type {
  AddInventoryItemInput,
  AIUsageQueryInput,
  AIUsageRecordRecord,
  AppendMessageInput,
  AppendWorldEventInput,
  AuthenticatedUserSessionRecord,
  AuthSessionRecord,
  AuthUserRecord,
  ChangeInventoryQuantityInput,
  CreateAuthSessionInput,
  AssignStoryCharacterAbilityInput,
  CreateFactionInput,
  CreateInitialStateInput,
  CreateMemoryInput,
  CreateNpcInput,
  CreateQuestInput,
  CreateSessionInput,
  CreateStoryInput,
  CreateStoryAbilityInput,
  CreateStoryCharacterInput,
  CreateStoryFactionInput,
  CreateStoryFactionRelationshipInput,
  CreateStoryVersionInput,
  CreateStoryVersionAbilityInput,
  CreateStoryVersionCharacterInput,
  CreateStoryVersionCharacterAbilityInput,
  CreateStoryVersionFactionInput,
  CreateStoryVersionFactionRelationshipInput,
  CreateUserInput,
  CreateWorldSimulationStateInput,
  EntityRef,
  FactionRecord,
  FactionRelationshipRecord,
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
  SessionListReferenceRecord,
  SessionSummaryRecord,
  StoryListItemRecord,
  StoryRecord,
  StoryAbilityRecord,
  StoryCharacterRecord,
  StoryCharacterAbilityRecord,
  StoryFactionRecord,
  StoryFactionRelationshipRecord,
  StoryListPageInput,
  StoryVersionCharacterRecord,
  StoryVersionAbilityRecord,
  StoryVersionCharacterAbilityRecord,
  StoryVersionFactionRecord,
  StoryVersionFactionRelationshipRecord,
  StoryVersionRecord,
  UpdateStoryCharacterInput,
  UpdateStoryAbilityInput,
  UpdateStoryFactionInput,
  UpdateStoryInput,
  UpdateNpcRuntimeStateInput,
  UpdateQuestInput,
  UpdateSessionMetadataInput,
  UpdateStateInput,
  UpdateMemoryInput,
  UpdateSessionSummaryWithVersionInput,
  UpdateWorldSimulationStateInput,
  UpsertFactionRelationshipInput,
  UpsertMemoryEmbeddingInput,
  UpsertSessionSummaryInput,
  UpsertRelationshipInput,
  UserRecord,
  UpdateFactionInput,
  WorldEventRecord,
  WorldSimulationStateRecord
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
  getValidUserSessionByTokenHash(
    tokenHash: string,
    now?: Date
  ): Promise<AuthenticatedUserSessionRecord | null>;
  revokeByTokenHash(tokenHash: string, now?: Date): Promise<void>;
  revokeAllForUser(userId: string, now?: Date): Promise<void>;
  touchLastUsedAt(sessionId: string, now?: Date): Promise<boolean>;
};

export type StoryRepository = {
  create(input: CreateStoryInput): Promise<StoryRecord>;
  getById(id: string): Promise<StoryRecord | null>;
  getBySlug(slug: string): Promise<StoryRecord | null>;
  update(storyId: string, input: UpdateStoryInput): Promise<StoryRecord>;
  listPublishedPage(input: StoryListPageInput): Promise<StoryRecord[]>;
  listPublishedListItemsPage(input: StoryListPageInput): Promise<StoryListItemRecord[]>;
  listPublished(limit?: number): Promise<StoryRecord[]>;
  listByGenre(genre: string, limit?: number): Promise<StoryRecord[]>;
  listCreatedByUser(userId: string): Promise<StoryRecord[]>;
  listCharactersForStory(storyId: string): Promise<StoryCharacterRecord[]>;
  listCharactersForStoryByType(
    storyId: string,
    characterType: StoryCharacterRecord["characterType"]
  ): Promise<StoryCharacterRecord[]>;
  createCharacter(input: CreateStoryCharacterInput): Promise<StoryCharacterRecord>;
  updateCharacter(input: UpdateStoryCharacterInput): Promise<StoryCharacterRecord>;
  deleteCharacter(storyId: string, characterId: string): Promise<void>;
  getCharacterForStory(
    storyId: string,
    characterId: string
  ): Promise<StoryCharacterRecord | null>;
};

export type StoryAbilityRepository = {
  create(input: CreateStoryAbilityInput): Promise<StoryAbilityRecord>;
  listForStory(storyId: string): Promise<StoryAbilityRecord[]>;
  getForStory(storyId: string, abilityId: string): Promise<StoryAbilityRecord | null>;
  getByKey(storyId: string, abilityKey: string): Promise<StoryAbilityRecord | null>;
  update(input: UpdateStoryAbilityInput): Promise<StoryAbilityRecord>;
  delete(storyId: string, abilityId: string): Promise<void>;
  assignToCharacter(
    input: AssignStoryCharacterAbilityInput
  ): Promise<StoryCharacterAbilityRecord>;
  listAssignmentsForStory(storyId: string): Promise<StoryCharacterAbilityRecord[]>;
  listAssignmentsForCharacter(characterId: string): Promise<StoryCharacterAbilityRecord[]>;
  removeFromCharacter(
    storyId: string,
    characterId: string,
    abilityId: string
  ): Promise<void>;
};

export type StoryFactionRepository = {
  create(input: CreateStoryFactionInput): Promise<StoryFactionRecord>;
  listForStory(storyId: string): Promise<StoryFactionRecord[]>;
  getForStory(storyId: string, factionId: string): Promise<StoryFactionRecord | null>;
  getByKey(storyId: string, factionKey: string): Promise<StoryFactionRecord | null>;
  update(input: UpdateStoryFactionInput): Promise<StoryFactionRecord>;
  delete(storyId: string, factionId: string): Promise<void>;
};

export type StoryFactionRelationshipRepository = {
  create(
    input: CreateStoryFactionRelationshipInput
  ): Promise<StoryFactionRelationshipRecord>;
  listForStory(storyId: string): Promise<StoryFactionRelationshipRecord[]>;
  delete(storyId: string, relationshipId: string): Promise<void>;
};

export type StoryVersionRepository = {
  create(input: CreateStoryVersionInput): Promise<StoryVersionRecord>;
  getById(versionId: string): Promise<StoryVersionRecord | null>;
  getCurrentPublishedVersion(storyId: string): Promise<StoryVersionRecord | null>;
  getLatestPublishedVersion(storyId: string): Promise<StoryVersionRecord | null>;
  listForStory(storyId: string): Promise<StoryVersionRecord[]>;
  getNextVersionNumber(storyId: string): Promise<number>;
  retireOtherPublishedVersions(
    storyId: string,
    currentVersionId: string
  ): Promise<void>;
};

export type StoryVersionCharacterRepository = {
  create(input: CreateStoryVersionCharacterInput): Promise<StoryVersionCharacterRecord>;
  listForVersion(versionId: string): Promise<StoryVersionCharacterRecord[]>;
  listForVersionByType(
    versionId: string,
    characterType: StoryVersionCharacterRecord["characterType"]
  ): Promise<StoryVersionCharacterRecord[]>;
  getForVersion(
    versionId: string,
    characterId: string
  ): Promise<StoryVersionCharacterRecord | null>;
};

export type StoryVersionAbilityRepository = {
  create(input: CreateStoryVersionAbilityInput): Promise<StoryVersionAbilityRecord>;
  listForVersion(versionId: string): Promise<StoryVersionAbilityRecord[]>;
};

export type StoryVersionCharacterAbilityRepository = {
  create(
    input: CreateStoryVersionCharacterAbilityInput
  ): Promise<StoryVersionCharacterAbilityRecord>;
  listForVersion(versionId: string): Promise<StoryVersionCharacterAbilityRecord[]>;
  listForVersionCharacter(
    versionCharacterId: string
  ): Promise<StoryVersionCharacterAbilityRecord[]>;
};

export type StoryVersionFactionRepository = {
  create(input: CreateStoryVersionFactionInput): Promise<StoryVersionFactionRecord>;
  listForVersion(versionId: string): Promise<StoryVersionFactionRecord[]>;
};

export type StoryVersionFactionRelationshipRepository = {
  create(
    input: CreateStoryVersionFactionRelationshipInput
  ): Promise<StoryVersionFactionRelationshipRecord>;
  listForVersion(versionId: string): Promise<StoryVersionFactionRelationshipRecord[]>;
};

export type GameSessionRepository = {
  create(input: CreateSessionInput): Promise<GameSessionRecord>;
  getById(id: string): Promise<GameSessionRecord | null>;
  listForUser(userId: string): Promise<GameSessionRecord[]>;
  listReferencesForUser(userId: string): Promise<SessionListReferenceRecord[]>;
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

export type FactionRepository = {
  create(input: CreateFactionInput): Promise<FactionRecord>;
  listBySession(sessionId: string): Promise<FactionRecord[]>;
  getByKey(sessionId: string, factionKey: string): Promise<FactionRecord | null>;
  getByIdForSession(sessionId: string, factionId: string): Promise<FactionRecord | null>;
  updateRuntimeState(input: UpdateFactionInput): Promise<FactionRecord>;
};

export type FactionRelationshipRepository = {
  listForSession(sessionId: string): Promise<FactionRelationshipRecord[]>;
  getRelation(
    sessionId: string,
    sourceFactionId: string,
    targetFactionId: string
  ): Promise<FactionRelationshipRecord | null>;
  upsertRelation(
    input: UpsertFactionRelationshipInput
  ): Promise<FactionRelationshipRecord>;
};

export type WorldSimulationStateRepository = {
  getForSession(sessionId: string): Promise<WorldSimulationStateRecord | null>;
  createInitial(
    input: CreateWorldSimulationStateInput
  ): Promise<WorldSimulationStateRecord>;
  updateAfterTickWithVersion(
    input: UpdateWorldSimulationStateInput
  ): Promise<WorldSimulationStateRecord>;
};

export type AIUsageRepository = {
  recordSuccess(
    input: Omit<RecordAIUsageInput, "status" | "errorCode">
  ): Promise<AIUsageRecordRecord>;
  recordFailure(
    input: Omit<RecordAIUsageInput, "status">
  ): Promise<AIUsageRecordRecord>;
  getUsageForUser(
    input: AIUsageQueryInput & { readonly userId: string }
  ): Promise<AIUsageRecordRecord[]>;
  getUsageForSession(
    input: AIUsageQueryInput & { readonly sessionId: string }
  ): Promise<AIUsageRecordRecord[]>;
  getUserCostSince(userId: string, since: Date): Promise<number | null>;
  getSessionCostSince(sessionId: string, since: Date): Promise<number | null>;
};

export type SessionSummaryRepository = {
  getForSession(sessionId: string): Promise<SessionSummaryRecord | null>;
  upsertSummary(input: UpsertSessionSummaryInput): Promise<SessionSummaryRecord>;
  updateWithVersion(
    input: UpdateSessionSummaryWithVersionInput
  ): Promise<SessionSummaryRecord>;
};

export type MemoryRepository = {
  createMemory(input: CreateMemoryInput): Promise<SessionMemoryRecord>;
  listActiveForSession(sessionId: string, limit: number): Promise<SessionMemoryRecord[]>;
  listImportantForSession(sessionId: string, limit: number): Promise<SessionMemoryRecord[]>;
  findByKey(sessionId: string, key: string): Promise<SessionMemoryRecord | null>;
  deactivateMemory(sessionId: string, memoryId: string): Promise<SessionMemoryRecord>;
  updateMemory(input: UpdateMemoryInput): Promise<SessionMemoryRecord>;
  confirmMemory(
    sessionId: string,
    memoryId: string,
    turnNumber: number
  ): Promise<SessionMemoryRecord>;
};

export type SemanticMemoryRepository = {
  getEmbeddingForMemory(
    memoryId: string,
    provider: string,
    model: string
  ): Promise<MemoryEmbeddingRecord | null>;
  upsertEmbedding(input: UpsertMemoryEmbeddingInput): Promise<MemoryEmbeddingRecord>;
  listActiveMemoriesMissingEmbedding(
    provider: string,
    model: string,
    limit: number
  ): Promise<SessionMemoryRecord[]>;
  searchSimilar(
    input: SearchSimilarMemoriesInput
  ): Promise<SemanticMemorySearchResult[]>;
};

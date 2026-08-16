import type {
  AIUsagePurpose,
  AIUsageStatus,
  EntityType,
  FactionStatus,
  MemoryType,
  MessageRole,
  QuestStatus,
  SessionStatus,
  StoryStatus
} from "@ai-novel/domain";
import type {
  AuthSession,
  AIUsageRecord as SchemaAIUsageRecord,
  GameMessage,
  GameSession,
  GameState,
  Faction,
  FactionRelationship,
  InventoryItem,
  MemoryEmbedding,
  NewMemoryEmbedding,
  NewGameMessage,
  NewGameSession,
  NewInventoryItem,
  NewAuthSession,
  NewAIUsageRecord,
  NewFaction,
  NewFactionRelationship,
  NewNpc,
  NewQuest,
  NewRelationship,
  NewStory,
  NewUser,
  NewWorldEvent,
  NewWorldSimulationState,
  Npc,
  Quest,
  Relationship,
  SessionMemory,
  SessionSummary,
  Story,
  StoryCharacter,
  User,
  WorldEvent,
  WorldSimulationState
} from "../schema/index.js";

export type {
  EntityType,
  MemoryType,
  MessageRole,
  QuestStatus,
  SessionStatus,
  StoryStatus
};
export type { AIUsagePurpose, AIUsageStatus, FactionStatus };

export type JsonObject = Record<string, unknown>;

export type UserRecord = Omit<User, "passwordHash">;
export type AuthUserRecord = User;
export type CreateUserInput = Pick<
  NewUser,
  "email" | "displayName" | "passwordHash"
>;

export type AuthSessionRecord = AuthSession;
export type CreateAuthSessionInput = Pick<
  NewAuthSession,
  "userId" | "tokenHash" | "expiresAt"
>;

export type StoryRecord = Story;
export type StoryCharacterRecord = StoryCharacter;
export type CreateStoryInput = Omit<NewStory, "id" | "createdAt" | "updatedAt">;
export type StoryListPageInput = {
  readonly genre?: string | undefined;
  readonly limit: number;
  readonly offset: number;
};

export type GameSessionRecord = GameSession;
export type CreateSessionInput = Pick<
  NewGameSession,
  "userId" | "storyId" | "selectedCharacterId" | "title"
>;
export type UpdateSessionMetadataInput = {
  readonly title?: string | null;
  readonly status?: SessionStatus;
};

export type GameMessageRecord = GameMessage;
export type AppendMessageInput = Pick<
  NewGameMessage,
  "sessionId" | "role" | "content" | "turnNumber"
>;
export type MessagePageInput = {
  readonly sessionId: string;
  readonly afterTurnNumber?: number;
  readonly limit: number;
};

export type GameStateRecord = GameState;
export type CreateInitialStateInput = {
  readonly sessionId: string;
  readonly location: string;
  readonly worldTime: string | null;
  readonly playerStats: JsonObject;
  readonly flags: JsonObject;
  readonly stateData: JsonObject;
};
export type UpdateStateInput = {
  readonly sessionId: string;
  readonly expectedVersion: number;
  readonly location?: string;
  readonly worldTime?: string | null;
  readonly playerStats?: JsonObject;
  readonly flags?: JsonObject;
  readonly stateData?: JsonObject;
};

export type NpcRecord = Npc;
export type CreateNpcInput = Pick<
  NewNpc,
  | "sessionId"
  | "templateCharacterId"
  | "name"
  | "description"
  | "personality"
  | "goals"
  | "secrets"
  | "currentState"
  | "alive"
>;
export type UpdateNpcRuntimeStateInput = {
  readonly sessionId: string;
  readonly npcId: string;
  readonly personality?: JsonObject;
  readonly goals?: unknown[];
  readonly secrets?: JsonObject;
  readonly currentState?: JsonObject;
  readonly alive?: boolean;
};

export type RelationshipRecord = Relationship;
export type EntityRef = {
  readonly type: EntityType;
  readonly id?: string | null;
};
export type UpsertRelationshipInput = {
  readonly sessionId: string;
  readonly source: EntityRef;
  readonly target: EntityRef;
  readonly affinity?: number;
  readonly trust?: number;
  readonly fear?: number;
  readonly metadata?: JsonObject;
};
export type CreateRelationshipInput = NewRelationship;

export type InventoryItemRecord = InventoryItem;
export type AddInventoryItemInput = Pick<
  NewInventoryItem,
  | "sessionId"
  | "ownerType"
  | "ownerId"
  | "itemKey"
  | "name"
  | "description"
  | "metadata"
> & {
  readonly quantity: number;
};
export type ChangeInventoryQuantityInput = {
  readonly sessionId: string;
  readonly owner: EntityRef;
  readonly itemKey: string;
  readonly delta: number;
};

export type QuestRecord = Quest;
export type CreateQuestInput = Pick<
  NewQuest,
  "sessionId" | "questKey" | "title" | "description" | "status" | "progress"
>;
export type UpdateQuestInput = {
  readonly sessionId: string;
  readonly questKey: string;
  readonly status?: QuestStatus;
  readonly progress?: JsonObject;
};

export type WorldEventRecord = WorldEvent;
export type AppendWorldEventInput = Pick<
  NewWorldEvent,
  "sessionId" | "eventType" | "title" | "description" | "payload" | "turnNumber"
> & {
  readonly importance: number;
};

export type FactionRecord = Faction;
export type CreateFactionInput = Pick<
  NewFaction,
  | "sessionId"
  | "factionKey"
  | "name"
  | "description"
  | "status"
  | "influence"
  | "resources"
  | "goals"
  | "state"
>;
export type UpdateFactionInput = {
  readonly sessionId: string;
  readonly factionId: string;
  readonly status?: FactionStatus;
  readonly influence?: number;
  readonly resources?: JsonObject;
  readonly goals?: unknown[];
  readonly state?: JsonObject;
};

export type FactionRelationshipRecord = FactionRelationship;
export type UpsertFactionRelationshipInput = Pick<
  NewFactionRelationship,
  | "sessionId"
  | "sourceFactionId"
  | "targetFactionId"
  | "affinity"
  | "tension"
  | "metadata"
>;

export type WorldSimulationStateRecord = WorldSimulationState;
export type CreateWorldSimulationStateInput = Pick<
  NewWorldSimulationState,
  "sessionId" | "lastTickTurn"
>;
export type UpdateWorldSimulationStateInput = {
  readonly sessionId: string;
  readonly expectedVersion: number;
  readonly lastTickTurn: number;
};

export type AIUsageRecordRecord = SchemaAIUsageRecord;
export type RecordAIUsageInput = Pick<
  NewAIUsageRecord,
  | "userId"
  | "sessionId"
  | "provider"
  | "model"
  | "purpose"
  | "status"
  | "inputTokens"
  | "outputTokens"
  | "totalTokens"
  | "estimatedCostMicros"
  | "latencyMs"
  | "providerRequestId"
  | "errorCode"
  | "createdAt"
>;
export type AIUsageQueryInput = {
  readonly userId?: string;
  readonly sessionId?: string;
  readonly since?: Date;
  readonly until?: Date;
  readonly limit?: number;
};

export type SessionSummaryRecord = SessionSummary;
export type UpsertSessionSummaryInput = {
  readonly sessionId: string;
  readonly summaryText: string;
  readonly summarizedThroughTurn: number;
};
export type UpdateSessionSummaryWithVersionInput = {
  readonly sessionId: string;
  readonly summaryText: string;
  readonly summarizedThroughTurn: number;
  readonly expectedVersion: number;
};

export type SessionMemoryRecord = SessionMemory;
export type CreateMemoryInput = {
  readonly sessionId: string;
  readonly memoryType: MemoryType;
  readonly subjectType: string | null;
  readonly subjectId: string | null;
  readonly key: string | null;
  readonly content: string;
  readonly importance: number;
  readonly firstObservedTurn: number | null;
  readonly lastConfirmedTurn: number | null;
  readonly metadata: JsonObject;
};
export type UpdateMemoryInput = {
  readonly sessionId: string;
  readonly memoryId: string;
  readonly content?: string;
  readonly importance?: number;
  readonly lastConfirmedTurn?: number | null;
  readonly active?: boolean;
  readonly metadata?: JsonObject;
};

export type MemoryEmbeddingRecord = Omit<MemoryEmbedding, "embedding">;
export type UpsertMemoryEmbeddingInput = Pick<
  NewMemoryEmbedding,
  "memoryId" | "provider" | "model" | "dimensions" | "contentHash"
> & {
  readonly embedding: readonly number[];
};
export type SearchSimilarMemoriesInput = {
  readonly sessionId: string;
  readonly provider: string;
  readonly model: string;
  readonly dimensions: number;
  readonly queryEmbedding: readonly number[];
  readonly limit: number;
  readonly minScore: number;
  readonly activeOnly?: boolean;
};
export type SemanticMemorySearchResult = {
  readonly memory: SessionMemoryRecord;
  readonly semanticScore: number;
};

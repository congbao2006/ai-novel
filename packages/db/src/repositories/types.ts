import type {
  EntityType,
  MessageRole,
  QuestStatus,
  SessionStatus,
  StoryStatus
} from "@ai-novel/domain";
import type {
  AuthSession,
  GameMessage,
  GameSession,
  GameState,
  InventoryItem,
  NewGameMessage,
  NewGameSession,
  NewGameState,
  NewInventoryItem,
  NewAuthSession,
  NewNpc,
  NewQuest,
  NewRelationship,
  NewStory,
  NewUser,
  NewWorldEvent,
  Npc,
  Quest,
  Relationship,
  Story,
  StoryCharacter,
  User,
  WorldEvent
} from "../schema/index.js";

export type { EntityType, MessageRole, QuestStatus, SessionStatus, StoryStatus };

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
export type CreateInitialStateInput = Pick<
  NewGameState,
  "sessionId" | "location" | "worldTime" | "playerStats" | "flags" | "stateData"
>;
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

export type EntityId = string;
export type StoryId = EntityId;
export type CharacterId = EntityId;
export type SessionId = EntityId;

export const storyStatuses = ["draft", "published", "archived"] as const;
export type StoryStatus = (typeof storyStatuses)[number];

export const sessionStatuses = ["active", "completed", "abandoned"] as const;
export type SessionStatus = (typeof sessionStatuses)[number];

export const messageRoles = ["system", "player", "assistant"] as const;
export type MessageRole = (typeof messageRoles)[number];

export const questStatuses = [
  "inactive",
  "active",
  "completed",
  "failed"
] as const;
export type QuestStatus = (typeof questStatuses)[number];

export const entityTypes = ["player", "npc"] as const;
export type EntityType = (typeof entityTypes)[number];

export type DomainModuleStatus = {
  readonly name: "domain";
  readonly gameplayImplemented: false;
  readonly databaseEnumsDefined: true;
};

export const domainModuleStatus: DomainModuleStatus = {
  name: "domain",
  gameplayImplemented: false,
  databaseEnumsDefined: true
};

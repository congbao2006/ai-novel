export type EntityId = string;
export type StoryId = EntityId;
export type CharacterId = EntityId;
export type SessionId = EntityId;

export type DomainModuleStatus = {
  readonly name: "domain";
  readonly gameplayImplemented: false;
};

export const domainModuleStatus: DomainModuleStatus = {
  name: "domain",
  gameplayImplemented: false
};

import type {
  GameMessageRecord,
  GameSessionRecord,
  GameStateRecord,
  FactionRecord,
  InventoryItemRecord,
  QuestRecord,
  StoryCharacterRecord,
  StoryRecord,
  WorldEventRecord
} from "@ai-novel/db";
import type { ConsequenceSummary } from "./consequence-engine.js";
import { toStoryCharacterDto, toStoryListItemDto } from "../stories/dto.js";

export type SessionStoryDto = ReturnType<typeof toStoryListItemDto>;
export type SessionCharacterDto = ReturnType<typeof toStoryCharacterDto>;

export type SessionListItemDto = {
  readonly id: string;
  readonly story: SessionStoryDto;
  readonly selectedCharacter: SessionCharacterDto | null;
  readonly status: string;
  readonly turnCount: number;
  readonly lastPlayedAt: string;
  readonly createdAt: string;
};

export type GameStateDto = {
  readonly id: string;
  readonly version: number;
  readonly location: string;
  readonly worldTime: string | null;
  readonly playerStats: Record<string, unknown>;
  readonly flags: Record<string, unknown>;
  readonly stateData: Record<string, unknown>;
  readonly updatedAt: string;
};

export type GameMessageDto = {
  readonly id: string;
  readonly role: string;
  readonly content: string;
  readonly turnNumber: number;
  readonly createdAt: string;
};

export type WorldEventDto = {
  readonly id: string;
  readonly eventType: string;
  readonly title: string;
  readonly description: string;
  readonly importance: number;
  readonly payload: Record<string, unknown>;
  readonly turnNumber: number;
  readonly createdAt: string;
};

export type QuestDto = {
  readonly questKey: string;
  readonly title: string;
  readonly description: string;
  readonly status: string;
  readonly progress: Record<string, unknown>;
  readonly updatedAt: string;
};

export type InventoryItemDto = {
  readonly itemKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly quantity: number;
  readonly metadata: Record<string, unknown>;
};

export type FactionDto = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly status: string;
  readonly influence: number;
  readonly resources: Record<string, unknown>;
  readonly goals: readonly unknown[];
};

export type SessionDetailDto = SessionListItemDto & {
  readonly currentState: GameStateDto | null;
  readonly recentMessages: GameMessageDto[];
};

export type SessionListResponseDto = {
  readonly sessions: SessionListItemDto[];
};

export type CreateSessionResponseDto = {
  readonly session: SessionDetailDto;
};

export type GameplayTurnResponseDto = {
  readonly turnNumber: number;
  readonly playerMessage: GameMessageDto;
  readonly resultMessage: GameMessageDto;
  readonly state: GameStateDto;
  readonly events: WorldEventDto[];
  readonly consequences?: readonly ConsequenceSummary[];
};

export type QuestListResponseDto = {
  readonly quests: QuestDto[];
};

export type InventoryResponseDto = {
  readonly items: InventoryItemDto[];
};

export type FactionListResponseDto = {
  readonly factions: FactionDto[];
};

export function toSessionListItemDto(input: {
  readonly session: GameSessionRecord;
  readonly story: StoryRecord;
  readonly character: StoryCharacterRecord | null;
}): SessionListItemDto {
  return {
    id: input.session.id,
    story: toStoryListItemDto(input.story),
    selectedCharacter: input.character
      ? toStoryCharacterDto(input.character)
      : null,
    status: input.session.status,
    turnCount: input.session.turnCount,
    lastPlayedAt: input.session.lastPlayedAt.toISOString(),
    createdAt: input.session.createdAt.toISOString()
  };
}

export function toGameStateDto(state: GameStateRecord): GameStateDto {
  return {
    id: state.id,
    version: state.version,
    location: state.location,
    worldTime: state.worldTime,
    playerStats: copyJsonObject(state.playerStats),
    flags: copyJsonObject(state.flags),
    stateData: copyJsonObject(state.stateData),
    updatedAt: state.updatedAt.toISOString()
  };
}

export function toGameMessageDto(message: GameMessageRecord): GameMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    turnNumber: message.turnNumber,
    createdAt: message.createdAt.toISOString()
  };
}

export function toWorldEventDto(event: WorldEventRecord): WorldEventDto {
  return {
    id: event.id,
    eventType: event.eventType,
    title: event.title,
    description: event.description,
    importance: event.importance,
    payload: copyJsonObject(event.payload),
    turnNumber: event.turnNumber,
    createdAt: event.createdAt.toISOString()
  };
}

export function toQuestDto(quest: QuestRecord): QuestDto {
  return {
    questKey: quest.questKey,
    title: quest.title,
    description: quest.description,
    status: quest.status,
    progress: copyJsonObject(quest.progress),
    updatedAt: quest.updatedAt.toISOString()
  };
}

export function toInventoryItemDto(item: InventoryItemRecord): InventoryItemDto {
  return {
    itemKey: item.itemKey,
    name: item.name,
    description: item.description ?? null,
    quantity: item.quantity,
    metadata: copyJsonObject(item.metadata)
  };
}

export function toFactionDto(faction: FactionRecord): FactionDto {
  return {
    id: faction.id,
    key: faction.factionKey,
    name: faction.name,
    description: faction.description,
    status: faction.status,
    influence: faction.influence,
    resources: copyJsonObject(faction.resources),
    goals: JSON.parse(JSON.stringify(faction.goals)) as unknown[]
  };
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

import type {
  GameMessageRecord,
  GameSessionRecord,
  GameStateRecord,
  StoryCharacterRecord,
  StoryRecord,
  WorldEventRecord
} from "@ai-novel/db";
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

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

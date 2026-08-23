import type {
  GameMessageRecord,
  GameSessionRecord,
  GameStateRecord,
  FactionRecord,
  InventoryItemRecord,
  QuestRecord,
  StoryCharacterRecord,
  StoryRecord,
  StoryVersionCharacterRecord,
  StoryVersionRecord,
  WorldEventRecord
} from "@ai-novel/db";
import type { AbilityAttempt } from "@ai-novel/domain";
import type { ConsequenceSummary } from "./consequence-engine.js";
import { toStoryCharacterDto, toStoryListItemDto } from "../stories/dto.js";

export type SessionStoryDto = ReturnType<typeof toStoryListItemDto>;
export type SessionCharacterDto = ReturnType<typeof toStoryCharacterDto>;

export type SessionListItemDto = {
  readonly id: string;
  readonly story: SessionStoryDto;
  readonly selectedCharacter: SessionCharacterDto | null;
  readonly status: string;
  readonly storyVersionId: string | null;
  readonly storyVersionNumber: number | null;
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
  readonly abilityAttempt?: AbilityAttemptDto | null;
};

export type AbilityAttemptDto = {
  readonly turnNumber: number;
  readonly requestedName: string | null;
  readonly requestedKey: string | null;
  readonly matchedAbilityKey: string | null;
  readonly authorized: boolean;
  readonly reason: AbilityAttempt["reason"];
  readonly cooldownRemaining: number | null;
  readonly resourceCost: AbilityAttempt["resourceCost"] | null;
  readonly abilityName: string | null;
  readonly abilityKey: string | null;
  readonly cooldownApplied: number | null;
  readonly noAbilityStateMutation: boolean;
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
  readonly abilityAttempt?: AbilityAttemptDto | null;
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
  readonly character: StoryCharacterRecord | StoryVersionCharacterRecord | null;
  readonly storyVersion?: StoryVersionRecord | null;
}): SessionListItemDto {
  return {
    id: input.session.id,
    story: toStoryListItemDto(input.story),
    selectedCharacter: input.character
      ? toStoryCharacterDto(input.character)
      : null,
    status: input.session.status,
    storyVersionId: input.storyVersion?.id ?? input.session.storyVersionId,
    storyVersionNumber: input.storyVersion?.versionNumber ?? null,
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

export function toGameMessageDto(
  message: GameMessageRecord,
  abilityAttemptsByTurn: ReadonlyMap<number, AbilityAttemptDto> = new Map()
): GameMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    turnNumber: message.turnNumber,
    createdAt: message.createdAt.toISOString(),
    abilityAttempt:
      message.role === "player"
        ? abilityAttemptsByTurn.get(message.turnNumber) ?? null
        : null
  };
}

export function abilityAttemptsByTurnFromStateData(
  stateData: Record<string, unknown>
): ReadonlyMap<number, AbilityAttemptDto> {
  const attempts = Array.isArray(stateData.abilityAttempts)
    ? stateData.abilityAttempts
    : [];
  return new Map(
    attempts.flatMap((attempt) => {
      if (!attempt || typeof attempt !== "object") return [];
      const record = attempt as Record<string, unknown>;
      if (
        typeof record.turnNumber !== "number" ||
        typeof record.authorized !== "boolean" ||
        typeof record.reason !== "string"
      ) {
        return [];
      }

      return [
        [
          record.turnNumber,
          {
            turnNumber: record.turnNumber,
            requestedName:
              typeof record.requestedName === "string"
                ? record.requestedName
                : null,
            requestedKey:
              typeof record.requestedKey === "string" ? record.requestedKey : null,
            matchedAbilityKey:
              typeof record.matchedAbilityKey === "string"
                ? record.matchedAbilityKey
                : null,
            authorized: record.authorized,
            reason: record.reason as AbilityAttempt["reason"],
            cooldownRemaining:
              typeof record.cooldownRemaining === "number"
                ? record.cooldownRemaining
                : null,
            resourceCost:
              record.resourceCost &&
              typeof record.resourceCost === "object" &&
              !Array.isArray(record.resourceCost)
                ? (record.resourceCost as AbilityAttempt["resourceCost"])
                : null,
            abilityName:
              typeof record.abilityName === "string" ? record.abilityName : null,
            abilityKey:
              typeof record.abilityKey === "string" ? record.abilityKey : null,
            cooldownApplied:
              typeof record.cooldownApplied === "number"
                ? record.cooldownApplied
                : null,
            noAbilityStateMutation: record.noAbilityStateMutation !== false
          }
        ] as const
      ];
    })
  );
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

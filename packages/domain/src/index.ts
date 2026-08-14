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

export type PlayerAction = {
  readonly text: string;
};

export type GameStateSnapshot = {
  readonly version: number;
  readonly location: string;
  readonly worldTime: string | null;
  readonly playerStats: Record<string, unknown>;
  readonly flags: Record<string, unknown>;
  readonly stateData: Record<string, unknown>;
};

export type TurnStoryContext = {
  readonly id: StoryId;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly genre: string;
};

export type TurnCharacterContext = {
  readonly id: CharacterId;
  readonly name: string;
  readonly description: string;
};

export type TurnContext = {
  readonly story: TurnStoryContext;
  readonly character: TurnCharacterContext | null;
  readonly state: GameStateSnapshot;
  readonly turnNumber: number;
};

export type DeterministicCommand =
  | "look"
  | "move"
  | "rest"
  | "status"
  | "fallback";

export type StatePatch = {
  readonly location?: string;
  readonly worldTime?: string | null;
  readonly playerStats?: Record<string, unknown>;
  readonly flags?: Record<string, unknown>;
  readonly stateData?: Record<string, unknown>;
};

export type GeneratedWorldEvent = {
  readonly eventType: string;
  readonly title: string;
  readonly description: string;
  readonly importance: number;
  readonly payload: Record<string, unknown>;
};

export type TurnResult = {
  readonly command: DeterministicCommand;
  readonly normalizedAction: string;
  readonly resultText: string;
  readonly statePatch: StatePatch;
  readonly events: GeneratedWorldEvent[];
};

export const maxPlayerActionLength = 2000;

export function normalizePlayerAction(action: PlayerAction): string {
  return action.text.trim().replace(/\s+/g, " ");
}

export function runDeterministicTurn(
  action: PlayerAction,
  context: TurnContext
): TurnResult {
  const normalizedAction = normalizePlayerAction(action);
  const parsed = parseDeterministicCommand(normalizedAction);

  if (parsed.command === "look") {
    return {
      command: "look",
      normalizedAction,
      resultText: `Bạn quan sát ${context.state.location}. ${context.story.title} vẫn đang mở ra quanh bạn, yên lặng chờ hành động tiếp theo.`,
      statePatch: {
        stateData: {
          ...copyJsonObject(context.state.stateData),
          lastCommand: "look"
        }
      },
      events: []
    };
  }

  if (parsed.command === "status") {
    const characterName = context.character?.name ?? "Nhân vật";
    return {
      command: "status",
      normalizedAction,
      resultText: `${characterName} đang ở ${context.state.location}. Turn hiện tại: ${context.turnNumber}.`,
      statePatch: {
        stateData: {
          ...copyJsonObject(context.state.stateData),
          lastCommand: "status"
        }
      },
      events: []
    };
  }

  if (parsed.command === "rest") {
    const stateData = copyJsonObject(context.state.stateData);
    const restCount = numberFromUnknown(stateData.restCount) + 1;
    return {
      command: "rest",
      normalizedAction,
      resultText: `Bạn nghỉ lại ở ${context.state.location}. Hơi thở chậm hơn, đầu óc rõ ràng hơn.`,
      statePatch: {
        stateData: {
          ...stateData,
          lastCommand: "rest",
          restCount
        }
      },
      events: []
    };
  }

  if (parsed.command === "move") {
    const destination = parsed.destination;
    return {
      command: "move",
      normalizedAction,
      resultText: `Bạn rời ${context.state.location} và đi đến ${destination}.`,
      statePatch: {
        location: destination,
        stateData: {
          ...copyJsonObject(context.state.stateData),
          lastCommand: "move",
          previousLocation: context.state.location
        }
      },
      events: [
        {
          eventType: "movement",
          title: "Di chuyển",
          description: `Người chơi di chuyển từ ${context.state.location} đến ${destination}.`,
          importance: 1,
          payload: {
            from: context.state.location,
            to: destination
          }
        }
      ]
    };
  }

  return {
    command: "fallback",
    normalizedAction,
    resultText: `Hành động của bạn được ghi nhận, nhưng engine deterministic hiện chưa hiểu lệnh này. Thế giới chưa thay đổi đáng kể.`,
    statePatch: {
      stateData: {
        ...copyJsonObject(context.state.stateData),
        lastCommand: "fallback"
      }
    },
    events: []
  };
}

function parseDeterministicCommand(action: string):
  | { readonly command: "look" | "rest" | "status" | "fallback" }
  | { readonly command: "move"; readonly destination: string } {
  const lower = action.toLowerCase();

  if (["look", "quan sát", "quan sat", "nhìn", "nhin"].includes(lower)) {
    return { command: "look" };
  }

  if (["rest", "nghỉ", "nghi"].includes(lower)) {
    return { command: "rest" };
  }

  if (["status", "trạng thái", "trang thai"].includes(lower)) {
    return { command: "status" };
  }

  const moveMatch = /^(?:move|go|đi|di)\s+(.+)$/i.exec(action);
  const destination = moveMatch?.[1]?.trim();

  if (destination) {
    return {
      command: "move",
      destination
    };
  }

  return { command: "fallback" };
}

function numberFromUnknown(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export type DomainModuleStatus = {
  readonly name: "domain";
  readonly gameplayImplemented: "deterministic";
  readonly databaseEnumsDefined: true;
};

export const domainModuleStatus: DomainModuleStatus = {
  name: "domain",
  gameplayImplemented: "deterministic",
  databaseEnumsDefined: true
};

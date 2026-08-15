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

export type AITurnStatePatch = {
  readonly location?: string;
  readonly playerStats?: Record<string, unknown>;
  readonly flags?: Record<string, unknown>;
  readonly stateData?: Record<string, unknown>;
};

export type AITurnEventProposal = {
  readonly eventType: string;
  readonly title: string;
  readonly description: string;
  readonly importance: number;
};

export type AITurnProposal = {
  readonly narrative: string;
  readonly proposedStatePatch: AITurnStatePatch;
  readonly proposedEvents: readonly AITurnEventProposal[];
};

export type ValidatedAITurnProposal = {
  readonly resultText: string;
  readonly statePatch: StatePatch;
  readonly events: GeneratedWorldEvent[];
};

export class AITurnProposalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AITurnProposalValidationError";
  }
}

export const aiTurnProposalLimits = {
  narrativeMaxLength: 4000,
  locationMaxLength: 120,
  stateObjectMaxKeys: 10,
  stateStringMaxLength: 500,
  eventMaxCount: 5,
  eventTypeMaxLength: 80,
  eventTitleMaxLength: 120,
  eventDescriptionMaxLength: 1000
} as const;

export const aiTurnProposalJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["narrative", "proposedStatePatch", "proposedEvents"],
  properties: {
    narrative: {
      type: "string",
      minLength: 1,
      maxLength: aiTurnProposalLimits.narrativeMaxLength
    },
    proposedStatePatch: {
      type: "object",
      additionalProperties: false,
      properties: {
        location: {
          type: "string",
          minLength: 1,
          maxLength: aiTurnProposalLimits.locationMaxLength
        },
        playerStats: {
          type: "object",
          additionalProperties: {
            type: "number"
          }
        },
        flags: {
          type: "object",
          additionalProperties: {
            anyOf: [
              { type: "string", maxLength: aiTurnProposalLimits.stateStringMaxLength },
              { type: "number" },
              { type: "boolean" },
              { type: "null" }
            ]
          }
        },
        stateData: {
          type: "object",
          additionalProperties: {
            anyOf: [
              { type: "string", maxLength: aiTurnProposalLimits.stateStringMaxLength },
              { type: "number" },
              { type: "boolean" },
              { type: "null" }
            ]
          }
        }
      }
    },
    proposedEvents: {
      type: "array",
      maxItems: aiTurnProposalLimits.eventMaxCount,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["eventType", "title", "description", "importance"],
        properties: {
          eventType: {
            type: "string",
            minLength: 1,
            maxLength: aiTurnProposalLimits.eventTypeMaxLength
          },
          title: {
            type: "string",
            minLength: 1,
            maxLength: aiTurnProposalLimits.eventTitleMaxLength
          },
          description: {
            type: "string",
            minLength: 1,
            maxLength: aiTurnProposalLimits.eventDescriptionMaxLength
          },
          importance: {
            type: "integer",
            minimum: 1,
            maximum: 5
          }
        }
      }
    }
  }
} as const;

const forbiddenStatePatchKeys = new Set([
  "id",
  "sessionId",
  "userId",
  "version",
  "turnCount",
  "createdAt",
  "updatedAt",
  "passwordHash",
  "tokenHash",
  "authSessionId"
]);

const allowedAIFlagKeys = new Set(["aiSceneTone"]);
const allowedAIStateDataKeys = new Set([
  "aiLastActionSummary",
  "aiSceneSummary"
]);

export function validateAITurnProposal(
  proposal: unknown,
  currentState: GameStateSnapshot
): ValidatedAITurnProposal {
  const record = expectRecord(proposal, "AI turn proposal");
  assertOnlyKeys(record, ["narrative", "proposedStatePatch", "proposedEvents"]);

  const narrative = validateText(
    record.narrative,
    "narrative",
    aiTurnProposalLimits.narrativeMaxLength
  );
  const patch = validateAITurnStatePatch(
    record.proposedStatePatch,
    currentState
  );
  const events = validateAITurnEvents(record.proposedEvents);

  return {
    resultText: narrative,
    statePatch: patch,
    events
  };
}

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

function validateAITurnStatePatch(
  value: unknown,
  currentState: GameStateSnapshot
): StatePatch {
  const patch = expectRecord(value, "proposedStatePatch");
  assertOnlyKeys(patch, ["location", "playerStats", "flags", "stateData"]);
  assertNoForbiddenKeys(patch, "proposedStatePatch");

  const validated: StatePatch = {};

  if (patch.location !== undefined) {
    const location = validateText(
      patch.location,
      "location",
      aiTurnProposalLimits.locationMaxLength
    );

    Object.assign(validated, { location });
  }

  if (patch.playerStats !== undefined) {
    Object.assign(validated, {
      playerStats: validateAIPlayerStatsPatch(
        patch.playerStats,
        currentState.playerStats
      )
    });
  }

  if (patch.flags !== undefined) {
    Object.assign(validated, {
      flags: {
        ...copyJsonObject(currentState.flags),
        ...validateAISafeObjectPatch(
          patch.flags,
          allowedAIFlagKeys,
          "flags"
        )
      }
    });
  }

  if (patch.stateData !== undefined) {
    Object.assign(validated, {
      stateData: {
        ...copyJsonObject(currentState.stateData),
        ...validateAISafeObjectPatch(
          patch.stateData,
          allowedAIStateDataKeys,
          "stateData"
        )
      }
    });
  }

  return validated;
}

function validateAIPlayerStatsPatch(
  value: unknown,
  currentPlayerStats: Record<string, unknown>
): Record<string, unknown> {
  const patch = expectRecord(value, "playerStats");
  assertObjectSize(patch, "playerStats");
  assertNoForbiddenKeys(patch, "playerStats");

  const nextStats = copyJsonObject(currentPlayerStats);

  for (const [key, nextValue] of Object.entries(patch)) {
    if (!(key in currentPlayerStats)) {
      throw new AITurnProposalValidationError(
        `AI cannot create unknown player stat: ${key}.`
      );
    }

    if (typeof currentPlayerStats[key] !== "number") {
      throw new AITurnProposalValidationError(
        `AI can only update numeric player stat: ${key}.`
      );
    }

    if (typeof nextValue !== "number" || !Number.isFinite(nextValue)) {
      throw new AITurnProposalValidationError(
        `AI player stat must be a finite number: ${key}.`
      );
    }

    nextStats[key] = nextValue;
  }

  return nextStats;
}

function validateAISafeObjectPatch(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
  path: string
): Record<string, unknown> {
  const patch = expectRecord(value, path);
  assertObjectSize(patch, path);
  assertNoForbiddenKeys(patch, path);

  const validated: Record<string, unknown> = {};

  for (const [key, nextValue] of Object.entries(patch)) {
    if (!allowedKeys.has(key)) {
      throw new AITurnProposalValidationError(
        `AI cannot update ${path} key: ${key}.`
      );
    }

    validated[key] = validateScalarJsonValue(nextValue, `${path}.${key}`);
  }

  return validated;
}

function validateAITurnEvents(value: unknown): GeneratedWorldEvent[] {
  if (!Array.isArray(value)) {
    throw new AITurnProposalValidationError("proposedEvents must be an array.");
  }

  if (value.length > aiTurnProposalLimits.eventMaxCount) {
    throw new AITurnProposalValidationError("AI proposed too many events.");
  }

  return value.map((event, index) => {
    const record = expectRecord(event, `proposedEvents[${index}]`);
    assertOnlyKeys(record, ["eventType", "title", "description", "importance"]);

    const importance = record.importance;

    if (
      !Number.isInteger(importance) ||
      (importance as number) < 1 ||
      (importance as number) > 5
    ) {
      throw new AITurnProposalValidationError(
        `Event importance is invalid at index ${index}.`
      );
    }

    return {
      eventType: validateText(
        record.eventType,
        `proposedEvents[${index}].eventType`,
        aiTurnProposalLimits.eventTypeMaxLength
      ),
      title: validateText(
        record.title,
        `proposedEvents[${index}].title`,
        aiTurnProposalLimits.eventTitleMaxLength
      ),
      description: validateText(
        record.description,
        `proposedEvents[${index}].description`,
        aiTurnProposalLimits.eventDescriptionMaxLength
      ),
      importance: importance as number,
      payload: {
        source: "ai"
      }
    };
  });
}

function validateText(value: unknown, path: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new AITurnProposalValidationError(`${path} must be a string.`);
  }

  const text = value.trim();

  if (!text || text.length > maxLength || hasControlCharacters(text)) {
    throw new AITurnProposalValidationError(`${path} is invalid.`);
  }

  return text;
}

function validateScalarJsonValue(value: unknown, path: string): unknown {
  if (value === null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new AITurnProposalValidationError(`${path} must be finite.`);
    }

    return value;
  }

  if (typeof value === "string") {
    return validateText(value, path, aiTurnProposalLimits.stateStringMaxLength);
  }

  throw new AITurnProposalValidationError(`${path} must be a scalar JSON value.`);
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AITurnProposalValidationError(`${path} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[]
): void {
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new AITurnProposalValidationError(`Unexpected AI proposal key: ${key}.`);
    }
  }
}

function assertObjectSize(value: Record<string, unknown>, path: string): void {
  if (Object.keys(value).length > aiTurnProposalLimits.stateObjectMaxKeys) {
    throw new AITurnProposalValidationError(`${path} has too many keys.`);
  }
}

function assertNoForbiddenKeys(
  value: Record<string, unknown>,
  path: string
): void {
  for (const key of Object.keys(value)) {
    if (forbiddenStatePatchKeys.has(key)) {
      throw new AITurnProposalValidationError(
        `AI cannot update protected key ${path}.${key}.`
      );
    }
  }
}

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return (
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f
    );
  });
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

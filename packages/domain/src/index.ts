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

export const aiUsagePurposes = [
  "gameplay_turn",
  "smoke",
  "summary",
  "npc",
  "memory",
  "embedding",
  "other"
] as const;
export type AIUsagePurpose = (typeof aiUsagePurposes)[number];

export const aiUsageStatuses = ["success", "failed"] as const;
export type AIUsageStatus = (typeof aiUsageStatuses)[number];

export const memoryTypes = [
  "fact",
  "relationship",
  "event",
  "player",
  "world",
  "npc",
  "quest",
  "other"
] as const;
export type MemoryType = (typeof memoryTypes)[number];

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

export type SessionSummary = {
  readonly sessionId: SessionId;
  readonly summaryText: string;
  readonly summarizedThroughTurn: number;
  readonly version: number;
};

export type PersistentMemory = {
  readonly id: EntityId;
  readonly sessionId: SessionId;
  readonly memoryType: MemoryType;
  readonly subjectType: string | null;
  readonly subjectId: string | null;
  readonly key: string | null;
  readonly content: string;
  readonly importance: number;
  readonly firstObservedTurn: number | null;
  readonly lastConfirmedTurn: number | null;
  readonly active: boolean;
  readonly metadata: Record<string, unknown>;
};

export type MemoryCandidate = {
  readonly memoryType: MemoryType;
  readonly key?: string | null;
  readonly content: string;
  readonly importance: number;
  readonly subjectType?: string | null;
  readonly subjectId?: string | null;
  readonly metadata?: Record<string, unknown>;
};

export type MemoryContextMessage = {
  readonly role: MessageRole;
  readonly content: string;
  readonly turnNumber: number;
};

export type MemoryContextWorldEvent = {
  readonly eventType: string;
  readonly title: string;
  readonly description: string;
  readonly importance: number;
  readonly turnNumber: number;
};

export type ContextBundle = {
  readonly state: GameStateSnapshot;
  readonly recentMessages: readonly MemoryContextMessage[];
  readonly summary: SessionSummary | null;
  readonly memories: readonly PersistentMemory[];
  readonly worldEvents: readonly MemoryContextWorldEvent[];
  readonly budget: {
    readonly maxRecentMessages: number;
    readonly maxMemories: number;
    readonly maxWorldEvents: number;
    readonly maxSummaryChars: number;
    readonly maxMemoryChars: number;
  };
};

export type SummaryOutput = {
  readonly summary: string;
  readonly importantFacts: readonly MemoryCandidate[];
};

export const npcActionTypes = [
  "speak",
  "observe",
  "move",
  "refuse",
  "assist",
  "threaten",
  "flee",
  "attack_intent",
  "give_item_intent",
  "custom_narrative"
] as const;
export type NPCActionType = (typeof npcActionTypes)[number];

export type NPCRuntimeProfile = {
  readonly id: EntityId;
  readonly sessionId: SessionId;
  readonly templateCharacterId: CharacterId | null;
  readonly name: string;
  readonly description: string;
  readonly personality: Record<string, unknown>;
  readonly goals: readonly unknown[];
  readonly secrets: Record<string, unknown>;
  readonly currentState: Record<string, unknown>;
  readonly alive: boolean;
};

export type NPCRelationshipContext = {
  readonly sourceType: EntityType;
  readonly sourceId: EntityId | null;
  readonly targetType: EntityType;
  readonly targetId: EntityId | null;
  readonly affinity: number;
  readonly trust: number;
  readonly fear: number;
};

export type NPCKnowledgeFact = {
  readonly memoryType: MemoryType;
  readonly content: string;
  readonly importance: number;
  readonly lastConfirmedTurn: number | null;
};

export type NPCDecisionContext = {
  readonly npc: NPCRuntimeProfile;
  readonly currentState: Pick<GameStateSnapshot, "location" | "worldTime" | "flags" | "stateData">;
  readonly relationshipWithPlayer: NPCRelationshipContext | null;
  readonly memories: readonly NPCKnowledgeFact[];
  readonly recentMessages: readonly MemoryContextMessage[];
  readonly worldEvents: readonly MemoryContextWorldEvent[];
  readonly playerAction: string;
  readonly turnNumber: number;
};

export type NPCActionProposal = {
  readonly type: NPCActionType;
  readonly description: string;
};

export type NPCRelationshipDeltaProposal = {
  readonly targetType: EntityType;
  readonly targetId: EntityId | null;
  readonly affinityDelta: number;
  readonly trustDelta: number;
  readonly fearDelta: number;
};

export type NPCReactionEventProposal = {
  readonly eventType: string;
  readonly title: string;
  readonly description: string;
  readonly importance: number;
};

export type NPCReactionProposal = {
  readonly dialogue: string | null;
  readonly action: NPCActionProposal | null;
  readonly statePatch: Record<string, unknown>;
  readonly relationshipDeltas: readonly NPCRelationshipDeltaProposal[];
  readonly memoryCandidates: readonly MemoryCandidate[];
  readonly events: readonly NPCReactionEventProposal[];
};

export type ValidatedNPCReactionProposal = {
  readonly dialogue: string | null;
  readonly action: NPCActionProposal | null;
  readonly statePatch: Record<string, unknown>;
  readonly relationshipDeltas: readonly NPCRelationshipDeltaProposal[];
  readonly memoryCandidates: readonly MemoryCandidate[];
  readonly events: readonly GeneratedWorldEvent[];
};

export class AITurnProposalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AITurnProposalValidationError";
  }
}

export class SummaryOutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SummaryOutputValidationError";
  }
}

export class NPCReactionProposalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NPCReactionProposalValidationError";
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

export const summaryOutputLimits = {
  summaryMaxLength: 6000,
  importantFactsMaxCount: 10,
  memoryContentMaxLength: 1000,
  memoryKeyMaxLength: 120
} as const;

export const npcReactionProposalLimits = {
  dialogueMaxLength: 1200,
  actionDescriptionMaxLength: 500,
  statePatchMaxKeys: 5,
  statePatchStringMaxLength: 240,
  relationshipDeltaMaxCount: 5,
  relationshipDeltaMaxAbs: 20,
  eventMaxCount: 3,
  memoryCandidateMaxCount: 3
} as const;

export const summaryOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "importantFacts"],
  properties: {
    summary: {
      type: "string",
      minLength: 1,
      maxLength: summaryOutputLimits.summaryMaxLength
    },
    importantFacts: {
      type: "array",
      maxItems: summaryOutputLimits.importantFactsMaxCount,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "content", "importance", "memoryType"],
        properties: {
          key: {
            anyOf: [
              { type: "string", maxLength: summaryOutputLimits.memoryKeyMaxLength },
              { type: "null" }
            ]
          },
          content: {
            type: "string",
            minLength: 1,
            maxLength: summaryOutputLimits.memoryContentMaxLength
          },
          importance: {
            type: "integer",
            minimum: 1,
            maximum: 5
          },
          memoryType: {
            type: "string",
            enum: memoryTypes
          }
        }
      }
    }
  }
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

export const npcReactionProposalJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "dialogue",
    "action",
    "statePatch",
    "relationshipDeltas",
    "memoryCandidates",
    "events"
  ],
  properties: {
    dialogue: {
      anyOf: [
        {
          type: "string",
          minLength: 1,
          maxLength: npcReactionProposalLimits.dialogueMaxLength
        },
        { type: "null" }
      ]
    },
    action: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "description"],
          properties: {
            type: { type: "string", enum: npcActionTypes },
            description: {
              type: "string",
              minLength: 1,
              maxLength: npcReactionProposalLimits.actionDescriptionMaxLength
            }
          }
        },
        { type: "null" }
      ]
    },
    statePatch: {
      type: "object",
      additionalProperties: {
        anyOf: [
          {
            type: "string",
            maxLength: npcReactionProposalLimits.statePatchStringMaxLength
          },
          { type: "number" },
          { type: "boolean" },
          { type: "null" }
        ]
      }
    },
    relationshipDeltas: {
      type: "array",
      maxItems: npcReactionProposalLimits.relationshipDeltaMaxCount,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "targetType",
          "targetId",
          "affinityDelta",
          "trustDelta",
          "fearDelta"
        ],
        properties: {
          targetType: { type: "string", enum: entityTypes },
          targetId: {
            anyOf: [{ type: "string" }, { type: "null" }]
          },
          affinityDelta: { type: "number" },
          trustDelta: { type: "number" },
          fearDelta: { type: "number" }
        }
      }
    },
    memoryCandidates: {
      type: "array",
      maxItems: npcReactionProposalLimits.memoryCandidateMaxCount,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "content", "importance", "memoryType"],
        properties: {
          key: {
            anyOf: [
              { type: "string", maxLength: summaryOutputLimits.memoryKeyMaxLength },
              { type: "null" }
            ]
          },
          content: {
            type: "string",
            minLength: 1,
            maxLength: summaryOutputLimits.memoryContentMaxLength
          },
          importance: { type: "integer", minimum: 1, maximum: 5 },
          memoryType: { type: "string", enum: memoryTypes }
        }
      }
    },
    events: {
      type: "array",
      maxItems: npcReactionProposalLimits.eventMaxCount,
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
          importance: { type: "integer", minimum: 1, maximum: 5 }
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

export function validateSummaryOutput(output: unknown): SummaryOutput {
  const record = expectRecordWithError(output, "summary output");
  assertOnlyKeysWithError(record, ["summary", "importantFacts"]);

  const summary = validateTextWithError(
    record.summary,
    "summary",
    summaryOutputLimits.summaryMaxLength
  );

  if (!Array.isArray(record.importantFacts)) {
    throw new SummaryOutputValidationError("importantFacts must be an array.");
  }

  if (record.importantFacts.length > summaryOutputLimits.importantFactsMaxCount) {
    throw new SummaryOutputValidationError("Too many importantFacts.");
  }

  return {
    summary,
    importantFacts: record.importantFacts.map((candidate, index) =>
      validateMemoryCandidate(candidate, index)
    )
  };
}

export function validateNPCReactionProposal(
  proposal: unknown,
  options: {
    readonly npcId: string;
    readonly validNpcIds?: ReadonlySet<string>;
  }
): ValidatedNPCReactionProposal {
  const record = expectNPCRecord(proposal, "NPC reaction proposal");
  assertOnlyNPCKeys(record, [
    "dialogue",
    "action",
    "statePatch",
    "relationshipDeltas",
    "memoryCandidates",
    "events"
  ]);

  return {
    dialogue: validateNPCOptionalText(
      record.dialogue,
      "dialogue",
      npcReactionProposalLimits.dialogueMaxLength
    ),
    action: validateNPCAction(record.action),
    statePatch: validateNPCStatePatch(record.statePatch),
    relationshipDeltas: validateNPCRelationshipDeltas(
      record.relationshipDeltas,
      options
    ),
    memoryCandidates: validateNPCMemoryCandidates(record.memoryCandidates),
    events: validateNPCEvents(record.events)
  };
}

function validateMemoryCandidate(value: unknown, index: number): MemoryCandidate {
  const record = expectRecordWithError(value, `importantFacts[${index}]`);
  assertOnlyKeysWithError(record, ["key", "content", "importance", "memoryType"]);

  if (!memoryTypes.includes(record.memoryType as MemoryType)) {
    throw new SummaryOutputValidationError(
      `importantFacts[${index}].memoryType is invalid.`
    );
  }

  const importance = record.importance;

  if (
    !Number.isInteger(importance) ||
    (importance as number) < 1 ||
    (importance as number) > 5
  ) {
    throw new SummaryOutputValidationError(
      `importantFacts[${index}].importance is invalid.`
    );
  }

  const key =
    record.key === null
      ? null
      : record.key === undefined
        ? null
        : validateMemoryKey(record.key, `importantFacts[${index}].key`);

  return {
    key,
    memoryType: record.memoryType as MemoryType,
    content: validateTextWithError(
      record.content,
      `importantFacts[${index}].content`,
      summaryOutputLimits.memoryContentMaxLength
    ),
    importance: importance as number
  };
}

function validateNPCAction(value: unknown): NPCActionProposal | null {
  if (value === null) {
    return null;
  }

  const record = expectNPCRecord(value, "action");
  assertOnlyNPCKeys(record, ["type", "description"]);

  if (!npcActionTypes.includes(record.type as NPCActionType)) {
    throw new NPCReactionProposalValidationError("NPC action type is invalid.");
  }

  return {
    type: record.type as NPCActionType,
    description: validateNPCText(
      record.description,
      "action.description",
      npcReactionProposalLimits.actionDescriptionMaxLength
    )
  };
}

function validateNPCStatePatch(value: unknown): Record<string, unknown> {
  const record = expectNPCRecord(value, "statePatch");
  const allowedKeys = new Set(["mood", "stance", "currentGoal", "attention", "location"]);

  if (Object.keys(record).length > npcReactionProposalLimits.statePatchMaxKeys) {
    throw new NPCReactionProposalValidationError("NPC statePatch has too many keys.");
  }

  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key) || forbiddenStatePatchKeys.has(key) || key === "alive") {
      throw new NPCReactionProposalValidationError(
        `NPC cannot update statePatch key: ${key}.`
      );
    }
  }

  const patch: Record<string, unknown> = {};

  for (const [key, nextValue] of Object.entries(record)) {
    patch[key] = validateNPCScalarValue(nextValue, `statePatch.${key}`);
  }

  return patch;
}

function validateNPCRelationshipDeltas(
  value: unknown,
  options: {
    readonly npcId: string;
    readonly validNpcIds?: ReadonlySet<string>;
  }
): NPCRelationshipDeltaProposal[] {
  if (!Array.isArray(value)) {
    throw new NPCReactionProposalValidationError(
      "relationshipDeltas must be an array."
    );
  }

  if (value.length > npcReactionProposalLimits.relationshipDeltaMaxCount) {
    throw new NPCReactionProposalValidationError(
      "NPC proposed too many relationship deltas."
    );
  }

  return value.map((delta, index) => {
    const record = expectNPCRecord(delta, `relationshipDeltas[${index}]`);
    assertOnlyNPCKeys(record, [
      "targetType",
      "targetId",
      "affinityDelta",
      "trustDelta",
      "fearDelta"
    ]);

    if (!entityTypes.includes(record.targetType as EntityType)) {
      throw new NPCReactionProposalValidationError(
        `relationshipDeltas[${index}].targetType is invalid.`
      );
    }

    const targetType = record.targetType as EntityType;
    const targetId =
      record.targetId === null || record.targetId === undefined
        ? null
        : validateNPCText(record.targetId, `relationshipDeltas[${index}].targetId`, 120);

    if (targetType === "player" && targetId !== null) {
      throw new NPCReactionProposalValidationError(
        `relationshipDeltas[${index}] player targetId must be null.`
      );
    }

    if (targetType === "npc") {
      if (!targetId) {
        throw new NPCReactionProposalValidationError(
          `relationshipDeltas[${index}] npc targetId is required.`
        );
      }

      if (targetId === options.npcId) {
        throw new NPCReactionProposalValidationError(
          "NPC cannot create a relationship delta to itself."
        );
      }

      if (options.validNpcIds && !options.validNpcIds.has(targetId)) {
        throw new NPCReactionProposalValidationError(
          `relationshipDeltas[${index}] target NPC is invalid.`
        );
      }
    }

    return {
      targetType,
      targetId,
      affinityDelta: validateNPCDeltaNumber(
        record.affinityDelta,
        `relationshipDeltas[${index}].affinityDelta`
      ),
      trustDelta: validateNPCDeltaNumber(
        record.trustDelta,
        `relationshipDeltas[${index}].trustDelta`
      ),
      fearDelta: validateNPCDeltaNumber(
        record.fearDelta,
        `relationshipDeltas[${index}].fearDelta`
      )
    };
  });
}

function validateNPCMemoryCandidates(value: unknown): MemoryCandidate[] {
  if (!Array.isArray(value)) {
    throw new NPCReactionProposalValidationError("memoryCandidates must be an array.");
  }

  if (value.length > npcReactionProposalLimits.memoryCandidateMaxCount) {
    throw new NPCReactionProposalValidationError(
      "NPC proposed too many memory candidates."
    );
  }

  return value.map((candidate, index) => {
    const record = expectNPCRecord(candidate, `memoryCandidates[${index}]`);
    assertOnlyNPCKeys(record, ["key", "content", "importance", "memoryType"]);

    if (!memoryTypes.includes(record.memoryType as MemoryType)) {
      throw new NPCReactionProposalValidationError(
        `memoryCandidates[${index}].memoryType is invalid.`
      );
    }

    const importance = record.importance;

    if (
      !Number.isInteger(importance) ||
      (importance as number) < 1 ||
      (importance as number) > 5
    ) {
      throw new NPCReactionProposalValidationError(
        `memoryCandidates[${index}].importance is invalid.`
      );
    }

    return {
      key:
        record.key === null || record.key === undefined
          ? null
          : validateMemoryKeyForNPC(record.key, `memoryCandidates[${index}].key`),
      memoryType: record.memoryType as MemoryType,
      content: validateNPCText(
        record.content,
        `memoryCandidates[${index}].content`,
        summaryOutputLimits.memoryContentMaxLength
      ),
      importance: importance as number
    };
  });
}

function validateNPCEvents(value: unknown): GeneratedWorldEvent[] {
  if (!Array.isArray(value)) {
    throw new NPCReactionProposalValidationError("events must be an array.");
  }

  if (value.length > npcReactionProposalLimits.eventMaxCount) {
    throw new NPCReactionProposalValidationError("NPC proposed too many events.");
  }

  return value.map((event, index) => {
    const record = expectNPCRecord(event, `events[${index}]`);
    assertOnlyNPCKeys(record, ["eventType", "title", "description", "importance"]);

    const importance = record.importance;

    if (
      !Number.isInteger(importance) ||
      (importance as number) < 1 ||
      (importance as number) > 5
    ) {
      throw new NPCReactionProposalValidationError(
        `events[${index}].importance is invalid.`
      );
    }

    return {
      eventType: validateNPCText(
        record.eventType,
        `events[${index}].eventType`,
        aiTurnProposalLimits.eventTypeMaxLength
      ),
      title: validateNPCText(
        record.title,
        `events[${index}].title`,
        aiTurnProposalLimits.eventTitleMaxLength
      ),
      description: validateNPCText(
        record.description,
        `events[${index}].description`,
        aiTurnProposalLimits.eventDescriptionMaxLength
      ),
      importance: importance as number,
      payload: {
        source: "npc_ai"
      }
    };
  });
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

function validateNPCOptionalText(
  value: unknown,
  path: string,
  maxLength: number
): string | null {
  if (value === null) {
    return null;
  }

  return validateNPCText(value, path, maxLength);
}

function validateNPCText(value: unknown, path: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new NPCReactionProposalValidationError(`${path} must be a string.`);
  }

  const text = value.trim();

  if (!text || text.length > maxLength || hasControlCharacters(text)) {
    throw new NPCReactionProposalValidationError(`${path} is invalid.`);
  }

  return text;
}

function validateNPCScalarValue(value: unknown, path: string): unknown {
  if (value === null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new NPCReactionProposalValidationError(`${path} must be finite.`);
    }

    return value;
  }

  if (typeof value === "string") {
    return validateNPCText(
      value,
      path,
      npcReactionProposalLimits.statePatchStringMaxLength
    );
  }

  throw new NPCReactionProposalValidationError(
    `${path} must be a scalar JSON value.`
  );
}

function validateNPCDeltaNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new NPCReactionProposalValidationError(`${path} must be finite.`);
  }

  if (Math.abs(value) > npcReactionProposalLimits.relationshipDeltaMaxAbs) {
    throw new NPCReactionProposalValidationError(`${path} is too large.`);
  }

  return value;
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

function expectNPCRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NPCReactionProposalValidationError(`${path} must be an object.`);
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

function assertOnlyNPCKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[]
): void {
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new NPCReactionProposalValidationError(
        `Unexpected NPC proposal key: ${key}.`
      );
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

function expectRecordWithError(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SummaryOutputValidationError(`${path} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function assertOnlyKeysWithError(
  value: Record<string, unknown>,
  allowedKeys: readonly string[]
): void {
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new SummaryOutputValidationError(`Unexpected summary key: ${key}.`);
    }
  }
}

function validateTextWithError(
  value: unknown,
  path: string,
  maxLength: number
): string {
  if (typeof value !== "string") {
    throw new SummaryOutputValidationError(`${path} must be a string.`);
  }

  const text = value.trim();

  if (!text || text.length > maxLength || hasControlCharacters(text)) {
    throw new SummaryOutputValidationError(`${path} is invalid.`);
  }

  return text;
}

function validateMemoryKey(value: unknown, path: string): string {
  const key = validateTextWithError(
    value,
    path,
    summaryOutputLimits.memoryKeyMaxLength
  );

  if (!/^[a-z0-9][a-z0-9._:-]*$/i.test(key)) {
    throw new SummaryOutputValidationError(`${path} format is invalid.`);
  }

  return key;
}

function validateMemoryKeyForNPC(value: unknown, path: string): string {
  const key = validateNPCText(value, path, summaryOutputLimits.memoryKeyMaxLength);

  if (!/^[a-z0-9][a-z0-9._:-]*$/i.test(key)) {
    throw new NPCReactionProposalValidationError(`${path} format is invalid.`);
  }

  return key;
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

export type EntityId = string;
export type StoryId = EntityId;
export type CharacterId = EntityId;
export type SessionId = EntityId;

export const storyStatuses = ["draft", "published", "archived"] as const;
export type StoryStatus = (typeof storyStatuses)[number];

export const storyCharacterTypes = ["playable", "npc"] as const;
export type StoryCharacterType = (typeof storyCharacterTypes)[number];

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

export const factionStatuses = ["active", "weakened", "collapsed", "hidden"] as const;
export type FactionStatus = (typeof factionStatuses)[number];

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

export const consequenceTypes = [
  "quest_activate",
  "quest_progress",
  "quest_complete",
  "quest_fail",
  "relationship_delta",
  "inventory_add",
  "inventory_remove",
  "flag_set",
  "state_value_change",
  "npc_state_change",
  "world_event",
  "reputation_delta",
  "custom_safe"
] as const;
export type ConsequenceType = (typeof consequenceTypes)[number];

export type QuestLifecycleStatus = QuestStatus;

export type EntityReference = {
  readonly type: EntityType;
  readonly id: EntityId | null;
};

export type ConsequenceProposal = {
  readonly type: ConsequenceType;
  readonly source: "deterministic" | "main_ai" | "npc_ai" | "rule";
  readonly questKey?: string;
  readonly title?: string;
  readonly description?: string;
  readonly status?: QuestLifecycleStatus;
  readonly progress?: Record<string, unknown>;
  readonly sourceEntity?: EntityReference;
  readonly targetEntity?: EntityReference;
  readonly affinityDelta?: number;
  readonly trustDelta?: number;
  readonly fearDelta?: number;
  readonly owner?: EntityReference;
  readonly itemKey?: string;
  readonly itemName?: string;
  readonly quantity?: number;
  readonly metadata?: Record<string, unknown>;
  readonly flagKey?: string;
  readonly stateKey?: string;
  readonly reputationKey?: string;
  readonly value?: unknown;
  readonly delta?: number;
  readonly npcId?: string;
  readonly statePatch?: Record<string, unknown>;
  readonly eventType?: string;
  readonly importance?: number;
};

export type ValidatedConsequence = ConsequenceProposal & {
  readonly type: ConsequenceType;
  readonly source: "deterministic" | "main_ai" | "npc_ai" | "rule";
};

export type ConsequenceContext = {
  readonly sessionId: SessionId;
  readonly turnNumber: number;
  readonly maxDepth: number;
};

export type TurnPersistencePlan = {
  readonly statePatch: StatePatch;
  readonly consequences: readonly ValidatedConsequence[];
  readonly events: readonly GeneratedWorldEvent[];
  readonly memories: readonly MemoryCandidate[];
  readonly assistantNarrative: string;
};

export type FactionGoal = {
  readonly key: string;
  readonly status: "active" | "completed" | "failed";
  readonly progress: number;
};

export type FactionRuntime = {
  readonly id: EntityId;
  readonly sessionId: SessionId;
  readonly factionKey: string;
  readonly name: string;
  readonly description: string;
  readonly status: FactionStatus;
  readonly influence: number;
  readonly resources: Record<string, unknown>;
  readonly goals: readonly FactionGoal[];
  readonly state: Record<string, unknown>;
};

export type FactionRelation = {
  readonly id: EntityId;
  readonly sessionId: SessionId;
  readonly sourceFactionId: EntityId;
  readonly targetFactionId: EntityId;
  readonly affinity: number;
  readonly tension: number;
  readonly metadata: Record<string, unknown>;
};

export type FactionChange = {
  readonly factionId: EntityId;
  readonly factionKey: string;
  readonly influenceDelta?: number;
  readonly resourcesDelta?: Record<string, number>;
  readonly statePatch?: Record<string, unknown>;
};

export type FactionRelationChange = {
  readonly sourceFactionId: EntityId;
  readonly targetFactionId: EntityId;
  readonly affinityDelta?: number;
  readonly tensionDelta?: number;
};

export type WorldSimulationSignal = {
  readonly type:
    | "faction_helped"
    | "faction_harmed"
    | "quest_completed"
    | "crime"
    | "important_item_acquired"
    | "territory_changed"
    | "major_loss";
  readonly factionKey?: string;
  readonly targetFactionKey?: string;
  readonly importance: number;
  readonly metadata?: Record<string, unknown>;
};

export type WorldSimulationContext = {
  readonly sessionId: SessionId;
  readonly currentTurn: number;
  readonly factions: readonly FactionRuntime[];
  readonly factionRelations: readonly FactionRelation[];
  readonly recentWorldEvents: readonly MemoryContextWorldEvent[];
  readonly state: Pick<GameStateSnapshot, "location" | "worldTime" | "flags" | "stateData">;
  readonly signals: readonly WorldSimulationSignal[];
};

export type WorldTickPlan = {
  readonly factionChanges: readonly FactionChange[];
  readonly factionRelationChanges: readonly FactionRelationChange[];
  readonly statePatch: StatePatch;
  readonly events: readonly GeneratedWorldEvent[];
  readonly memories: readonly MemoryCandidate[];
};

export type WorldSimulationResult = {
  readonly plan: WorldTickPlan;
  readonly appliedRuleCount: number;
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

export class ConsequenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsequenceValidationError";
  }
}

export class WorldSimulationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorldSimulationValidationError";
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

export const consequenceLimits = {
  questKeyMaxLength: 120,
  titleMaxLength: 160,
  descriptionMaxLength: 1000,
  maxProgressKeys: 20,
  maxProgressDepth: 3,
  maxProgressStringLength: 300,
  maxDeltaAbs: 20,
  maxInventoryQuantity: 999,
  maxConsequencesPerTurn: 20,
  maxChainDepth: 3,
  stateKeyMaxLength: 80
} as const;

export const worldSimulationLimits = {
  influenceMin: 0,
  influenceMax: 100,
  weakenedThreshold: 20,
  collapsedThreshold: 0,
  resourceMin: 0,
  resourceMax: 1000,
  maxResourceDeltaAbs: 100,
  maxRelationDeltaAbs: 20,
  maxSignalsPerTick: 20,
  maxRuleDepth: 2,
  maxEventsPerTick: 8,
  maxMemoriesPerTick: 8
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

export function validateConsequenceProposal(
  proposal: unknown
): ValidatedConsequence {
  const record = expectConsequenceRecord(proposal, "consequence");

  if (!consequenceTypes.includes(record.type as ConsequenceType)) {
    throw new ConsequenceValidationError("Consequence type is invalid.");
  }

  const source = validateConsequenceSource(record.source);
  const base = { type: record.type as ConsequenceType, source };

  switch (base.type) {
    case "quest_activate":
      return {
        ...base,
        questKey: validateQuestKey(record.questKey, "questKey"),
        title: validateConsequenceText(
          record.title,
          "title",
          consequenceLimits.titleMaxLength
        ),
        description: validateConsequenceText(
          record.description,
          "description",
          consequenceLimits.descriptionMaxLength
        ),
        status: "active",
        progress: validateQuestProgress(record.progress ?? {})
      };
    case "quest_progress":
      return {
        ...base,
        questKey: validateQuestKey(record.questKey, "questKey"),
        progress: validateQuestProgress(record.progress ?? {})
      };
    case "quest_complete":
    case "quest_fail":
      return {
        ...base,
        questKey: validateQuestKey(record.questKey, "questKey"),
        status: base.type === "quest_complete" ? "completed" : "failed",
        ...(record.progress === undefined
          ? {}
          : { progress: validateQuestProgress(record.progress) })
      };
    case "relationship_delta":
      return {
        ...base,
        sourceEntity: validateEntityReference(record.sourceEntity, "sourceEntity"),
        targetEntity: validateEntityReference(record.targetEntity, "targetEntity"),
        affinityDelta: validateConsequenceDelta(record.affinityDelta, "affinityDelta"),
        trustDelta: validateConsequenceDelta(record.trustDelta, "trustDelta"),
        fearDelta: validateConsequenceDelta(record.fearDelta, "fearDelta")
      };
    case "inventory_add":
    case "inventory_remove":
      return {
        ...base,
        owner: validateEntityReference(record.owner, "owner"),
        itemKey: validateSafeKey(record.itemKey, "itemKey"),
        ...(base.type === "inventory_add"
          ? {
              itemName: validateConsequenceText(
                record.itemName,
                "itemName",
                consequenceLimits.titleMaxLength
              )
            }
          : {}),
        ...(record.description === undefined
          ? {}
          : {
              description: validateConsequenceText(
                record.description,
                "description",
                consequenceLimits.descriptionMaxLength
              )
            }),
        quantity: validateInventoryQuantity(record.quantity),
        metadata:
          record.metadata === undefined
            ? {}
            : validateQuestProgress(record.metadata)
      };
    case "flag_set":
      return {
        ...base,
        flagKey: validateSafeNamespaceKey(record.flagKey, "flagKey", "consequence"),
        value: validateConsequenceScalar(record.value, "value")
      };
    case "state_value_change":
      return {
        ...base,
        stateKey: validateSafeNamespaceKey(record.stateKey, "stateKey", "consequence"),
        value: validateConsequenceScalar(record.value, "value")
      };
    case "reputation_delta":
      return {
        ...base,
        reputationKey: validateSafeNamespaceKey(
          record.reputationKey,
          "reputationKey",
          "reputation"
        ),
        delta: validateConsequenceDelta(record.delta, "delta")
      };
    case "npc_state_change":
      return {
        ...base,
        npcId: validateConsequenceText(record.npcId, "npcId", 120),
        statePatch: validateNPCStatePatch(record.statePatch ?? {})
      };
    case "world_event":
    case "custom_safe":
      return {
        ...base,
        eventType: validateConsequenceText(
          record.eventType ?? "custom_safe",
          "eventType",
          aiTurnProposalLimits.eventTypeMaxLength
        ),
        title: validateConsequenceText(
          record.title,
          "title",
          aiTurnProposalLimits.eventTitleMaxLength
        ),
        description: validateConsequenceText(
          record.description,
          "description",
          aiTurnProposalLimits.eventDescriptionMaxLength
        ),
        importance: validateImportanceValue(record.importance),
        metadata:
          record.metadata === undefined
            ? {}
            : validateQuestProgress(record.metadata)
      };
  }
}

export function assertQuestStatusTransition(
  currentStatus: QuestStatus | null,
  nextStatus: QuestStatus
): void {
  if (currentStatus === null) {
    if (nextStatus !== "active" && nextStatus !== "inactive") {
      throw new ConsequenceValidationError(
        "New quests must start inactive or active."
      );
    }
    return;
  }

  const allowed =
    (currentStatus === "inactive" && nextStatus === "active") ||
    (currentStatus === "active" &&
      (nextStatus === "completed" || nextStatus === "failed" || nextStatus === "active"));

  if (!allowed && currentStatus !== nextStatus) {
    throw new ConsequenceValidationError(
      `Invalid quest transition: ${currentStatus} -> ${nextStatus}.`
    );
  }
}

export function expandConsequenceChain(input: {
  readonly consequences: readonly ValidatedConsequence[];
  readonly maxDepth?: number;
}): ValidatedConsequence[] {
  const maxDepth = input.maxDepth ?? consequenceLimits.maxChainDepth;
  const results: ValidatedConsequence[] = [...input.consequences];
  let frontier = [...input.consequences];
  let depth = 0;

  while (frontier.length > 0 && depth < maxDepth) {
    const next = frontier.flatMap((consequence) =>
      deriveRuleConsequences(consequence)
    );

    if (next.length === 0) {
      break;
    }

    const deduped = next.filter(
      (candidate) => !results.some((existing) => consequenceIdentity(existing) === consequenceIdentity(candidate))
    );
    results.push(...deduped);
    frontier = deduped;
    depth += 1;
  }

  if (results.length > consequenceLimits.maxConsequencesPerTurn) {
    throw new ConsequenceValidationError("Too many consequences for one turn.");
  }

  return results;
}

export function buildDeterministicConsequenceProposals(
  action: string
): ConsequenceProposal[] {
  const normalized = action.trim().replace(/\s+/g, " ");
  const lower = normalizeConsequenceText(normalized);
  const questActivate = /^(?:nhan nhiem vu|quest)\s+(.+)$/i.exec(lower);
  const questComplete = /^(?:hoan thanh nhiem vu|complete quest)\s+(.+)$/i.exec(lower);
  const questFail = /^(?:that bai nhiem vu|fail quest)\s+(.+)$/i.exec(lower);
  const inventoryAdd = /^(?:nhan vat pham|nhan item|get item)\s+(.+)$/i.exec(lower);
  const inventoryRemove = /^(?:mat vat pham|bo vat pham|remove item|drop item)\s+(.+)$/i.exec(lower);

  if (questActivate?.[1]) {
    const title = titleFromKey(questActivate[1]);
    return [
      {
        type: "quest_activate",
        source: "deterministic",
        questKey: safeKeyFromText(questActivate[1]),
        title,
        description: `Nhiệm vụ được kích hoạt: ${title}.`,
        progress: {}
      }
    ];
  }

  if (questComplete?.[1]) {
    return [
      {
        type: "quest_complete",
        source: "deterministic",
        questKey: safeKeyFromText(questComplete[1])
      }
    ];
  }

  if (questFail?.[1]) {
    return [
      {
        type: "quest_fail",
        source: "deterministic",
        questKey: safeKeyFromText(questFail[1])
      }
    ];
  }

  if (inventoryAdd?.[1]) {
    const title = titleFromKey(inventoryAdd[1]);
    return [
      {
        type: "inventory_add",
        source: "deterministic",
        owner: { type: "player", id: null },
        itemKey: safeKeyFromText(inventoryAdd[1]),
        itemName: title,
        quantity: 1,
        metadata: { source: "deterministic" }
      }
    ];
  }

  if (inventoryRemove?.[1]) {
    return [
      {
        type: "inventory_remove",
        source: "deterministic",
        owner: { type: "player", id: null },
        itemKey: safeKeyFromText(inventoryRemove[1]),
        quantity: 1
      }
    ];
  }

  return [];
}

export function shouldRunWorldTick(input: {
  readonly turnCount: number;
  readonly intervalTurns: number;
  readonly lastTickTurn: number;
  readonly forced?: boolean;
}): boolean {
  if (!Number.isInteger(input.intervalTurns) || input.intervalTurns < 1) {
    throw new WorldSimulationValidationError("World tick interval is invalid.");
  }

  if (input.forced) {
    return input.turnCount > input.lastTickTurn;
  }

  return (
    input.turnCount > 0 &&
    input.turnCount > input.lastTickTurn &&
    input.turnCount % input.intervalTurns === 0
  );
}

export function runWorldSimulation(
  context: WorldSimulationContext
): WorldSimulationResult {
  if (context.signals.length > worldSimulationLimits.maxSignalsPerTick) {
    throw new WorldSimulationValidationError("Too many world simulation signals.");
  }

  const factionsByKey = new Map(
    context.factions.map((faction) => [faction.factionKey, faction])
  );
  const changes = new Map<string, MutableFactionChange>();
  const events: GeneratedWorldEvent[] = [];
  const memories: MemoryCandidate[] = [];
  let appliedRuleCount = 0;

  for (const signal of context.signals) {
    validateWorldSimulationSignal(signal);
    const factionKey = signal.factionKey;

    if (!factionKey) {
      continue;
    }

    const faction = factionsByKey.get(factionKey);

    if (!faction || faction.status === "hidden" || faction.status === "collapsed") {
      continue;
    }

    const delta = influenceDeltaForSignal(signal);

    if (delta === 0) {
      continue;
    }

    const change = getMutableFactionChange(changes, faction);
    change.influenceDelta += delta;
    appliedRuleCount += 1;
  }

  for (const change of changes.values()) {
    const faction = factionsByKey.get(change.factionKey);

    if (!faction) {
      continue;
    }

    const nextInfluence = clampWorldInteger(
      faction.influence + change.influenceDelta,
      worldSimulationLimits.influenceMin,
      worldSimulationLimits.influenceMax
    );
    const nextStatus = statusForInfluence(faction.status, nextInfluence);

    if (nextStatus !== faction.status) {
      change.statePatch = {
        ...(change.statePatch ?? {}),
        lastStatusChangeTurn: context.currentTurn
      };
      events.push({
        eventType: "faction_status_changed",
        title: "Thế lực biến động",
        description: `${faction.name} chuyển sang trạng thái ${nextStatus}.`,
        importance: nextStatus === "collapsed" ? 5 : 4,
        payload: {
          factionKey: faction.factionKey,
          previousStatus: faction.status,
          nextStatus
        }
      });
      memories.push({
        memoryType: "world",
        key: `world:faction:${faction.factionKey}:${nextStatus}`,
        content: `${faction.name} chuyển sang trạng thái ${nextStatus}.`,
        importance: nextStatus === "collapsed" ? 5 : 4,
        metadata: {
          source: "world_simulation",
          factionKey: faction.factionKey,
          status: nextStatus
        }
      });
    }

    if (Math.abs(change.influenceDelta) >= 5) {
      events.push({
        eventType: "faction_influence_changed",
        title: "Ảnh hưởng thế lực thay đổi",
        description: `${faction.name} ${change.influenceDelta > 0 ? "tăng" : "giảm"} ảnh hưởng.`,
        importance: Math.abs(change.influenceDelta) >= 10 ? 4 : 3,
        payload: {
          factionKey: faction.factionKey,
          influenceDelta: change.influenceDelta,
          nextInfluence
        }
      });
    }
  }

  return {
    appliedRuleCount,
    plan: {
      factionChanges: [...changes.values()].map((change) => ({
        factionId: change.factionId,
        factionKey: change.factionKey,
        influenceDelta: change.influenceDelta,
        ...(change.resourcesDelta ? { resourcesDelta: change.resourcesDelta } : {}),
        ...(change.statePatch ? { statePatch: change.statePatch } : {})
      })),
      factionRelationChanges: deriveFactionRelationChanges(context),
      statePatch: {},
      events: events.slice(0, worldSimulationLimits.maxEventsPerTick),
      memories: memories.slice(0, worldSimulationLimits.maxMemoriesPerTick)
    }
  };
}

export function nextFactionStatusForInfluence(
  current: FactionStatus,
  influence: number
): FactionStatus {
  return statusForInfluence(current, influence);
}

export function deriveWorldSimulationSignals(input: {
  readonly events: readonly GeneratedWorldEvent[];
  readonly consequences: readonly ValidatedConsequence[];
}): WorldSimulationSignal[] {
  const signals: WorldSimulationSignal[] = [];

  for (const event of input.events) {
    const factionKey = stringFromMetadata(event.payload.factionKey);
    const signalType = stringFromMetadata(event.payload.worldSignal);

    if (factionKey && isWorldSimulationSignalType(signalType)) {
      signals.push({
        type: signalType,
        factionKey,
        importance: event.importance,
        ...(event.payload ? { metadata: event.payload } : {})
      });
      continue;
    }

    if (factionKey && event.eventType === "quest_complete") {
      signals.push({
        type: "quest_completed",
        factionKey,
        importance: event.importance,
        ...(event.payload ? { metadata: event.payload } : {})
      });
    }
  }

  for (const consequence of input.consequences) {
    const factionKey = stringFromMetadata(consequence.metadata?.factionKey);
    const signalType = stringFromMetadata(consequence.metadata?.worldSignal);

    if (factionKey && isWorldSimulationSignalType(signalType)) {
      signals.push({
        type: signalType,
        factionKey,
        importance:
          typeof consequence.importance === "number"
            ? consequence.importance
            : 3,
        ...(consequence.metadata ? { metadata: consequence.metadata } : {})
      });
    }
  }

  return signals;
}

type MutableFactionChange = {
  factionId: EntityId;
  factionKey: string;
  influenceDelta: number;
  resourcesDelta?: Record<string, number>;
  statePatch?: Record<string, unknown>;
};

function validateWorldSimulationSignal(signal: WorldSimulationSignal): void {
  if (!isWorldSimulationSignalType(signal.type)) {
    throw new WorldSimulationValidationError("World simulation signal type is invalid.");
  }

  if (!Number.isInteger(signal.importance) || signal.importance < 1 || signal.importance > 5) {
    throw new WorldSimulationValidationError("World simulation signal importance is invalid.");
  }

  if (signal.factionKey !== undefined) {
    validateSafeKey(signal.factionKey, "factionKey");
  }

  if (signal.targetFactionKey !== undefined) {
    validateSafeKey(signal.targetFactionKey, "targetFactionKey");
  }
}

function isWorldSimulationSignalType(value: unknown): value is WorldSimulationSignal["type"] {
  return (
    value === "faction_helped" ||
    value === "faction_harmed" ||
    value === "quest_completed" ||
    value === "crime" ||
    value === "important_item_acquired" ||
    value === "territory_changed" ||
    value === "major_loss"
  );
}

function influenceDeltaForSignal(signal: WorldSimulationSignal): number {
  const importanceWeight = Math.max(1, Math.min(5, signal.importance));

  switch (signal.type) {
    case "faction_helped":
    case "quest_completed":
      return importanceWeight >= 4 ? 8 : 5;
    case "faction_harmed":
    case "major_loss":
      return importanceWeight >= 4 ? -8 : -5;
    case "crime":
      return -3;
    case "important_item_acquired":
      return importanceWeight >= 4 ? 3 : 1;
    case "territory_changed":
      return importanceWeight >= 4 ? 10 : 5;
  }
}

function getMutableFactionChange(
  changes: Map<string, MutableFactionChange>,
  faction: FactionRuntime
): MutableFactionChange {
  const existing = changes.get(faction.id);

  if (existing) {
    return existing;
  }

  const created = {
    factionId: faction.id,
    factionKey: faction.factionKey,
    influenceDelta: 0
  };
  changes.set(faction.id, created);
  return created;
}

function statusForInfluence(current: FactionStatus, influence: number): FactionStatus {
  if (current === "hidden") {
    return current;
  }

  if (influence <= worldSimulationLimits.collapsedThreshold) {
    return "collapsed";
  }

  if (influence <= worldSimulationLimits.weakenedThreshold) {
    return "weakened";
  }

  return "active";
}

function deriveFactionRelationChanges(
  context: WorldSimulationContext
): FactionRelationChange[] {
  const factionsByKey = new Map(
    context.factions.map((faction) => [faction.factionKey, faction])
  );
  const changes: FactionRelationChange[] = [];

  for (const signal of context.signals) {
    if (!signal.factionKey || !signal.targetFactionKey) {
      continue;
    }

    const source = factionsByKey.get(signal.factionKey);
    const target = factionsByKey.get(signal.targetFactionKey);

    if (!source || !target || source.id === target.id) {
      continue;
    }

    const hostile = signal.type === "faction_harmed" || signal.type === "crime";
    changes.push({
      sourceFactionId: source.id,
      targetFactionId: target.id,
      affinityDelta: hostile ? -5 : 3,
      tensionDelta: hostile ? 5 : -2
    });
  }

  return changes;
}

function clampWorldInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function stringFromMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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

function validateConsequenceSource(value: unknown): ValidatedConsequence["source"] {
  if (
    value === "deterministic" ||
    value === "main_ai" ||
    value === "npc_ai" ||
    value === "rule"
  ) {
    return value;
  }

  throw new ConsequenceValidationError("Consequence source is invalid.");
}

function validateQuestKey(value: unknown, path: string): string {
  return validateSafeKey(value, path);
}

function validateSafeKey(value: unknown, path: string): string {
  const key = validateConsequenceText(
    value,
    path,
    consequenceLimits.questKeyMaxLength
  );

  if (!/^[a-z0-9][a-z0-9._:-]*$/i.test(key)) {
    throw new ConsequenceValidationError(`${path} format is invalid.`);
  }

  return key;
}

function validateSafeNamespaceKey(
  value: unknown,
  path: string,
  namespace: string
): string {
  const key = validateSafeKey(value, path);

  if (!key.startsWith(`${namespace}.`)) {
    throw new ConsequenceValidationError(
      `${path} must be in the ${namespace} namespace.`
    );
  }

  return key;
}

function validateQuestProgress(value: unknown): Record<string, unknown> {
  const record = expectConsequenceRecord(value, "progress");
  validateBoundedObject(record, "progress", 0);
  return JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
}

function validateBoundedObject(
  record: Record<string, unknown>,
  path: string,
  depth: number
): void {
  if (Object.keys(record).length > consequenceLimits.maxProgressKeys) {
    throw new ConsequenceValidationError(`${path} has too many keys.`);
  }

  if (depth > consequenceLimits.maxProgressDepth) {
    throw new ConsequenceValidationError(`${path} is too deeply nested.`);
  }

  for (const [key, value] of Object.entries(record)) {
    if (!/^[a-zA-Z0-9_.:-]+$/.test(key)) {
      throw new ConsequenceValidationError(`${path}.${key} key is invalid.`);
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      validateBoundedObject(value as Record<string, unknown>, `${path}.${key}`, depth + 1);
      continue;
    }

    if (Array.isArray(value)) {
      throw new ConsequenceValidationError(`${path}.${key} arrays are not allowed.`);
    }

    validateConsequenceScalar(value, `${path}.${key}`);
  }
}

function validateConsequenceScalar(value: unknown, path: string): unknown {
  if (value === null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) {
      throw new ConsequenceValidationError(`${path} number is invalid.`);
    }

    return value;
  }

  if (typeof value === "string") {
    return validateConsequenceText(
      value,
      path,
      consequenceLimits.maxProgressStringLength
    );
  }

  throw new ConsequenceValidationError(`${path} must be scalar JSON.`);
}

function validateEntityReference(value: unknown, path: string): EntityReference {
  const record = expectConsequenceRecord(value, path);

  if (!entityTypes.includes(record.type as EntityType)) {
    throw new ConsequenceValidationError(`${path}.type is invalid.`);
  }

  const type = record.type as EntityType;
  const id =
    record.id === null || record.id === undefined
      ? null
      : validateConsequenceText(record.id, `${path}.id`, 120);

  if (type === "player" && id !== null) {
    throw new ConsequenceValidationError(`${path}.id must be null for player.`);
  }

  if (type === "npc" && !id) {
    throw new ConsequenceValidationError(`${path}.id is required for npc.`);
  }

  return { type, id };
}

function validateConsequenceDelta(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ConsequenceValidationError(`${path} must be finite.`);
  }

  if (Math.abs(value) > consequenceLimits.maxDeltaAbs) {
    throw new ConsequenceValidationError(`${path} is too large.`);
  }

  return Math.trunc(value);
}

function validateInventoryQuantity(value: unknown): number {
  if (
    !Number.isInteger(value) ||
    (value as number) < 1 ||
    (value as number) > consequenceLimits.maxInventoryQuantity
  ) {
    throw new ConsequenceValidationError("Inventory quantity is invalid.");
  }

  return value as number;
}

function validateImportanceValue(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 5) {
    throw new ConsequenceValidationError("Consequence importance is invalid.");
  }

  return value as number;
}

function validateConsequenceText(
  value: unknown,
  path: string,
  maxLength: number
): string {
  if (typeof value !== "string") {
    throw new ConsequenceValidationError(`${path} must be a string.`);
  }

  const text = value.trim();

  if (!text || text.length > maxLength || hasControlCharacters(text)) {
    throw new ConsequenceValidationError(`${path} is invalid.`);
  }

  return text;
}

function expectConsequenceRecord(
  value: unknown,
  path: string
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConsequenceValidationError(`${path} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function deriveRuleConsequences(
  consequence: ValidatedConsequence
): ValidatedConsequence[] {
  if (
    consequence.type === "quest_activate" ||
    consequence.type === "quest_complete" ||
    consequence.type === "quest_fail"
  ) {
    const title =
      consequence.type === "quest_activate"
        ? "Nhiệm vụ mới"
        : consequence.type === "quest_complete"
          ? "Nhiệm vụ hoàn thành"
          : "Nhiệm vụ thất bại";

    return [
      validateConsequenceProposal({
        type: "world_event",
        source: "rule",
        eventType: consequence.type,
        title,
        description: `${title}: ${consequence.questKey}.`,
        importance: consequence.type === "quest_activate" ? 3 : 4
      }),
      validateConsequenceProposal({
        type: "custom_safe",
        source: "rule",
        eventType: "quest_memory",
        title,
        description: `${title}: ${consequence.questKey}.`,
        importance: 4
      })
    ];
  }

  if (consequence.type === "inventory_add") {
    return [
      validateConsequenceProposal({
        type: "world_event",
        source: "rule",
        eventType: "inventory_item_acquired",
        title: "Nhận vật phẩm",
        description: `Người chơi nhận vật phẩm ${consequence.itemKey}.`,
        importance: 2
      })
    ];
  }

  return [];
}

function consequenceIdentity(consequence: ValidatedConsequence): string {
  return [
    consequence.type,
    consequence.questKey ?? "",
    consequence.eventType ?? "",
    consequence.itemKey ?? "",
    consequence.flagKey ?? "",
    consequence.stateKey ?? "",
    consequence.reputationKey ?? "",
    consequence.npcId ?? ""
  ].join(":");
}

function normalizeConsequenceText(value: string): string {
  return value
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function safeKeyFromText(value: string): string {
  return normalizeConsequenceText(value)
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, consequenceLimits.questKeyMaxLength) || "unknown";
}

function titleFromKey(value: string): string {
  const text = value.trim().replace(/\s+/g, " ");
  return text.charAt(0).toLocaleUpperCase("vi-VN") + text.slice(1);
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

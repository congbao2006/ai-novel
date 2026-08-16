import {
  buildDeterministicConsequenceProposals,
  expandConsequenceChain,
  validateConsequenceProposal,
  type ConsequenceProposal,
  type GeneratedWorldEvent,
  type MemoryCandidate,
  type StatePatch,
  type ValidatedConsequence
} from "@ai-novel/domain";
import type { GameStateRecord } from "@ai-novel/db";
import type { PersistableNPCReaction } from "./npc-reaction-service.js";
import { toStateSnapshot } from "./memory-context-builder.js";

export type ConsequenceSummary = {
  readonly type: "quest" | "inventory" | "relationship" | "world" | "state";
  readonly title: string;
  readonly description: string;
};

export type InternalTurnPersistencePlan = {
  readonly statePatch: StatePatch;
  readonly consequences: readonly ValidatedConsequence[];
  readonly events: readonly GeneratedWorldEvent[];
  readonly memories: readonly MemoryCandidate[];
  readonly assistantNarrative: string;
  readonly summaries: readonly ConsequenceSummary[];
};

export class ConsequenceEngine {
  buildPlan(input: {
    readonly state: GameStateRecord;
    readonly action: string;
    readonly assistantNarrative: string;
    readonly baseStatePatch: StatePatch;
    readonly baseEvents: readonly GeneratedWorldEvent[];
    readonly npcReactions?: readonly PersistableNPCReaction[];
    readonly npcEvents?: readonly GeneratedWorldEvent[];
  }): InternalTurnPersistencePlan {
    const proposals: ConsequenceProposal[] = [
      ...buildDeterministicConsequenceProposals(input.action),
      ...consequencesFromNPCReactions(input.npcReactions ?? [])
    ];
    const validated = proposals.map(validateConsequenceProposal);
    const consequences = expandConsequenceChain({
      consequences: validated,
      maxDepth: 3
    });
    const statePatch = mergeStatePatchWithConsequences(
      input.state,
      input.baseStatePatch,
      consequences
    );
    const derivedEvents = consequences.flatMap(toWorldEvent);
    const memories = consequences.flatMap(toMemoryCandidate);

    return {
      statePatch,
      consequences,
      events: [
        ...input.baseEvents,
        ...(input.npcEvents ?? []),
        ...derivedEvents
      ],
      memories,
      assistantNarrative: input.assistantNarrative,
      summaries: consequences.flatMap(toSummary)
    };
  }
}

function consequencesFromNPCReactions(
  reactions: readonly PersistableNPCReaction[]
): ConsequenceProposal[] {
  return reactions.flatMap((reaction) => [
    ...(Object.keys(reaction.statePatch).length === 0
      ? []
      : [
          {
            type: "npc_state_change" as const,
            source: "npc_ai" as const,
            npcId: reaction.npcId,
            statePatch: reaction.statePatch
          }
        ]),
    ...reaction.relationshipDeltas.map((delta) => ({
      type: "relationship_delta" as const,
      source: "npc_ai" as const,
      sourceEntity: { type: "npc" as const, id: reaction.npcId },
      targetEntity: {
        type: delta.targetType,
        id: delta.targetId
      },
      affinityDelta: delta.affinityDelta,
      trustDelta: delta.trustDelta,
      fearDelta: delta.fearDelta
    })),
    ...reaction.memoryCandidates.map((candidate) => ({
      type: "custom_safe" as const,
      source: "npc_ai" as const,
      eventType: "npc_memory",
      title: candidate.key ?? "npc.memory",
      description: candidate.content,
      importance: candidate.importance,
      metadata: {
        npcId: reaction.npcId,
        memoryType: candidate.memoryType,
        key: candidate.key ?? null
      }
    }))
  ]);
}

function mergeStatePatchWithConsequences(
  state: GameStateRecord,
  basePatch: StatePatch,
  consequences: readonly ValidatedConsequence[]
): StatePatch {
  const snapshot = toStateSnapshot(state);
  const flags = {
    ...snapshot.flags,
    ...(basePatch.flags ?? {})
  };
  const stateData = {
    ...snapshot.stateData,
    ...(basePatch.stateData ?? {})
  };
  let flagsChanged = basePatch.flags !== undefined;
  let stateDataChanged = basePatch.stateData !== undefined;

  for (const consequence of consequences) {
    if (consequence.type === "flag_set" && consequence.flagKey) {
      flags[consequence.flagKey] = consequence.value;
      flagsChanged = true;
    }

    if (consequence.type === "state_value_change" && consequence.stateKey) {
      stateData[consequence.stateKey] = consequence.value;
      stateDataChanged = true;
    }

    if (consequence.type === "reputation_delta" && consequence.reputationKey) {
      const reputation = reputationObject(stateData.reputation);
      reputation[consequence.reputationKey] = clamp(
        numberFromUnknown(reputation[consequence.reputationKey]) +
          (consequence.delta ?? 0),
        -100,
        100
      );
      stateData.reputation = reputation;
      stateDataChanged = true;
    }
  }

  return {
    ...basePatch,
    ...(flagsChanged ? { flags } : {}),
    ...(stateDataChanged ? { stateData } : {})
  };
}

function toWorldEvent(consequence: ValidatedConsequence): GeneratedWorldEvent[] {
  if (consequence.type !== "world_event") {
    return [];
  }

  return [
    {
      eventType: consequence.eventType ?? "world_event",
      title: consequence.title ?? "Sự kiện",
      description: consequence.description ?? "Một hệ quả đã xảy ra.",
      importance: consequence.importance ?? 3,
      payload: {
        source: consequence.source,
        consequenceType: consequence.type
      }
    }
  ];
}

function toMemoryCandidate(consequence: ValidatedConsequence): MemoryCandidate[] {
  if (
    consequence.type === "quest_activate" ||
    consequence.type === "quest_complete" ||
    consequence.type === "quest_fail"
  ) {
    return [
      {
        memoryType: "quest",
        key: `quest:${consequence.questKey}:${consequence.type}`,
        content: `${questSummaryTitle(consequence.type)}: ${consequence.questKey}.`,
        importance: consequence.type === "quest_activate" ? 3 : 4
      }
    ];
  }

  if (consequence.type === "custom_safe" && consequence.eventType === "npc_memory") {
    return [
      {
        memoryType: "npc",
        key:
          typeof consequence.metadata?.key === "string"
            ? `npc:${consequence.metadata.npcId}:${consequence.metadata.key}`
            : null,
        subjectType: "npc",
        subjectId:
          typeof consequence.metadata?.npcId === "string"
            ? consequence.metadata.npcId
            : null,
        content: consequence.description ?? "",
        importance: consequence.importance ?? 3
      }
    ];
  }

  return [];
}

function toSummary(consequence: ValidatedConsequence): ConsequenceSummary[] {
  if (
    consequence.type === "quest_activate" ||
    consequence.type === "quest_complete" ||
    consequence.type === "quest_fail"
  ) {
    return [
      {
        type: "quest",
        title: questSummaryTitle(consequence.type),
        description: consequence.questKey ?? ""
      }
    ];
  }

  if (consequence.type === "inventory_add" || consequence.type === "inventory_remove") {
    return [
      {
        type: "inventory",
        title: consequence.type === "inventory_add" ? "Nhận vật phẩm" : "Mất vật phẩm",
        description: consequence.itemName ?? consequence.itemKey ?? ""
      }
    ];
  }

  if (consequence.type === "relationship_delta") {
    return [
      {
        type: "relationship",
        title: "Quan hệ thay đổi",
        description: "Một quan hệ trong phiên chơi đã thay đổi."
      }
    ];
  }

  return [];
}

function questSummaryTitle(type: ValidatedConsequence["type"]): string {
  if (type === "quest_activate") {
    return "Nhiệm vụ mới";
  }

  if (type === "quest_complete") {
    return "Nhiệm vụ hoàn thành";
  }

  if (type === "quest_fail") {
    return "Nhiệm vụ thất bại";
  }

  return "Nhiệm vụ";
}

function reputationObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }

  return {};
}

function numberFromUnknown(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}

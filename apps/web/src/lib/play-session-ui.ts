import type { AbilityAttempt } from "./api";

export type RuntimeAbilityDefinition = {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly rank: number;
  readonly resourceCost: Record<string, unknown> | null;
  readonly cooldownTurns: number;
};

export type RuntimeAbility = RuntimeAbilityDefinition & {
  readonly abilityKey: string;
  readonly currentCooldown: number;
  readonly enabled: boolean;
  readonly unlocked: boolean;
  readonly status: "READY" | "COOLDOWN" | "DISABLED";
};

export function readRuntimeAbilities(
  stateData: Record<string, unknown>
): RuntimeAbility[] {
  const abilitiesRecord =
    stateData.abilities &&
    typeof stateData.abilities === "object" &&
    !Array.isArray(stateData.abilities)
      ? (stateData.abilities as Record<string, unknown>)
      : null;
  const definitions = Array.isArray(abilitiesRecord?.definitions)
    ? abilitiesRecord.definitions
    : [];
  const owned = Array.isArray(abilitiesRecord?.owned) ? abilitiesRecord.owned : [];
  const definitionsByKey = new Map(
    definitions.flatMap((definition) => {
      if (!definition || typeof definition !== "object") return [];
      const record = definition as Record<string, unknown>;
      if (typeof record.key !== "string" || typeof record.name !== "string") {
        return [];
      }

      return [
        [
          record.key,
          {
            key: record.key,
            name: record.name,
            description:
              typeof record.description === "string" ? record.description : "",
            category:
              typeof record.category === "string" ? record.category : "other",
            rank: typeof record.rank === "number" ? record.rank : 1,
            resourceCost:
              record.resourceCost &&
              typeof record.resourceCost === "object" &&
              !Array.isArray(record.resourceCost)
                ? (record.resourceCost as Record<string, unknown>)
                : null,
            cooldownTurns:
              typeof record.cooldownTurns === "number"
                ? record.cooldownTurns
                : 0
          } satisfies RuntimeAbilityDefinition
        ] as const
      ];
    })
  );

  return owned.flatMap((ability) => {
    if (!ability || typeof ability !== "object") return [];
    const record = ability as Record<string, unknown>;
    if (typeof record.abilityKey !== "string") return [];
    const definition = definitionsByKey.get(record.abilityKey);
    if (!definition) return [];
    const currentCooldown =
      typeof record.currentCooldown === "number" ? record.currentCooldown : 0;
    const enabled = record.enabled !== false;
    const unlocked = record.unlocked !== false;

    return [
      {
        ...definition,
        abilityKey: record.abilityKey,
        rank: typeof record.rank === "number" ? record.rank : definition.rank,
        currentCooldown,
        enabled,
        unlocked,
        status:
          currentCooldown > 0
            ? "COOLDOWN"
            : enabled && unlocked
              ? "READY"
              : "DISABLED"
      }
    ];
  });
}

export function readLatestAbilityAttempt(
  stateData: Record<string, unknown>
): AbilityAttempt | null {
  const attempt = stateData.latestAbilityAttempt;
  if (!attempt || typeof attempt !== "object" || Array.isArray(attempt)) {
    return null;
  }

  return normalizeAbilityAttempt(attempt as Record<string, unknown>);
}

export function normalizeAbilityAttempt(
  record: Record<string, unknown>
): AbilityAttempt | null {
  if (
    typeof record.turnNumber !== "number" ||
    typeof record.authorized !== "boolean" ||
    typeof record.reason !== "string"
  ) {
    return null;
  }

  return {
    turnNumber: record.turnNumber,
    requestedName:
      typeof record.requestedName === "string" ? record.requestedName : null,
    requestedKey:
      typeof record.requestedKey === "string" ? record.requestedKey : null,
    matchedAbilityKey:
      typeof record.matchedAbilityKey === "string"
        ? record.matchedAbilityKey
        : null,
    authorized: record.authorized,
    reason: record.reason,
    cooldownRemaining:
      typeof record.cooldownRemaining === "number"
        ? record.cooldownRemaining
        : null,
    resourceCost:
      record.resourceCost &&
      typeof record.resourceCost === "object" &&
      !Array.isArray(record.resourceCost)
        ? (record.resourceCost as Record<string, unknown>)
        : null,
    abilityName:
      typeof record.abilityName === "string" ? record.abilityName : null,
    abilityKey: typeof record.abilityKey === "string" ? record.abilityKey : null,
    cooldownApplied:
      typeof record.cooldownApplied === "number" ? record.cooldownApplied : null,
    noAbilityStateMutation: record.noAbilityStateMutation !== false
  };
}

export function formatResourceCost(
  resourceCost: Record<string, unknown> | null | undefined
): string {
  if (!resourceCost) {
    return "Không có";
  }

  const statKey =
    typeof resourceCost.statKey === "string" ? resourceCost.statKey : "resource";
  const amount =
    typeof resourceCost.amount === "number" ? resourceCost.amount : 0;
  return `${amount} ${statKey}`;
}

export function formatAbilityAttemptReason(reason: string): string {
  switch (reason) {
    case "unknown_ability":
      return "UNKNOWN";
    case "not_owned":
      return "NOT OWNED";
    case "cooldown":
      return "COOLDOWN";
    case "insufficient_resource":
      return "INSUFFICIENT RESOURCE";
    case "disabled":
      return "DISABLED";
    case "owned":
      return "OWNED";
    default:
      return reason.toUpperCase();
  }
}

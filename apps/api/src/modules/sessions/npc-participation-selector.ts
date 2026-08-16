import type { NpcRecord } from "@ai-novel/db";

export type NPCParticipationSelectorOptions = {
  readonly maxReactionsPerTurn: number;
};

export class NPCParticipationSelector {
  constructor(private readonly options: NPCParticipationSelectorOptions) {}

  select(input: {
    readonly npcs: readonly NpcRecord[];
    readonly action: string;
    readonly location: string;
  }): NpcRecord[] {
    const action = normalize(input.action);
    const location = normalize(input.location);
    const scored = input.npcs
      .filter((npc) => npc.alive)
      .map((npc) => ({
        npc,
        score: scoreNpc(npc, action, location)
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.npc.name.localeCompare(right.npc.name);
      });

    return scored
      .slice(0, this.options.maxReactionsPerTurn)
      .map((candidate) => candidate.npc);
  }
}

function scoreNpc(npc: NpcRecord, action: string, location: string): number {
  let score = 0;
  const npcName = normalize(npc.name);

  if (npcName && action.includes(npcName)) {
    score += 100;
  }

  const npcLocation = normalize(stringFromState(npc.currentState, "location"));

  if (npcLocation && location && npcLocation === location) {
    score += 25;
  }

  if (stringFromState(npc.currentState, "recentlyActive") === "true") {
    score += 10;
  }

  return score;
}

function stringFromState(
  state: Record<string, unknown>,
  key: string
): string | null {
  const value = state[key];

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function normalize(value: string | null): string {
  return (value ?? "")
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

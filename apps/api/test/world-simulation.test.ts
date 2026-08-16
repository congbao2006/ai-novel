import { describe, expect, it } from "vitest";
import type {
  FactionRecord,
  FactionRelationshipRecord,
  GameStateRecord,
  Repositories,
  RepositoryContext,
  SessionMemoryRecord,
  WorldEventRecord,
  WorldSimulationStateRecord
} from "@ai-novel/db";
import { ConflictError } from "@ai-novel/db";
import { WorldSimulationService } from "../src/modules/sessions/world-simulation-service.js";

const sessionId = "550e8400-e29b-41d4-a716-446655440002";

function createFixture(options: { readonly failEventAppend?: boolean } = {}) {
  const factions: FactionRecord[] = [
    {
      id: "550e8400-e29b-41d4-a716-446655440201",
      sessionId,
      factionKey: "guard",
      name: "Guard",
      description: "Keeps order.",
      status: "active",
      influence: 50,
      resources: { manpower: 10 },
      goals: [],
      state: {},
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z")
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440202",
      sessionId,
      factionKey: "guild",
      name: "Guild",
      description: "Moves goods.",
      status: "active",
      influence: 40,
      resources: {},
      goals: [],
      state: {},
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z")
    }
  ];
  const relations: FactionRelationshipRecord[] = [];
  const events: WorldEventRecord[] = [];
  const memories: SessionMemoryRecord[] = [];
  const tickState: WorldSimulationStateRecord = {
    id: "550e8400-e29b-41d4-a716-446655440203",
    sessionId,
    lastTickTurn: 0,
    version: 1,
    createdAt: new Date("2026-01-02T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z")
  };
  const state: GameStateRecord = {
    id: "550e8400-e29b-41d4-a716-446655440204",
    sessionId,
    version: 1,
    location: "Gate",
    worldTime: null,
    playerStats: {},
    flags: {},
    stateData: {},
    createdAt: new Date("2026-01-02T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z")
  };

  const repositories = {
    factions: {
      async listBySession(requestedSessionId: string) {
        return factions.filter((faction) => faction.sessionId === requestedSessionId);
      },
      async getByIdForSession(requestedSessionId: string, factionId: string) {
        return (
          factions.find(
            (faction) =>
              faction.sessionId === requestedSessionId && faction.id === factionId
          ) ?? null
        );
      },
      async updateRuntimeState(input: Parameters<Repositories["factions"]["updateRuntimeState"]>[0]) {
        const faction = factions.find(
          (item) => item.sessionId === input.sessionId && item.id === input.factionId
        );

        if (!faction) {
          throw new ConflictError("Faction not found.");
        }

        Object.assign(faction, {
          influence: input.influence ?? faction.influence,
          status: input.status ?? faction.status,
          resources: input.resources ?? faction.resources,
          state: input.state ?? faction.state,
          updatedAt: new Date("2026-01-02T00:01:00Z")
        });
        return faction;
      }
    },
    factionRelationships: {
      async listForSession(requestedSessionId: string) {
        return relations.filter((relation) => relation.sessionId === requestedSessionId);
      },
      async getRelation(
        requestedSessionId: string,
        sourceFactionId: string,
        targetFactionId: string
      ) {
        return (
          relations.find(
            (relation) =>
              relation.sessionId === requestedSessionId &&
              relation.sourceFactionId === sourceFactionId &&
              relation.targetFactionId === targetFactionId
          ) ?? null
        );
      },
      async upsertRelation(
        input: Parameters<Repositories["factionRelationships"]["upsertRelation"]>[0]
      ) {
        const relation = {
          id: `relation-${relations.length + 1}`,
          updatedAt: new Date("2026-01-02T00:01:00Z"),
          ...input
        } as FactionRelationshipRecord;
        relations.push(relation);
        return relation;
      }
    },
    worldSimulationStates: {
      async getForSession(requestedSessionId: string) {
        return requestedSessionId === sessionId ? tickState : null;
      },
      async createInitial(
        input: Parameters<Repositories["worldSimulationStates"]["createInitial"]>[0]
      ) {
        Object.assign(tickState, {
          sessionId: input.sessionId,
          lastTickTurn: input.lastTickTurn
        });
        return tickState;
      },
      async updateAfterTickWithVersion(
        input: Parameters<Repositories["worldSimulationStates"]["updateAfterTickWithVersion"]>[0]
      ) {
        if (input.expectedVersion !== tickState.version) {
          throw new ConflictError("World simulation state version conflict.");
        }

        Object.assign(tickState, {
          lastTickTurn: input.lastTickTurn,
          version: tickState.version + 1
        });
        return tickState;
      }
    },
    gameStates: {
      async getCurrentState(requestedSessionId: string) {
        return requestedSessionId === sessionId ? state : null;
      }
    },
    worldEvents: {
      async getImportantEvents() {
        return events.filter((event) => event.importance >= 3);
      },
      async append(input: Parameters<Repositories["worldEvents"]["append"]>[0]) {
        if (options.failEventAppend) {
          throw new ConflictError("Event failed.");
        }

        const event = {
          id: `event-${events.length + 1}`,
          createdAt: new Date("2026-01-02T00:01:00Z"),
          ...input
        } as WorldEventRecord;
        events.push(event);
        return event;
      }
    },
    memories: {
      async findByKey() {
        return null;
      },
      async createMemory(input: Parameters<Repositories["memories"]["createMemory"]>[0]) {
        const memory = {
          id: `memory-${memories.length + 1}`,
          active: true,
          createdAt: new Date("2026-01-02T00:01:00Z"),
          updatedAt: new Date("2026-01-02T00:01:00Z"),
          ...input
        } as SessionMemoryRecord;
        memories.push(memory);
        return memory;
      }
    }
  } as unknown as Repositories;
  const transactionRunner = async <T>(
    work: (context: RepositoryContext) => Promise<T>
  ) => {
    const factionSnapshot = structuredClone(factions);
    const relationSnapshot = structuredClone(relations);
    const eventSnapshot = structuredClone(events);
    const memorySnapshot = structuredClone(memories);
    const tickSnapshot = structuredClone(tickState);

    try {
      return await work({ db: {} as RepositoryContext["db"], repositories });
    } catch (error) {
      factions.splice(0, factions.length, ...factionSnapshot);
      relations.splice(0, relations.length, ...relationSnapshot);
      events.splice(0, events.length, ...eventSnapshot);
      memories.splice(0, memories.length, ...memorySnapshot);
      Object.assign(tickState, tickSnapshot);
      throw error;
    }
  };

  return {
    factions,
    relations,
    events,
    memories,
    tickState,
    service: new WorldSimulationService(repositories, undefined, transactionRunner, {
      tickIntervalTurns: 5
    })
  };
}

describe("WorldSimulationService", () => {
  it("applies an explicit deterministic tick and prevents double execution", async () => {
    const fixture = createFixture();

    const result = await fixture.service.runIfDue({
      sessionId,
      turnNumber: 5,
      reason: "gameplay_turn",
      signals: [
        {
          type: "faction_helped",
          factionKey: "guard",
          importance: 4
        }
      ]
    });
    const second = await fixture.service.runIfDue({
      sessionId,
      turnNumber: 5,
      reason: "gameplay_turn",
      signals: [
        {
          type: "faction_helped",
          factionKey: "guard",
          importance: 4
        }
      ]
    });

    expect(result.triggered).toBe(true);
    expect(fixture.factions[0]?.influence).toBe(58);
    expect(fixture.tickState.lastTickTurn).toBe(5);
    expect(second.triggered).toBe(false);
    expect(fixture.factions[0]?.influence).toBe(58);
  });

  it("keeps unrelated session factions isolated", async () => {
    const fixture = createFixture();

    const result = await fixture.service.runIfDue({
      sessionId: "550e8400-e29b-41d4-a716-446655440999",
      turnNumber: 5,
      reason: "manual",
      signals: [
        {
          type: "faction_helped",
          factionKey: "guard",
          importance: 5
        }
      ]
    });

    expect(result.triggered).toBe(false);
    expect(fixture.factions[0]?.influence).toBe(50);
  });

  it("rolls back through the caller transaction when tick persistence fails", async () => {
    const fixture = createFixture({ failEventAppend: true });

    await expect(
      fixture.service.runIfDue({
        sessionId,
        turnNumber: 5,
        reason: "manual",
        signals: [
          {
            type: "faction_helped",
            factionKey: "guard",
            importance: 5
          }
        ]
      })
    ).rejects.toBeInstanceOf(ConflictError);
    expect(fixture.factions[0]?.influence).toBe(50);
    expect(fixture.tickState.lastTickTurn).toBe(0);
  });
});

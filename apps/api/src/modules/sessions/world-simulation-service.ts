import {
  deriveWorldSimulationSignals,
  nextFactionStatusForInfluence,
  runWorldSimulation,
  shouldRunWorldTick,
  type FactionRuntime,
  type MemoryCandidate,
  type WorldSimulationSignal
} from "@ai-novel/domain";
import type {
  DatabaseClient,
  FactionRecord,
  GameStateRecord,
  RepositoryContext,
  Repositories,
  SessionMemoryRecord,
  WorldEventRecord
} from "@ai-novel/db";
import { ConflictError, withTransaction } from "@ai-novel/db";
import type { MemoryEmbeddingService } from "./memory-embedding-service.js";
import { toStateSnapshot } from "./memory-context-builder.js";
import type { TransactionRunner } from "./service.js";

export type WorldTickReason = "gameplay_turn" | "manual" | "major_event";

export type WorldTickResult = {
  readonly triggered: boolean;
  readonly skippedReason?: string;
  readonly events: readonly WorldEventRecord[];
  readonly memories: readonly SessionMemoryRecord[];
  readonly factionsChanged: number;
  readonly rulesApplied: number;
};

export class WorldSimulationService {
  private readonly runInTransaction: TransactionRunner;

  constructor(
    private readonly repositories: Repositories,
    database?: DatabaseClient,
    transactionRunner?: TransactionRunner,
    private readonly options: {
      readonly tickIntervalTurns: number;
      readonly memoryEmbeddingService?: MemoryEmbeddingService;
    } = { tickIntervalTurns: 5 }
  ) {
    this.runInTransaction =
      transactionRunner ??
      (database
        ? (work) => withTransaction(database, work)
        : async () => ({
            triggered: false,
            skippedReason: "database_unavailable",
            events: [],
            memories: [],
            factionsChanged: 0,
            rulesApplied: 0
          } as never));
  }

  async runIfDue(input: {
    readonly userId?: string;
    readonly sessionId: string;
    readonly turnNumber: number;
    readonly reason: WorldTickReason;
    readonly signals?: readonly WorldSimulationSignal[];
    readonly turnEvents?: readonly {
      readonly eventType: string;
      readonly title: string;
      readonly description: string;
      readonly importance: number;
      readonly payload: Record<string, unknown>;
    }[];
  }): Promise<WorldTickResult> {
    const explicitSignals = input.signals ?? [];
    const eventSignals = deriveWorldSimulationSignals({
      events: input.turnEvents ?? [],
      consequences: []
    });
    const signals = [...explicitSignals, ...eventSignals];
    const forced =
      input.reason === "manual" ||
      input.reason === "major_event" ||
      signals.some((signal) => signal.importance >= 4);

    const result = await this.runInTransaction(async (context) => {
      const tickState =
        (await context.repositories.worldSimulationStates.getForSession(
          input.sessionId
        )) ??
        (await context.repositories.worldSimulationStates.createInitial({
          sessionId: input.sessionId,
          lastTickTurn: 0
        }));

      if (
        !shouldRunWorldTick({
          turnCount: input.turnNumber,
          intervalTurns: this.options.tickIntervalTurns,
          lastTickTurn: tickState.lastTickTurn,
          forced
        })
      ) {
        return {
          triggered: false,
          skippedReason: "not_due",
          events: [],
          memories: [],
          factionsChanged: 0,
          rulesApplied: 0
        };
      }

      const [factions, relations, state, recentEvents] = await Promise.all([
        context.repositories.factions.listBySession(input.sessionId),
        context.repositories.factionRelationships.listForSession(input.sessionId),
        context.repositories.gameStates.getCurrentState(input.sessionId),
        context.repositories.worldEvents.getImportantEvents(input.sessionId, 3, 20)
      ]);

      if (!state || factions.length === 0) {
        return {
          triggered: false,
          skippedReason: "missing_world_state",
          events: [],
          memories: [],
          factionsChanged: 0,
          rulesApplied: 0
        };
      }

      const simulation = runWorldSimulation({
        sessionId: input.sessionId,
        currentTurn: input.turnNumber,
        factions: factions.map(toFactionRuntime),
        factionRelations: relations,
        recentWorldEvents: recentEvents.map((event) => ({
          eventType: event.eventType,
          title: event.title,
          description: event.description,
          importance: event.importance,
          turnNumber: event.turnNumber
        })),
        state: toStateSnapshot(state),
        signals
      });

      return persistWorldTick(context, {
        sessionId: input.sessionId,
        turnNumber: input.turnNumber,
        expectedTickVersion: tickState.version,
        factions,
        state,
        plan: simulation.plan,
        rulesApplied: simulation.appliedRuleCount
      });
    });

    if (result.memories.length > 0) {
      await this.options.memoryEmbeddingService?.embedMemoriesBestEffort({
        ...(input.userId ? { userId: input.userId } : {}),
        sessionId: input.sessionId,
        memories: result.memories
      });
    }

    return result;
  }
}

async function persistWorldTick(
  context: RepositoryContext,
  input: {
    readonly sessionId: string;
    readonly turnNumber: number;
    readonly expectedTickVersion: number;
    readonly factions: readonly FactionRecord[];
    readonly state: GameStateRecord;
    readonly plan: ReturnType<typeof runWorldSimulation>["plan"];
    readonly rulesApplied: number;
  }
): Promise<WorldTickResult> {
  const factionById = new Map(input.factions.map((faction) => [faction.id, faction]));
  const events: WorldEventRecord[] = [];
  const memories: SessionMemoryRecord[] = [];

  for (const change of input.plan.factionChanges) {
    const faction = factionById.get(change.factionId);

    if (!faction) {
      throw new ConflictError("Faction tick target was not found.");
    }

    const influence = clampInteger(
      faction.influence + (change.influenceDelta ?? 0),
      0,
      100
    );
    await context.repositories.factions.updateRuntimeState({
      sessionId: input.sessionId,
      factionId: faction.id,
      influence,
      status: nextFactionStatusForInfluence(faction.status, influence),
      resources: applyResourceDelta(faction.resources, change.resourcesDelta ?? {}),
      state: {
        ...copyJsonObject(faction.state),
        ...(change.statePatch ?? {}),
        lastWorldTickTurn: input.turnNumber
      }
    });
  }

  for (const change of input.plan.factionRelationChanges) {
    await assertFactionInSession(context, input.sessionId, change.sourceFactionId);
    await assertFactionInSession(context, input.sessionId, change.targetFactionId);
    const existing = await context.repositories.factionRelationships.getRelation(
      input.sessionId,
      change.sourceFactionId,
      change.targetFactionId
    );

    await context.repositories.factionRelationships.upsertRelation({
      sessionId: input.sessionId,
      sourceFactionId: change.sourceFactionId,
      targetFactionId: change.targetFactionId,
      affinity: clampInteger(
        (existing?.affinity ?? 0) + (change.affinityDelta ?? 0),
        -100,
        100
      ),
      tension: clampInteger(
        (existing?.tension ?? 0) + (change.tensionDelta ?? 0),
        -100,
        100
      ),
      metadata: {
        ...(existing?.metadata ?? {}),
        source: "world_simulation",
        lastTickTurn: input.turnNumber
      }
    });
  }

  if (Object.keys(input.plan.statePatch).length > 0) {
    await context.repositories.gameStates.updateStateWithVersion({
      sessionId: input.sessionId,
      expectedVersion: input.state.version,
      ...input.plan.statePatch
    });
  }

  for (const event of input.plan.events) {
    events.push(
      await context.repositories.worldEvents.append({
        sessionId: input.sessionId,
        eventType: event.eventType,
        title: event.title,
        description: event.description,
        importance: event.importance,
        payload: event.payload,
        turnNumber: input.turnNumber
      })
    );
  }

  for (const memory of input.plan.memories) {
    memories.push(
      await upsertWorldMemory(context, {
        sessionId: input.sessionId,
        turnNumber: input.turnNumber,
        memory
      })
    );
  }

  await context.repositories.worldSimulationStates.updateAfterTickWithVersion({
    sessionId: input.sessionId,
    expectedVersion: input.expectedTickVersion,
    lastTickTurn: input.turnNumber
  });

  return {
    triggered: true,
    events,
    memories,
    factionsChanged: input.plan.factionChanges.length,
    rulesApplied: input.rulesApplied
  };
}

async function upsertWorldMemory(
  context: RepositoryContext,
  input: {
    readonly sessionId: string;
    readonly turnNumber: number;
    readonly memory: MemoryCandidate;
  }
): Promise<SessionMemoryRecord> {
  const existing = input.memory.key
    ? await context.repositories.memories.findByKey(input.sessionId, input.memory.key)
    : null;

  if (existing) {
    return context.repositories.memories.updateMemory({
      sessionId: input.sessionId,
      memoryId: existing.id,
      content: input.memory.content,
      importance: Math.max(existing.importance, input.memory.importance),
      lastConfirmedTurn: input.turnNumber,
      active: true,
      metadata: {
        ...existing.metadata,
        source: "world_simulation"
      }
    });
  }

  return context.repositories.memories.createMemory({
    sessionId: input.sessionId,
    memoryType: input.memory.memoryType,
    subjectType: input.memory.subjectType ?? null,
    subjectId: input.memory.subjectId ?? null,
    key: input.memory.key ?? null,
    content: input.memory.content,
    importance: input.memory.importance,
    firstObservedTurn: input.turnNumber,
    lastConfirmedTurn: input.turnNumber,
    metadata: {
      ...(input.memory.metadata ?? {}),
      source: "world_simulation"
    }
  });
}

async function assertFactionInSession(
  context: RepositoryContext,
  sessionId: string,
  factionId: string
): Promise<void> {
  const faction = await context.repositories.factions.getByIdForSession(
    sessionId,
    factionId
  );

  if (!faction) {
    throw new ConflictError("Faction relation target was not found.");
  }
}

function toFactionRuntime(faction: FactionRecord): FactionRuntime {
  return {
    id: faction.id,
    sessionId: faction.sessionId,
    factionKey: faction.factionKey,
    name: faction.name,
    description: faction.description,
    status: faction.status,
    influence: faction.influence,
    resources: copyJsonObject(faction.resources),
    goals: JSON.parse(JSON.stringify(faction.goals)) as FactionRuntime["goals"],
    state: copyJsonObject(faction.state)
  };
}

function applyResourceDelta(
  current: Record<string, unknown>,
  delta: Record<string, number>
): Record<string, unknown> {
  const next = copyJsonObject(current);

  for (const [key, value] of Object.entries(delta)) {
    const currentValue = typeof next[key] === "number" ? next[key] : 0;
    next[key] = clampInteger(currentValue + value, 0, 1000);
  }

  return next;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

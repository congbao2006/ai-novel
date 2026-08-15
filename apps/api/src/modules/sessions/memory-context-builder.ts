import type {
  ContextBundle,
  GameStateSnapshot,
  PersistentMemory,
  SessionSummary
} from "@ai-novel/domain";
import type {
  GameMessageRecord,
  GameStateRecord,
  Repositories,
  SessionMemoryRecord,
  SessionSummaryRecord,
  WorldEventRecord
} from "@ai-novel/db";

export type MemoryContextBudget = {
  readonly maxRecentMessages: number;
  readonly maxMemories: number;
  readonly maxWorldEvents: number;
  readonly maxSummaryChars: number;
  readonly maxMemoryChars: number;
};

export type BuildMemoryContextInput = {
  readonly sessionId: string;
  readonly state: GameStateRecord;
};

export class MemoryContextBuilder {
  constructor(
    private readonly repositories: Repositories,
    private readonly budget: MemoryContextBudget
  ) {}

  async buildForTurn(input: BuildMemoryContextInput): Promise<ContextBundle> {
    const [recentMessages, summary, memories, worldEvents] = await Promise.all([
      this.repositories.gameMessages.getRecentMessages(
        input.sessionId,
        this.budget.maxRecentMessages
      ),
      this.repositories.sessionSummaries.getForSession(input.sessionId),
      this.repositories.memories.listImportantForSession(
        input.sessionId,
        this.budget.maxMemories
      ),
      this.repositories.worldEvents.getImportantEvents(
        input.sessionId,
        3,
        this.budget.maxWorldEvents
      )
    ]);

    return {
      state: toStateSnapshot(input.state),
      recentMessages: recentMessages
        .sort(compareMessages)
        .map((message) => ({
          role: message.role,
          content: trimToBudget(message.content, this.budget.maxMemoryChars),
          turnNumber: message.turnNumber
        })),
      summary: summary ? toSessionSummary(summary, this.budget.maxSummaryChars) : null,
      memories: memories.map((memory) =>
        toPersistentMemory(memory, this.budget.maxMemoryChars)
      ),
      worldEvents: worldEvents.map(toContextWorldEvent),
      budget: this.budget
    };
  }
}

export function toStateSnapshot(state: GameStateRecord): GameStateSnapshot {
  return {
    version: state.version,
    location: state.location,
    worldTime: state.worldTime,
    playerStats: copyJsonObject(state.playerStats),
    flags: copyJsonObject(state.flags),
    stateData: copyJsonObject(state.stateData)
  };
}

function toSessionSummary(
  summary: SessionSummaryRecord,
  maxChars: number
): SessionSummary {
  return {
    sessionId: summary.sessionId,
    summaryText: trimToBudget(summary.summaryText, maxChars),
    summarizedThroughTurn: summary.summarizedThroughTurn,
    version: summary.version
  };
}

function toPersistentMemory(
  memory: SessionMemoryRecord,
  maxChars: number
): PersistentMemory {
  return {
    id: memory.id,
    sessionId: memory.sessionId,
    memoryType: memory.memoryType,
    subjectType: memory.subjectType,
    subjectId: memory.subjectId,
    key: memory.key,
    content: trimToBudget(memory.content, maxChars),
    importance: memory.importance,
    firstObservedTurn: memory.firstObservedTurn,
    lastConfirmedTurn: memory.lastConfirmedTurn,
    active: memory.active,
    metadata: copyJsonObject(memory.metadata)
  };
}

function toContextWorldEvent(event: WorldEventRecord) {
  return {
    eventType: event.eventType,
    title: event.title,
    description: event.description,
    importance: event.importance,
    turnNumber: event.turnNumber
  };
}

function compareMessages(
  left: GameMessageRecord,
  right: GameMessageRecord
): number {
  if (left.turnNumber !== right.turnNumber) {
    return left.turnNumber - right.turnNumber;
  }

  return left.createdAt.getTime() - right.createdAt.getTime();
}

function trimToBudget(value: string, maxChars: number): string {
  return value.length <= maxChars ? value : `${value.slice(0, maxChars)}...`;
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

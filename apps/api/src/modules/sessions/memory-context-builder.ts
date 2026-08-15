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
  SemanticMemorySearchResult,
  SessionSummaryRecord,
  WorldEventRecord
} from "@ai-novel/db";
import {
  mergeAndRankMemories,
  type SemanticMemoryService
} from "./semantic-memory-service.js";

export type MemoryContextBudget = {
  readonly maxRecentMessages: number;
  readonly maxMemories: number;
  readonly maxWorldEvents: number;
  readonly maxSummaryChars: number;
  readonly maxMemoryChars: number;
};

export type BuildMemoryContextInput = {
  readonly userId?: string;
  readonly sessionId: string;
  readonly state: GameStateRecord;
  readonly action?: string;
};

export type MemoryContextBuilderOptions = {
  readonly semanticMemoryService?: SemanticMemoryService;
  readonly logger?: {
    info(metadata: Record<string, unknown>, message: string): void;
  };
};

export class MemoryContextBuilder {
  constructor(
    private readonly repositories: Repositories,
    private readonly budget: MemoryContextBudget,
    private readonly options: MemoryContextBuilderOptions = {}
  ) {}

  async buildForTurn(input: BuildMemoryContextInput): Promise<ContextBundle> {
    const [recentMessages, summary, deterministicMemories, worldEvents] =
      await Promise.all([
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
    const semanticMemories = await this.trySearchSemanticMemories(input);
    const rankedMemories = mergeAndRankMemories({
      deterministic: deterministicMemories,
      semantic: semanticMemories,
      limit: this.budget.maxMemories
    });

    this.options.logger?.info(
      {
        sessionId: input.sessionId,
        deterministicMemoryCount: deterministicMemories.length,
        semanticMemoryCount: semanticMemories.length,
        finalMemoryCount: rankedMemories.length
      },
      "memory context built"
    );

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
      memories: rankedMemories.map(({ memory }) =>
        toPersistentMemory(memory, this.budget.maxMemoryChars)
      ),
      worldEvents: worldEvents.map(toContextWorldEvent),
      budget: this.budget
    };
  }

  private async trySearchSemanticMemories(
    input: BuildMemoryContextInput
  ): Promise<SemanticMemorySearchResult[]> {
    if (!this.options.semanticMemoryService || !input.userId || !input.action) {
      return [];
    }

    try {
      return await this.options.semanticMemoryService.searchRelevantMemories({
        userId: input.userId,
        sessionId: input.sessionId,
        action: input.action,
        location: input.state.location
      });
    } catch {
      return [];
    }
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

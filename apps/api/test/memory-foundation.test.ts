import { describe, expect, it } from "vitest";
import {
  AIGateway,
  createPolicy,
  type LLMProvider
} from "@ai-novel/ai-engine";
import type {
  GameMessageRecord,
  GameStateRecord,
  Repositories,
  SessionMemoryRecord,
  SessionSummaryRecord,
  WorldEventRecord
} from "@ai-novel/db";
import { AIInvalidResponseError } from "@ai-novel/ai-engine";
import type { SummaryOutput } from "@ai-novel/domain";
import { MemoryContextBuilder } from "../src/modules/sessions/memory-context-builder.js";
import { SummaryService } from "../src/modules/sessions/summary-service.js";

const sessionId = "550e8400-e29b-41d4-a716-446655440002";
const userId = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-01-01T00:00:00Z");

const state: GameStateRecord = {
  id: "state-1",
  sessionId,
  version: 2,
  location: "Bến thuyền",
  worldTime: null,
  playerStats: { hp: 8, stamina: 5 },
  flags: { aiSceneTone: "quiet" },
  stateData: {},
  createdAt: now,
  updatedAt: now
};

describe("memory context builder", () => {
  it("builds bounded multi-layer context with authoritative state first", async () => {
    const repositories = createMemoryRepositories();
    const builder = new MemoryContextBuilder(repositories, {
      maxRecentMessages: 2,
      maxMemories: 1,
      maxWorldEvents: 1,
      maxSummaryChars: 20,
      maxMemoryChars: 24
    });

    const context = await builder.buildForTurn({ sessionId, state });

    expect(context.state.location).toBe("Bến thuyền");
    expect(context.summary?.summaryText).toHaveLength(23);
    expect(context.summary?.summaryText.endsWith("...")).toBe(true);
    expect(context.recentMessages.map((message) => message.content)).toEqual([
      "message-2",
      "message-3"
    ]);
    expect(context.memories).toHaveLength(1);
    expect(context.memories[0]?.content).toHaveLength(27);
    expect(context.memories[0]?.content.endsWith("...")).toBe(true);
    expect(context.worldEvents).toHaveLength(1);
    expect(context.budget.maxMemories).toBe(1);
  });
});

describe("summary service", () => {
  it("skips summary refresh below the configured threshold", async () => {
    const repositories = createMemoryRepositories();
    let called = false;
    const gateway = createGateway(async () => {
      called = true;
      throw new Error("Gateway should not be called.");
    });
    const service = new SummaryService(repositories, gateway, undefined, {
      intervalTurns: 10,
      maxSourceMessages: 10,
      maxSourceEvents: 10
    });

    await service.refreshIfDue({ userId, sessionId, targetTurn: 5 });

    expect(called).toBe(false);
  });

  it("persists summary output and deduplicates important memories by key", async () => {
    const repositories = createMemoryRepositories();
    const gateway = createGateway(async (request) => {
      expect(request.metadata?.purpose).toBe("summary");
      expect(JSON.stringify(request)).toContain("untrusted fiction data");
      return {
        requestId: "summary-request-1",
        text: "structured summary",
        narrativeText: "structured summary",
        structuredOutput: {
          summary: "Người chơi đã tìm thấy một manh mối ở bến thuyền.",
          importantFacts: [
            {
              key: "dock.clue",
              content: "Manh mối ở bến thuyền liên quan đến con thuyền cũ.",
              importance: 5,
              memoryType: "fact"
            }
          ]
        } satisfies SummaryOutput,
        provider: "fake",
        model: "fake-summary-model",
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
        finishReason: "stop",
        latencyMs: 1
      };
    });
    const service = new SummaryService(repositories, gateway, undefined, {
      intervalTurns: 1,
      maxSourceMessages: 10,
      maxSourceEvents: 10
    });

    await service.refreshIfDue({ userId, sessionId, targetTurn: 3 });

    expect(repositories.sessionSummaries.upserted?.summaryText).toContain(
      "manh mối"
    );
    expect(repositories.sessionSummaries.upserted?.summarizedThroughTurn).toBe(3);
    expect(repositories.memories.updated).toHaveLength(1);
    expect(repositories.memories.created).toHaveLength(0);
    expect(repositories.memories.updated[0]).toMatchObject({
      memoryId: "memory-keyed",
      lastConfirmedTurn: 3,
      active: true
    });
  });

  it("does not persist invalid structured summary output", async () => {
    const repositories = createMemoryRepositories();
    const gateway = createGateway(async () => ({
      text: "invalid",
      requestId: "summary-request-2",
      narrativeText: "invalid",
      structuredOutput: {
        summary: "",
        importantFacts: []
      } as SummaryOutput,
      provider: "fake",
      model: "fake-summary-model",
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      finishReason: "stop",
      latencyMs: 1
    }));
    const service = new SummaryService(repositories, gateway, undefined, {
      intervalTurns: 1,
      maxSourceMessages: 10,
      maxSourceEvents: 10
    });

    await expect(
      service.refreshIfDue({ userId, sessionId, targetTurn: 3 })
    ).rejects.toBeInstanceOf(AIInvalidResponseError);
    expect(repositories.sessionSummaries.upserted).toBeNull();
    expect(repositories.memories.created).toEqual([]);
    expect(repositories.memories.updated).toEqual([]);
  });
});

function createGateway(
  generate: LLMProvider<SummaryOutput>["generate"]
): AIGateway {
  return new AIGateway({
    providers: [
      {
        id: "fake",
        estimateUsage: async () => ({
          inputTokens: 10,
          maxOutputTokens: 300
        }),
        generate
      }
    ],
    defaultModelPolicy: createPolicy({
      feature: "summary",
      provider: "fake",
      model: "fake-summary-model",
      maxOutputTokens: 300
    }),
    timeoutMs: 1000,
    maxRetries: 0
  });
}

function createMemoryRepositories() {
  const messages: GameMessageRecord[] = [
    message("message-1", 1),
    message("message-2", 2),
    message("message-3", 3)
  ];
  const summary: SessionSummaryRecord = {
    id: "summary-1",
    sessionId,
    summaryText: "Người chơi đã tới bến thuyền và đang điều tra.",
    summarizedThroughTurn: 0,
    version: 1,
    createdAt: now,
    updatedAt: now
  };
  const memories: SessionMemoryRecord[] = [
    memory("memory-keyed", "dock.clue", 4),
    memory("memory-less-important", null, 2)
  ];
  const events: WorldEventRecord[] = [
    {
      id: "event-1",
      sessionId,
      eventType: "movement",
      title: "Đến bến thuyền",
      description: "Người chơi tới bến thuyền.",
      importance: 4,
      payload: {},
      turnNumber: 2,
      createdAt: now
    },
    {
      id: "event-2",
      sessionId,
      eventType: "minor",
      title: "Gió đổi hướng",
      description: "Gió sông đổi hướng.",
      importance: 1,
      payload: {},
      turnNumber: 3,
      createdAt: now
    }
  ];
  const created: unknown[] = [];
  const updated: unknown[] = [];
  let upserted: { summaryText: string; summarizedThroughTurn: number } | null =
    null;

  return {
    gameMessages: {
      getRecentMessages: async (_sessionId: string, limit: number) =>
        messages.slice(-limit),
      getMessagesForSession: async () => messages
    },
    sessionSummaries: {
      getForSession: async () => summary,
      upsertSummary: async (input: {
        summaryText: string;
        summarizedThroughTurn: number;
      }) => {
        upserted = input;
        return { ...summary, ...input, version: 2 };
      },
      updateWithVersion: async (input: {
        summaryText: string;
        summarizedThroughTurn: number;
      }) => {
        upserted = input;
        return { ...summary, ...input, version: 2 };
      },
      get upserted() {
        return upserted;
      }
    },
    memories: {
      listImportantForSession: async (_sessionId: string, limit: number) =>
        [...memories]
          .sort((left, right) => right.importance - left.importance)
          .slice(0, limit),
      listActiveForSession: async () => memories,
      findByKey: async (_sessionId: string, key: string) =>
        memories.find((candidate) => candidate.key === key) ?? null,
      createMemory: async (input: unknown) => {
        created.push(input);
        return { ...memory("created", null, 3), ...(input as object) };
      },
      updateMemory: async (input: unknown) => {
        updated.push(input);
        return { ...memory("updated", null, 3), ...(input as object) };
      },
      deactivateMemory: async () => memory("inactive", null, 3),
      confirmMemory: async () => memory("confirmed", null, 3),
      created,
      updated
    },
    worldEvents: {
      getImportantEvents: async (
        _sessionId: string,
        minImportance: number,
        limit: number
      ) =>
        events
          .filter((event) => event.importance >= minImportance)
          .slice(0, limit),
      getRecentEvents: async (_sessionId: string, limit: number) =>
        events.slice(0, limit)
    }
  } as unknown as Repositories & {
    readonly sessionSummaries: Repositories["sessionSummaries"] & {
      readonly upserted: {
        readonly summaryText: string;
        readonly summarizedThroughTurn: number;
      } | null;
    };
    readonly memories: Repositories["memories"] & {
      readonly created: readonly unknown[];
      readonly updated: readonly unknown[];
    };
  };
}

function message(content: string, turnNumber: number): GameMessageRecord {
  return {
    id: `message-${turnNumber}`,
    sessionId,
    role: turnNumber % 2 === 0 ? "assistant" : "player",
    content,
    turnNumber,
    createdAt: new Date(`2026-01-01T00:00:0${turnNumber}Z`)
  };
}

function memory(
  id: string,
  key: string | null,
  importance: number
): SessionMemoryRecord {
  return {
    id,
    sessionId,
    memoryType: "fact",
    subjectType: null,
    subjectId: null,
    key,
    content: "Đồng minh đang giữ một manh mối ở bến thuyền.",
    importance,
    firstObservedTurn: 1,
    lastConfirmedTurn: 2,
    active: true,
    metadata: {},
    createdAt: now,
    updatedAt: now
  };
}

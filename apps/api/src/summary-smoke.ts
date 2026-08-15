import { createAIGateway } from "@ai-novel/ai-engine";
import { getServerConfig } from "@ai-novel/config";
import { validateSummaryOutput } from "@ai-novel/domain";
import { SummaryService } from "./modules/sessions/summary-service.js";

const config = getServerConfig();

if (config.ai.provider !== "openai" || !config.ai.openaiApiKey) {
  console.log("Summary smoke skipped: set AI_PROVIDER=openai and OPENAI_API_KEY.");
  process.exit(0);
}

const gateway = createAIGateway({
  provider: config.ai.provider,
  openaiApiKey: config.ai.openaiApiKey,
  ...(config.ai.openaiModel ? { openaiModel: config.ai.openaiModel } : {}),
  timeoutMs: config.ai.requestTimeoutMs,
  maxRetries: config.ai.maxRetries,
  maxOutputTokens: Math.min(config.ai.maxOutputTokens, 220)
});

if (!gateway) {
  console.log("Summary smoke skipped: AI gateway is disabled.");
  process.exit(0);
}

const now = new Date("2026-01-01T00:00:00Z");
let persistedSummary: unknown = null;
let persistedMemories: unknown[] = [];
const repositories = {
  sessionSummaries: {
    getForSession: async () => null,
    upsertSummary: async (input: unknown) => {
      persistedSummary = input;
      return {
        id: "summary-smoke-id",
        ...(input as Record<string, unknown>),
        version: 1,
        createdAt: now,
        updatedAt: now
      };
    },
    updateWithVersion: async () => {
      throw new Error("Summary smoke should create, not update.");
    }
  },
  memories: {
    findByKey: async () => null,
    listActiveForSession: async () => [],
    createMemory: async (input: unknown) => {
      persistedMemories = [...persistedMemories, input];
      return {
        id: `memory-${persistedMemories.length}`,
        active: true,
        createdAt: now,
        updatedAt: now,
        ...(input as Record<string, unknown>)
      };
    },
    updateMemory: async () => {
      throw new Error("Summary smoke should create memories, not update.");
    }
  },
  gameMessages: {
    getMessagesForSession: async () => [
      {
        id: "message-1",
        sessionId: "summary-smoke-session",
        role: "player",
        content: "Tôi nhìn quanh căn phòng.",
        turnNumber: 1,
        createdAt: now
      },
      {
        id: "message-2",
        sessionId: "summary-smoke-session",
        role: "assistant",
        content: "Bạn thấy một chiếc bàn gỗ và cánh cửa khép hờ.",
        turnNumber: 1,
        createdAt: now
      }
    ]
  },
  worldEvents: {
    getRecentEvents: async () => [
      {
        id: "event-1",
        sessionId: "summary-smoke-session",
        eventType: "observation",
        title: "Quan sát căn phòng",
        description: "Người chơi phát hiện bàn gỗ và cửa khép hờ.",
        importance: 2,
        payload: {},
        turnNumber: 1,
        createdAt: now
      }
    ]
  }
};

const service = new SummaryService(repositories as never, gateway, undefined, {
  intervalTurns: 1,
  maxSourceMessages: 4,
  maxSourceEvents: 2
});

await service.refreshIfDue({
  userId: "summary-smoke-user",
  sessionId: "summary-smoke-session",
  targetTurn: 1
});

const summary = persistedSummary as { summaryText?: string } | null;
const validated = validateSummaryOutput({
  summary: summary?.summaryText ?? "",
  importantFacts: persistedMemories.map((memory) => {
    const record = memory as Record<string, unknown>;
    return {
      key: record.key ?? null,
      content: record.content,
      importance: record.importance,
      memoryType: record.memoryType
    };
  })
});

console.log(
  JSON.stringify(
    {
      summaryPreview: validated.summary.slice(0, 160),
      memoryCount: validated.importantFacts.length
    },
    null,
    2
  )
);

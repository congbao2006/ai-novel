import { createAIGateway } from "@ai-novel/ai-engine";
import { getServerConfig } from "@ai-novel/config";
import { validateAITurnProposal } from "@ai-novel/domain";
import { buildAITurnGenerationRequest } from "./modules/sessions/ai-turn-prompt.js";

const config = getServerConfig();

if (config.ai.provider !== "openai" || !config.ai.openaiApiKey) {
  console.log("AI turn smoke skipped: set AI_PROVIDER=openai and OPENAI_API_KEY.");
  process.exit(0);
}

const gateway = createAIGateway({
  provider: config.ai.provider,
  openaiApiKey: config.ai.openaiApiKey,
  ...(config.ai.openaiModel ? { openaiModel: config.ai.openaiModel } : {}),
  timeoutMs: config.ai.requestTimeoutMs,
  maxRetries: config.ai.maxRetries,
  maxOutputTokens: Math.min(config.ai.maxOutputTokens, 180)
});

if (!gateway) {
  console.log("AI turn smoke skipped: AI gateway is disabled.");
  process.exit(0);
}

const state = {
  version: 1,
  location: "Căn phòng yên tĩnh",
  worldTime: null,
  playerStats: {
    hp: 10,
    stamina: 8
  },
  flags: {},
  stateData: {}
};
const result = await gateway.generate(
  buildAITurnGenerationRequest({
    userId: "ai-turn-smoke-user",
    sessionId: "ai-turn-smoke-session",
    story: {
      id: "ai-turn-smoke-story",
      title: "Smoke Test Story",
      slug: "smoke-test-story",
      description: "A tiny room used only to verify structured AI output.",
      genre: "test",
      storyVersionId: "ai-turn-smoke-version",
      storyVersionNumber: 1,
      worldPrompt: "Keep the scene small and concrete.",
      openingPrompt: "The player stands inside a quiet room."
    },
    character: {
      id: "ai-turn-smoke-character",
      name: "Tester",
      description: "A careful observer.",
      background: "Created for a live smoke test.",
      initialStats: {
        hp: 10,
        stamina: 8
      }
    },
    context: {
      state,
      recentMessages: [],
      summary: null,
      memories: [],
      worldEvents: [],
      budget: {
        maxRecentMessages: 20,
        maxMemories: 20,
        maxWorldEvents: 10,
        maxSummaryChars: 6000,
        maxMemoryChars: 1000
      }
    },
    action: "Tôi nhìn quanh căn phòng."
  })
);

if (!result.structuredOutput) {
  throw new Error("AI turn smoke failed: structured output was missing.");
}

const proposal = validateAITurnProposal(result.structuredOutput, state);

console.log(
  JSON.stringify(
    {
      narrativePreview: proposal.resultText.slice(0, 160),
      eventCount: proposal.events.length,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      latencyMs: result.latencyMs,
      requestId: result.requestId,
      estimatedCostMicros: result.estimatedCostMicros
    },
    null,
    2
  )
);

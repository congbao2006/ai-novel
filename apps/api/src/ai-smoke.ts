import { createAIGateway } from "@ai-novel/ai-engine";
import { getServerConfig } from "@ai-novel/config";

const config = getServerConfig();

if (config.ai.provider !== "openai" || !config.ai.openaiApiKey) {
  console.log("AI smoke skipped: set AI_PROVIDER=openai and OPENAI_API_KEY.");
  process.exit(0);
}

const gateway = createAIGateway({
  provider: config.ai.provider,
  openaiApiKey: config.ai.openaiApiKey,
  ...(config.ai.openaiModel ? { openaiModel: config.ai.openaiModel } : {}),
  timeoutMs: config.ai.requestTimeoutMs,
  maxRetries: config.ai.maxRetries,
  maxOutputTokens: Math.min(config.ai.maxOutputTokens, 32)
});

if (!gateway) {
  console.log("AI smoke skipped: AI gateway is disabled.");
  process.exit(0);
}

const result = await gateway.generate({
  feature: "cli.ai.smoke",
  input: "Reply with exactly: OK",
  instructions: "Follow the user instruction exactly.",
  maxOutputTokens: 16,
  metadata: {
    route: "cli.ai.smoke"
  }
});

console.log(
  JSON.stringify(
    {
      text: result.text,
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

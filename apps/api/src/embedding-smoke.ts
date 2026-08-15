import { createEmbeddingGateway } from "@ai-novel/ai-engine";
import { getServerConfig } from "@ai-novel/config";

const config = getServerConfig();

if (
  config.ai.embeddingProvider !== "openai" ||
  !config.ai.openaiApiKey ||
  !config.ai.openaiEmbeddingModel
) {
  console.log(
    "Embedding smoke skipped: set AI_EMBEDDING_PROVIDER=openai, OPENAI_API_KEY, and OPENAI_EMBEDDING_MODEL."
  );
  process.exit(0);
}

const gateway = createEmbeddingGateway({
  provider: config.ai.embeddingProvider,
  openaiApiKey: config.ai.openaiApiKey,
  openaiEmbeddingModel: config.ai.openaiEmbeddingModel,
  timeoutMs: config.ai.requestTimeoutMs,
  maxRetries: config.ai.maxRetries,
  pricingRegistry: config.ai.modelPricingRegistry
});

if (!gateway) {
  console.log("Embedding smoke skipped: embedding gateway is disabled.");
  process.exit(0);
}

const result = await gateway.embed({
  texts: [
    "[event] Người chơi từng cứu Lý Thanh khỏi sát thủ ở bến sông.",
    "[world] Một cánh cổng đá cũ nằm ở phía bắc thành."
  ],
  metadata: {
    purpose: "embedding"
  }
});
const query = await gateway.embed({
  texts: ["Player action: Tôi muốn tìm cô gái mà mình từng cứu gần bờ sông."],
  metadata: {
    purpose: "embedding"
  }
});

console.log(
  JSON.stringify(
    {
      provider: result.provider,
      model: result.model,
      vectorCount: result.embeddings.length,
      dimensions: result.embeddings[0]?.length ?? 0,
      queryDimensions: query.embeddings[0]?.length ?? 0,
      roughSimilarity: cosine(result.embeddings[0] ?? [], query.embeddings[0] ?? []),
      usage: result.usage,
      latencyMs: result.latencyMs
    },
    null,
    2
  )
);

function cosine(left: readonly number[], right: readonly number[]): number {
  if (!left.length || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

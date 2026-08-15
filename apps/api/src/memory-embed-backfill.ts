import { createEmbeddingGateway } from "@ai-novel/ai-engine";
import { getServerConfig } from "@ai-novel/config";
import {
  closeDatabaseClient,
  createRepositories,
  getDatabaseClient
} from "@ai-novel/db";
import { BudgetService } from "./modules/ai/budget-service.js";
import { RepositoryAIUsageLedger } from "./modules/ai/usage-ledger.js";
import { MemoryEmbeddingService } from "./modules/sessions/memory-embedding-service.js";

const config = getServerConfig();

if (!config.database.url) {
  console.log("Memory embedding backfill skipped: DATABASE_URL is not set.");
  process.exit(0);
}

if (config.ai.embeddingProvider === "disabled" || !config.ai.openaiEmbeddingModel) {
  console.log(
    "Memory embedding backfill skipped: configure AI_EMBEDDING_PROVIDER and OPENAI_EMBEDDING_MODEL."
  );
  process.exit(0);
}

const database = getDatabaseClient(config.database.url);
const repositories = createRepositories(database);
const usageLedger = new RepositoryAIUsageLedger(repositories.aiUsage);
const embeddingGateway = createEmbeddingGateway({
  provider: config.ai.embeddingProvider,
  ...(config.ai.openaiApiKey ? { openaiApiKey: config.ai.openaiApiKey } : {}),
  openaiEmbeddingModel: config.ai.openaiEmbeddingModel,
  timeoutMs: config.ai.requestTimeoutMs,
  maxRetries: config.ai.maxRetries,
  pricingRegistry: config.ai.modelPricingRegistry,
  usageLedger
});

if (!embeddingGateway) {
  console.log("Memory embedding backfill skipped: embedding gateway is disabled.");
  process.exit(0);
}

const budgetService = new BudgetService(repositories.aiUsage, {
  ...(config.budget.userDailyBudgetMicros !== undefined
    ? { userDailyBudgetMicros: config.budget.userDailyBudgetMicros }
    : {}),
  ...(config.budget.userMonthlyBudgetMicros !== undefined
    ? { userMonthlyBudgetMicros: config.budget.userMonthlyBudgetMicros }
    : {}),
  ...(config.budget.sessionBudgetMicros !== undefined
    ? { sessionBudgetMicros: config.budget.sessionBudgetMicros }
    : {})
});
const service = new MemoryEmbeddingService(
  repositories,
  embeddingGateway,
  budgetService,
  {
    provider: config.ai.embeddingProvider,
    model: config.ai.openaiEmbeddingModel,
    batchSize: 32
  }
);
const limit = Number.parseInt(process.env.MEMORY_EMBED_BACKFILL_LIMIT ?? "100", 10);
let embeddedTotal = 0;
let skippedTotal = 0;
let failedTotal = 0;

try {
  while (true) {
    const result = await service.backfillMissingActiveMemories({ limit });
    embeddedTotal += result.embedded;
    skippedTotal += result.skipped;
    failedTotal += result.failed;

    if (result.embedded === 0) {
      break;
    }
  }

  console.log(
    JSON.stringify(
      {
        embedded: embeddedTotal,
        skipped: skippedTotal,
        failed: failedTotal
      },
      null,
      2
    )
  );
} finally {
  await closeDatabaseClient();
}

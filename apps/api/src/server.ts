import { getServerConfig } from "@ai-novel/config";
import { createAIGateway, createEmbeddingGateway } from "@ai-novel/ai-engine";
import {
  createRepositories,
  getDatabaseClient
} from "@ai-novel/db";
import { buildApp } from "./app.js";
import { BudgetService } from "./modules/ai/budget-service.js";
import { RepositoryAIUsageLedger } from "./modules/ai/usage-ledger.js";
import { Argon2PasswordHasher } from "./modules/auth/password.js";
import { AuthService } from "./modules/auth/service.js";
import { GameplayService } from "./modules/sessions/gameplay-service.js";
import { MemoryEmbeddingService } from "./modules/sessions/memory-embedding-service.js";
import { MemoryContextBuilder } from "./modules/sessions/memory-context-builder.js";
import { SemanticMemoryService } from "./modules/sessions/semantic-memory-service.js";
import { SessionService } from "./modules/sessions/service.js";
import { SummaryService } from "./modules/sessions/summary-service.js";
import { StoryService } from "./modules/stories/service.js";

const config = getServerConfig();
const database = config.database.url ? getDatabaseClient(config.database.url) : undefined;
const repositories = config.database.url
  ? createRepositories(database!)
  : undefined;
const authService = repositories
  ? new AuthService({
      repositories,
      passwordHasher: new Argon2PasswordHasher(),
      sessionTtlSeconds: config.auth.sessionTtlSeconds
    })
  : undefined;
const storyService = repositories ? new StoryService(repositories) : undefined;
const sessionService = repositories
  ? new SessionService(repositories, database)
  : undefined;
const aiUsageLedger = repositories
  ? new RepositoryAIUsageLedger(repositories.aiUsage)
  : undefined;
const budgetService = repositories
  ? new BudgetService(repositories.aiUsage, {
      ...(config.budget.userDailyBudgetMicros !== undefined
        ? { userDailyBudgetMicros: config.budget.userDailyBudgetMicros }
        : {}),
      ...(config.budget.userMonthlyBudgetMicros !== undefined
        ? { userMonthlyBudgetMicros: config.budget.userMonthlyBudgetMicros }
        : {}),
      ...(config.budget.sessionBudgetMicros !== undefined
        ? { sessionBudgetMicros: config.budget.sessionBudgetMicros }
        : {})
    })
  : undefined;
const aiGateway = createAIGateway({
  provider: config.ai.provider,
  ...(config.ai.openaiApiKey ? { openaiApiKey: config.ai.openaiApiKey } : {}),
  ...(config.ai.openaiModel ? { openaiModel: config.ai.openaiModel } : {}),
  timeoutMs: config.ai.requestTimeoutMs,
  maxRetries: config.ai.maxRetries,
  maxOutputTokens: config.ai.maxOutputTokens,
  pricingRegistry: config.ai.modelPricingRegistry,
  ...(aiUsageLedger ? { usageLedger: aiUsageLedger } : {})
});
const embeddingGateway = createEmbeddingGateway({
  provider: config.ai.embeddingProvider,
  ...(config.ai.openaiApiKey ? { openaiApiKey: config.ai.openaiApiKey } : {}),
  ...(config.ai.openaiEmbeddingModel
    ? { openaiEmbeddingModel: config.ai.openaiEmbeddingModel }
    : {}),
  timeoutMs: config.ai.requestTimeoutMs,
  maxRetries: config.ai.maxRetries,
  pricingRegistry: config.ai.modelPricingRegistry,
  ...(aiUsageLedger ? { usageLedger: aiUsageLedger } : {})
});
const memoryEmbeddingService =
  repositories && embeddingGateway && config.ai.openaiEmbeddingModel
    ? new MemoryEmbeddingService(
        repositories,
        embeddingGateway,
        budgetService,
        {
          provider: config.ai.embeddingProvider,
          model: config.ai.openaiEmbeddingModel,
          batchSize: 32
        }
      )
    : undefined;
const semanticMemoryService =
  repositories &&
  embeddingGateway &&
  config.memory.semanticSearchEnabled &&
  config.ai.openaiEmbeddingModel
    ? new SemanticMemoryService(
        repositories,
        embeddingGateway,
        budgetService,
        {
          provider: config.ai.embeddingProvider,
          model: config.ai.openaiEmbeddingModel,
          topK: config.memory.semanticTopK,
          minScore: config.memory.semanticMinScore
        }
      )
    : undefined;
const memoryContextBuilder = repositories
  ? new MemoryContextBuilder(
      repositories,
      {
        maxRecentMessages: config.memory.contextMaxRecentMessages,
        maxMemories: config.memory.contextMaxMemories,
        maxWorldEvents: config.memory.contextMaxWorldEvents,
        maxSummaryChars: config.memory.contextMaxSummaryChars,
        maxMemoryChars: config.memory.contextMaxMemoryChars
      },
      {
        ...(semanticMemoryService ? { semanticMemoryService } : {})
      }
    )
  : undefined;
const summaryService =
  repositories && aiGateway
    ? new SummaryService(repositories, aiGateway, budgetService, {
        intervalTurns: config.memory.summaryIntervalTurns,
        maxSourceMessages: Math.max(config.memory.summaryIntervalTurns * 4, 40),
        maxSourceEvents: Math.max(config.memory.contextMaxWorldEvents * 4, 20)
      }, memoryEmbeddingService)
    : undefined;
const gameplayService = repositories
  ? new GameplayService(repositories, database, undefined, {
      engineMode: config.gameplay.engineMode,
      ...(aiGateway ? { aiGateway } : {}),
      ...(budgetService ? { budgetService } : {}),
      ...(memoryContextBuilder ? { memoryContextBuilder } : {}),
      ...(summaryService ? { summaryService } : {})
    })
  : undefined;
const dependencies = {
  ...(repositories ? { repositories } : {}),
  ...(authService ? { authService } : {}),
  ...(storyService ? { storyService } : {}),
  ...(sessionService ? { sessionService } : {}),
  ...(gameplayService ? { gameplayService } : {}),
  ...(aiGateway ? { aiGateway } : {})
};
const app = await buildApp({
  dependencies
});

try {
  await app.listen({
    host: config.api.host,
    port: config.api.port
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

import { getServerConfig } from "@ai-novel/config";
import { createAIGateway, createEmbeddingGateway } from "@ai-novel/ai-engine";
import {
  closeDatabaseClient,
  createRepositories,
  getDatabaseClient,
  getDatabasePool,
  instrumentPgPool
} from "@ai-novel/db";
import { buildApp } from "./app.js";
import { BudgetService } from "./modules/ai/budget-service.js";
import { RepositoryAIUsageLedger } from "./modules/ai/usage-ledger.js";
import { StoryAuthoringService } from "./modules/authoring/service.js";
import { Argon2PasswordHasher } from "./modules/auth/password.js";
import { AuthService } from "./modules/auth/service.js";
import { GameplayService } from "./modules/sessions/gameplay-service.js";
import { FactionInitializationService } from "./modules/sessions/faction-initialization-service.js";
import { MemoryEmbeddingService } from "./modules/sessions/memory-embedding-service.js";
import { MemoryContextBuilder } from "./modules/sessions/memory-context-builder.js";
import { SemanticMemoryService } from "./modules/sessions/semantic-memory-service.js";
import { NPCKnowledgeBuilder } from "./modules/sessions/npc-knowledge-builder.js";
import { NPCInitializationService } from "./modules/sessions/npc-initialization-service.js";
import { NPCParticipationSelector } from "./modules/sessions/npc-participation-selector.js";
import { AINPCReactionEngine } from "./modules/sessions/npc-reaction-engine.js";
import { NPCReactionService } from "./modules/sessions/npc-reaction-service.js";
import { SessionService } from "./modules/sessions/service.js";
import { SummaryService } from "./modules/sessions/summary-service.js";
import { StoryService } from "./modules/stories/service.js";
import { WorldSimulationService } from "./modules/sessions/world-simulation-service.js";

const config = getServerConfig();
const databasePoolOptions = {
  max: config.database.poolMax,
  idleTimeoutMillis: config.database.poolIdleTimeoutMs,
  connectionTimeoutMillis: config.database.poolConnectionTimeoutMs
};
const databasePool = config.database.url
  ? getDatabasePool(config.database.url, databasePoolOptions)
  : undefined;
const database = config.database.url
  ? getDatabaseClient(config.database.url, databasePoolOptions)
  : undefined;
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
const storyAuthoringService = repositories
  ? new StoryAuthoringService(repositories, database)
  : undefined;
const npcInitializationService = repositories
  ? new NPCInitializationService()
  : undefined;
const factionInitializationService = repositories
  ? new FactionInitializationService()
  : undefined;
const sessionService = repositories
  ? new SessionService(
      repositories,
      database,
      undefined,
      npcInitializationService,
      factionInitializationService
    )
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
const npcReactionService =
  repositories && aiGateway && config.gameplay.engineMode === "ai"
    ? new NPCReactionService(
        repositories,
        new NPCParticipationSelector({
          maxReactionsPerTurn: config.gameplay.maxNpcReactionsPerTurn
        }),
        new NPCKnowledgeBuilder(repositories, {
          maxMemories: config.memory.contextMaxMemories,
          maxRecentMessages: config.memory.contextMaxRecentMessages,
          maxWorldEvents: config.memory.contextMaxWorldEvents,
          ...(semanticMemoryService ? { semanticMemoryService } : {})
        }),
        new AINPCReactionEngine(aiGateway),
        budgetService,
        memoryEmbeddingService
      )
    : undefined;
const worldSimulationService = repositories
  ? new WorldSimulationService(
      repositories,
      database,
      undefined,
      {
        tickIntervalTurns: config.world.tickIntervalTurns,
        ...(memoryEmbeddingService ? { memoryEmbeddingService } : {})
      }
    )
  : undefined;
const gameplayService = repositories
  ? new GameplayService(repositories, database, undefined, {
      engineMode: config.gameplay.engineMode,
      ...(aiGateway ? { aiGateway } : {}),
      ...(budgetService ? { budgetService } : {}),
      ...(memoryContextBuilder ? { memoryContextBuilder } : {}),
      ...(summaryService ? { summaryService } : {}),
      ...(npcReactionService ? { npcReactionService } : {}),
      ...(worldSimulationService ? { worldSimulationService } : {})
    })
  : undefined;
const dependencies = {
  ...(database ? { database } : {}),
  ...(databasePool ? { databasePool } : {}),
  ...(repositories ? { repositories } : {}),
  ...(authService ? { authService } : {}),
  ...(storyAuthoringService ? { storyAuthoringService } : {}),
  ...(storyService ? { storyService } : {}),
  ...(sessionService ? { sessionService } : {}),
  ...(gameplayService ? { gameplayService } : {}),
  ...(worldSimulationService ? { worldSimulationService } : {}),
  ...(aiGateway ? { aiGateway } : {})
};
const app = await buildApp({
  dependencies,
  config
});

if (databasePool) {
  instrumentPgPool(databasePool, {
    onEvent(event) {
      if (event.type === "acquire" && event.durationMs < 100) {
        return;
      }

      const logPayload =
        event.type === "error"
          ? {
              type: event.type,
              errorName: event.errorName,
              errorMessage: event.errorMessage,
              poolTotal: event.poolTotal,
              poolIdle: event.poolIdle,
              poolWaiting: event.poolWaiting
            }
          : event.type === "acquire"
            ? {
                type: event.type,
                durationMs: event.durationMs,
                status: event.status,
                poolTotal: event.poolTotal,
                poolIdle: event.poolIdle,
                poolWaiting: event.poolWaiting
              }
            : {
                type: event.type,
                poolTotal: event.poolTotal,
                poolIdle: event.poolIdle,
                poolWaiting: event.poolWaiting
              };

      app.log.info(logPayload, "[perf] db pool event");
    }
  });
}

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  app.log.info({ signal }, "shutting down API server");

  try {
    await app.close();
    await closeDatabaseClient();
    app.log.info("API server shutdown complete");
    process.exit(0);
  } catch (error) {
    app.log.error(error, "API server shutdown failed");
    process.exit(1);
  }
}

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

try {
  app.log.info(
    {
      databasePoolMax: config.database.poolMax,
      databasePoolIdleTimeoutMs: config.database.poolIdleTimeoutMs,
      databasePoolConnectionTimeoutMs: config.database.poolConnectionTimeoutMs,
      railwayRegion:
        process.env.RAILWAY_REGION ??
        process.env.RAILWAY_DEPLOYMENT_REGION ??
        process.env.RAILWAY_SERVICE_REGION
    },
    "database pool configuration"
  );

  await app.listen({
    host: config.api.host,
    port: config.api.port
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

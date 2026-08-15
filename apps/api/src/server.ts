import { getServerConfig } from "@ai-novel/config";
import { createAIGateway } from "@ai-novel/ai-engine";
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
import { SessionService } from "./modules/sessions/service.js";
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
const gameplayService = repositories
  ? new GameplayService(repositories, database, undefined, {
      engineMode: config.gameplay.engineMode,
      ...(aiGateway ? { aiGateway } : {}),
      ...(budgetService ? { budgetService } : {})
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

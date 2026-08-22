import { z } from "zod";
import { getPublicServerConfig } from "./public.js";

const serverConfigSchema = z.object({
  nodeEnv: z
    .enum(["development", "test", "production"])
    .default("development"),
  webAppUrl: z.url().default("http://localhost:3000"),
  api: z.object({
    host: z.string().min(1).default("0.0.0.0"),
    port: z.coerce.number().int().positive().default(4000),
    allowedOrigins: z.array(z.url()).default(["http://localhost:3000"]),
    bodyLimitBytes: z.coerce.number().int().positive().default(1_048_576),
    slowRequestThresholdMs: z.coerce.number().int().positive().default(1000),
    slowAiRequestThresholdMs: z.coerce.number().int().positive().default(15_000),
    logLevel: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info")
  }),
  database: z.object({
    url: z.string().min(1).optional(),
    poolMax: z.coerce.number().int().positive().max(100).default(10),
    poolIdleTimeoutMs: z.coerce.number().int().positive().default(30_000),
    poolConnectionTimeoutMs: z.coerce.number().int().positive().default(10_000)
  }),
  auth: z.object({
    cookieName: z.string().min(1).default("ai_novel_session"),
    sessionTtlSeconds: z.coerce.number().int().positive().default(60 * 60 * 24 * 14),
    cookieSameSite: z.enum(["lax", "strict", "none"]).default("lax")
  }),
  ai: z.object({
    provider: z.enum(["disabled", "openai"]).default("disabled"),
    embeddingProvider: z.enum(["disabled", "openai"]).default("disabled"),
    openaiApiKey: z.string().optional(),
    openaiModel: z.string().min(1).optional(),
    openaiEmbeddingModel: z.string().min(1).optional(),
    requestTimeoutMs: z.coerce.number().int().positive().default(30_000),
    maxRetries: z.coerce.number().int().min(0).max(5).default(2),
    maxOutputTokens: z.coerce.number().int().positive().default(256),
    internalSmokeEnabled: z.boolean().default(false),
    modelPricingRegistry: z.record(
      z.string(),
      z.object({
        inputMicrosPerMillionTokens: z.number().int().nonnegative(),
        outputMicrosPerMillionTokens: z.number().int().nonnegative()
      })
    ).default({})
  }),
  budget: z.object({
    userDailyBudgetMicros: z.coerce.number().int().positive().optional(),
    userMonthlyBudgetMicros: z.coerce.number().int().positive().optional(),
    sessionBudgetMicros: z.coerce.number().int().positive().optional()
  }),
  memory: z.object({
    contextMaxRecentMessages: z.coerce.number().int().positive().default(20),
    contextMaxMemories: z.coerce.number().int().positive().default(20),
    contextMaxWorldEvents: z.coerce.number().int().positive().default(10),
    contextMaxSummaryChars: z.coerce.number().int().positive().default(6000),
    contextMaxMemoryChars: z.coerce.number().int().positive().default(1000),
    summaryIntervalTurns: z.coerce.number().int().positive().default(10),
    semanticSearchEnabled: z.boolean().default(false),
    semanticTopK: z.coerce.number().int().positive().max(100).default(12),
    semanticMinScore: z.coerce.number().min(0).max(1).default(0.72)
  }),
  gameplay: z.object({
    engineMode: z.enum(["deterministic", "ai"]).default("deterministic"),
    maxNpcReactionsPerTurn: z.coerce.number().int().min(0).max(5).default(2)
  }),
  world: z.object({
    tickIntervalTurns: z.coerce.number().int().positive().default(5)
  })
}).superRefine((config, context) => {
  if (config.nodeEnv === "production") {
    if (!config.database.url) {
      context.addIssue({
        code: "custom",
        path: ["database", "url"],
        message: "DATABASE_URL is required in production."
      });
    }

    if (!config.webAppUrl.startsWith("https://")) {
      context.addIssue({
        code: "custom",
        path: ["webAppUrl"],
        message: "WEB_APP_URL must be HTTPS in production."
      });
    }

    for (const origin of config.api.allowedOrigins) {
      if (!origin.startsWith("https://")) {
        context.addIssue({
          code: "custom",
          path: ["api", "allowedOrigins"],
          message: "API_ALLOWED_ORIGINS must contain only HTTPS origins in production."
        });
      }
    }

    if (config.auth.cookieSameSite === "none") {
      for (const origin of config.api.allowedOrigins) {
        if (!origin.startsWith("https://")) {
          context.addIssue({
            code: "custom",
            path: ["auth", "cookieSameSite"],
            message:
              "AUTH_COOKIE_SAME_SITE=none requires HTTPS allowed origins."
          });
        }
      }
    }
  }

  if (config.ai.provider === "openai") {
    if (!config.ai.openaiApiKey) {
      context.addIssue({
        code: "custom",
        path: ["ai", "openaiApiKey"],
        message: "OPENAI_API_KEY is required when AI_PROVIDER=openai."
      });
    }

    if (!config.ai.openaiModel) {
      context.addIssue({
        code: "custom",
        path: ["ai", "openaiModel"],
        message: "OPENAI_MODEL is required when AI_PROVIDER=openai."
      });
    }
  }

  if (config.memory.semanticSearchEnabled) {
    if (config.ai.embeddingProvider === "disabled") {
      context.addIssue({
        code: "custom",
        path: ["ai", "embeddingProvider"],
        message:
          "MEMORY_SEMANTIC_SEARCH_ENABLED=true requires AI_EMBEDDING_PROVIDER."
      });
    }

    if (config.ai.embeddingProvider === "openai") {
      if (!config.ai.openaiApiKey) {
        context.addIssue({
          code: "custom",
          path: ["ai", "openaiApiKey"],
          message:
            "OPENAI_API_KEY is required when AI_EMBEDDING_PROVIDER=openai."
        });
      }

      if (!config.ai.openaiEmbeddingModel) {
        context.addIssue({
          code: "custom",
          path: ["ai", "openaiEmbeddingModel"],
          message:
            "OPENAI_EMBEDDING_MODEL is required when AI_EMBEDDING_PROVIDER=openai."
        });
      }
    }
  }

  if (config.gameplay.engineMode === "ai" && config.ai.provider === "disabled") {
    context.addIssue({
      code: "custom",
      path: ["gameplay", "engineMode"],
      message:
        "GAMEPLAY_ENGINE_MODE=ai requires AI_PROVIDER to be configured."
    });
  }

  if (
    config.gameplay.engineMode === "ai" &&
    hasEnabledBudget(config.budget) &&
    config.ai.provider !== "disabled" &&
    config.ai.openaiModel
  ) {
    const pricingKey = `${config.ai.provider}:${config.ai.openaiModel}`;

    if (!config.ai.modelPricingRegistry[pricingKey]) {
      context.addIssue({
        code: "custom",
        path: ["ai", "modelPricingRegistry"],
        message:
          `Budget enforcement requires pricing for ${pricingKey}.`
      });
    }
  }

  if (
    config.memory.semanticSearchEnabled &&
    hasEnabledBudget(config.budget) &&
    config.ai.embeddingProvider !== "disabled" &&
    config.ai.openaiEmbeddingModel
  ) {
    const pricingKey =
      `${config.ai.embeddingProvider}:${config.ai.openaiEmbeddingModel}`;

    if (!config.ai.modelPricingRegistry[pricingKey]) {
      context.addIssue({
        code: "custom",
        path: ["ai", "modelPricingRegistry"],
        message:
          `Budget enforcement requires pricing for ${pricingKey}.`
      });
    }
  }
});

export type ServerConfig = z.infer<typeof serverConfigSchema> &
  ReturnType<typeof getPublicServerConfig>;

export function getServerConfig(
  env: NodeJS.ProcessEnv = process.env
): ServerConfig {
  const publicConfig = getPublicServerConfig(env);
  const serverConfig = serverConfigSchema.parse({
    nodeEnv: env.NODE_ENV,
    webAppUrl: env.WEB_APP_URL,
    api: {
      host: env.API_HOST,
      port: env.API_PORT ?? env.PORT,
      allowedOrigins: parseAllowedOriginsEnv(
        env.API_ALLOWED_ORIGINS,
        env.WEB_APP_URL
      ),
      bodyLimitBytes: env.API_BODY_LIMIT_BYTES,
      slowRequestThresholdMs: env.API_SLOW_REQUEST_THRESHOLD_MS,
      slowAiRequestThresholdMs: env.API_SLOW_AI_REQUEST_THRESHOLD_MS,
      logLevel: env.LOG_LEVEL
    },
    database: {
      url: env.DATABASE_URL,
      poolMax: env.DATABASE_POOL_MAX,
      poolIdleTimeoutMs: env.DATABASE_POOL_IDLE_TIMEOUT_MS,
      poolConnectionTimeoutMs: env.DATABASE_POOL_CONNECTION_TIMEOUT_MS
    },
    auth: {
      cookieName: env.AUTH_COOKIE_NAME,
      sessionTtlSeconds: env.AUTH_SESSION_TTL_SECONDS,
      cookieSameSite: env.AUTH_COOKIE_SAME_SITE
    },
    ai: {
      provider: env.AI_PROVIDER,
      embeddingProvider: env.AI_EMBEDDING_PROVIDER,
      openaiApiKey: env.OPENAI_API_KEY || undefined,
      openaiModel: env.OPENAI_MODEL || undefined,
      openaiEmbeddingModel: env.OPENAI_EMBEDDING_MODEL || undefined,
      requestTimeoutMs: env.AI_REQUEST_TIMEOUT_MS,
      maxRetries: env.AI_MAX_RETRIES,
      maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
      internalSmokeEnabled: parseBooleanEnv(env.AI_INTERNAL_SMOKE_ENABLED),
      modelPricingRegistry: parsePricingRegistryEnv(env.AI_MODEL_PRICING_JSON)
    },
    budget: {
      userDailyBudgetMicros: env.AI_USER_DAILY_BUDGET_MICROS,
      userMonthlyBudgetMicros: env.AI_USER_MONTHLY_BUDGET_MICROS,
      sessionBudgetMicros: env.AI_SESSION_BUDGET_MICROS
    },
    memory: {
      contextMaxRecentMessages: env.AI_CONTEXT_MAX_RECENT_MESSAGES,
      contextMaxMemories: env.AI_CONTEXT_MAX_MEMORIES,
      contextMaxWorldEvents: env.AI_CONTEXT_MAX_WORLD_EVENTS,
      contextMaxSummaryChars: env.AI_CONTEXT_MAX_SUMMARY_CHARS,
      contextMaxMemoryChars: env.AI_CONTEXT_MAX_MEMORY_CHARS,
      summaryIntervalTurns: env.AI_SUMMARY_INTERVAL_TURNS,
      semanticSearchEnabled: parseBooleanEnv(env.MEMORY_SEMANTIC_SEARCH_ENABLED),
      semanticTopK: env.MEMORY_SEMANTIC_TOP_K,
      semanticMinScore: env.MEMORY_SEMANTIC_MIN_SCORE
    },
    gameplay: {
      engineMode: env.GAMEPLAY_ENGINE_MODE,
      maxNpcReactionsPerTurn: env.AI_MAX_NPC_REACTIONS_PER_TURN
    },
    world: {
      tickIntervalTurns: env.WORLD_TICK_INTERVAL_TURNS
    }
  });

  return {
    ...publicConfig,
    ...serverConfig
  };
}

function hasEnabledBudget(config: {
  readonly userDailyBudgetMicros?: number | undefined;
  readonly userMonthlyBudgetMicros?: number | undefined;
  readonly sessionBudgetMicros?: number | undefined;
}): boolean {
  return (
    config.userDailyBudgetMicros !== undefined ||
    config.userMonthlyBudgetMicros !== undefined ||
    config.sessionBudgetMicros !== undefined
  );
}

function parsePricingRegistryEnv(value: string | undefined): unknown {
  if (value === undefined || value.trim() === "") {
    return {};
  }

  return JSON.parse(value) as unknown;
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseAllowedOriginsEnv(
  value: string | undefined,
  webAppUrl: string | undefined
): readonly string[] | undefined {
  if (value === undefined || value.trim() === "") {
    return webAppUrl ? [webAppUrl] : undefined;
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

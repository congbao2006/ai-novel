import { z } from "zod";
import { getPublicServerConfig } from "./public.js";

const serverConfigSchema = z.object({
  api: z.object({
    host: z.string().min(1).default("0.0.0.0"),
    port: z.coerce.number().int().positive().default(4000)
  }),
  database: z.object({
    url: z.string().min(1).optional()
  }),
  auth: z.object({
    cookieName: z.string().min(1).default("ai_novel_session"),
    sessionTtlSeconds: z.coerce.number().int().positive().default(60 * 60 * 24 * 14)
  }),
  ai: z.object({
    provider: z.enum(["disabled", "openai"]).default("disabled"),
    openaiApiKey: z.string().optional(),
    openaiModel: z.string().min(1).optional(),
    requestTimeoutMs: z.coerce.number().int().positive().default(30_000),
    maxRetries: z.coerce.number().int().min(0).max(5).default(2),
    maxOutputTokens: z.coerce.number().int().positive().default(256),
    internalSmokeEnabled: z.boolean().default(false)
  }),
  gameplay: z.object({
    engineMode: z.enum(["deterministic", "ai"]).default("deterministic")
  })
}).superRefine((config, context) => {
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

  if (config.gameplay.engineMode === "ai" && config.ai.provider === "disabled") {
    context.addIssue({
      code: "custom",
      path: ["gameplay", "engineMode"],
      message:
        "GAMEPLAY_ENGINE_MODE=ai requires AI_PROVIDER to be configured."
    });
  }
});

export type ServerConfig = z.infer<typeof serverConfigSchema> &
  ReturnType<typeof getPublicServerConfig>;

export function getServerConfig(
  env: NodeJS.ProcessEnv = process.env
): ServerConfig {
  const publicConfig = getPublicServerConfig(env);
  const serverConfig = serverConfigSchema.parse({
    api: {
      host: env.API_HOST,
      port: env.API_PORT
    },
    database: {
      url: env.DATABASE_URL
    },
    auth: {
      cookieName: env.AUTH_COOKIE_NAME,
      sessionTtlSeconds: env.AUTH_SESSION_TTL_SECONDS
    },
    ai: {
      provider: env.AI_PROVIDER,
      openaiApiKey: env.OPENAI_API_KEY || undefined,
      openaiModel: env.OPENAI_MODEL || undefined,
      requestTimeoutMs: env.AI_REQUEST_TIMEOUT_MS,
      maxRetries: env.AI_MAX_RETRIES,
      maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
      internalSmokeEnabled: parseBooleanEnv(env.AI_INTERNAL_SMOKE_ENABLED)
    },
    gameplay: {
      engineMode: env.GAMEPLAY_ENGINE_MODE
    }
  });

  return {
    ...publicConfig,
    ...serverConfig
  };
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

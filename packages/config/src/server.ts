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
  ai: z.object({
    provider: z.string().default("disabled"),
    providerApiKey: z.string().optional()
  })
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
    ai: {
      provider: env.AI_PROVIDER,
      providerApiKey: env.AI_PROVIDER_API_KEY || undefined
    }
  });

  return {
    ...publicConfig,
    ...serverConfig
  };
}

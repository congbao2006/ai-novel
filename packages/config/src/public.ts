import { z } from "zod";

const publicServerConfigSchema = z.object({
  nodeEnv: z
    .enum(["development", "test", "production"])
    .default("development"),
  webAppUrl: z.url().default("http://localhost:3000")
});

export type PublicServerConfig = z.infer<typeof publicServerConfigSchema>;

export function getPublicServerConfig(
  env: NodeJS.ProcessEnv = process.env
): PublicServerConfig {
  return publicServerConfigSchema.parse({
    nodeEnv: env.NODE_ENV,
    webAppUrl: env.WEB_APP_URL
  });
}

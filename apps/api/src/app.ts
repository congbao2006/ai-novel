import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { getPublicServerConfig } from "@ai-novel/config";
import { registerAiRoutes } from "./modules/ai/routes.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerGameplayRoutes } from "./modules/gameplay/routes.js";
import { registerHealthRoutes } from "./modules/health/routes.js";
import { registerSessionsRoutes } from "./modules/sessions/routes.js";
import { registerStoriesRoutes } from "./modules/stories/routes.js";
import { registerUsersRoutes } from "./modules/users/routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true
  });

  const config = getPublicServerConfig();

  await app.register(cors, {
    origin: config.webAppUrl
  });

  await app.register(registerHealthRoutes);
  await app.register(registerAuthRoutes, { prefix: "/auth" });
  await app.register(registerStoriesRoutes, { prefix: "/stories" });
  await app.register(registerSessionsRoutes, { prefix: "/sessions" });
  await app.register(registerGameplayRoutes, { prefix: "/gameplay" });
  await app.register(registerAiRoutes, { prefix: "/ai" });
  await app.register(registerUsersRoutes, { prefix: "/users" });

  return app;
}

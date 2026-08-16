import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { getPublicServerConfig } from "@ai-novel/config";
import { createAppDependencies, type AppDependencies } from "./dependencies.js";
import { registerAiRoutes } from "./modules/ai/routes.js";
import { registerAuthoringRoutes } from "./modules/authoring/routes.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerGameplayRoutes } from "./modules/gameplay/routes.js";
import { registerHealthRoutes } from "./modules/health/routes.js";
import { registerInternalAiRoutes } from "./modules/internal-ai/routes.js";
import { registerSessionsRoutes } from "./modules/sessions/routes.js";
import { registerStoriesRoutes } from "./modules/stories/routes.js";
import { registerUsersRoutes } from "./modules/users/routes.js";

declare module "fastify" {
  interface FastifyInstance {
    dependencies: AppDependencies;
  }
}

export type BuildAppOptions = {
  readonly dependencies?: AppDependencies;
};

export async function buildApp(
  options: BuildAppOptions = {}
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true
  });

  const config = getPublicServerConfig();
  const dependencies = createAppDependencies(options.dependencies);

  app.decorate("dependencies", dependencies);

  await app.register(cookie);
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute"
  });

  await app.register(cors, {
    origin: config.webAppUrl,
    credentials: true
  });

  await app.register(registerHealthRoutes);
  await app.register(registerInternalAiRoutes, { prefix: "/internal/ai" });
  await app.register(registerAuthRoutes, { prefix: "/auth" });
  await app.register(registerAuthoringRoutes, { prefix: "/author" });
  await app.register(registerStoriesRoutes, { prefix: "/stories" });
  await app.register(registerSessionsRoutes, { prefix: "/sessions" });
  await app.register(registerGameplayRoutes, { prefix: "/gameplay" });
  await app.register(registerAiRoutes, { prefix: "/ai" });
  await app.register(registerUsersRoutes, { prefix: "/users" });

  return app;
}

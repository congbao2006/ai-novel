import type { AIGateway } from "@ai-novel/ai-engine";
import type { DatabaseClient, PgPool, Repositories } from "@ai-novel/db";
import type { AuthService } from "./modules/auth/service.js";
import type { StoryAuthoringService } from "./modules/authoring/service.js";
import type { GameplayService } from "./modules/sessions/gameplay-service.js";
import type { SessionService } from "./modules/sessions/service.js";
import type { WorldSimulationService } from "./modules/sessions/world-simulation-service.js";
import type { StoryService } from "./modules/stories/service.js";

export type AppDependencies = {
  readonly database?: DatabaseClient;
  readonly databasePool?: PgPool;
  readonly repositories?: Repositories;
  readonly authService?: AuthService;
  readonly storyAuthoringService?: StoryAuthoringService;
  readonly storyService?: StoryService;
  readonly sessionService?: SessionService;
  readonly gameplayService?: GameplayService;
  readonly worldSimulationService?: WorldSimulationService;
  readonly aiGateway?: AIGateway;
};

export function createAppDependencies(
  dependencies: AppDependencies = {}
): AppDependencies {
  return dependencies;
}

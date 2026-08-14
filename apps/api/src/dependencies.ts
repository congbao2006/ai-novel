import type { AIGateway } from "@ai-novel/ai-engine";
import type { Repositories } from "@ai-novel/db";
import type { AuthService } from "./modules/auth/service.js";
import type { GameplayService } from "./modules/sessions/gameplay-service.js";
import type { SessionService } from "./modules/sessions/service.js";
import type { StoryService } from "./modules/stories/service.js";

export type AppDependencies = {
  readonly repositories?: Repositories;
  readonly authService?: AuthService;
  readonly storyService?: StoryService;
  readonly sessionService?: SessionService;
  readonly gameplayService?: GameplayService;
  readonly aiGateway?: AIGateway;
};

export function createAppDependencies(
  dependencies: AppDependencies = {}
): AppDependencies {
  return dependencies;
}

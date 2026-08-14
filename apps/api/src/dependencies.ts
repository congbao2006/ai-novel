import type { Repositories } from "@ai-novel/db";
import type { AuthService } from "./modules/auth/service.js";

export type AppDependencies = {
  readonly repositories?: Repositories;
  readonly authService?: AuthService;
};

export function createAppDependencies(
  dependencies: AppDependencies = {}
): AppDependencies {
  return dependencies;
}

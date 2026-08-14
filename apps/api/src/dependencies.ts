import type { Repositories } from "@ai-novel/db";

export type AppDependencies = {
  readonly repositories?: Repositories;
};

export function createAppDependencies(
  dependencies: AppDependencies = {}
): AppDependencies {
  return dependencies;
}

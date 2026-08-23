import { performance } from "node:perf_hooks";
import type { PgPool } from "@ai-novel/db";

export type DatabasePoolSnapshot = {
  readonly dbPoolTotal: number;
  readonly dbPoolIdle: number;
  readonly dbPoolWaiting: number;
};

export function nowMs(): number {
  return performance.now();
}

export function elapsedMs(startedAt: number): number {
  return roundMs(performance.now() - startedAt);
}

export function getPoolSnapshot(pool: PgPool | undefined): DatabasePoolSnapshot | undefined {
  if (!pool) {
    return undefined;
  }

  return {
    dbPoolTotal: pool.totalCount,
    dbPoolIdle: pool.idleCount,
    dbPoolWaiting: pool.waitingCount
  };
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}

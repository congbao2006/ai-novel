import { performance } from "node:perf_hooks";
import type { PgPool } from "@ai-novel/db";

export type DatabasePoolSnapshot = {
  readonly dbPoolTotal: number;
  readonly dbPoolIdle: number;
  readonly dbPoolWaiting: number;
};

export type DatabaseAcquireTiming = DatabasePoolSnapshot & {
  readonly dbAcquireMs: number;
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

export async function measureDatabaseAcquire(
  pool: PgPool | undefined
): Promise<DatabaseAcquireTiming | undefined> {
  if (!pool) {
    return undefined;
  }

  const startedAt = performance.now();
  const client = await pool.connect();

  try {
    return {
      ...getPoolSnapshot(pool)!,
      dbAcquireMs: roundMs(performance.now() - startedAt)
    };
  } finally {
    client.release();
  }
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}

import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import { performance } from "node:perf_hooks";
import * as schema from "./schema/index.js";

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
export type PgPool = pg.Pool;

export type DatabasePoolOptions = {
  readonly max?: number | undefined;
  readonly idleTimeoutMillis?: number | undefined;
  readonly connectionTimeoutMillis?: number | undefined;
};

export type DatabaseReadinessResult = {
  readonly database: "ok";
  readonly pgvector: "ok" | "skipped";
};

export type PgPoolInstrumentationEvent =
  | {
      readonly type: "acquire";
      readonly durationMs: number;
      readonly status: "success" | "error";
      readonly poolTotal: number;
      readonly poolIdle: number;
      readonly poolWaiting: number;
    }
  | {
      readonly type: "connect" | "remove";
      readonly poolTotal: number;
      readonly poolIdle: number;
      readonly poolWaiting: number;
    }
  | {
      readonly type: "error";
      readonly errorName: string;
      readonly errorMessage: string;
      readonly poolTotal: number;
      readonly poolIdle: number;
      readonly poolWaiting: number;
    };

export type PgPoolInstrumentationOptions = {
  readonly onEvent: (event: PgPoolInstrumentationEvent) => void;
};

const instrumentedPools = new WeakSet<pg.Pool>();

export function createPgPool(
  connectionString: string,
  options: DatabasePoolOptions = {}
): pg.Pool {
  return new pg.Pool({
    connectionString,
    ...(options.max !== undefined ? { max: options.max } : {}),
    ...(options.idleTimeoutMillis !== undefined
      ? { idleTimeoutMillis: options.idleTimeoutMillis }
      : {}),
    ...(options.connectionTimeoutMillis !== undefined
      ? { connectionTimeoutMillis: options.connectionTimeoutMillis }
      : {})
  });
}

export function createDatabaseClient(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

export function instrumentPgPool(
  pool: pg.Pool,
  options: PgPoolInstrumentationOptions
): void {
  if (instrumentedPools.has(pool)) {
    return;
  }

  instrumentedPools.add(pool);

  pool.on("connect", () => {
    options.onEvent({
      type: "connect",
      ...getPoolCounts(pool)
    });
  });
  pool.on("remove", () => {
    options.onEvent({
      type: "remove",
      ...getPoolCounts(pool)
    });
  });
  pool.on("error", (error) => {
    options.onEvent({
      type: "error",
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : "unknown",
      ...getPoolCounts(pool)
    });
  });

  type PoolConnectCallback = (
    error: Error | undefined,
    client: pg.PoolClient | undefined,
    release: ((err?: Error | boolean) => void) | undefined
  ) => void;

  const originalConnect = pool.connect.bind(pool);
  const instrumentedConnect = ((callback?: PoolConnectCallback) => {
    const startedAt = performance.now();

    if (callback) {
      return originalConnect((error, client, release) => {
        options.onEvent({
          type: "acquire",
          durationMs: roundMs(performance.now() - startedAt),
          status: error ? "error" : "success",
          ...getPoolCounts(pool)
        });
        callback(error, client, release);
      });
    }

    return originalConnect()
      .then((client) => {
        options.onEvent({
          type: "acquire",
          durationMs: roundMs(performance.now() - startedAt),
          status: "success",
          ...getPoolCounts(pool)
        });
        return client;
      })
      .catch((error: unknown) => {
        options.onEvent({
          type: "acquire",
          durationMs: roundMs(performance.now() - startedAt),
          status: "error",
          ...getPoolCounts(pool)
        });
        throw error;
      });
  }) as pg.Pool["connect"];

  pool.connect = instrumentedConnect;
}

let singletonPool: PgPool | undefined;
let singletonDatabase: DatabaseClient | undefined;

export function getDatabasePool(
  connectionString: string,
  options: DatabasePoolOptions = {}
): PgPool {
  if (!singletonPool) {
    singletonPool = createPgPool(connectionString, options);
  }

  return singletonPool;
}

export function getDatabaseClient(
  connectionString: string,
  options: DatabasePoolOptions = {}
): DatabaseClient {
  const pool = getDatabasePool(connectionString, options);

  if (!singletonDatabase) {
    singletonDatabase = createDatabaseClient(pool);
  }

  return singletonDatabase;
}

export async function checkDatabaseReadiness(
  db: DatabaseClient,
  options: { readonly requirePgVector?: boolean | undefined } = {}
): Promise<DatabaseReadinessResult> {
  await db.execute(sql`select 1`);

  if (options.requirePgVector) {
    const result = await db.execute<{ extname: string }>(
      sql`select extname from pg_extension where extname = 'vector'`
    );

    if (result.rows.length === 0) {
      throw new Error("PostgreSQL pgvector extension is not enabled.");
    }

    return {
      database: "ok",
      pgvector: "ok"
    };
  }

  return {
    database: "ok",
    pgvector: "skipped"
  };
}

export async function closeDatabaseClient(): Promise<void> {
  await singletonPool?.end();
  singletonPool = undefined;
  singletonDatabase = undefined;
}

function getPoolCounts(pool: pg.Pool): {
  readonly poolTotal: number;
  readonly poolIdle: number;
  readonly poolWaiting: number;
} {
  return {
    poolTotal: pool.totalCount,
    poolIdle: pool.idleCount,
    poolWaiting: pool.waitingCount
  };
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}

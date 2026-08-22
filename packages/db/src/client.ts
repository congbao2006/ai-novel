import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
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

let singletonPool: PgPool | undefined;
let singletonDatabase: DatabaseClient | undefined;

export function getDatabaseClient(
  connectionString: string,
  options: DatabasePoolOptions = {}
): DatabaseClient {
  if (!singletonPool || !singletonDatabase) {
    singletonPool = createPgPool(connectionString, options);
    singletonDatabase = createDatabaseClient(singletonPool);
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

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
export type PgPool = pg.Pool;

export function createPgPool(connectionString: string): pg.Pool {
  return new pg.Pool({
    connectionString
  });
}

export function createDatabaseClient(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

let singletonPool: PgPool | undefined;
let singletonDatabase: DatabaseClient | undefined;

export function getDatabaseClient(connectionString: string): DatabaseClient {
  if (!singletonPool || !singletonDatabase) {
    singletonPool = createPgPool(connectionString);
    singletonDatabase = createDatabaseClient(singletonPool);
  }

  return singletonDatabase;
}

export async function closeDatabaseClient(): Promise<void> {
  await singletonPool?.end();
  singletonPool = undefined;
  singletonDatabase = undefined;
}

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export function createPgPool(connectionString: string): pg.Pool {
  return new pg.Pool({
    connectionString
  });
}

export function createDatabaseClient(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

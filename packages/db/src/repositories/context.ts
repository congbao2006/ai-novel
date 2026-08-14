import type { DatabaseClient } from "../client.js";
import { createRepositories, type Repositories } from "./factory.js";

export type TransactionClient = Parameters<
  Parameters<DatabaseClient["transaction"]>[0]
>[0];

export type DbExecutor = DatabaseClient | TransactionClient;

export type RepositoryContext = {
  readonly db: DbExecutor;
  readonly repositories: Repositories;
};

export function createRepositoryContext(db: DbExecutor): RepositoryContext {
  return {
    db,
    repositories: createRepositories(db)
  };
}

export async function withTransaction<T>(
  db: DatabaseClient,
  work: (context: RepositoryContext) => Promise<T>
): Promise<T> {
  return db.transaction((transaction) => work(createRepositoryContext(transaction)));
}

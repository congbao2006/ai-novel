import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

type DrizzleJournal = {
  readonly entries: readonly {
    readonly idx: number;
    readonly tag: string;
  }[];
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required to check applied migrations.");
  process.exitCode = 1;
} else {
  await runStatus(databaseUrl);
}

async function runStatus(connectionString: string): Promise<void> {
  const journal = await readJournal();
  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000
  });

  try {
    const appliedCount = await getAppliedMigrationCount(pool);
    const expectedCount = journal.entries.length;
    const latestExpected = journal.entries.at(-1)?.tag ?? "none";
    const tableStatus = await getSchemaTableStatus(pool);

    console.log(`Migration files: ${expectedCount}`);
    console.log(`Applied migrations: ${appliedCount}`);
    console.log(`Latest expected migration: ${latestExpected}`);
    console.log(`story_factions table: ${tableStatus.storyFactions}`);
    console.log(`story_version_factions table: ${tableStatus.storyVersionFactions}`);

    if (appliedCount < expectedCount) {
      console.log(
        `Status: pending migrations (${expectedCount - appliedCount} not applied)`
      );
      process.exitCode = 1;
      return;
    }

    if (appliedCount > expectedCount) {
      console.log("Status: database has migrations newer than this checkout");
      process.exitCode = 1;
      return;
    }

    console.log("Status: migration count matches this checkout");
  } finally {
    await pool.end();
  }
}

async function readJournal(): Promise<DrizzleJournal> {
  const currentFile = fileURLToPath(import.meta.url);
  const journalPath = path.resolve(
    path.dirname(currentFile),
    "../../drizzle/meta/_journal.json"
  );
  return JSON.parse(await readFile(journalPath, "utf8")) as DrizzleJournal;
}

async function getAppliedMigrationCount(pool: pg.Pool): Promise<number> {
  const existsResult = await pool.query<{ exists: boolean }>(
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'drizzle'
          and table_name = '__drizzle_migrations'
      ) as exists
    `
  );

  if (!existsResult.rows[0]?.exists) {
    return 0;
  }

  const countResult = await pool.query<{ count: string }>(
    `select count(*)::text as count from drizzle.__drizzle_migrations`
  );

  return Number(countResult.rows[0]?.count ?? 0);
}

async function getSchemaTableStatus(pool: pg.Pool): Promise<{
  readonly storyFactions: "present" | "missing";
  readonly storyVersionFactions: "present" | "missing";
}> {
  const result = await pool.query<{
    story_factions: string | null;
    story_version_factions: string | null;
  }>(
    `
      select
        to_regclass('public.story_factions')::text as story_factions,
        to_regclass('public.story_version_factions')::text as story_version_factions
    `
  );
  const row = result.rows[0];

  return {
    storyFactions: row?.story_factions ? "present" : "missing",
    storyVersionFactions: row?.story_version_factions ? "present" : "missing"
  };
}

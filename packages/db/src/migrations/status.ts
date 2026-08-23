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

type ExpectedColumn = {
  readonly name: string;
  readonly dataType: string;
  readonly nullable: "YES" | "NO";
  readonly udtName?: string | undefined;
};

const expectedStoryFactionColumns = [
  { name: "id", dataType: "uuid", nullable: "NO" },
  { name: "story_id", dataType: "uuid", nullable: "NO" },
  { name: "faction_key", dataType: "text", nullable: "NO" },
  { name: "name", dataType: "text", nullable: "NO" },
  { name: "description", dataType: "text", nullable: "NO" },
  {
    name: "initial_status",
    dataType: "USER-DEFINED",
    nullable: "NO",
    udtName: "faction_status"
  },
  { name: "initial_influence", dataType: "integer", nullable: "NO" },
  { name: "resources", dataType: "jsonb", nullable: "NO" },
  { name: "goals", dataType: "jsonb", nullable: "NO" },
  { name: "state", dataType: "jsonb", nullable: "NO" },
  { name: "created_at", dataType: "timestamp with time zone", nullable: "NO" },
  { name: "updated_at", dataType: "timestamp with time zone", nullable: "NO" }
] satisfies readonly ExpectedColumn[];

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
    const columnMismatches = await getStoryFactionColumnMismatches(pool);

    console.log(`Migration files: ${expectedCount}`);
    console.log(`Applied migrations: ${appliedCount}`);
    console.log(`Latest expected migration: ${latestExpected}`);
    console.log(`story_factions table: ${tableStatus.storyFactions}`);
    console.log(`story_version_factions table: ${tableStatus.storyVersionFactions}`);
    console.log(
      `story_factions columns: ${
        columnMismatches.length === 0 ? "ok" : columnMismatches.join(", ")
      }`
    );

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

    if (columnMismatches.length > 0) {
      console.log("Status: schema drift detected");
      process.exitCode = 1;
      return;
    }

    console.log("Status: migration count and checked schema match this checkout");
  } finally {
    await pool.end();
  }
}

async function getStoryFactionColumnMismatches(
  pool: pg.Pool
): Promise<string[]> {
  const result = await pool.query<{
    column_name: string;
    data_type: string;
    is_nullable: "YES" | "NO";
    udt_name: string;
  }>(
    `
      select column_name, data_type, is_nullable, udt_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'story_factions'
    `
  );
  const columns = new Map(result.rows.map((row) => [row.column_name, row]));
  const mismatches: string[] = [];

  for (const expected of expectedStoryFactionColumns) {
    const actual = columns.get(expected.name);
    if (!actual) {
      mismatches.push(`${expected.name}:missing`);
      continue;
    }

    if (actual.data_type !== expected.dataType) {
      mismatches.push(
        `${expected.name}:type=${actual.data_type},expected=${expected.dataType}`
      );
    }

    if (actual.is_nullable !== expected.nullable) {
      mismatches.push(
        `${expected.name}:nullable=${actual.is_nullable},expected=${expected.nullable}`
      );
    }

    if (expected.udtName && actual.udt_name !== expected.udtName) {
      mismatches.push(
        `${expected.name}:udt=${actual.udt_name},expected=${expected.udtName}`
      );
    }
  }

  return mismatches;
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

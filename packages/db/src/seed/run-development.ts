import { createDatabaseClient, createPgPool } from "../client.js";
import { seedDevelopmentDatabase } from "./development.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the development seed.");
}

const pool = createPgPool(databaseUrl);
const db = createDatabaseClient(pool);

try {
  await seedDevelopmentDatabase(db);
  console.log("Development seed completed.");
} finally {
  await pool.end();
}

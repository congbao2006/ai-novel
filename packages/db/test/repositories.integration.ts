import { describe, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("repository integration tests", () => {
  it("is reserved for TEST_DATABASE_URL-backed repository checks", () => {
    // Real integration tests will be added when a test database lifecycle exists.
  });
});

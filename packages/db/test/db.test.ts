import { describe, expect, it } from "vitest";
import { schemaModuleStatus } from "../src/index.js";

describe("db package", () => {
  it("exports database infrastructure without gameplay schema", () => {
    expect(schemaModuleStatus).toEqual({
      name: "db-schema",
      gameSchemaImplemented: false
    });
  });
});

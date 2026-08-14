import { describe, expect, it } from "vitest";
import { domainModuleStatus } from "../src/index.js";

describe("domain package", () => {
  it("exports foundation status without gameplay implementation", () => {
    expect(domainModuleStatus).toEqual({
      name: "domain",
      gameplayImplemented: false
    });
  });
});

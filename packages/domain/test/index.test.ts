import { describe, expect, it } from "vitest";
import {
  domainModuleStatus,
  entityTypes,
  messageRoles,
  questStatuses,
  sessionStatuses,
  storyStatuses
} from "../src/index.js";

describe("domain package", () => {
  it("exports foundation status without gameplay implementation", () => {
    expect(domainModuleStatus).toEqual({
      name: "domain",
      gameplayImplemented: false,
      databaseEnumsDefined: true
    });
  });

  it("exports stable database enum values from one TypeScript source", () => {
    expect(storyStatuses).toEqual(["draft", "published", "archived"]);
    expect(sessionStatuses).toEqual(["active", "completed", "abandoned"]);
    expect(messageRoles).toEqual(["system", "player", "assistant"]);
    expect(questStatuses).toEqual([
      "inactive",
      "active",
      "completed",
      "failed"
    ]);
    expect(entityTypes).toEqual(["player", "npc"]);
  });
});

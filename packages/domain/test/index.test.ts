import { describe, expect, it } from "vitest";
import {
  domainModuleStatus,
  entityTypes,
  messageRoles,
  questStatuses,
  runDeterministicTurn,
  sessionStatuses,
  storyStatuses
} from "../src/index.js";

describe("domain package", () => {
  const context = {
    story: {
      id: "story-1",
      title: "Đại Việt 1288",
      slug: "dai-viet-1288",
      description: "A deterministic test story.",
      genre: "historical fantasy"
    },
    character: {
      id: "character-1",
      name: "Trinh sat",
      description: "Nhanh và kín đáo."
    },
    state: {
      version: 1,
      location: "Điểm khởi đầu",
      worldTime: null,
      playerStats: { agility: 7 },
      flags: {},
      stateData: {}
    },
    turnNumber: 1
  };

  it("exports foundation status with deterministic gameplay implementation", () => {
    expect(domainModuleStatus).toEqual({
      name: "domain",
      gameplayImplemented: "deterministic",
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

  it("produces the same output for the same input", () => {
    const first = runDeterministicTurn({ text: "quan sát" }, context);
    const second = runDeterministicTurn({ text: " quan   sát " }, context);

    expect(first).toEqual(second);
  });

  it("moves to a destination and emits a movement event", () => {
    const result = runDeterministicTurn({ text: "đi Chợ Đông" }, context);

    expect(result.command).toBe("move");
    expect(result.statePatch.location).toBe("Chợ Đông");
    expect(result.events).toEqual([
      {
        eventType: "movement",
        title: "Di chuyển",
        description: "Người chơi di chuyển từ Điểm khởi đầu đến Chợ Đông.",
        importance: 1,
        payload: {
          from: "Điểm khởi đầu",
          to: "Chợ Đông"
        }
      }
    ]);
  });

  it("keeps fallback actions safe", () => {
    const result = runDeterministicTurn(
      { text: "tung một kế hoạch rất mơ hồ" },
      context
    );

    expect(result.command).toBe("fallback");
    expect(result.statePatch.location).toBeUndefined();
    expect(result.events).toEqual([]);
  });
});

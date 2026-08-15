import { describe, expect, it } from "vitest";
import {
  domainModuleStatus,
  aiUsagePurposes,
  aiUsageStatuses,
  entityTypes,
  memoryTypes,
  messageRoles,
  questStatuses,
  runDeterministicTurn,
  sessionStatuses,
  storyStatuses,
  validateSummaryOutput,
  validateAITurnProposal,
  AITurnProposalValidationError,
  SummaryOutputValidationError
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
    expect(memoryTypes).toEqual([
      "fact",
      "relationship",
      "event",
      "player",
      "world",
      "npc",
      "quest",
      "other"
    ]);
    expect(aiUsagePurposes).toEqual([
      "gameplay_turn",
      "smoke",
      "summary",
      "npc",
      "memory",
      "other"
    ]);
    expect(aiUsageStatuses).toEqual(["success", "failed"]);
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

  it("accepts a valid AI turn proposal and merges allowed state patches", () => {
    const result = validateAITurnProposal(
      {
        narrative: "Bạn bước vào sân trong và nghe tiếng gió đổi hướng.",
        proposedStatePatch: {
          location: "Sân trong",
          playerStats: { agility: 8 },
          flags: { aiSceneTone: "tense" },
          stateData: { aiLastActionSummary: "Người chơi tiến vào sân trong." }
        },
        proposedEvents: [
          {
            eventType: "movement",
            title: "Tiến vào sân trong",
            description: "Người chơi đổi vị trí sang sân trong.",
            importance: 2
          }
        ]
      },
      context.state
    );

    expect(result.resultText).toContain("sân trong");
    expect(result.statePatch.location).toBe("Sân trong");
    expect(result.statePatch.playerStats).toMatchObject({ agility: 8 });
    expect(result.statePatch.flags).toMatchObject({ aiSceneTone: "tense" });
    expect(result.events[0]).toMatchObject({
      eventType: "movement",
      importance: 2,
      payload: { source: "ai" }
    });
  });

  it("rejects unsafe AI proposal shape and protected state fields", () => {
    expect(() =>
      validateAITurnProposal(
        {
          narrative: "Nope",
          proposedStatePatch: {},
          proposedEvents: [],
          userId: "attacker"
        },
        context.state
      )
    ).toThrow(AITurnProposalValidationError);

    expect(() =>
      validateAITurnProposal(
        {
          narrative: "Nope",
          proposedStatePatch: { version: 99 },
          proposedEvents: []
        },
        context.state
      )
    ).toThrow(AITurnProposalValidationError);
  });

  it("rejects invalid event and state patch values from AI", () => {
    expect(() =>
      validateAITurnProposal(
        {
          narrative: "Nope",
          proposedStatePatch: {},
          proposedEvents: [
            {
              eventType: "movement",
              title: "Bad",
              description: "Bad",
              importance: 6
            }
          ]
        },
        context.state
      )
    ).toThrow(AITurnProposalValidationError);

    expect(() =>
      validateAITurnProposal(
        {
          narrative: "Nope",
          proposedStatePatch: { playerStats: { newStat: 10 } },
          proposedEvents: []
        },
        context.state
      )
    ).toThrow(AITurnProposalValidationError);

    expect(() =>
      validateAITurnProposal(
        {
          narrative: "Nope",
          proposedStatePatch: { playerStats: { agility: Number.NaN } },
          proposedEvents: []
        },
        context.state
      )
    ).toThrow(AITurnProposalValidationError);
  });

  it("rejects excessive AI-proposed events", () => {
    expect(() =>
      validateAITurnProposal(
        {
          narrative: "Nope",
          proposedStatePatch: {},
          proposedEvents: Array.from({ length: 6 }, (_, index) => ({
            eventType: "note",
            title: `Event ${index}`,
            description: "Too many events.",
            importance: 1
          }))
        },
        context.state
      )
    ).toThrow(AITurnProposalValidationError);
  });

  it("accepts bounded structured summary output", () => {
    const output = validateSummaryOutput({
      summary: "Người chơi đã tới bến thuyền và gặp một đồng minh.",
      importantFacts: [
        {
          key: "ally.waits_at_dock",
          content: "Một đồng minh đang chờ người chơi ở bến thuyền.",
          importance: 4,
          memoryType: "fact"
        }
      ]
    });

    expect(output.importantFacts[0]).toMatchObject({
      key: "ally.waits_at_dock",
      memoryType: "fact",
      importance: 4
    });
  });

  it("rejects unsafe summary memory candidates", () => {
    expect(() =>
      validateSummaryOutput({
        summary: "Valid summary",
        importantFacts: [
          {
            key: "bad key with spaces",
            content: "Invalid key format.",
            importance: 4,
            memoryType: "fact"
          }
        ]
      })
    ).toThrow(SummaryOutputValidationError);

    expect(() =>
      validateSummaryOutput({
        summary: "Valid summary",
        importantFacts: [
          {
            key: null,
            content: "Invalid importance.",
            importance: 9,
            memoryType: "fact"
          }
        ]
      })
    ).toThrow(SummaryOutputValidationError);
  });
});

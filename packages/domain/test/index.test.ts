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
  assertQuestStatusTransition,
  buildDeterministicConsequenceProposals,
  deriveWorldSimulationSignals,
  expandConsequenceChain,
  factionStatuses,
  runWorldSimulation,
  shouldRunWorldTick,
  validateConsequenceProposal,
  validateSummaryOutput,
  validateAITurnProposal,
  validateNPCReactionProposal,
  AITurnProposalValidationError,
  ConsequenceValidationError,
  NPCReactionProposalValidationError,
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
    expect(factionStatuses).toEqual([
      "active",
      "weakened",
      "collapsed",
      "hidden"
    ]);
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
      "embedding",
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

  it("validates an NPC reaction proposal with narrow server-owned effects", () => {
    const proposal = validateNPCReactionProposal(
      {
        dialogue: "Ta nhớ chuyện ở bến sông.",
        action: {
          type: "speak",
          description: "Lý Thanh answers cautiously."
        },
        statePatch: {
          mood: "cautious"
        },
        relationshipDeltas: [
          {
            targetType: "player",
            targetId: null,
            affinityDelta: 2,
            trustDelta: 1,
            fearDelta: -1
          }
        ],
        memoryCandidates: [
          {
            key: "ly-thanh.saved-at-river",
            content: "Lý Thanh confirmed the player once saved her near the river.",
            importance: 4,
            memoryType: "npc"
          }
        ],
        events: [
          {
            eventType: "npc_dialogue",
            title: "Lý Thanh nhớ chuyện cũ",
            description: "Lý Thanh nhắc lại chuyện được cứu ở bến sông.",
            importance: 3
          }
        ]
      },
      {
        npcId: "npc-1",
        validNpcIds: new Set(["npc-1", "npc-2"])
      }
    );

    expect(proposal.dialogue).toContain("bến sông");
    expect(proposal.statePatch).toEqual({ mood: "cautious" });
    expect(proposal.relationshipDeltas[0]?.trustDelta).toBe(1);
    expect(proposal.memoryCandidates[0]?.memoryType).toBe("npc");
    expect(proposal.events[0]?.payload).toEqual({ source: "npc_ai" });
  });

  it("rejects unsafe NPC reaction proposals", () => {
    expect(() =>
      validateNPCReactionProposal(
        {
          dialogue: null,
          action: {
            type: "execute_sql",
            description: "bad"
          },
          statePatch: {},
          relationshipDeltas: [],
          memoryCandidates: [],
          events: []
        },
        { npcId: "npc-1" }
      )
    ).toThrow(NPCReactionProposalValidationError);

    expect(() =>
      validateNPCReactionProposal(
        {
          dialogue: null,
          action: null,
          statePatch: {
            alive: false
          },
          relationshipDeltas: [],
          memoryCandidates: [],
          events: []
        },
        { npcId: "npc-1" }
      )
    ).toThrow(NPCReactionProposalValidationError);

    expect(() =>
      validateNPCReactionProposal(
        {
          dialogue: null,
          action: null,
          statePatch: {},
          relationshipDeltas: [
            {
              targetType: "player",
              targetId: null,
              affinityDelta: 21,
              trustDelta: 0,
              fearDelta: 0
            }
          ],
          memoryCandidates: [],
          events: []
        },
        { npcId: "npc-1" }
      )
    ).toThrow(NPCReactionProposalValidationError);
  });

  it("validates consequence proposals and quest lifecycle rules", () => {
    const consequence = validateConsequenceProposal({
      type: "quest_activate",
      source: "deterministic",
      questKey: "river.rescue",
      title: "Cứu người ở bến sông",
      description: "Giúp người bị truy đuổi ở bến sông.",
      progress: {
        counters: { rescued: 0 },
        stage: "start"
      }
    });

    expect(consequence).toMatchObject({
      type: "quest_activate",
      status: "active",
      questKey: "river.rescue"
    });
    expect(() => assertQuestStatusTransition("inactive", "active")).not.toThrow();
    expect(() => assertQuestStatusTransition("active", "completed")).not.toThrow();
    expect(() => assertQuestStatusTransition("completed", "active")).toThrow(
      ConsequenceValidationError
    );
  });

  it("rejects unsafe consequence proposals", () => {
    expect(() =>
      validateConsequenceProposal({
        type: "relationship_delta",
        source: "main_ai",
        sourceEntity: { type: "npc", id: "npc-1" },
        targetEntity: { type: "player", id: null },
        affinityDelta: 100,
        trustDelta: 0,
        fearDelta: 0
      })
    ).toThrow(ConsequenceValidationError);

    expect(() =>
      validateConsequenceProposal({
        type: "flag_set",
        source: "main_ai",
        flagKey: "auth.admin",
        value: true
      })
    ).toThrow(ConsequenceValidationError);
  });

  it("builds deterministic consequences and bounded rule-chain output", () => {
    const proposals = buildDeterministicConsequenceProposals(
      "nhận nhiệm vụ cứu Lý Thanh"
    );
    const consequences = expandConsequenceChain({
      consequences: proposals.map(validateConsequenceProposal),
      maxDepth: 2
    });

    expect(consequences[0]).toMatchObject({
      type: "quest_activate",
      questKey: "cuu-ly-thanh"
    });
    expect(consequences.some((item) => item.type === "world_event")).toBe(true);
    expect(consequences.length).toBeLessThanOrEqual(20);
  });

  it("applies deterministic world simulation signals to factions", () => {
    const first = runWorldSimulation({
      sessionId: "session-1",
      currentTurn: 5,
      factions: [
        {
          id: "faction-1",
          sessionId: "session-1",
          factionKey: "guard",
          name: "Guard",
          description: "Keeps order.",
          status: "active",
          influence: 50,
          resources: { wealth: 10 },
          goals: [],
          state: {}
        }
      ],
      factionRelations: [],
      recentWorldEvents: [],
      state: {
        location: "Gate",
        worldTime: null,
        flags: {},
        stateData: {}
      },
      signals: [
        {
          type: "faction_helped",
          factionKey: "guard",
          importance: 3
        }
      ]
    });
    const second = runWorldSimulation({
      sessionId: "session-1",
      currentTurn: 5,
      factions: [
        {
          id: "faction-1",
          sessionId: "session-1",
          factionKey: "guard",
          name: "Guard",
          description: "Keeps order.",
          status: "active",
          influence: 50,
          resources: { wealth: 10 },
          goals: [],
          state: {}
        }
      ],
      factionRelations: [],
      recentWorldEvents: [],
      state: {
        location: "Gate",
        worldTime: null,
        flags: {},
        stateData: {}
      },
      signals: [
        {
          type: "faction_helped",
          factionKey: "guard",
          importance: 3
        }
      ]
    });

    expect(first).toEqual(second);
    expect(first.plan.factionChanges[0]).toMatchObject({
      factionKey: "guard",
      influenceDelta: 5
    });
  });

  it("emits status events and memories when a faction collapses", () => {
    const result = runWorldSimulation({
      sessionId: "session-1",
      currentTurn: 10,
      factions: [
        {
          id: "faction-1",
          sessionId: "session-1",
          factionKey: "guard",
          name: "Guard",
          description: "Keeps order.",
          status: "weakened",
          influence: 4,
          resources: {},
          goals: [],
          state: {}
        }
      ],
      factionRelations: [],
      recentWorldEvents: [],
      state: {
        location: "Gate",
        worldTime: null,
        flags: {},
        stateData: {}
      },
      signals: [
        {
          type: "major_loss",
          factionKey: "guard",
          importance: 5
        }
      ]
    });

    expect(result.plan.events[0]).toMatchObject({
      eventType: "faction_status_changed",
      importance: 5
    });
    expect(result.plan.memories[0]).toMatchObject({
      memoryType: "world",
      importance: 5
    });
  });

  it("uses explicit bounded world tick policy", () => {
    expect(
      shouldRunWorldTick({
        turnCount: 4,
        intervalTurns: 5,
        lastTickTurn: 0
      })
    ).toBe(false);
    expect(
      shouldRunWorldTick({
        turnCount: 5,
        intervalTurns: 5,
        lastTickTurn: 0
      })
    ).toBe(true);
    expect(
      shouldRunWorldTick({
        turnCount: 5,
        intervalTurns: 5,
        lastTickTurn: 5
      })
    ).toBe(false);
  });

  it("derives world simulation signals only from explicit metadata", () => {
    const signals = deriveWorldSimulationSignals({
      events: [
        {
          eventType: "world_event",
          title: "Guard helped",
          description: "The player helped the guard.",
          importance: 4,
          payload: {
            worldSignal: "faction_helped",
            factionKey: "guard"
          }
        }
      ],
      consequences: []
    });

    expect(signals).toEqual([
      {
        type: "faction_helped",
        factionKey: "guard",
        importance: 4,
        metadata: {
          worldSignal: "faction_helped",
          factionKey: "guard"
        }
      }
    ]);
  });
});

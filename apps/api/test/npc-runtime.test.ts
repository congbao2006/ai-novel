import { describe, expect, it } from "vitest";
import type {
  GameMessageRecord,
  GameStateRecord,
  NpcRecord,
  RelationshipRecord,
  Repositories,
  RepositoryContext,
  SessionMemoryRecord,
  StoryCharacterRecord,
  StoryRecord,
  WorldEventRecord
} from "@ai-novel/db";
import type {
  NPCDecisionContext,
  ValidatedNPCReactionProposal
} from "@ai-novel/domain";
import { NPCInitializationService } from "../src/modules/sessions/npc-initialization-service.js";
import { NPCKnowledgeBuilder } from "../src/modules/sessions/npc-knowledge-builder.js";
import { NPCParticipationSelector } from "../src/modules/sessions/npc-participation-selector.js";
import type { NPCReactionEngine } from "../src/modules/sessions/npc-reaction-engine.js";
import { NPCReactionService } from "../src/modules/sessions/npc-reaction-service.js";

const story: StoryRecord = {
  id: "story-1",
  title: "Bến sông",
  slug: "ben-song",
  description: "A river story.",
  genre: "fantasy",
  status: "published",
  worldPrompt: "secret world prompt",
  openingPrompt: "secret opening prompt",
  createdByUserId: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z")
};

const playerTemplate: StoryCharacterRecord = {
  id: "character-player",
  storyId: story.id,
  name: "Người chơi",
  description: "Player character.",
  personality: "brave",
  background: "public background",
  initialStats: {},
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z")
};

const npcTemplate: StoryCharacterRecord = {
  ...playerTemplate,
  id: "character-ly-thanh",
  name: "Lý Thanh",
  description: "A cautious ally.",
  personality: "careful"
};

const state: GameStateRecord = {
  id: "state-1",
  sessionId: "session-1",
  version: 1,
  location: "Bến sông",
  worldTime: null,
  playerStats: {},
  flags: { hiddenPlayerFlag: true },
  stateData: { aiSceneSummary: "Mưa nhỏ trên bến." },
  createdAt: new Date("2026-01-02T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z")
};

function createNpc(id: string, name: string, sessionId = "session-1"): NpcRecord {
  return {
    id,
    sessionId,
    templateCharacterId: id === "npc-1" ? npcTemplate.id : null,
    name,
    description: `${name} description`,
    personality: { summary: "careful" },
    goals: ["survive"],
    secrets: { privateGoal: "hide the map" },
    currentState: { location: "Bến sông", mood: "neutral" },
    alive: true,
    createdAt: new Date("2026-01-02T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z")
  };
}

function createFixture() {
  const npcs = [createNpc("npc-1", "Lý Thanh"), createNpc("npc-2", "Trần Hổ")];
  const memories: SessionMemoryRecord[] = [
    {
      id: "memory-1",
      sessionId: "session-1",
      memoryType: "npc",
      subjectType: "npc",
      subjectId: "npc-1",
      key: "ly.saved",
      content: "Lý Thanh remembers the player saved her near the river.",
      importance: 5,
      firstObservedTurn: 1,
      lastConfirmedTurn: 8,
      active: true,
      metadata: {},
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z")
    },
    {
      id: "memory-2",
      sessionId: "session-1",
      memoryType: "npc",
      subjectType: "npc",
      subjectId: "npc-2",
      key: "ho.secret",
      content: "Trần Hổ hides a different secret.",
      importance: 5,
      firstObservedTurn: 1,
      lastConfirmedTurn: 8,
      active: true,
      metadata: {},
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z")
    }
  ];
  const messages: GameMessageRecord[] = [
    {
      id: "message-1",
      sessionId: "session-1",
      role: "player",
      content: "Tôi hỏi Lý Thanh về bến sông.",
      turnNumber: 1,
      createdAt: new Date("2026-01-02T00:00:00Z")
    }
  ];
  const events: WorldEventRecord[] = [
    {
      id: "event-1",
      sessionId: "session-1",
      eventType: "rumor",
      title: "Tin ở bến",
      description: "Lý Thanh nghe tin có sát thủ gần bến.",
      importance: 4,
      payload: {},
      turnNumber: 2,
      createdAt: new Date("2026-01-02T00:00:00Z")
    }
  ];
  const relationships: RelationshipRecord[] = [];

  const repositories = {
    stories: {
      async listCharactersForStory() {
        return [playerTemplate, npcTemplate];
      }
    },
    npcs: {
      async create(input: Parameters<Repositories["npcs"]["create"]>[0]) {
        const npc = {
          id: `npc-created-${npcs.length + 1}`,
          createdAt: new Date("2026-01-02T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
          ...input
        } as NpcRecord;
        npcs.push(npc);
        return npc;
      },
      async listBySession(sessionId: string) {
        return npcs.filter((npc) => npc.sessionId === sessionId);
      },
      async getByIdForSession(sessionId: string, npcId: string) {
        return npcs.find((npc) => npc.sessionId === sessionId && npc.id === npcId) ?? null;
      },
      async updateRuntimeState(input: Parameters<Repositories["npcs"]["updateRuntimeState"]>[0]) {
        const npc = npcs.find(
          (item) => item.sessionId === input.sessionId && item.id === input.npcId
        );

        if (!npc) {
          throw new Error("missing npc");
        }

        Object.assign(npc, {
          currentState: input.currentState ?? npc.currentState,
          updatedAt: new Date("2026-01-02T00:01:00Z")
        });
        return npc;
      }
    },
    memories: {
      async listActiveForSession(sessionId: string) {
        return memories.filter((memory) => memory.sessionId === sessionId && memory.active);
      },
      async createMemory(input: Parameters<Repositories["memories"]["createMemory"]>[0]) {
        const memory = {
          id: `memory-${memories.length + 1}`,
          active: true,
          createdAt: new Date("2026-01-02T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
          ...input
        } as SessionMemoryRecord;
        memories.push(memory);
        return memory;
      },
      async findByKey(sessionId: string, key: string) {
        return memories.find((memory) => memory.sessionId === sessionId && memory.key === key) ?? null;
      },
      async updateMemory() {
        throw new Error("not needed");
      }
    },
    relationships: {
      async getRelationshipEdge(
        sessionId: string,
        source: Parameters<Repositories["relationships"]["getRelationshipEdge"]>[1],
        target: Parameters<Repositories["relationships"]["getRelationshipEdge"]>[2]
      ) {
        return (
          relationships.find(
            (relationship) =>
              relationship.sessionId === sessionId &&
              relationship.sourceType === source.type &&
              relationship.sourceId === (source.id ?? null) &&
              relationship.targetType === target.type &&
              relationship.targetId === (target.id ?? null)
          ) ?? null
        );
      },
      async upsertRelationship(input: Parameters<Repositories["relationships"]["upsertRelationship"]>[0]) {
        const relationship = {
          id: `relationship-${relationships.length + 1}`,
          sessionId: input.sessionId,
          sourceType: input.source.type,
          sourceId: input.source.id ?? null,
          targetType: input.target.type,
          targetId: input.target.id ?? null,
          affinity: input.affinity ?? 0,
          trust: input.trust ?? 0,
          fear: input.fear ?? 0,
          metadata: input.metadata ?? {},
          updatedAt: new Date("2026-01-02T00:00:00Z")
        } as RelationshipRecord;
        relationships.push(relationship);
        return relationship;
      }
    },
    gameMessages: {
      async getRecentMessages() {
        return messages;
      }
    },
    worldEvents: {
      async getImportantEvents() {
        return events;
      }
    }
  } as unknown as Repositories;

  return { repositories, npcs, memories, relationships };
}

describe("NPC runtime foundation", () => {
  it("initializes runtime NPCs separately from the selected player template", async () => {
    const { repositories, npcs } = createFixture();
    const service = new NPCInitializationService();

    await service.initializeForSession({
      context: { db: {} as RepositoryContext["db"], repositories },
      sessionId: "new-session",
      story,
      selectedCharacterId: playerTemplate.id
    });

    expect(npcs.some((npc) => npc.sessionId === "new-session" && npc.name === "Lý Thanh")).toBe(true);
    expect(npcs.some((npc) => npc.sessionId === "new-session" && npc.name === "Người chơi")).toBe(false);
  });

  it("selects named and colocated NPCs with a reaction cap", () => {
    const selector = new NPCParticipationSelector({ maxReactionsPerTurn: 1 });
    const selected = selector.select({
      npcs: [createNpc("npc-1", "Lý Thanh"), createNpc("npc-2", "Trần Hổ")],
      action: "Tôi hỏi Lý Thanh về cô gái ở bờ sông.",
      location: "Bến sông"
    });

    expect(selected).toHaveLength(1);
    expect(selected[0]?.name).toBe("Lý Thanh");
  });

  it("builds NPC knowledge without unrelated NPC memories or full game state", async () => {
    const { repositories } = createFixture();
    const builder = new NPCKnowledgeBuilder(repositories, {
      maxMemories: 5,
      maxRecentMessages: 5,
      maxWorldEvents: 5
    });

    const context = await builder.build({
      userId: "user-1",
      sessionId: "session-1",
      npc: createNpc("npc-1", "Lý Thanh"),
      allNpcs: [createNpc("npc-1", "Lý Thanh"), createNpc("npc-2", "Trần Hổ")],
      state,
      action: "Tôi hỏi Lý Thanh.",
      turnNumber: 3
    });

    expect(context.memories.map((memory) => memory.content).join("\n")).toContain("saved her");
    expect(context.memories.map((memory) => memory.content).join("\n")).not.toContain("Trần Hổ hides");
    expect(context.currentState.flags).toEqual({});
    expect(context.npc.secrets).toEqual({ privateGoal: "hide the map" });
  });

  it("runs optional NPC reactions and persists proposed deltas through repositories", async () => {
    const { repositories, memories, relationships } = createFixture();
    const engine: NPCReactionEngine = {
      async react(input): Promise<ValidatedNPCReactionProposal> {
        expect((input.context as NPCDecisionContext).npc.name).toBe("Lý Thanh");
        return {
          dialogue: "Ta vẫn nhớ bến sông.",
          action: { type: "speak", description: "Answers the player." },
          statePatch: { mood: "trusting" },
          relationshipDeltas: [
            {
              targetType: "player",
              targetId: null,
              affinityDelta: 3,
              trustDelta: 2,
              fearDelta: 0
            }
          ],
          memoryCandidates: [
            {
              memoryType: "npc",
              key: "reply.river",
              content: "Lý Thanh discussed the river rescue with the player.",
              importance: 4
            }
          ],
          events: []
        };
      }
    };
    const service = new NPCReactionService(
      repositories,
      new NPCParticipationSelector({ maxReactionsPerTurn: 1 }),
      new NPCKnowledgeBuilder(repositories, {
        maxMemories: 5,
        maxRecentMessages: 5,
        maxWorldEvents: 5
      }),
      engine
    );

    const result = await service.generateReactions({
      userId: "user-1",
      sessionId: "session-1",
      state,
      action: "Tôi hỏi Lý Thanh.",
      turnNumber: 3
    });
    const reaction = result.reactions[0]!;
    const delta = reaction.relationshipDeltas[0]!;

    await repositories.npcs.updateRuntimeState({
      sessionId: "session-1",
      npcId: reaction.npcId,
      currentState: { mood: reaction.statePatch.mood }
    });
    await repositories.relationships.upsertRelationship({
      sessionId: "session-1",
      source: { type: "npc", id: reaction.npcId },
      target: { type: "player", id: null },
      affinity: delta.affinityDelta,
      trust: delta.trustDelta,
      fear: delta.fearDelta
    });
    await repositories.memories.createMemory({
      sessionId: "session-1",
      memoryType: "npc",
      subjectType: "npc",
      subjectId: reaction.npcId,
      key: "npc:npc-1:reply.river",
      content: reaction.memoryCandidates[0]!.content,
      importance: 4,
      firstObservedTurn: 3,
      lastConfirmedTurn: 3,
      metadata: { source: "npc_ai" }
    });

    expect(result.dialogueBlocks[0]).toContain("Lý Thanh:");
    expect(relationships[0]).toMatchObject({ affinity: 3, trust: 2 });
    expect(memories.some((memory) => memory.key === "npc:npc-1:reply.river")).toBe(true);
  });
});

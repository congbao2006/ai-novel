import { describe, expect, it } from "vitest";
import {
  authSessions,
  aiUsagePurposeEnum,
  aiUsageRecords,
  aiUsageStatusEnum,
  developmentSeedData,
  entityTypeEnum,
  factionRelationships,
  factionStatusEnum,
  factions,
  gameMessages,
  gameSessions,
  gameStates,
  inventoryItems,
  memoryEmbeddings,
  memoryTypeEnum,
  messageRoleEnum,
  npcs,
  questStatusEnum,
  quests,
  relationships,
  sessionMemories,
  sessionSummaries,
  schemaModuleStatus,
  sessionStatusEnum,
  stories,
  storyCharacters,
  storyCharacterTypeEnum,
  storyFactionRelationships,
  storyFactions,
  storyStatusEnum,
  users,
  worldEvents,
  worldSimulationStates
} from "../src/index.js";

describe("db package", () => {
  it("exports database infrastructure with the foundational gameplay schema", () => {
    expect(schemaModuleStatus).toEqual({
      name: "db-schema",
      gameSchemaImplemented: true
    });
  });

  it("exports all required business tables", () => {
    expect(users).toBeDefined();
    expect(authSessions).toBeDefined();
    expect(aiUsageRecords).toBeDefined();
    expect(stories).toBeDefined();
    expect(storyCharacters).toBeDefined();
    expect(storyFactions).toBeDefined();
    expect(storyFactionRelationships).toBeDefined();
    expect(gameSessions).toBeDefined();
    expect(gameMessages).toBeDefined();
    expect(gameStates).toBeDefined();
    expect(factions).toBeDefined();
    expect(factionRelationships).toBeDefined();
    expect(worldSimulationStates).toBeDefined();
    expect(npcs).toBeDefined();
    expect(relationships).toBeDefined();
    expect(inventoryItems).toBeDefined();
    expect(quests).toBeDefined();
    expect(worldEvents).toBeDefined();
    expect(sessionSummaries).toBeDefined();
    expect(sessionMemories).toBeDefined();
    expect(memoryEmbeddings).toBeDefined();
  });

  it("defines PostgreSQL enums from shared domain constants", () => {
    expect(storyStatusEnum.enumValues).toEqual([
      "draft",
      "published",
      "archived"
    ]);
    expect(storyCharacterTypeEnum.enumValues).toEqual(["playable", "npc"]);
    expect(sessionStatusEnum.enumValues).toEqual([
      "active",
      "completed",
      "abandoned"
    ]);
    expect(messageRoleEnum.enumValues).toEqual([
      "system",
      "player",
      "assistant"
    ]);
    expect(questStatusEnum.enumValues).toEqual([
      "inactive",
      "active",
      "completed",
      "failed"
    ]);
    expect(entityTypeEnum.enumValues).toEqual(["player", "npc"]);
    expect(factionStatusEnum.enumValues).toEqual([
      "active",
      "weakened",
      "collapsed",
      "hidden"
    ]);
    expect(memoryTypeEnum.enumValues).toEqual([
      "fact",
      "relationship",
      "event",
      "player",
      "world",
      "npc",
      "quest",
      "other"
    ]);
    expect(aiUsagePurposeEnum.enumValues).toEqual([
      "gameplay_turn",
      "smoke",
      "summary",
      "npc",
      "memory",
      "embedding",
      "other"
    ]);
    expect(aiUsageStatusEnum.enumValues).toEqual(["success", "failed"]);
  });

  it("defines coherent development seed data", () => {
    const storyIds = new Set(developmentSeedData.stories.map((story) => story.id));

    expect(developmentSeedData.user.email).toBe("demo@ai-novel.local");
    expect(developmentSeedData.stories).toHaveLength(3);
    expect(developmentSeedData.storyCharacters).toHaveLength(6);
    expect(
      developmentSeedData.storyCharacters.every((character) =>
        storyIds.has(character.storyId)
      )
    ).toBe(true);
  });
});

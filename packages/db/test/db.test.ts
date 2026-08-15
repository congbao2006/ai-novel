import { describe, expect, it } from "vitest";
import {
  authSessions,
  aiUsagePurposeEnum,
  aiUsageRecords,
  aiUsageStatusEnum,
  developmentSeedData,
  entityTypeEnum,
  gameMessages,
  gameSessions,
  gameStates,
  inventoryItems,
  messageRoleEnum,
  npcs,
  questStatusEnum,
  quests,
  relationships,
  schemaModuleStatus,
  sessionStatusEnum,
  stories,
  storyCharacters,
  storyStatusEnum,
  users,
  worldEvents
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
    expect(gameSessions).toBeDefined();
    expect(gameMessages).toBeDefined();
    expect(gameStates).toBeDefined();
    expect(npcs).toBeDefined();
    expect(relationships).toBeDefined();
    expect(inventoryItems).toBeDefined();
    expect(quests).toBeDefined();
    expect(worldEvents).toBeDefined();
  });

  it("defines PostgreSQL enums from shared domain constants", () => {
    expect(storyStatusEnum.enumValues).toEqual([
      "draft",
      "published",
      "archived"
    ]);
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
    expect(aiUsagePurposeEnum.enumValues).toEqual([
      "gameplay_turn",
      "smoke",
      "summary",
      "npc",
      "memory",
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

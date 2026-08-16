import { describe, expect, it } from "vitest";
import type {
  CreateSessionInput,
  GameSessionRecord,
  GameStateRecord,
  Repositories,
  RepositoryContext,
  StoryCharacterRecord,
  StoryFactionRecord,
  StoryRecord
} from "@ai-novel/db";
import { AccessDeniedError, ConflictApplicationError, ResourceNotFoundError } from "../src/errors.js";
import { StoryAuthoringService } from "../src/modules/authoring/service.js";
import { FactionInitializationService } from "../src/modules/sessions/faction-initialization-service.js";
import { NPCInitializationService } from "../src/modules/sessions/npc-initialization-service.js";
import { SessionService } from "../src/modules/sessions/service.js";
import { StoryService } from "../src/modules/stories/service.js";

const author = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "author@example.com",
  displayName: "Author"
};

const otherUser = {
  userId: "22222222-2222-4222-8222-222222222222",
  email: "other@example.com",
  displayName: "Other"
};

describe("StoryAuthoringService", () => {
  it("creates an owned draft that is absent from the public catalog", async () => {
    const fixture = createAuthoringFixture();
    const service = new StoryAuthoringService(fixture.repositories);
    const publicStories = new StoryService(fixture.repositories);

    const draft = await service.createDraft(author, {
      title: "Thành Phố Sương",
      genre: "mystery",
      description: "Một thành phố bị phủ bởi màn sương lạ."
    });

    expect(draft.status).toBe("draft");
    expect(draft.slug).toBe("thanh-pho-suong");
    await expect(publicStories.getBySlug(draft.slug)).rejects.toBeInstanceOf(
      ResourceNotFoundError
    );
  });

  it("enforces owner-only authoring access", async () => {
    const fixture = createAuthoringFixture();
    const service = new StoryAuthoringService(fixture.repositories);
    const draft = await service.createDraft(author, {
      title: "Private Draft",
      genre: "test",
      description: "Private."
    });

    await expect(service.getOwnedStory(otherUser, draft.id)).rejects.toBeInstanceOf(
      AccessDeniedError
    );
    await expect(
      service.updateStory(otherUser, draft.id, { title: "Nope" })
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("validates and publishes a playable story with authored templates", async () => {
    const fixture = createAuthoringFixture();
    const authoring = new StoryAuthoringService(fixture.repositories);
    const draft = await createPublishableStory(authoring);

    const validation = await authoring.validateForPublish(author, draft.id);
    const published = await authoring.publish(author, draft.id);

    expect(validation).toEqual({ valid: true, issues: [] });
    expect(published.status).toBe("published");
  });

  it("rejects publish when required runtime templates are missing", async () => {
    const fixture = createAuthoringFixture();
    const service = new StoryAuthoringService(fixture.repositories);
    const draft = await service.createDraft(author, {
      title: "Broken",
      genre: "test",
      description: "Missing core fields."
    });

    const validation = await service.validateForPublish(author, draft.id);

    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.field)).toContain("worldPrompt");
    expect(validation.issues.map((issue) => issue.field)).toContain("characters");
  });

  it("locks runtime-critical content after publish", async () => {
    const fixture = createAuthoringFixture();
    const service = new StoryAuthoringService(fixture.repositories);
    const draft = await createPublishableStory(service);
    const published = await service.publish(author, draft.id);

    await expect(
      service.updateStory(author, published.id, { worldPrompt: "changed" })
    ).rejects.toBeInstanceOf(ConflictApplicationError);
    await expect(
      service.createCharacter(author, published.id, {
        type: "playable",
        name: "Late",
        description: "Too late."
      })
    ).rejects.toBeInstanceOf(ConflictApplicationError);
  });

  it("initializes sessions from authored playable, NPC, faction, and world settings", async () => {
    const fixture = createAuthoringFixture();
    const authoring = new StoryAuthoringService(fixture.repositories);
    const draft = await createPublishableStory(authoring);
    const published = await authoring.publish(author, draft.id);
    const playable = fixture.characters.find(
      (character) =>
        character.storyId === published.id && character.characterType === "playable"
    )!;
    const npc = fixture.characters.find(
      (character) => character.storyId === published.id && character.characterType === "npc"
    )!;
    const sessionService = new SessionService(
      fixture.repositories,
      undefined,
      async (work) =>
        work({ db: {} as RepositoryContext["db"], repositories: fixture.repositories }),
      new NPCInitializationService(),
      new FactionInitializationService()
    );

    await expect(
      sessionService.createSession(otherUser, {
        storyId: published.id,
        characterId: npc.id
      })
    ).rejects.toThrow("not playable");

    const result = await sessionService.createSession(otherUser, {
      storyId: published.id,
      characterId: playable.id
    });

    expect(result.session.currentState?.location).toBe("Cổng thành");
    expect(fixture.npcs).toHaveLength(1);
    expect(fixture.npcs[0]?.templateCharacterId).toBe(npc.id);
    expect(fixture.factions).toHaveLength(1);
    expect(fixture.factions[0]?.factionKey).toBe("city_watch");
  });
});

async function createPublishableStory(service: StoryAuthoringService) {
  const draft = await service.createDraft(author, {
    title: "Thành Phố Sương",
    genre: "mystery",
    description: "Một thành phố bị phủ bởi màn sương lạ."
  });
  await service.updateStory(author, draft.id, {
    worldPrompt: "Giữ không khí bí ẩn, server vẫn là authority.",
    openingPrompt: "Người chơi đứng trước cổng thành đầy sương.",
    settings: {
      initialLocation: "Cổng thành",
      initialWorldTime: "Bình minh"
    }
  });
  await service.createCharacter(author, draft.id, {
    type: "playable",
    name: "Người Gác",
    description: "Một người gác cổng trẻ.",
    initialStats: { hp: 100, stamina: 30 }
  });
  await service.createCharacter(author, draft.id, {
    type: "npc",
    name: "Lý Thanh",
    description: "Một người đưa tin thận trọng.",
    goals: [{ key: "deliver_message", status: "active", progress: 10 }],
    secrets: { rumor: "Biết lối vào hẻm kín." },
    initialLocation: "Cổng thành"
  });
  await service.createFaction(author, draft.id, {
    factionKey: "city_watch",
    name: "Đội Gác Thành",
    description: "Những người giữ cổng thành.",
    initialInfluence: 55,
    resources: { manpower: 20 }
  });
  return service.getOwnedStory(author, draft.id);
}

function createAuthoringFixture() {
  const stories: StoryRecord[] = [];
  const characters: StoryCharacterRecord[] = [];
  const storyFactions: StoryFactionRecord[] = [];
  const sessions: GameSessionRecord[] = [];
  const states: GameStateRecord[] = [];
  const npcs: Repositories["npcs"]["create"] extends (input: infer I) => Promise<infer R>
    ? R[]
    : never[] = [];
  const factions: Repositories["factions"]["create"] extends (
    input: infer I
  ) => Promise<infer R>
    ? R[]
    : never[] = [];
  let counter = 1;
  const nextId = () =>
    `550e8400-e29b-41d4-a716-${String(counter++).padStart(12, "0")}`;

  const repositories = {
    stories: {
      async create(input: Parameters<Repositories["stories"]["create"]>[0]) {
        const story = {
          id: nextId(),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
          ...input
        } as StoryRecord;
        stories.push(story);
        return story;
      },
      async getById(id: string) {
        return stories.find((story) => story.id === id) ?? null;
      },
      async getBySlug(slug: string) {
        return stories.find((story) => story.slug === slug) ?? null;
      },
      async update(storyId: string, input: Parameters<Repositories["stories"]["update"]>[1]) {
        const index = stories.findIndex((story) => story.id === storyId);
        if (index < 0) throw new Error("story missing");
        stories[index] = { ...stories[index]!, ...input, updatedAt: new Date() };
        return stories[index]!;
      },
      async listPublishedPage() {
        return stories.filter((story) => story.status === "published");
      },
      async listPublished() {
        return stories.filter((story) => story.status === "published");
      },
      async listByGenre(genre: string) {
        return stories.filter(
          (story) => story.status === "published" && story.genre === genre
        );
      },
      async listCreatedByUser(userId: string) {
        return stories.filter((story) => story.createdByUserId === userId);
      },
      async listCharactersForStory(storyId: string) {
        return characters.filter((character) => character.storyId === storyId);
      },
      async listCharactersForStoryByType(
        storyId: string,
        characterType: StoryCharacterRecord["characterType"]
      ) {
        return characters.filter(
          (character) =>
            character.storyId === storyId && character.characterType === characterType
        );
      },
      async getCharacterForStory(storyId: string, characterId: string) {
        return (
          characters.find(
            (character) => character.storyId === storyId && character.id === characterId
          ) ?? null
        );
      },
      async createCharacter(
        input: Parameters<Repositories["stories"]["createCharacter"]>[0]
      ) {
        const character = {
          id: nextId(),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
          ...input
        } as StoryCharacterRecord;
        characters.push(character);
        return character;
      },
      async updateCharacter(
        input: Parameters<Repositories["stories"]["updateCharacter"]>[0]
      ) {
        const index = characters.findIndex(
          (character) =>
            character.storyId === input.storyId && character.id === input.characterId
        );
        if (index < 0) throw new Error("character missing");
        characters[index] = {
          ...characters[index]!,
          ...(input as Partial<StoryCharacterRecord>),
          updatedAt: new Date()
        };
        return characters[index]!;
      },
      async deleteCharacter(storyId: string, characterId: string) {
        const index = characters.findIndex(
          (character) => character.storyId === storyId && character.id === characterId
        );
        if (index >= 0) characters.splice(index, 1);
      }
    },
    storyFactions: {
      async create(input: Parameters<Repositories["storyFactions"]["create"]>[0]) {
        const faction = {
          id: nextId(),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
          ...input
        } as StoryFactionRecord;
        storyFactions.push(faction);
        return faction;
      },
      async listForStory(storyId: string) {
        return storyFactions.filter((faction) => faction.storyId === storyId);
      },
      async update(input: Parameters<Repositories["storyFactions"]["update"]>[0]) {
        const index = storyFactions.findIndex(
          (faction) =>
            faction.storyId === input.storyId && faction.id === input.factionId
        );
        if (index < 0) throw new Error("faction missing");
        storyFactions[index] = {
          ...storyFactions[index]!,
          ...(input as Partial<StoryFactionRecord>),
          updatedAt: new Date()
        };
        return storyFactions[index]!;
      },
      async delete(storyId: string, factionId: string) {
        const index = storyFactions.findIndex(
          (faction) => faction.storyId === storyId && faction.id === factionId
        );
        if (index >= 0) storyFactions.splice(index, 1);
      }
    },
    storyFactionRelationships: {
      async listForStory() {
        return [];
      }
    },
    gameSessions: {
      async create(input: CreateSessionInput) {
        const session = {
          id: nextId(),
          status: "active",
          turnCount: 0,
          createdAt: new Date("2026-01-02T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
          lastPlayedAt: new Date("2026-01-02T00:00:00Z"),
          ...input
        } as GameSessionRecord;
        sessions.push(session);
        return session;
      },
      async getById(id: string) {
        return sessions.find((session) => session.id === id) ?? null;
      },
      async listForUser(userId: string) {
        return sessions.filter((session) => session.userId === userId);
      }
    },
    gameStates: {
      async createInitialState(input: Parameters<Repositories["gameStates"]["createInitialState"]>[0]) {
        const state = {
          id: nextId(),
          version: 1,
          createdAt: new Date("2026-01-02T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
          ...input
        } as GameStateRecord;
        states.push(state);
        return state;
      },
      async getCurrentState(sessionId: string) {
        return states.find((state) => state.sessionId === sessionId) ?? null;
      }
    },
    gameMessages: {
      async getRecentMessages() {
        return [];
      }
    },
    npcs: {
      async create(input: Parameters<Repositories["npcs"]["create"]>[0]) {
        const npc = {
          id: nextId(),
          createdAt: new Date("2026-01-02T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
          ...input
        } as (typeof npcs)[number];
        npcs.push(npc);
        return npc;
      }
    },
    factions: {
      async create(input: Parameters<Repositories["factions"]["create"]>[0]) {
        const faction = {
          id: nextId(),
          createdAt: new Date("2026-01-02T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
          ...input
        } as (typeof factions)[number];
        factions.push(faction);
        return faction;
      },
      async listBySession(sessionId: string) {
        return factions.filter((faction) => faction.sessionId === sessionId);
      }
    },
    factionRelationships: {
      async upsertRelation() {
        throw new Error("not expected");
      }
    },
    worldSimulationStates: {
      async createInitial() {
        return {
          id: nextId(),
          sessionId: sessions.at(-1)?.id ?? "session",
          lastTickTurn: 0,
          version: 1,
          createdAt: new Date("2026-01-02T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z")
        };
      }
    }
  } as unknown as Repositories;

  return { repositories, stories, characters, storyFactions, sessions, states, npcs, factions };
}

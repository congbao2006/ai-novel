import { describe, expect, it } from "vitest";
import type {
  CreateInitialStateInput,
  CreateSessionInput,
  GameMessageRecord,
  GameSessionRecord,
  GameStateRecord,
  InventoryItemRecord,
  QuestRecord,
  Repositories,
  RepositoryContext,
  StoryCharacterRecord,
  StoryRecord
} from "@ai-novel/db";
import { buildApp } from "../src/app.js";
import { ResourceNotFoundError } from "../src/errors.js";
import { UnauthenticatedError } from "../src/modules/auth/errors.js";
import type { AuthService } from "../src/modules/auth/service.js";
import { buildInitialGameState } from "../src/modules/sessions/initial-state.js";
import { SessionService } from "../src/modules/sessions/service.js";
import { StoryService } from "../src/modules/stories/service.js";

const user = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "user@example.com",
  displayName: "User One"
};

const otherUser = {
  userId: "22222222-2222-2222-2222-222222222222",
  email: "other@example.com",
  displayName: "Other User"
};

const publishedStory: StoryRecord = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  title: "Đại Việt 1288",
  slug: "dai-viet-1288",
  description: "A published historical adventure.",
  genre: "historical fantasy",
  status: "published",
  worldPrompt: "internal world prompt",
  openingPrompt: "internal opening prompt",
  createdByUserId: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z")
};

const draftStory: StoryRecord = {
  ...publishedStory,
  id: "550e8400-e29b-41d4-a716-446655440010",
  slug: "draft-story",
  status: "draft"
};

const character: StoryCharacterRecord = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  storyId: publishedStory.id,
  name: "Trinh sat",
  description: "Nhanh và kín đáo.",
  personality: "calm",
  background: "Lớn lên ở vùng biên.",
  initialStats: { agility: 7, nested: { courage: 3 } },
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z")
};

const otherCharacter: StoryCharacterRecord = {
  ...character,
  id: "550e8400-e29b-41d4-a716-446655440011",
  storyId: draftStory.id
};

function createSessionRecord(
  input: CreateSessionInput,
  id = "550e8400-e29b-41d4-a716-446655440002"
): GameSessionRecord {
  return {
    id,
    userId: input.userId,
    storyId: input.storyId,
    selectedCharacterId: input.selectedCharacterId ?? null,
    title: input.title ?? null,
    status: "active",
    turnCount: 0,
    createdAt: new Date("2026-01-02T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    lastPlayedAt: new Date("2026-01-02T00:00:00Z")
  };
}

function createStateRecord(input: CreateInitialStateInput): GameStateRecord {
  return {
    id: "550e8400-e29b-41d4-a716-446655440003",
    sessionId: input.sessionId,
    version: 1,
    location: input.location,
    worldTime: input.worldTime ?? null,
    playerStats: input.playerStats,
    flags: input.flags,
    stateData: input.stateData,
    createdAt: new Date("2026-01-02T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z")
  };
}

function createRepositoriesFixture(options: {
  readonly failStateCreate?: boolean;
  readonly ownerUserId?: string;
	} = {}): {
	  readonly repositories: Repositories;
	  readonly sessions: GameSessionRecord[];
	  readonly states: GameStateRecord[];
	  readonly quests: QuestRecord[];
	  readonly inventory: InventoryItemRecord[];
	} {
  const sessions: GameSessionRecord[] = [];
  const states: GameStateRecord[] = [];
  const messages: GameMessageRecord[] = [];
  const quests: QuestRecord[] = [];
  const inventory: InventoryItemRecord[] = [];

  const repositories = {
    stories: {
      async getById(id: string) {
        return [publishedStory, draftStory].find((story) => story.id === id) ?? null;
      },
      async getBySlug(slug: string) {
        return [publishedStory, draftStory].find((story) => story.slug === slug) ?? null;
      },
      async listPublishedPage() {
        return [publishedStory];
      },
      async listPublished() {
        return [publishedStory];
      },
      async listByGenre() {
        return [publishedStory];
      },
      async listCreatedByUser() {
        return [];
      },
      async listCharactersForStory(storyId: string) {
        return [character, otherCharacter].filter(
          (item) => item.storyId === storyId
        );
      },
      async getCharacterForStory(storyId: string, characterId: string) {
        return (
          [character, otherCharacter].find(
            (item) => item.storyId === storyId && item.id === characterId
          ) ?? null
        );
      }
    },
    gameSessions: {
      async create(input: CreateSessionInput) {
        const session = createSessionRecord(input);
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
      async createInitialState(input: CreateInitialStateInput) {
        if (options.failStateCreate) {
          throw new Error("state failed");
        }

        const state = createStateRecord(input);
        states.push(state);
        return state;
      },
      async getCurrentState(sessionId: string) {
        return states.find((state) => state.sessionId === sessionId) ?? null;
      }
    },
    gameMessages: {
      async getRecentMessages() {
        return messages;
      }
    },
    quests: {
      async listSessionQuests(sessionId: string) {
        return quests.filter((quest) => quest.sessionId === sessionId);
      }
    },
    inventory: {
      async listInventoryByOwner(
        sessionId: string,
        owner: Parameters<Repositories["inventory"]["listInventoryByOwner"]>[1]
      ) {
        return inventory.filter(
          (item) =>
            item.sessionId === sessionId &&
            item.ownerType === owner.type &&
            item.ownerId === (owner.id ?? null)
        );
      }
    }
  } as unknown as Repositories;

  if (options.ownerUserId) {
    const seeded = createSessionRecord(
      {
        userId: options.ownerUserId,
        storyId: publishedStory.id,
        selectedCharacterId: character.id,
        title: publishedStory.title
      },
      "550e8400-e29b-41d4-a716-446655440099"
    );
    sessions.push(seeded);
    states.push(createStateRecord(buildInitialGameState(seeded.id, publishedStory, character)));
    quests.push({
      id: "550e8400-e29b-41d4-a716-446655440120",
      sessionId: seeded.id,
      questKey: "demo.quest",
      title: "Demo Quest",
      description: "A visible quest.",
      status: "active",
      progress: { stage: "start" },
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z")
    });
    inventory.push({
      id: "550e8400-e29b-41d4-a716-446655440121",
      sessionId: seeded.id,
      ownerType: "player",
      ownerId: null,
      itemKey: "demo_item",
      name: "Demo Item",
      description: "A visible item.",
      quantity: 2,
      metadata: {},
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z")
    });
  }

  return { repositories, sessions, states, quests, inventory };
}

function createTransactionRunner(
  repositories: Repositories,
  onRollback?: () => void
) {
  return async <T>(work: (context: RepositoryContext) => Promise<T>) => {
    const snapshot = createRepositoriesFixture();

    try {
      return await work({ db: {} as RepositoryContext["db"], repositories });
    } catch (error) {
      onRollback?.();
      throw error;
    } finally {
      void snapshot;
    }
  };
}

function createFakeAuthService(authenticatedUser = user): AuthService {
  return {
    async getCurrentUser(token: string | undefined) {
      if (token !== "valid-token") {
        throw new UnauthenticatedError();
      }

      return authenticatedUser;
    }
  } as unknown as AuthService;
}

describe("StoryService", () => {
  it("lists only published stories and omits internal prompts", async () => {
    const { repositories } = createRepositoriesFixture();
    const service = new StoryService(repositories);

    const result = await service.listPublished({ limit: 20, page: 1 });

    expect(result.stories).toHaveLength(1);
    expect(result.stories[0]).toEqual({
      id: publishedStory.id,
      title: publishedStory.title,
      slug: publishedStory.slug,
      description: publishedStory.description,
      genre: publishedStory.genre
    });
    expect(JSON.stringify(result)).not.toContain("worldPrompt");
    expect(JSON.stringify(result)).not.toContain("openingPrompt");
  });

  it("returns story detail with public character data", async () => {
    const { repositories } = createRepositoriesFixture();
    const service = new StoryService(repositories);

    const result = await service.getBySlug(publishedStory.slug);

    expect(result.characters).toHaveLength(1);
    expect(result.characters[0]?.initialStats).toEqual(character.initialStats);
    expect(JSON.stringify(result)).not.toContain("internal world prompt");
  });

  it("does not expose unpublished stories", async () => {
    const { repositories } = createRepositoriesFixture();
    const service = new StoryService(repositories);

    await expect(service.getBySlug(draftStory.slug)).rejects.toBeInstanceOf(
      ResourceNotFoundError
    );
  });
});

describe("SessionService", () => {
  it("creates a session and initial state in a transaction", async () => {
    const { repositories, sessions, states } = createRepositoriesFixture();
    const service = new SessionService(
      repositories,
      undefined,
      createTransactionRunner(repositories)
    );

    const result = await service.createSession(user, {
      storyId: publishedStory.id,
      characterId: character.id
    });

    expect(sessions).toHaveLength(1);
    expect(states).toHaveLength(1);
    expect(result.session.currentState?.playerStats).toEqual(character.initialStats);
    expect(result.session.recentMessages).toEqual([]);
  });

  it("rejects invalid story and invalid character choices", async () => {
    const { repositories } = createRepositoriesFixture();
    const service = new SessionService(
      repositories,
      undefined,
      createTransactionRunner(repositories)
    );

    await expect(
      service.createSession(user, {
        storyId: draftStory.id,
        characterId: otherCharacter.id
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    await expect(
      service.createSession(user, {
        storyId: publishedStory.id,
        characterId: otherCharacter.id
      })
    ).rejects.toThrow("Selected character");
  });

  it("enforces ownership for session loading and listing", async () => {
    const { repositories } = createRepositoriesFixture({ ownerUserId: user.userId });
    const service = new SessionService(
      repositories,
      undefined,
      createTransactionRunner(repositories)
    );

    await expect(
      service.getSession(otherUser, "550e8400-e29b-41d4-a716-446655440099")
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    await expect(service.listSessions(user)).resolves.toMatchObject({
      sessions: [{ id: "550e8400-e29b-41d4-a716-446655440099" }]
    });
    await expect(service.listSessions(otherUser)).resolves.toEqual({
      sessions: []
    });
  });

  it("does not mutate character template stats when building initial state", () => {
    const state = buildInitialGameState("session-1", publishedStory, character);

    (state.playerStats.nested as { courage: number }).courage = 99;

    expect(character.initialStats).toEqual({ agility: 7, nested: { courage: 3 } });
    expect(state.location).toBe("Điểm khởi đầu");
    expect(state.flags).toMatchObject({
      storySlug: publishedStory.slug,
      selectedCharacterId: character.id,
      aiEnabled: false
    });
  });

  it("bubbles state creation failure through the transaction boundary", async () => {
    let rolledBack = false;
    const { repositories } = createRepositoriesFixture({ failStateCreate: true });
    const service = new SessionService(
      repositories,
      undefined,
      createTransactionRunner(repositories, () => {
        rolledBack = true;
      })
    );

    await expect(
      service.createSession(user, {
        storyId: publishedStory.id,
        characterId: character.id
      })
    ).rejects.toThrow("state failed");
    expect(rolledBack).toBe(true);
  });
});

describe("story/session API routes", () => {
  it("rejects unauthenticated session creation", async () => {
    const app = await buildApp({
      dependencies: {
        authService: createFakeAuthService(),
        sessionService: {} as SessionService
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: {
        storyId: publishedStory.id,
        characterId: character.id
      }
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("serves story DTOs without prompt leakage", async () => {
    const { repositories } = createRepositoriesFixture();
    const app = await buildApp({
      dependencies: {
        storyService: new StoryService(repositories)
      }
    });

    const listResponse = await app.inject({
      method: "GET",
      url: "/stories"
    });
    const detailResponse = await app.inject({
      method: "GET",
      url: `/stories/${publishedStory.slug}`
    });

    expect(listResponse.statusCode).toBe(200);
    expect(detailResponse.statusCode).toBe(200);
    expect(listResponse.body).not.toContain("worldPrompt");
    expect(detailResponse.body).not.toContain("openingPrompt");
    expect(detailResponse.json().characters[0]).toMatchObject({
      id: character.id,
      initialStats: character.initialStats
    });

    await app.close();
  });

  it("creates and loads a protected session through route contracts", async () => {
    const { repositories } = createRepositoriesFixture();
    const sessionService = new SessionService(
      repositories,
      undefined,
      createTransactionRunner(repositories)
    );
    const app = await buildApp({
      dependencies: {
        authService: createFakeAuthService(),
        sessionService
      }
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/sessions",
      cookies: { ai_novel_session: "valid-token" },
      payload: {
        storyId: publishedStory.id,
        characterId: character.id
      }
    });
    const sessionId = createResponse.json().session.id as string;
    const getResponse = await app.inject({
      method: "GET",
      url: `/sessions/${sessionId}`,
      cookies: { ai_novel_session: "valid-token" }
    });

    expect(createResponse.statusCode).toBe(201);
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().currentState.location).toBe("Điểm khởi đầu");

    await app.close();
  });

  it("serves protected quest and inventory DTOs for the owning user", async () => {
    const { repositories, sessions } = createRepositoriesFixture({
      ownerUserId: user.userId
    });
    const sessionService = new SessionService(
      repositories,
      undefined,
      createTransactionRunner(repositories)
    );
    const app = await buildApp({
      dependencies: {
        authService: createFakeAuthService(),
        sessionService
      }
    });
    const sessionId = sessions[0]!.id;
    const questsResponse = await app.inject({
      method: "GET",
      url: `/sessions/${sessionId}/quests`,
      cookies: { ai_novel_session: "valid-token" }
    });
    const inventoryResponse = await app.inject({
      method: "GET",
      url: `/sessions/${sessionId}/inventory`,
      cookies: { ai_novel_session: "valid-token" }
    });

    expect(questsResponse.statusCode).toBe(200);
    expect(questsResponse.json().quests[0]).toMatchObject({
      questKey: "demo.quest",
      status: "active"
    });
    expect(inventoryResponse.statusCode).toBe(200);
    expect(inventoryResponse.json().items[0]).toMatchObject({
      itemKey: "demo_item",
      quantity: 2
    });

    await app.close();
  });
});

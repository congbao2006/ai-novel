import { describe, expect, it } from "vitest";
import type {
  CreateInitialStateInput,
  CreateSessionInput,
  FactionRecord,
  GameMessageRecord,
  GameSessionRecord,
  GameStateRecord,
  InventoryItemRecord,
  QuestRecord,
  Repositories,
  RepositoryContext,
  StoryFactionRecord,
  StoryCharacterRecord,
  StoryRecord,
  StoryVersionCharacterRecord,
  StoryVersionFactionRecord,
  StoryVersionRecord
} from "@ai-novel/db";
import { buildApp } from "../src/app.js";
import { ResourceNotFoundError } from "../src/errors.js";
import { UnauthenticatedError } from "../src/modules/auth/errors.js";
import type { AuthService } from "../src/modules/auth/service.js";
import { FactionInitializationService } from "../src/modules/sessions/faction-initialization-service.js";
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
  settings: { initialLocation: "Bến sông" },
  currentPublishedVersionId: "550e8400-e29b-41d4-a716-446655440100",
  createdByUserId: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z")
};

const draftStory: StoryRecord = {
  ...publishedStory,
  id: "550e8400-e29b-41d4-a716-446655440010",
  slug: "draft-story",
  status: "draft",
  currentPublishedVersionId: null
};

const storyVersion: StoryVersionRecord = {
  id: publishedStory.currentPublishedVersionId!,
  storyId: publishedStory.id,
  versionNumber: 1,
  status: "published",
  worldPrompt: publishedStory.worldPrompt,
  openingPrompt: publishedStory.openingPrompt,
  settings: publishedStory.settings,
  createdByUserId: null,
  publishedAt: new Date("2026-01-01T00:00:00Z"),
  createdAt: new Date("2026-01-01T00:00:00Z")
};

const character: StoryCharacterRecord = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  storyId: publishedStory.id,
  characterType: "playable",
  name: "Trinh sat",
  description: "Nhanh và kín đáo.",
  personality: "calm",
  background: "Lớn lên ở vùng biên.",
  initialStats: { agility: 7, nested: { courage: 3 } },
  goals: [],
  secrets: {},
  initialState: {},
  initialLocation: null,
  metadata: {},
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z")
};

const versionCharacter: StoryVersionCharacterRecord = {
  id: "550e8400-e29b-41d4-a716-446655440101",
  storyVersionId: storyVersion.id,
  sourceCharacterId: character.id,
  characterType: character.characterType,
  name: character.name,
  description: character.description,
  personality: character.personality,
  background: character.background,
  goals: character.goals,
  secrets: character.secrets,
  initialState: character.initialState,
  initialLocation: character.initialLocation,
  metadata: character.metadata,
  initialStats: character.initialStats,
  createdAt: new Date("2026-01-01T00:00:00Z")
};

const otherCharacter: StoryCharacterRecord = {
  ...character,
  id: "550e8400-e29b-41d4-a716-446655440011",
  storyId: draftStory.id
};

const npcCharacter: StoryCharacterRecord = {
  ...character,
  id: "550e8400-e29b-41d4-a716-446655440012",
  characterType: "npc",
  name: "NPC Template"
};

const storyFactionTemplate: StoryFactionRecord = {
  id: "550e8400-e29b-41d4-a716-446655440020",
  storyId: publishedStory.id,
  factionKey: "river_guard",
  name: "River Guard",
  description: "Template faction.",
  initialStatus: "active",
  initialInfluence: 61,
  resources: { manpower: 5 },
  goals: [],
  state: { public: true },
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z")
};

const versionFactionTemplate: StoryVersionFactionRecord = {
  id: "550e8400-e29b-41d4-a716-446655440102",
  storyVersionId: storyVersion.id,
  sourceFactionId: storyFactionTemplate.id,
  factionKey: storyFactionTemplate.factionKey,
  name: storyFactionTemplate.name,
  description: storyFactionTemplate.description,
  initialStatus: storyFactionTemplate.initialStatus,
  initialInfluence: storyFactionTemplate.initialInfluence,
  resources: storyFactionTemplate.resources,
  goals: storyFactionTemplate.goals,
  state: storyFactionTemplate.state,
  createdAt: new Date("2026-01-01T00:00:00Z")
};

function createSessionRecord(
  input: CreateSessionInput,
  id = "550e8400-e29b-41d4-a716-446655440002"
): GameSessionRecord {
  return {
    id,
    userId: input.userId,
    storyId: input.storyId,
    storyVersionId: input.storyVersionId ?? null,
    selectedCharacterId: input.selectedCharacterId ?? null,
    selectedVersionCharacterId: input.selectedVersionCharacterId ?? null,
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
  readonly factions: FactionRecord[];
} {
  const sessions: GameSessionRecord[] = [];
  const states: GameStateRecord[] = [];
  const messages: GameMessageRecord[] = [];
  const quests: QuestRecord[] = [];
  const inventory: InventoryItemRecord[] = [];
  const factions: FactionRecord[] = [];

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
      async listPublishedListItemsPage() {
        return [
          {
            id: publishedStory.id,
            title: publishedStory.title,
            slug: publishedStory.slug,
            description: publishedStory.description,
            genre: publishedStory.genre
          }
        ];
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
        return [character, otherCharacter, npcCharacter].filter(
          (item) => item.storyId === storyId
        );
      },
      async listCharactersForStoryByType(
        storyId: string,
        characterType: StoryCharacterRecord["characterType"]
      ) {
        return [character, otherCharacter, npcCharacter].filter(
          (item) => item.storyId === storyId && item.characterType === characterType
        );
      },
      async getCharacterForStory(storyId: string, characterId: string) {
        return (
          [character, otherCharacter, npcCharacter].find(
            (item) => item.storyId === storyId && item.id === characterId
          ) ?? null
        );
      }
    },
    storyFactions: {
      async listForStory(storyId: string) {
        return [storyFactionTemplate].filter((item) => item.storyId === storyId);
      }
    },
    storyFactionRelationships: {
      async listForStory() {
        return [];
      }
    },
    storyVersions: {
      async getById(versionId: string) {
        return versionId === storyVersion.id ? storyVersion : null;
      },
      async getCurrentPublishedVersion(storyId: string) {
        return storyId === publishedStory.id ? storyVersion : null;
      },
      async listForStory(storyId: string) {
        return storyId === publishedStory.id ? [storyVersion] : [];
      }
    },
    storyVersionCharacters: {
      async getForVersion(versionId: string, characterId: string) {
        return versionId === storyVersion.id && characterId === versionCharacter.id
          ? versionCharacter
          : null;
      },
      async listForVersion(versionId: string) {
        return versionId === storyVersion.id ? [versionCharacter] : [];
      },
      async listForVersionByType(
        versionId: string,
        characterType: StoryVersionCharacterRecord["characterType"]
      ) {
        return versionId === storyVersion.id &&
          versionCharacter.characterType === characterType
          ? [versionCharacter]
          : [];
      }
    },
    storyVersionFactions: {
      async listForVersion(versionId: string) {
        return versionId === storyVersion.id ? [versionFactionTemplate] : [];
      }
    },
    storyVersionFactionRelationships: {
      async listForVersion() {
        return [];
      }
    },
    factionRelationships: {
      async upsertRelation() {
        throw new Error("not expected");
      }
    },
    gameSessions: {
      async create(input: CreateSessionInput) {
        const session = createSessionRecord(
          input,
          `550e8400-e29b-41d4-a716-${String(446655440200 + sessions.length).padStart(12, "0")}`
        );
        sessions.push(session);
        return session;
      },
      async getById(id: string) {
        return sessions.find((session) => session.id === id) ?? null;
      },
      async listForUser(userId: string) {
        return sessions.filter((session) => session.userId === userId);
      },
      async listReferencesForUser(userId: string) {
        return sessions
          .filter((session) => session.userId === userId)
          .map((session) => ({
            session,
            story: publishedStory,
            storyVersion,
            versionCharacter,
            legacyCharacter: null,
            currentState:
              states.find((state) => state.sessionId === session.id) ?? null
          }));
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
      },
      async listBySessionIds(sessionIds: readonly string[]) {
        return states.filter((state) => sessionIds.includes(state.sessionId));
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
    },
    factions: {
      async create(input: Parameters<Repositories["factions"]["create"]>[0]) {
        if (
          factions.some(
            (faction) =>
              faction.sessionId === input.sessionId &&
              faction.factionKey === input.factionKey
          )
        ) {
          throw new Error("duplicate faction");
        }

        const faction = {
          id: `550e8400-e29b-41d4-a716-44665544013${factions.length}`,
          createdAt: new Date("2026-01-02T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z"),
          ...input
        } as FactionRecord;
        factions.push(faction);
        return faction;
      },
      async listBySession(sessionId: string) {
        return factions.filter((faction) => faction.sessionId === sessionId);
      }
    },
    worldSimulationStates: {
      async createInitial(
        input: Parameters<Repositories["worldSimulationStates"]["createInitial"]>[0]
      ) {
        return {
          id: "550e8400-e29b-41d4-a716-446655440140",
          sessionId: input.sessionId,
          lastTickTurn: 0,
          version: 1,
          createdAt: new Date("2026-01-02T00:00:00Z"),
          updatedAt: new Date("2026-01-02T00:00:00Z")
        };
      }
    }
  } as unknown as Repositories;

  if (options.ownerUserId) {
    const seeded = createSessionRecord(
      {
        userId: options.ownerUserId,
        storyId: publishedStory.id,
        storyVersionId: storyVersion.id,
        selectedCharacterId: character.id,
        selectedVersionCharacterId: versionCharacter.id,
        title: publishedStory.title
      },
      "550e8400-e29b-41d4-a716-446655440099"
    );
    sessions.push(seeded);
    states.push(
      createStateRecord(
        buildInitialGameState(
          seeded.id,
          {
            storyId: publishedStory.id,
            storySlug: publishedStory.slug,
            storyVersionId: storyVersion.id,
            storyVersionNumber: storyVersion.versionNumber,
            settings: storyVersion.settings
          },
          versionCharacter
        )
      )
    );
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
    factions.push({
      id: "550e8400-e29b-41d4-a716-446655440122",
      sessionId: seeded.id,
      factionKey: "dai-viet-1288.city_guard",
      name: "Đội Tuần Thành",
      description: "A visible faction.",
      status: "active",
      influence: 55,
      resources: { manpower: 60 },
      goals: [],
      state: {},
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z")
    });
  }

  return { repositories, sessions, states, quests, inventory, factions };
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
    const { repositories, sessions, states, factions } = createRepositoriesFixture();
    const service = new SessionService(
      repositories,
      undefined,
      createTransactionRunner(repositories),
      undefined,
      new FactionInitializationService()
    );

    const result = await service.createSession(user, {
      storyId: publishedStory.id,
      characterId: versionCharacter.id
    });

    expect(sessions).toHaveLength(1);
    expect(states).toHaveLength(1);
    expect(factions).toHaveLength(1);
    expect(factions.every((faction) => faction.sessionId === sessions[0]?.id)).toBe(true);
    expect(factions[0]?.factionKey).toBe(storyFactionTemplate.factionKey);
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
      sessions: [
        {
          id: "550e8400-e29b-41d4-a716-446655440099",
          currentLocation: "Bến sông"
        }
      ]
    });
    await expect(service.listSessions(otherUser)).resolves.toEqual({
      sessions: []
    });
  });

  it("creates a distinct new run without overwriting an existing session", async () => {
    const { repositories, sessions, states } = createRepositoriesFixture({
      ownerUserId: user.userId
    });
    const service = new SessionService(
      repositories,
      undefined,
      createTransactionRunner(repositories)
    );
    const existingSessionId = "550e8400-e29b-41d4-a716-446655440099";

    const result = await service.createSession(user, {
      storyId: publishedStory.id,
      characterId: versionCharacter.id
    });
    const listed = await service.listSessions(user);

    expect(result.session.id).not.toBe(existingSessionId);
    expect(sessions.map((session) => session.id)).toContain(existingSessionId);
    expect(sessions.map((session) => session.id)).toContain(result.session.id);
    expect(states.map((state) => state.sessionId)).toContain(existingSessionId);
    expect(states.map((state) => state.sessionId)).toContain(result.session.id);
    expect(listed.sessions.map((session) => session.id).sort()).toEqual(
      [existingSessionId, result.session.id].sort()
    );
  });

  it("does not mutate character template stats when building initial state", () => {
    const state = buildInitialGameState(
      "session-1",
      {
        storyId: publishedStory.id,
        storySlug: publishedStory.slug,
        storyVersionId: storyVersion.id,
        storyVersionNumber: storyVersion.versionNumber,
        settings: storyVersion.settings
      },
      versionCharacter
    );

    (state.playerStats.nested as { courage: number }).courage = 99;

    expect(character.initialStats).toEqual({ agility: 7, nested: { courage: 3 } });
    expect(state.location).toBe("Bến sông");
    expect(state.flags).toMatchObject({
      storySlug: publishedStory.slug,
      selectedCharacterId: versionCharacter.id,
      storyVersionId: storyVersion.id,
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
        characterId: versionCharacter.id
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
        characterId: versionCharacter.id
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
      id: versionCharacter.id,
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
        characterId: versionCharacter.id
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
    expect(getResponse.json().currentState.location).toBe("Bến sông");

    await app.close();
  });

  it("serves protected quest, inventory, and faction DTOs for the owning user", async () => {
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
    const factionResponse = await app.inject({
      method: "GET",
      url: `/sessions/${sessionId}/factions`,
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
    expect(factionResponse.statusCode).toBe(200);
    expect(factionResponse.json().factions[0]).toMatchObject({
      key: "dai-viet-1288.city_guard",
      influence: 55
    });

    await app.close();
  });
});

import { describe, expect, it } from "vitest";
import type {
  CreateSessionInput,
  GameSessionRecord,
  GameStateRecord,
  Repositories,
  RepositoryContext,
  StoryAbilityRecord,
  StoryCharacterAbilityRecord,
  StoryCharacterRecord,
  StoryFactionRecord,
  StoryRecord,
  StoryVersionCharacterRecord,
  StoryVersionAbilityRecord,
  StoryVersionCharacterAbilityRecord,
  StoryVersionFactionRecord,
  StoryVersionRecord
} from "@ai-novel/db";
import {
  AccessDeniedError,
  ConflictApplicationError,
  ResourceNotFoundError
} from "../src/errors.js";
import type { ValidationIssuesError } from "../src/errors.js";
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
    const service = new StoryAuthoringService(fixture.repositories, undefined, fixture.transactionRunner);
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
    const service = new StoryAuthoringService(fixture.repositories, undefined, fixture.transactionRunner);
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
    const authoring = new StoryAuthoringService(fixture.repositories, undefined, fixture.transactionRunner);
    const draft = await createPublishableStory(authoring);

    const validation = await authoring.validateForPublish(author, draft.id);
    const published = await authoring.publish(author, draft.id);

    expect(validation).toEqual({ valid: true, issues: [] });
    expect(published.status).toBe("published");
  });

  it("rejects publish when required runtime templates are missing", async () => {
    const fixture = createAuthoringFixture();
    const service = new StoryAuthoringService(fixture.repositories, undefined, fixture.transactionRunner);
    const draft = await service.createDraft(author, {
      title: "Broken",
      genre: "test",
      description: "Missing core fields."
    });

    const validation = await service.validateForPublish(author, draft.id);

    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.field)).toContain("worldPrompt");
    expect(validation.issues.map((issue) => issue.field)).toContain("characters");
    expect(validation.issues.every((issue) => issue.code)).toBe(true);
    await expect(service.publish(author, draft.id)).rejects.toMatchObject({
      name: "ValidationIssuesError",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "required",
          field: "worldPrompt"
        }),
        expect.objectContaining({
          code: "missing_playable_character",
          field: "characters"
        })
      ])
    } satisfies Partial<ValidationIssuesError>);
  });

  it("creates a faction from the API DTO shape used by the authoring form", async () => {
    const fixture = createAuthoringFixture();
    const service = new StoryAuthoringService(
      fixture.repositories,
      undefined,
      fixture.transactionRunner
    );
    const draft = await service.createDraft(author, {
      title: "Hắc Nguyệt Thành",
      genre: "fantasy",
      description: "Một thành trì nằm dưới bóng trăng đen."
    });

    const faction = await service.createFaction(author, draft.id, {
      factionKey: "hac-nguyet-hoi",
      name: "Hắc Nguyệt Hội",
      description:
        "Tổ chức quyền lực bí ẩn kiểm soát phần lớn Hắc Nguyệt Thành.",
      initialStatus: "active",
      initialInfluence: 75,
      resources: { wealth: 80, influence: 90, military: 65 },
      goals: [
        "kiem-soat-thanh-pho",
        "thu-thap-thong-tin",
        "bao-ve-bi-mat"
      ]
    });

    expect(faction).toMatchObject({
      factionKey: "hac-nguyet-hoi",
      name: "Hắc Nguyệt Hội",
      description:
        "Tổ chức quyền lực bí ẩn kiểm soát phần lớn Hắc Nguyệt Thành.",
      initialStatus: "active",
      initialInfluence: 75,
      resources: { wealth: 80, influence: 90, military: 65 },
      goals: [
        "kiem-soat-thanh-pho",
        "thu-thap-thong-tin",
        "bao-ve-bi-mat"
      ],
      state: {}
    });
    expect(fixture.storyFactions[0]).toMatchObject({
      storyId: draft.id,
      factionKey: "hac-nguyet-hoi",
      initialStatus: "active",
      initialInfluence: 75,
      resources: { wealth: 80, influence: 90, military: 65 },
      goals: [
        "kiem-soat-thanh-pho",
        "thu-thap-thong-tin",
        "bao-ve-bi-mat"
      ],
      state: {}
    });
  });

  it("locks runtime-critical content after publish", async () => {
    const fixture = createAuthoringFixture();
    const service = new StoryAuthoringService(fixture.repositories, undefined, fixture.transactionRunner);
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

  it("serializes a character once when multiple abilities are assigned", async () => {
    const fixture = createAuthoringFixture();
    const service = new StoryAuthoringService(
      fixture.repositories,
      undefined,
      fixture.transactionRunner
    );
    const draft = await service.createDraft(author, {
      title: "Ability Test",
      genre: "fantasy",
      description: "Ability authoring."
    });
    const playable = await service.createCharacter(author, draft.id, {
      type: "playable",
      name: "Kẻ Vô Danh",
      description: "A playable character."
    });
    const shadowStep = await service.createAbility(author, draft.id, {
      abilityKey: "shadow-step",
      name: "Ảnh Bộ",
      category: "movement",
      cooldownTurns: 2
    });
    const innerSight = await service.createAbility(author, draft.id, {
      abilityKey: "inner-sight",
      name: "Nội Quan",
      category: "perception",
      cooldownTurns: 1
    });

    await service.assignAbilityToCharacter(author, draft.id, playable.id, {
      abilityId: shadowStep.id
    });
    await service.assignAbilityToCharacter(author, draft.id, playable.id, {
      abilityId: innerSight.id
    });

    const detail = await service.getOwnedStory(author, draft.id);

    expect(detail.characters).toHaveLength(1);
    expect(detail.characters[0]).toMatchObject({
      id: playable.id,
      name: "Kẻ Vô Danh",
      abilityKeys: ["shadow-step", "inner-sight"],
      assignedAbilities: [
        expect.objectContaining({
          abilityKey: "shadow-step",
          name: "Ảnh Bộ",
          category: "movement",
          rank: 1,
          cooldownTurns: 2
        }),
        expect.objectContaining({
          abilityKey: "inner-sight",
          name: "Nội Quan",
          category: "perception",
          rank: 1,
          cooldownTurns: 1
        })
      ]
    });
  });

  it("prevents duplicate character templates with the same name and type", async () => {
    const fixture = createAuthoringFixture();
    const service = new StoryAuthoringService(
      fixture.repositories,
      undefined,
      fixture.transactionRunner
    );
    const draft = await service.createDraft(author, {
      title: "Duplicate Guard",
      genre: "fantasy",
      description: "Prevent repeated submissions."
    });

    await service.createCharacter(author, draft.id, {
      type: "playable",
      name: "Kẻ Vô Danh",
      description: "First playable."
    });

    await expect(
      service.createCharacter(author, draft.id, {
        type: "playable",
        name: "Kẻ Vô Danh",
        description: "Repeated playable."
      })
    ).rejects.toBeInstanceOf(ConflictApplicationError);

    await expect(
      service.createCharacter(author, draft.id, {
        type: "npc",
        name: "Kẻ Vô Danh",
        description: "Same display name but different template type."
      })
    ).resolves.toMatchObject({ type: "npc" });
  });

  it("returns assigned abilities in owned detail and published version snapshots", async () => {
    const fixture = createAuthoringFixture();
    const service = new StoryAuthoringService(
      fixture.repositories,
      undefined,
      fixture.transactionRunner
    );
    const draft = await createPublishableStory(service);
    const detail = await service.getOwnedStory(author, draft.id);

    expect(detail.characters.find((character) => character.type === "playable"))
      .toMatchObject({
        assignedAbilities: [
          expect.objectContaining({
            abilityKey: "shadow-step",
            name: "Ảnh Bộ",
            category: "movement",
            rank: 1,
            cooldownTurns: 2
          })
        ]
      });

    const published = await service.publish(author, draft.id);
    const snapshot = await service.getVersionSnapshot(
      author,
      published.id,
      published.currentPublishedVersionId!
    );

    expect(snapshot.version.versionNumber).toBe(1);
    expect(snapshot.characters.find((character) => character.type === "playable"))
      .toMatchObject({
        name: "Người Gác",
        assignedAbilities: [
          expect.objectContaining({
            abilityKey: "shadow-step",
            name: "Ảnh Bộ",
            category: "movement",
            rank: 1,
            cooldownTurns: 2
          })
        ]
      });
  });

  it("initializes sessions from authored playable, NPC, faction, and world settings", async () => {
    const fixture = createAuthoringFixture();
    const authoring = new StoryAuthoringService(fixture.repositories, undefined, fixture.transactionRunner);
    const draft = await createPublishableStory(authoring);
    const published = await authoring.publish(author, draft.id);
    const liveVersion = fixture.storyVersions.find(
      (version) => version.id === published.currentPublishedVersionId
    )!;
    const playable = fixture.storyVersionCharacters.find(
      (character) =>
        character.storyVersionId === liveVersion.id &&
        character.characterType === "playable"
    )!;
    const npc = fixture.storyVersionCharacters.find(
      (character) =>
        character.storyVersionId === liveVersion.id &&
        character.characterType === "npc"
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
    expect(result.session.currentState?.stateData.abilities).toMatchObject({
      definitions: [
        expect.objectContaining({
          key: "shadow-step",
          name: "Ảnh Bộ",
          cooldownTurns: 2
        })
      ],
      owned: [
        expect.objectContaining({
          abilityKey: "shadow-step",
          currentCooldown: 0,
          unlocked: true,
          enabled: true
        })
      ]
    });
    expect(fixture.npcs).toHaveLength(1);
    expect(fixture.npcs[0]?.templateCharacterId).toBe(npc.sourceCharacterId);
    expect(fixture.factions).toHaveLength(1);
    expect(fixture.factions[0]?.factionKey).toBe("city_watch");
  });

  it("pins sessions to immutable story versions across revisions", async () => {
    const fixture = createAuthoringFixture();
    const authoring = new StoryAuthoringService(
      fixture.repositories,
      undefined,
      fixture.transactionRunner
    );
    const draft = await createPublishableStory(authoring);
    const publishedV1 = await authoring.publish(author, draft.id);
    const version1 = fixture.storyVersions.find(
      (version) => version.id === publishedV1.currentPublishedVersionId
    )!;
    const playableV1 = fixture.storyVersionCharacters.find(
      (character) =>
        character.storyVersionId === version1.id &&
        character.characterType === "playable"
    )!;
    const sessionService = new SessionService(
      fixture.repositories,
      undefined,
      async (work) =>
        work({ db: {} as RepositoryContext["db"], repositories: fixture.repositories }),
      new NPCInitializationService(),
      new FactionInitializationService()
    );

    const sessionA = await sessionService.createSession(otherUser, {
      storyId: publishedV1.id,
      characterId: playableV1.id
    });

    await authoring.createRevision(author, publishedV1.id);
    await authoring.updateStory(author, publishedV1.id, {
      worldPrompt: "Version 2 world prompt.",
      openingPrompt: "Version 2 opening prompt.",
      settings: {
        initialLocation: "Cầu cảng",
        initialWorldTime: "Hoàng hôn"
      }
    });
    const shadowStep = fixture.storyAbilities.find(
      (ability) => ability.abilityKey === "shadow-step"
    )!;
    await authoring.updateAbility(author, publishedV1.id, shadowStep.id, {
      abilityKey: "shadow-step",
      name: "Ảnh Bộ",
      description: "Phiên bản mới lướt xa hơn.",
      category: "movement",
      cooldownTurns: 3
    });
    const innerSight = await authoring.createAbility(author, publishedV1.id, {
      abilityKey: "inner-sight",
      name: "Thiên Nhãn",
      description: "Nhìn thấy dấu vết ẩn trong cảnh.",
      category: "perception",
      cooldownTurns: 1
    });
    const workingPlayable = fixture.characters.find(
      (character) =>
        character.storyId === publishedV1.id &&
        character.characterType === "playable"
    )!;
    await authoring.assignAbilityToCharacter(
      author,
      publishedV1.id,
      workingPlayable.id,
      {
        abilityId: innerSight.id,
        rank: 1
      }
    );
    const publishedV2 = await authoring.publish(author, publishedV1.id);
    const version2 = fixture.storyVersions.find(
      (version) => version.id === publishedV2.currentPublishedVersionId
    )!;
    const playableV2 = fixture.storyVersionCharacters.find(
      (character) =>
        character.storyVersionId === version2.id &&
        character.characterType === "playable"
    )!;

    const sessionB = await sessionService.createSession(otherUser, {
      storyId: publishedV2.id,
      characterId: playableV2.id
    });
    const loadedA = await sessionService.getSession(otherUser, sessionA.session.id);

    expect(version1.status).toBe("retired");
    expect(version2.versionNumber).toBe(2);
    expect(loadedA.storyVersionNumber).toBe(1);
    expect(loadedA.currentState?.location).toBe("Cổng thành");
    expect(loadedA.currentState?.stateData.abilities).toMatchObject({
      definitions: [expect.objectContaining({ cooldownTurns: 2 })]
    });
    expect(
      (
        loadedA.currentState?.stateData.abilities as {
          definitions: readonly { key: string }[];
        }
      ).definitions.map((ability) => ability.key)
    ).toEqual(["shadow-step"]);
    expect(sessionB.session.storyVersionNumber).toBe(2);
    expect(sessionB.session.currentState?.location).toBe("Cầu cảng");
    expect(
      (
        sessionB.session.currentState?.stateData.abilities as {
          definitions: readonly { key: string; cooldownTurns: number }[];
        }
      ).definitions.map((ability) => ability.key)
    ).toEqual(["shadow-step", "inner-sight"]);
    expect(
      (
        sessionB.session.currentState?.stateData.abilities as {
          definitions: readonly { key: string; cooldownTurns: number }[];
        }
      ).definitions.find((ability) => ability.key === "shadow-step")?.cooldownTurns
    ).toBe(3);
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
  const detail = await service.getOwnedStory(author, draft.id);
  const playable = detail.characters.find((character) => character.type === "playable")!;
  const shadowStep = await service.createAbility(author, draft.id, {
    abilityKey: "shadow-step",
    name: "Ảnh Bộ",
    description: "Lướt nhanh qua một khoảng ngắn để né tránh hoặc áp sát.",
    category: "movement",
    cooldownTurns: 2
  });
  await service.assignAbilityToCharacter(author, draft.id, playable.id, {
    abilityId: shadowStep.id,
    rank: 1
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
  const storyAbilities: StoryAbilityRecord[] = [];
  const storyCharacterAbilities: StoryCharacterAbilityRecord[] = [];
  const storyFactions: StoryFactionRecord[] = [];
  const storyVersions: StoryVersionRecord[] = [];
  const storyVersionCharacters: StoryVersionCharacterRecord[] = [];
  const storyVersionAbilities: StoryVersionAbilityRecord[] = [];
  const storyVersionCharacterAbilities: StoryVersionCharacterAbilityRecord[] = [];
  const storyVersionFactions: StoryVersionFactionRecord[] = [];
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
          currentPublishedVersionId: null,
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
        return stories.filter(
          (story) => story.currentPublishedVersionId && story.status !== "archived"
        );
      },
      async listPublished() {
        return stories.filter(
          (story) => story.currentPublishedVersionId && story.status !== "archived"
        );
      },
      async listByGenre(genre: string) {
        return stories.filter(
          (story) =>
            story.currentPublishedVersionId &&
            story.status !== "archived" &&
            story.genre === genre
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
    storyAbilities: {
      async create(input: Parameters<Repositories["storyAbilities"]["create"]>[0]) {
        const ability = {
          id: nextId(),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
          ...input
        } as StoryAbilityRecord;
        storyAbilities.push(ability);
        return ability;
      },
      async listForStory(storyId: string) {
        return storyAbilities.filter((ability) => ability.storyId === storyId);
      },
      async getForStory(storyId: string, abilityId: string) {
        return (
          storyAbilities.find(
            (ability) => ability.storyId === storyId && ability.id === abilityId
          ) ?? null
        );
      },
      async getByKey(storyId: string, abilityKey: string) {
        return (
          storyAbilities.find(
            (ability) =>
              ability.storyId === storyId && ability.abilityKey === abilityKey
          ) ?? null
        );
      },
      async update(input: Parameters<Repositories["storyAbilities"]["update"]>[0]) {
        const index = storyAbilities.findIndex(
          (ability) =>
            ability.storyId === input.storyId && ability.id === input.abilityId
        );
        if (index < 0) throw new Error("ability missing");
        storyAbilities[index] = {
          ...storyAbilities[index]!,
          ...(input as Partial<StoryAbilityRecord>),
          updatedAt: new Date()
        };
        return storyAbilities[index]!;
      },
      async delete(storyId: string, abilityId: string) {
        const index = storyAbilities.findIndex(
          (ability) => ability.storyId === storyId && ability.id === abilityId
        );
        if (index >= 0) storyAbilities.splice(index, 1);
      },
      async assignToCharacter(
        input: Parameters<Repositories["storyAbilities"]["assignToCharacter"]>[0]
      ) {
        const assignment = {
          id: nextId(),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          ...input
        } as StoryCharacterAbilityRecord;
        storyCharacterAbilities.push(assignment);
        return assignment;
      },
      async listAssignmentsForStory(storyId: string) {
        return storyCharacterAbilities.filter(
          (assignment) => assignment.storyId === storyId
        );
      },
      async listAssignmentsForCharacter(characterId: string) {
        return storyCharacterAbilities.filter(
          (assignment) => assignment.characterId === characterId
        );
      },
      async removeFromCharacter(
        storyId: string,
        characterId: string,
        abilityId: string
      ) {
        const index = storyCharacterAbilities.findIndex(
          (assignment) =>
            assignment.storyId === storyId &&
            assignment.characterId === characterId &&
            assignment.abilityId === abilityId
        );
        if (index >= 0) storyCharacterAbilities.splice(index, 1);
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
    storyVersions: {
      async create(input: Parameters<Repositories["storyVersions"]["create"]>[0]) {
        const version = {
          id: nextId(),
          publishedAt: new Date("2026-01-01T00:00:00Z"),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          ...input
        } as StoryVersionRecord;
        storyVersions.push(version);
        return version;
      },
      async getById(versionId: string) {
        return storyVersions.find((version) => version.id === versionId) ?? null;
      },
      async getCurrentPublishedVersion(storyId: string) {
        const story = stories.find((item) => item.id === storyId);
        return story?.currentPublishedVersionId
          ? (storyVersions.find(
              (version) => version.id === story.currentPublishedVersionId
            ) ?? null)
          : null;
      },
      async listForStory(storyId: string) {
        return storyVersions
          .filter((version) => version.storyId === storyId)
          .sort((left, right) => right.versionNumber - left.versionNumber);
      },
      async getNextVersionNumber(storyId: string) {
        return (
          Math.max(
            0,
            ...storyVersions
              .filter((version) => version.storyId === storyId)
              .map((version) => version.versionNumber)
          ) + 1
        );
      },
      async retireOtherPublishedVersions(storyId: string, currentVersionId: string) {
        for (const version of storyVersions) {
          if (
            version.storyId === storyId &&
            version.id !== currentVersionId &&
            version.status === "published"
          ) {
            Object.assign(version, { status: "retired" });
          }
        }
      }
    },
    storyVersionCharacters: {
      async create(
        input: Parameters<Repositories["storyVersionCharacters"]["create"]>[0]
      ) {
        const character = {
          id: nextId(),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          ...input
        } as StoryVersionCharacterRecord;
        storyVersionCharacters.push(character);
        return character;
      },
      async getForVersion(versionId: string, characterId: string) {
        return (
          storyVersionCharacters.find(
            (character) =>
              character.storyVersionId === versionId && character.id === characterId
          ) ?? null
        );
      },
      async listForVersion(versionId: string) {
        return storyVersionCharacters.filter(
          (character) => character.storyVersionId === versionId
        );
      },
      async listForVersionByType(
        versionId: string,
        characterType: StoryVersionCharacterRecord["characterType"]
      ) {
        return storyVersionCharacters.filter(
          (character) =>
            character.storyVersionId === versionId &&
            character.characterType === characterType
        );
      }
    },
    storyVersionAbilities: {
      async create(
        input: Parameters<Repositories["storyVersionAbilities"]["create"]>[0]
      ) {
        const ability = {
          id: nextId(),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          ...input
        } as StoryVersionAbilityRecord;
        storyVersionAbilities.push(ability);
        return ability;
      },
      async listForVersion(versionId: string) {
        return storyVersionAbilities.filter(
          (ability) => ability.storyVersionId === versionId
        );
      }
    },
    storyVersionCharacterAbilities: {
      async create(
        input: Parameters<Repositories["storyVersionCharacterAbilities"]["create"]>[0]
      ) {
        const assignment = {
          id: nextId(),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          ...input
        } as StoryVersionCharacterAbilityRecord;
        storyVersionCharacterAbilities.push(assignment);
        return assignment;
      },
      async listForVersion(versionId: string) {
        return storyVersionCharacterAbilities.filter(
          (assignment) => assignment.storyVersionId === versionId
        );
      },
      async listForVersionCharacter(versionCharacterId: string) {
        return storyVersionCharacterAbilities.filter(
          (assignment) => assignment.versionCharacterId === versionCharacterId
        );
      }
    },
    storyVersionFactions: {
      async create(
        input: Parameters<Repositories["storyVersionFactions"]["create"]>[0]
      ) {
        const faction = {
          id: nextId(),
          createdAt: new Date("2026-01-01T00:00:00Z"),
          ...input
        } as StoryVersionFactionRecord;
        storyVersionFactions.push(faction);
        return faction;
      },
      async listForVersion(versionId: string) {
        return storyVersionFactions.filter(
          (faction) => faction.storyVersionId === versionId
        );
      }
    },
    storyVersionFactionRelationships: {
      async create() {
        throw new Error("not expected");
      },
      async listForVersion() {
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

  const transactionRunner = async <T>(
    work: (context: RepositoryContext) => Promise<T>
  ) => work({ db: {} as RepositoryContext["db"], repositories });

  return {
    repositories,
    transactionRunner,
    stories,
    characters,
    storyAbilities,
    storyCharacterAbilities,
    storyFactions,
    storyVersions,
    storyVersionCharacters,
    storyVersionAbilities,
    storyVersionCharacterAbilities,
    storyVersionFactions,
    sessions,
    states,
    npcs,
    factions
  };
}

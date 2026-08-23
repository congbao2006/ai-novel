import type {
  DatabaseClient,
  RepositoryContext,
  Repositories,
  StoryAbilityRecord,
  StoryCharacterAbilityRecord,
  StoryCharacterRecord,
  StoryFactionRecord,
  StoryFactionRelationshipRecord,
  StoryRecord
} from "@ai-novel/db";
import { withTransaction } from "@ai-novel/db";
import {
  abilityCategories,
  abilityLimits,
  type AbilityCategory
} from "@ai-novel/domain";
import {
  AccessDeniedError,
  BadRequestError,
  ConflictApplicationError,
  ResourceNotFoundError,
  ServiceUnavailableError,
  ValidationIssuesError
} from "../../errors.js";
import type { CurrentUser } from "../auth/dto.js";
import {
  toAuthorStoryCharacterDto,
  toAuthorStoryAbilityDto,
  toAuthorStoryFactionDto,
  toAuthorStorySummaryDto,
  toAuthorStoryVersionSnapshotDto,
  toAuthorStoryVersionDto,
  type AuthorStoryCharacterDto,
  type AuthorStoryAbilityDto,
  type AuthorStoryDetailDto,
  type AuthorStoryFactionDto,
  type AuthorStoryVersionSnapshotDto,
  type AuthorStoryListResponseDto,
  type PublishValidationIssueDto,
  type PublishValidationResponseDto
} from "./dto.js";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const safeKeyPattern = /^[a-z][a-z0-9_:-]{1,63}$/;

export type CreateDraftInput = {
  readonly title: string;
  readonly description: string;
  readonly genre: string;
  readonly slug?: string | undefined;
};

export type UpdateStoryInput = {
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly genre?: string | undefined;
  readonly slug?: string | undefined;
  readonly worldPrompt?: string | undefined;
  readonly openingPrompt?: string | undefined;
  readonly settings?: Record<string, unknown> | undefined;
};

export type UpsertCharacterInput = {
  readonly type: "playable" | "npc";
  readonly name: string;
  readonly description: string;
  readonly personality?: string | undefined;
  readonly background?: string | undefined;
  readonly goals?: unknown[] | undefined;
  readonly secrets?: Record<string, unknown> | undefined;
  readonly initialStats?: Record<string, unknown> | undefined;
  readonly initialState?: Record<string, unknown> | undefined;
  readonly initialLocation?: string | null | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
};

export type UpsertFactionInput = {
  readonly factionKey: string;
  readonly name: string;
  readonly description: string;
  readonly initialStatus?: "active" | "weakened" | "collapsed" | "hidden" | undefined;
  readonly initialInfluence?: number | undefined;
  readonly resources?: Record<string, unknown> | undefined;
  readonly goals?: unknown[] | undefined;
  readonly state?: Record<string, unknown> | undefined;
};

export type UpsertAbilityInput = {
  readonly abilityKey: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly category?: AbilityCategory | undefined;
  readonly rank?: number | undefined;
  readonly resourceCost?: Record<string, unknown> | null | undefined;
  readonly cooldownTurns?: number | undefined;
  readonly tags?: unknown[] | undefined;
  readonly effects?: Record<string, unknown> | undefined;
  readonly requirements?: Record<string, unknown> | undefined;
  readonly enabled?: boolean | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
};

export type AssignAbilityInput = {
  readonly abilityId: string;
  readonly rank?: number | undefined;
  readonly enabled?: boolean | undefined;
  readonly unlocked?: boolean | undefined;
};

export type TransactionRunner = <T>(
  work: (context: RepositoryContext) => Promise<T>
) => Promise<T>;

export class StoryAuthoringService {
  private readonly runInTransaction: TransactionRunner;

  constructor(
    private readonly repositories: Repositories,
    database?: DatabaseClient,
    transactionRunner?: TransactionRunner
  ) {
    this.runInTransaction =
      transactionRunner ??
      (database
        ? (work) => withTransaction(database, work)
        : async () => {
            throw new ServiceUnavailableError(
              "Story publishing requires database transaction support."
            );
          });
  }

  async createDraft(
    user: CurrentUser,
    input: CreateDraftInput
  ): Promise<AuthorStoryDetailDto> {
    const title = normalizeText(input.title, 120, "Title");
    const slug = await this.generateUniqueSlug(input.slug ?? title);
    const story = await this.repositories.stories.create({
      title,
      slug,
      description: normalizeText(input.description, 2_000, "Description"),
      genre: normalizeKeyish(input.genre, 80, "Genre"),
      status: "draft",
      worldPrompt: "",
      openingPrompt: "",
      settings: {},
      createdByUserId: user.userId
    });

    return this.buildDetail(story);
  }

  async listOwned(user: CurrentUser): Promise<AuthorStoryListResponseDto> {
    const stories = await this.repositories.stories.listCreatedByUser(user.userId);
    return {
      stories: stories.map(toAuthorStorySummaryDto)
    };
  }

  async getOwnedStory(
    user: CurrentUser,
    storyId: string
  ): Promise<AuthorStoryDetailDto> {
    return this.buildDetail(await this.requireOwnedStory(user, storyId));
  }

  async updateStory(
    user: CurrentUser,
    storyId: string,
    input: UpdateStoryInput
  ): Promise<AuthorStoryDetailDto> {
    const story = await this.requireOwnedStory(user, storyId);
    const updates: {
      title?: string;
      slug?: string;
      description?: string;
      genre?: string;
      worldPrompt?: string;
      openingPrompt?: string;
      settings?: Record<string, unknown>;
    } = {};

    if (input.title !== undefined) {
      updates.title = normalizeText(input.title, 120, "Title");
    }

    if (input.slug !== undefined) {
      const nextSlug = normalizeSlug(input.slug);
      const existing = await this.repositories.stories.getBySlug(nextSlug);
      if (existing && existing.id !== story.id) {
        throw new ConflictApplicationError("Story slug is already in use.");
      }
      updates.slug = nextSlug;
    }

    if (input.description !== undefined) {
      updates.description = normalizeText(input.description, 2_000, "Description");
    }

    if (input.genre !== undefined) {
      updates.genre = normalizeKeyish(input.genre, 80, "Genre");
    }

    if (input.worldPrompt !== undefined) {
      this.assertRuntimeCriticalEditable(story);
      updates.worldPrompt = normalizeText(input.worldPrompt, 12_000, "World prompt", {
        allowEmpty: true
      });
    }

    if (input.openingPrompt !== undefined) {
      this.assertRuntimeCriticalEditable(story);
      updates.openingPrompt = normalizeText(
        input.openingPrompt,
        8_000,
        "Opening prompt",
        { allowEmpty: true }
      );
    }

    if (input.settings !== undefined) {
      this.assertRuntimeCriticalEditable(story);
      updates.settings = validateStorySettings(input.settings);
    }

    const updated = await this.repositories.stories.update(story.id, updates);
    return this.buildDetail(updated);
  }

  async createCharacter(
    user: CurrentUser,
    storyId: string,
    input: UpsertCharacterInput
  ): Promise<AuthorStoryCharacterDto> {
    const story = await this.requireOwnedStory(user, storyId);
    this.assertRuntimeCriticalEditable(story);
    const normalized = normalizeCharacterInput(input);
    await this.assertCharacterNameAvailable(
      story.id,
      normalized.name,
      normalized.type
    );
    const character = await this.repositories.stories.createCharacter({
      storyId: story.id,
      characterType: normalized.type,
      name: normalized.name,
      description: normalized.description,
      personality: normalized.personality,
      background: normalized.background,
      goals: normalized.goals,
      secrets: normalized.secrets,
      initialStats: normalized.initialStats,
      initialState: normalized.initialState,
      initialLocation: normalized.initialLocation,
      metadata: normalized.metadata
    });
    return toAuthorStoryCharacterDto(character);
  }

  async updateCharacter(
    user: CurrentUser,
    storyId: string,
    characterId: string,
    input: UpsertCharacterInput
  ): Promise<AuthorStoryCharacterDto> {
    const story = await this.requireOwnedStory(user, storyId);
    this.assertRuntimeCriticalEditable(story);
    const normalized = normalizeCharacterInput(input);
    await this.assertCharacterNameAvailable(
      story.id,
      normalized.name,
      normalized.type,
      characterId
    );
    const character = await this.repositories.stories.updateCharacter({
      storyId: story.id,
      characterId,
      characterType: normalized.type,
      name: normalized.name,
      description: normalized.description,
      personality: normalized.personality,
      background: normalized.background,
      goals: normalized.goals,
      secrets: normalized.secrets,
      initialStats: normalized.initialStats,
      initialState: normalized.initialState,
      initialLocation: normalized.initialLocation,
      metadata: normalized.metadata
    });
    return toAuthorStoryCharacterDto(character);
  }

  async deleteCharacter(
    user: CurrentUser,
    storyId: string,
    characterId: string
  ): Promise<void> {
    const story = await this.requireOwnedStory(user, storyId);
    this.assertRuntimeCriticalEditable(story);
    await this.repositories.stories.deleteCharacter(story.id, characterId);
  }

  async createAbility(
    user: CurrentUser,
    storyId: string,
    input: UpsertAbilityInput
  ): Promise<AuthorStoryAbilityDto> {
    const story = await this.requireOwnedStory(user, storyId);
    this.assertRuntimeCriticalEditable(story);
    const normalized = normalizeAbilityInput(input);
    const ability = await this.repositories.storyAbilities.create({
      storyId: story.id,
      abilityKey: normalized.abilityKey,
      name: normalized.name,
      description: normalized.description,
      category: normalized.category,
      rank: normalized.rank,
      resourceCost: normalized.resourceCost,
      cooldownTurns: normalized.cooldownTurns,
      tags: normalized.tags,
      effects: normalized.effects,
      requirements: normalized.requirements,
      enabled: normalized.enabled,
      metadata: normalized.metadata
    });
    return toAuthorStoryAbilityDto(ability);
  }

  async updateAbility(
    user: CurrentUser,
    storyId: string,
    abilityId: string,
    input: UpsertAbilityInput
  ): Promise<AuthorStoryAbilityDto> {
    const story = await this.requireOwnedStory(user, storyId);
    this.assertRuntimeCriticalEditable(story);
    const normalized = normalizeAbilityInput(input);
    const ability = await this.repositories.storyAbilities.update({
      storyId: story.id,
      abilityId,
      abilityKey: normalized.abilityKey,
      name: normalized.name,
      description: normalized.description,
      category: normalized.category,
      rank: normalized.rank,
      resourceCost: normalized.resourceCost,
      cooldownTurns: normalized.cooldownTurns,
      tags: normalized.tags,
      effects: normalized.effects,
      requirements: normalized.requirements,
      enabled: normalized.enabled,
      metadata: normalized.metadata
    });
    return toAuthorStoryAbilityDto(ability);
  }

  async deleteAbility(
    user: CurrentUser,
    storyId: string,
    abilityId: string
  ): Promise<void> {
    const story = await this.requireOwnedStory(user, storyId);
    this.assertRuntimeCriticalEditable(story);
    await this.repositories.storyAbilities.delete(story.id, abilityId);
  }

  async assignAbilityToCharacter(
    user: CurrentUser,
    storyId: string,
    characterId: string,
    input: AssignAbilityInput
  ): Promise<AuthorStoryDetailDto> {
    const story = await this.requireOwnedStory(user, storyId);
    this.assertRuntimeCriticalEditable(story);
    const character = await this.repositories.stories.getCharacterForStory(
      story.id,
      characterId
    );
    if (!character) {
      throw new ResourceNotFoundError("Story character was not found.");
    }
    const ability = await this.repositories.storyAbilities.getForStory(
      story.id,
      input.abilityId
    );
    if (!ability) {
      throw new ResourceNotFoundError("Story ability was not found.");
    }
    const existingAssignments =
      await this.repositories.storyAbilities.listAssignmentsForCharacter(
        character.id
      );
    if (
      existingAssignments.some(
        (assignment) => assignment.abilityId === ability.id
      )
    ) {
      throw new ConflictApplicationError(
        "This ability is already assigned to the character."
      );
    }

    await this.repositories.storyAbilities.assignToCharacter({
      storyId: story.id,
      characterId: character.id,
      abilityId: ability.id,
      rank: clampInteger(input.rank ?? ability.rank, abilityLimits.rankMin, abilityLimits.rankMax),
      enabled: input.enabled ?? true,
      unlocked: input.unlocked ?? true
    });

    return this.buildDetail(story);
  }

  async removeAbilityFromCharacter(
    user: CurrentUser,
    storyId: string,
    characterId: string,
    abilityId: string
  ): Promise<void> {
    const story = await this.requireOwnedStory(user, storyId);
    this.assertRuntimeCriticalEditable(story);
    await this.repositories.storyAbilities.removeFromCharacter(
      story.id,
      characterId,
      abilityId
    );
  }

  async createFaction(
    user: CurrentUser,
    storyId: string,
    input: UpsertFactionInput
  ): Promise<AuthorStoryFactionDto> {
    const story = await this.requireOwnedStory(user, storyId);
    this.assertRuntimeCriticalEditable(story);
    const normalized = normalizeFactionInput(input);
    const faction = await this.repositories.storyFactions.create({
      storyId: story.id,
      factionKey: normalized.factionKey,
      name: normalized.name,
      description: normalized.description,
      initialStatus: normalized.initialStatus,
      initialInfluence: normalized.initialInfluence,
      resources: normalized.resources,
      goals: normalized.goals,
      state: normalized.state
    });
    return toAuthorStoryFactionDto(faction);
  }

  async updateFaction(
    user: CurrentUser,
    storyId: string,
    factionId: string,
    input: UpsertFactionInput
  ): Promise<AuthorStoryFactionDto> {
    const story = await this.requireOwnedStory(user, storyId);
    this.assertRuntimeCriticalEditable(story);
    const normalized = normalizeFactionInput(input);
    const faction = await this.repositories.storyFactions.update({
      storyId: story.id,
      factionId,
      factionKey: normalized.factionKey,
      name: normalized.name,
      description: normalized.description,
      initialStatus: normalized.initialStatus,
      initialInfluence: normalized.initialInfluence,
      resources: normalized.resources,
      goals: normalized.goals,
      state: normalized.state
    });
    return toAuthorStoryFactionDto(faction);
  }

  async deleteFaction(
    user: CurrentUser,
    storyId: string,
    factionId: string
  ): Promise<void> {
    const story = await this.requireOwnedStory(user, storyId);
    this.assertRuntimeCriticalEditable(story);
    await this.repositories.storyFactions.delete(story.id, factionId);
  }

  async validateForPublish(
    user: CurrentUser,
    storyId: string
  ): Promise<PublishValidationResponseDto> {
    const story = await this.requireOwnedStory(user, storyId);
    const characters = await this.repositories.stories.listCharactersForStory(
      story.id
    );
    const [factions, abilities, abilityAssignments] = await Promise.all([
      this.repositories.storyFactions.listForStory(story.id),
      this.repositories.storyAbilities.listForStory(story.id),
      this.repositories.storyAbilities.listAssignmentsForStory(story.id)
    ]);
    const issues = validatePublishStory(
      story,
      characters,
      factions,
      abilities,
      abilityAssignments
    );

    return {
      valid: issues.length === 0,
      issues
    };
  }

  async publish(user: CurrentUser, storyId: string): Promise<AuthorStoryDetailDto> {
    const story = await this.requireOwnedStory(user, storyId);

    if (story.status !== "draft") {
      throw new BadRequestError("Only draft revisions can be published.");
    }

    const validation = await this.validateForPublish(user, story.id);
    if (!validation.valid) {
      throw new ValidationIssuesError(
        "Story is not valid for publishing.",
        validation.issues
      );
    }

    const published = await this.runInTransaction(async (context) =>
      this.createPublishedVersionSnapshot(context, story.id, user.userId)
    );

    return this.buildDetail(published);
  }

  async createRevision(
    user: CurrentUser,
    storyId: string
  ): Promise<AuthorStoryDetailDto> {
    const story = await this.requireOwnedStory(user, storyId);

    if (story.status === "archived") {
      throw new BadRequestError("Archived stories cannot create new revisions.");
    }

    if (!story.currentPublishedVersionId) {
      throw new BadRequestError("Only published stories can create revisions.");
    }

    if (story.status === "draft") {
      return this.buildDetail(story);
    }

    const updated = await this.repositories.stories.update(story.id, {
      status: "draft"
    });
    return this.buildDetail(updated);
  }

  async listVersions(user: CurrentUser, storyId: string) {
    const story = await this.requireOwnedStory(user, storyId);
    const versions = await this.repositories.storyVersions.listForStory(story.id);
    return {
      versions: versions.map(toAuthorStoryVersionDto)
    };
  }

  async getVersionSnapshot(
    user: CurrentUser,
    storyId: string,
    versionId: string
  ): Promise<AuthorStoryVersionSnapshotDto> {
    const story = await this.requireOwnedStory(user, storyId);
    const version = await this.repositories.storyVersions.getById(versionId);
    if (!version || version.storyId !== story.id) {
      throw new ResourceNotFoundError("Story version was not found.");
    }

    const [characters, abilities, assignments] = await Promise.all([
      this.repositories.storyVersionCharacters.listForVersion(version.id),
      this.repositories.storyVersionAbilities.listForVersion(version.id),
      this.repositories.storyVersionCharacterAbilities.listForVersion(version.id)
    ]);

    return toAuthorStoryVersionSnapshotDto(
      version,
      characters,
      abilities,
      assignments
    );
  }

  async archive(user: CurrentUser, storyId: string): Promise<AuthorStoryDetailDto> {
    const story = await this.requireOwnedStory(user, storyId);
    if (story.status !== "published") {
      throw new BadRequestError("Only published stories can be archived.");
    }

    return this.buildDetail(
      await this.repositories.stories.update(story.id, { status: "archived" })
    );
  }

  private async requireOwnedStory(
    user: CurrentUser,
    storyId: string
  ): Promise<StoryRecord> {
    const story = await this.repositories.stories.getById(storyId);
    if (!story) {
      throw new ResourceNotFoundError("Story was not found.");
    }
    if (story.createdByUserId !== user.userId) {
      throw new AccessDeniedError("You cannot edit this story.");
    }
    return story;
  }

  private assertRuntimeCriticalEditable(story: StoryRecord): void {
    if (story.status !== "draft") {
      throw new ConflictApplicationError(
        "Published story runtime configuration is locked. Archive or create a new version for structural changes."
      );
    }
  }

  private async assertCharacterNameAvailable(
    storyId: string,
    name: string,
    characterType: StoryCharacterRecord["characterType"],
    exceptCharacterId?: string
  ): Promise<void> {
    const characters = await this.repositories.stories.listCharactersForStory(
      storyId
    );
    const normalizedName = name.trim().toLocaleLowerCase("vi-VN");
    const duplicate = characters.find(
      (character) =>
        character.id !== exceptCharacterId &&
        character.characterType === characterType &&
        character.name.trim().toLocaleLowerCase("vi-VN") === normalizedName
    );
    if (duplicate) {
      throw new ConflictApplicationError(
        "A character template with this name and type already exists."
      );
    }
  }

  private async buildDetail(story: StoryRecord): Promise<AuthorStoryDetailDto> {
    const [characters, factions, abilities, abilityAssignments, versions, currentVersion] = await Promise.all([
      this.repositories.stories.listCharactersForStory(story.id),
      this.repositories.storyFactions.listForStory(story.id),
      this.repositories.storyAbilities.listForStory(story.id),
      this.repositories.storyAbilities.listAssignmentsForStory(story.id),
      this.repositories.storyVersions.listForStory(story.id),
      story.currentPublishedVersionId
        ? this.repositories.storyVersions.getById(story.currentPublishedVersionId)
        : null
    ]);
    const abilitiesById = new Map(abilities.map((ability) => [ability.id, ability]));
    return {
      ...toAuthorStorySummaryDto(story),
      currentPublishedVersionNumber: currentVersion?.versionNumber ?? null,
      worldPrompt: story.worldPrompt,
      openingPrompt: story.openingPrompt,
      settings: copyJsonObject(story.settings),
      characters: characters.map((character) =>
        toAuthorStoryCharacterDto(character, abilityAssignments, abilitiesById)
      ),
      abilities: abilities.map(toAuthorStoryAbilityDto),
      factions: factions.map(toAuthorStoryFactionDto),
      versions: versions.map(toAuthorStoryVersionDto)
    };
  }

  private async createPublishedVersionSnapshot(
    context: RepositoryContext,
    storyId: string,
    userId: string
  ): Promise<StoryRecord> {
    const story = await context.repositories.stories.getById(storyId);
    if (!story) {
      throw new ResourceNotFoundError("Story was not found.");
    }

    const [
      characters,
      factions,
      abilities,
      abilityAssignments,
      factionRelationships
    ] = await Promise.all([
      context.repositories.stories.listCharactersForStory(story.id),
      context.repositories.storyFactions.listForStory(story.id),
      context.repositories.storyAbilities.listForStory(story.id),
      context.repositories.storyAbilities.listAssignmentsForStory(story.id),
      context.repositories.storyFactionRelationships.listForStory(story.id)
    ]);
    const issues = validatePublishStory(
      story,
      characters,
      factions,
      abilities,
      abilityAssignments
    );
    if (issues.length > 0) {
      throw new ValidationIssuesError(
        "Story is not valid for publishing.",
        issues
      );
    }

    const versionNumber =
      await context.repositories.storyVersions.getNextVersionNumber(story.id);
    const version = await context.repositories.storyVersions.create({
      storyId: story.id,
      versionNumber,
      status: "published",
      worldPrompt: story.worldPrompt,
      openingPrompt: story.openingPrompt,
      settings: copyJsonObject(story.settings),
      createdByUserId: userId
    });

    const versionCharacterIdsBySource = new Map<string, string>();
    for (const character of characters) {
      const versionCharacter =
        await context.repositories.storyVersionCharacters.create({
          storyVersionId: version.id,
          sourceCharacterId: character.id,
          characterType: character.characterType,
          name: character.name,
          description: character.description,
          personality: character.personality,
          background: character.background,
          goals: copyJsonArray(character.goals),
          secrets: copyJsonObject(character.secrets),
          initialStats: copyJsonObject(character.initialStats),
          initialState: copyJsonObject(character.initialState),
          initialLocation: character.initialLocation,
          metadata: copyJsonObject(character.metadata)
        });
      versionCharacterIdsBySource.set(character.id, versionCharacter.id);
    }

    const versionAbilityIdsBySource = new Map<string, string>();
    for (const ability of abilities) {
      const versionAbility =
        await context.repositories.storyVersionAbilities.create({
          storyVersionId: version.id,
          sourceAbilityId: ability.id,
          abilityKey: ability.abilityKey,
          name: ability.name,
          description: ability.description,
          category: ability.category,
          rank: ability.rank,
          resourceCost: ability.resourceCost ? copyJsonObject(ability.resourceCost) : null,
          cooldownTurns: ability.cooldownTurns,
          tags: copyJsonArray(ability.tags),
          effects: copyJsonObject(ability.effects),
          requirements: copyJsonObject(ability.requirements),
          enabled: ability.enabled,
          metadata: copyJsonObject(ability.metadata)
        });
      versionAbilityIdsBySource.set(ability.id, versionAbility.id);
    }

    await this.copyAbilityAssignments(
      context,
      version.id,
      abilityAssignments,
      versionCharacterIdsBySource,
      versionAbilityIdsBySource,
      abilities
    );

    const versionFactionIdsBySource = new Map<string, string>();
    for (const faction of factions) {
      const versionFaction =
        await context.repositories.storyVersionFactions.create({
          storyVersionId: version.id,
          sourceFactionId: faction.id,
          factionKey: faction.factionKey,
          name: faction.name,
          description: faction.description,
          initialStatus: faction.initialStatus,
          initialInfluence: faction.initialInfluence,
          resources: copyJsonObject(faction.resources),
          goals: copyJsonArray(faction.goals),
          state: copyJsonObject(faction.state)
        });
      versionFactionIdsBySource.set(faction.id, versionFaction.id);
    }

    await this.copyFactionRelationships(
      context,
      version.id,
      factionRelationships,
      versionFactionIdsBySource
    );

    await context.repositories.storyVersions.retireOtherPublishedVersions(
      story.id,
      version.id
    );

    return context.repositories.stories.update(story.id, {
      status: "published",
      currentPublishedVersionId: version.id
    });
  }

  private async copyAbilityAssignments(
    context: RepositoryContext,
    storyVersionId: string,
    assignments: readonly StoryCharacterAbilityRecord[],
    versionCharacterIdsBySource: ReadonlyMap<string, string>,
    versionAbilityIdsBySource: ReadonlyMap<string, string>,
    abilities: readonly StoryAbilityRecord[]
  ): Promise<void> {
    const abilitiesById = new Map(abilities.map((ability) => [ability.id, ability]));

    for (const assignment of assignments) {
      const versionCharacterId = versionCharacterIdsBySource.get(
        assignment.characterId
      );
      const versionAbilityId = versionAbilityIdsBySource.get(assignment.abilityId);
      const ability = abilitiesById.get(assignment.abilityId);

      if (!versionCharacterId || !versionAbilityId || !ability) {
        throw new BadRequestError(
          "Character ability assignment references a missing template."
        );
      }

      await context.repositories.storyVersionCharacterAbilities.create({
        storyVersionId,
        versionCharacterId,
        versionAbilityId,
        sourceCharacterAbilityId: assignment.id,
        abilityKey: ability.abilityKey,
        rank: assignment.rank,
        enabled: assignment.enabled,
        unlocked: assignment.unlocked
      });
    }
  }

  private async copyFactionRelationships(
    context: RepositoryContext,
    storyVersionId: string,
    relationships: readonly StoryFactionRelationshipRecord[],
    versionFactionIdsBySource: ReadonlyMap<string, string>
  ): Promise<void> {
    for (const relationship of relationships) {
      const sourceVersionFactionId = versionFactionIdsBySource.get(
        relationship.sourceFactionId
      );
      const targetVersionFactionId = versionFactionIdsBySource.get(
        relationship.targetFactionId
      );
      if (!sourceVersionFactionId || !targetVersionFactionId) {
        throw new BadRequestError(
          "Faction relationship references a missing faction template."
        );
      }

      await context.repositories.storyVersionFactionRelationships.create({
        storyVersionId,
        sourceVersionFactionId,
        targetVersionFactionId,
        affinity: relationship.affinity,
        tension: relationship.tension,
        metadata: copyJsonObject(relationship.metadata)
      });
    }
  }

  private async generateUniqueSlug(input: string): Promise<string> {
    const base = normalizeSlug(input);
    let candidate = base;
    let suffix = 2;

    while (await this.repositories.stories.getBySlug(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }
}

function validatePublishStory(
  story: StoryRecord,
  characters: readonly StoryCharacterRecord[],
  factions: readonly StoryFactionRecord[],
  abilities: readonly StoryAbilityRecord[] = [],
  abilityAssignments: readonly StoryCharacterAbilityRecord[] = []
): PublishValidationIssueDto[] {
  const issues: PublishValidationIssueDto[] = [];
  addRequiredTextIssue(issues, "title", story.title);
  addRequiredTextIssue(issues, "slug", story.slug);
  if (!slugPattern.test(story.slug)) {
    issues.push({
      code: "invalid_slug",
      field: "slug",
      message: "Slug must be URL safe."
    });
  }
  addRequiredTextIssue(issues, "description", story.description);
  addRequiredTextIssue(issues, "genre", story.genre);
  addRequiredTextIssue(issues, "worldPrompt", story.worldPrompt);
  addRequiredTextIssue(issues, "openingPrompt", story.openingPrompt);

  const playableCharacters = characters.filter(
    (character) => character.characterType === "playable"
  );
  if (playableCharacters.length < 1) {
    issues.push({
      code: "missing_playable_character",
      field: "characters",
      message: "At least one playable character is required."
    });
  }

  for (const character of characters) {
    if (!isValidStats(character.initialStats)) {
      issues.push({
        code: "invalid_initial_stats",
        field: `characters.${character.id}.initialStats`,
        message: "Initial stats must be bounded finite numeric values."
      });
    }
  }

  const abilityKeys = new Set<string>();
  for (const ability of abilities) {
    if (!safeKeyPattern.test(ability.abilityKey)) {
      issues.push({
        code: "invalid_ability_key",
        field: `abilities.${ability.id}.abilityKey`,
        message: "Ability key must be a safe stable key."
      });
    }
    if (abilityKeys.has(ability.abilityKey)) {
      issues.push({
        code: "duplicate_ability_key",
        field: `abilities.${ability.id}.abilityKey`,
        message: "Ability keys must be unique within a story."
      });
    }
    abilityKeys.add(ability.abilityKey);
    if (!abilityCategories.includes(ability.category as AbilityCategory)) {
      issues.push({
        code: "invalid_ability_category",
        field: `abilities.${ability.id}.category`,
        message: "Ability category is invalid."
      });
    }
    if (
      ability.rank < abilityLimits.rankMin ||
      ability.rank > abilityLimits.rankMax ||
      ability.cooldownTurns < abilityLimits.cooldownMin ||
      ability.cooldownTurns > abilityLimits.cooldownMax
    ) {
      issues.push({
        code: "invalid_ability_numbers",
        field: `abilities.${ability.id}`,
        message: "Ability rank and cooldown must be within supported bounds."
      });
    }
  }

  const charactersById = new Map(characters.map((character) => [character.id, character]));
  const abilitiesById = new Map(abilities.map((ability) => [ability.id, ability]));
  for (const assignment of abilityAssignments) {
    const character = charactersById.get(assignment.characterId);
    if (!character) {
      issues.push({
        code: "invalid_ability_assignment_character",
        field: `abilityAssignments.${assignment.id}.characterId`,
        message: "Ability assignment references a missing character."
      });
    } else if (character.characterType !== "playable") {
      issues.push({
        code: "invalid_ability_assignment_character_type",
        field: `abilityAssignments.${assignment.id}.characterId`,
        message: "Only playable characters can be granted player abilities."
      });
    }
    if (!abilitiesById.has(assignment.abilityId)) {
      issues.push({
        code: "invalid_ability_assignment_ability",
        field: `abilityAssignments.${assignment.id}.abilityId`,
        message: "Ability assignment references a missing ability definition."
      });
    }
    if (
      assignment.rank < abilityLimits.rankMin ||
      assignment.rank > abilityLimits.rankMax
    ) {
      issues.push({
        code: "invalid_ability_assignment_rank",
        field: `abilityAssignments.${assignment.id}.rank`,
        message: "Assigned ability rank is invalid."
      });
    }
  }

  const settings = validateStorySettings(story.settings);
  if (!settings.initialLocation) {
    issues.push({
      code: "missing_initial_location",
      field: "settings.initialLocation",
      message: "Initial location is required."
    });
  }

  for (const faction of factions) {
    if (!safeKeyPattern.test(faction.factionKey)) {
      issues.push({
        code: "invalid_faction_key",
        field: `factions.${faction.id}.factionKey`,
        message: "Faction key must be a safe stable key."
      });
    }
  }

  return issues;
}

function addRequiredTextIssue(
  issues: PublishValidationIssueDto[],
  field: string,
  value: string
): void {
  if (!value.trim()) {
    issues.push({
      code: "required",
      field,
      message: `${field} is required.`
    });
  }
}

function normalizeCharacterInput(input: UpsertCharacterInput) {
  return {
    type: input.type,
    name: normalizeText(input.name, 120, "Character name"),
    description: normalizeText(input.description, 2_000, "Character description"),
    personality: normalizeText(input.personality ?? "", 2_000, "Personality", {
      allowEmpty: true
    }),
    background: normalizeText(input.background ?? "", 2_000, "Background", {
      allowEmpty: true
    }),
    goals: validateJsonArray(input.goals ?? [], 20, "Goals"),
    secrets: validateJsonObject(input.secrets ?? {}, "Secrets"),
    initialStats: validateStats(input.initialStats ?? {}),
    initialState: validateJsonObject(input.initialState ?? {}, "Initial state"),
    initialLocation:
      input.initialLocation === null || input.initialLocation === undefined
        ? null
        : normalizeText(input.initialLocation, 160, "Initial location"),
    metadata: validateJsonObject(input.metadata ?? {}, "Metadata")
  };
}

function normalizeFactionInput(input: UpsertFactionInput) {
  const factionKey = normalizeKeyish(input.factionKey, 80, "Faction key");
  if (!safeKeyPattern.test(factionKey)) {
    throw new BadRequestError("Faction key must be a safe stable key.");
  }

  return {
    factionKey,
    name: normalizeText(input.name, 120, "Faction name"),
    description: normalizeText(input.description, 2_000, "Faction description"),
    initialStatus: input.initialStatus ?? "active",
    initialInfluence: clampInteger(input.initialInfluence ?? 50, 0, 100),
    resources: validateJsonObject(input.resources ?? {}, "Resources"),
    goals: validateJsonArray(input.goals ?? [], 20, "Goals"),
    state: validateJsonObject(input.state ?? {}, "Faction state")
  };
}

function normalizeAbilityInput(input: UpsertAbilityInput) {
  const abilityKey = normalizeKeyish(input.abilityKey, abilityLimits.keyMaxLength, "Ability key");
  if (!safeKeyPattern.test(abilityKey)) {
    throw new BadRequestError("Ability key must be a safe stable key.");
  }
  const category = input.category ?? "other";
  if (!abilityCategories.includes(category)) {
    throw new BadRequestError("Ability category is invalid.");
  }

  return {
    abilityKey,
    name: normalizeText(input.name, abilityLimits.nameMaxLength, "Ability name"),
    description: normalizeText(
      input.description ?? "",
      abilityLimits.descriptionMaxLength,
      "Ability description",
      { allowEmpty: true }
    ),
    category,
    rank: clampInteger(
      input.rank ?? 1,
      abilityLimits.rankMin,
      abilityLimits.rankMax
    ),
    resourceCost: normalizeResourceCost(input.resourceCost ?? null),
    cooldownTurns: clampInteger(
      input.cooldownTurns ?? 0,
      abilityLimits.cooldownMin,
      abilityLimits.cooldownMax
    ),
    tags: validateJsonArray(input.tags ?? [], abilityLimits.tagMaxCount, "Ability tags"),
    effects: validateJsonObject(input.effects ?? {}, "Ability effects"),
    requirements: validateJsonObject(
      input.requirements ?? {},
      "Ability requirements"
    ),
    enabled: input.enabled ?? true,
    metadata: validateJsonObject(input.metadata ?? {}, "Ability metadata")
  };
}

function normalizeResourceCost(
  input: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (input === null) {
    return null;
  }
  const statKey =
    typeof input.statKey === "string"
      ? normalizeKeyish(input.statKey, abilityLimits.keyMaxLength, "Resource stat key")
      : "";
  const amount = typeof input.amount === "number" ? input.amount : 0;

  if (!safeKeyPattern.test(statKey)) {
    throw new BadRequestError("Ability resource stat key is invalid.");
  }

  return {
    statKey,
    amount: clampInteger(amount, 0, abilityLimits.resourceCostMax)
  };
}

function validateStorySettings(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  if (typeof input.initialLocation === "string" && input.initialLocation.trim()) {
    output.initialLocation = normalizeText(
      input.initialLocation,
      160,
      "Initial location"
    );
  }
  if (typeof input.initialWorldTime === "string" && input.initialWorldTime.trim()) {
    output.initialWorldTime = normalizeText(
      input.initialWorldTime,
      160,
      "Initial world time"
    );
  }
  if (input.statDefinitions && typeof input.statDefinitions === "object") {
    output.statDefinitions = validateJsonObject(
      input.statDefinitions as Record<string, unknown>,
      "Stat definitions"
    );
  }
  return output;
}

function validateStats(input: Record<string, unknown>): Record<string, unknown> {
  if (!isValidStats(input)) {
    throw new BadRequestError("Stats must be bounded finite numeric values.");
  }
  return copyJsonObject(input);
}

function isValidStats(input: Record<string, unknown>): boolean {
  const entries = Object.entries(input);
  if (entries.length > 30) return false;
  return entries.every(
    ([key, value]) =>
      safeKeyPattern.test(key) &&
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= -10_000 &&
      value <= 10_000
  );
}

function validateJsonObject(
  input: Record<string, unknown>,
  label: string
): Record<string, unknown> {
  const json = copyJsonObject(input);
  if (JSON.stringify(json).length > 8_000 || maxDepth(json) > 4) {
    throw new BadRequestError(`${label} is too large or deeply nested.`);
  }
  return json;
}

function validateJsonArray(input: unknown[], limit: number, label: string): unknown[] {
  const json = JSON.parse(JSON.stringify(input)) as unknown[];
  if (json.length > limit || JSON.stringify(json).length > 8_000 || maxDepth(json) > 4) {
    throw new BadRequestError(`${label} is too large or deeply nested.`);
  }
  return json;
}

function maxDepth(value: unknown, depth = 0): number {
  if (!value || typeof value !== "object") return depth;
  if (Array.isArray(value)) {
    return Math.max(depth, ...value.map((item) => maxDepth(item, depth + 1)));
  }
  return Math.max(
    depth,
    ...Object.values(value as Record<string, unknown>).map((item) =>
      maxDepth(item, depth + 1)
    )
  );
}

function normalizeText(
  value: string,
  maxLength: number,
  label: string,
  options: { readonly allowEmpty?: boolean } = {}
): string {
  const normalized = value.trim();
  if (!options.allowEmpty && !normalized) {
    throw new BadRequestError(`${label} is required.`);
  }
  if (normalized.length > maxLength) {
    throw new BadRequestError(`${label} is too long.`);
  }
  return normalized;
}

function normalizeKeyish(value: string, maxLength: number, label: string): string {
  return normalizeText(value, maxLength, label).toLowerCase();
}

function normalizeSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

  if (!slug || !slugPattern.test(slug)) {
    throw new BadRequestError("Slug must contain URL-safe text.");
  }

  return slug;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isInteger(value)) {
    throw new BadRequestError("Value must be an integer.");
  }
  return Math.min(max, Math.max(min, value));
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function copyJsonArray(value: unknown[]): unknown[] {
  return JSON.parse(JSON.stringify(value)) as unknown[];
}

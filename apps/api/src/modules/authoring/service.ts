import type {
  Repositories,
  StoryCharacterRecord,
  StoryFactionRecord,
  StoryRecord
} from "@ai-novel/db";
import {
  AccessDeniedError,
  BadRequestError,
  ConflictApplicationError,
  ResourceNotFoundError
} from "../../errors.js";
import type { CurrentUser } from "../auth/dto.js";
import {
  toAuthorStoryCharacterDto,
  toAuthorStoryFactionDto,
  toAuthorStorySummaryDto,
  type AuthorStoryCharacterDto,
  type AuthorStoryDetailDto,
  type AuthorStoryFactionDto,
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

export class StoryAuthoringService {
  constructor(private readonly repositories: Repositories) {}

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
    const factions = await this.repositories.storyFactions.listForStory(story.id);
    const issues = validatePublishStory(story, characters, factions);

    return {
      valid: issues.length === 0,
      issues
    };
  }

  async publish(user: CurrentUser, storyId: string): Promise<AuthorStoryDetailDto> {
    const story = await this.requireOwnedStory(user, storyId);

    if (story.status !== "draft") {
      throw new BadRequestError("Only draft stories can be published.");
    }

    const validation = await this.validateForPublish(user, story.id);
    if (!validation.valid) {
      throw new BadRequestError("Story is not valid for publishing.");
    }

    return this.buildDetail(
      await this.repositories.stories.update(story.id, { status: "published" })
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

  private async buildDetail(story: StoryRecord): Promise<AuthorStoryDetailDto> {
    const [characters, factions] = await Promise.all([
      this.repositories.stories.listCharactersForStory(story.id),
      this.repositories.storyFactions.listForStory(story.id)
    ]);
    return {
      ...toAuthorStorySummaryDto(story),
      worldPrompt: story.worldPrompt,
      openingPrompt: story.openingPrompt,
      settings: copyJsonObject(story.settings),
      characters: characters.map(toAuthorStoryCharacterDto),
      factions: factions.map(toAuthorStoryFactionDto)
    };
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
  factions: readonly StoryFactionRecord[]
): PublishValidationIssueDto[] {
  const issues: PublishValidationIssueDto[] = [];
  addRequiredTextIssue(issues, "title", story.title);
  addRequiredTextIssue(issues, "slug", story.slug);
  if (!slugPattern.test(story.slug)) {
    issues.push({ field: "slug", message: "Slug must be URL safe." });
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
      field: "characters",
      message: "At least one playable character is required."
    });
  }

  for (const character of characters) {
    if (!isValidStats(character.initialStats)) {
      issues.push({
        field: `characters.${character.id}.initialStats`,
        message: "Initial stats must be bounded finite numeric values."
      });
    }
  }

  const settings = validateStorySettings(story.settings);
  if (!settings.initialLocation) {
    issues.push({
      field: "settings.initialLocation",
      message: "Initial location is required."
    });
  }

  for (const faction of factions) {
    if (!safeKeyPattern.test(faction.factionKey)) {
      issues.push({
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
    issues.push({ field, message: `${field} is required.` });
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

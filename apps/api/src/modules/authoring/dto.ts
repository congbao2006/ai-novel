import type {
  StoryCharacterRecord,
  StoryFactionRecord,
  StoryRecord
} from "@ai-novel/db";

export type AuthorStoryCharacterDto = {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly description: string;
  readonly personality: string;
  readonly background: string;
  readonly goals: readonly unknown[];
  readonly secrets: Record<string, unknown>;
  readonly initialStats: Record<string, unknown>;
  readonly initialState: Record<string, unknown>;
  readonly initialLocation: string | null;
  readonly metadata: Record<string, unknown>;
};

export type AuthorStoryFactionDto = {
  readonly id: string;
  readonly factionKey: string;
  readonly name: string;
  readonly description: string;
  readonly initialStatus: string;
  readonly initialInfluence: number;
  readonly resources: Record<string, unknown>;
  readonly goals: readonly unknown[];
  readonly state: Record<string, unknown>;
};

export type AuthorStorySummaryDto = {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly genre: string;
  readonly status: string;
  readonly updatedAt: string;
};

export type AuthorStoryDetailDto = AuthorStorySummaryDto & {
  readonly worldPrompt: string;
  readonly openingPrompt: string;
  readonly settings: Record<string, unknown>;
  readonly characters: readonly AuthorStoryCharacterDto[];
  readonly factions: readonly AuthorStoryFactionDto[];
};

export type AuthorStoryListResponseDto = {
  readonly stories: readonly AuthorStorySummaryDto[];
};

export type PublishValidationIssueDto = {
  readonly field: string;
  readonly message: string;
};

export type PublishValidationResponseDto = {
  readonly valid: boolean;
  readonly issues: readonly PublishValidationIssueDto[];
};

export function toAuthorStorySummaryDto(
  story: StoryRecord
): AuthorStorySummaryDto {
  return {
    id: story.id,
    title: story.title,
    slug: story.slug,
    description: story.description,
    genre: story.genre,
    status: story.status,
    updatedAt: story.updatedAt.toISOString()
  };
}

export function toAuthorStoryCharacterDto(
  character: StoryCharacterRecord
): AuthorStoryCharacterDto {
  return {
    id: character.id,
    type: character.characterType,
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
  };
}

export function toAuthorStoryFactionDto(
  faction: StoryFactionRecord
): AuthorStoryFactionDto {
  return {
    id: faction.id,
    factionKey: faction.factionKey,
    name: faction.name,
    description: faction.description,
    initialStatus: faction.initialStatus,
    initialInfluence: faction.initialInfluence,
    resources: copyJsonObject(faction.resources),
    goals: copyJsonArray(faction.goals),
    state: copyJsonObject(faction.state)
  };
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function copyJsonArray(value: unknown[]): unknown[] {
  return JSON.parse(JSON.stringify(value)) as unknown[];
}

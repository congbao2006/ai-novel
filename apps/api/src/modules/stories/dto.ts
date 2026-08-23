import type {
  StoryCharacterRecord,
  StoryListItemRecord,
  StoryVersionCharacterRecord
} from "@ai-novel/db";

export type StoryListItemDto = {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly genre: string;
};

export type StoryCharacterDto = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly background: string;
  readonly initialStats: Record<string, unknown>;
};

export type StoryDetailDto = StoryListItemDto & {
  readonly storyVersionId: string;
  readonly storyVersionNumber: number;
  readonly characters: StoryCharacterDto[];
};

export type StoryListResponseDto = {
  readonly stories: StoryListItemDto[];
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
};

export function toStoryListItemDto(story: StoryListItemRecord): StoryListItemDto {
  return {
    id: story.id,
    title: story.title,
    slug: story.slug,
    description: story.description,
    genre: story.genre
  };
}

export function toStoryCharacterDto(
  character: StoryCharacterRecord | StoryVersionCharacterRecord
): StoryCharacterDto {
  return {
    id: character.id,
    name: character.name,
    description: character.description,
    background: character.background,
    initialStats: copyJsonObject(character.initialStats)
  };
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

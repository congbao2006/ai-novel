import type { Repositories } from "@ai-novel/db";
import { ResourceNotFoundError } from "../../errors.js";
import {
  toStoryCharacterDto,
  toStoryListItemDto,
  type StoryDetailDto,
  type StoryListResponseDto
} from "./dto.js";

export type ListStoriesInput = {
  readonly genre?: string | undefined;
  readonly limit: number;
  readonly page: number;
};

export class StoryService {
  constructor(private readonly repositories: Repositories) {}

  async listPublished(input: ListStoriesInput): Promise<StoryListResponseDto> {
    const page = Math.max(1, input.page);
    const limit = Math.min(Math.max(1, input.limit), 50);
    const offset = (page - 1) * limit;
    const stories = await this.repositories.stories.listPublishedPage({
      genre: input.genre,
      limit: limit + 1,
      offset
    });

    return {
      stories: stories.slice(0, limit).map(toStoryListItemDto),
      page,
      limit,
      hasMore: stories.length > limit
    };
  }

  async getBySlug(slug: string): Promise<StoryDetailDto> {
    const story = await this.repositories.stories.getBySlug(slug);

    if (!story || story.status === "archived") {
      throw new ResourceNotFoundError("Story was not found.");
    }

    const version = await this.repositories.storyVersions.getCurrentPublishedVersion(
      story.id
    );
    if (!version) {
      throw new ResourceNotFoundError("Story was not found.");
    }

    const characters =
      await this.repositories.storyVersionCharacters.listForVersionByType(
        version.id,
        "playable"
      );

    return {
      ...toStoryListItemDto(story),
      storyVersionId: version.id,
      storyVersionNumber: version.versionNumber,
      characters: characters.map(toStoryCharacterDto)
    };
  }
}

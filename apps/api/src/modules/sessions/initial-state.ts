import type {
  CreateInitialStateInput,
  StoryCharacterRecord,
  StoryRecord
} from "@ai-novel/db";

export function buildInitialGameState(
  sessionId: string,
  story: StoryRecord,
  character: StoryCharacterRecord
): CreateInitialStateInput {
  const playerStats = copyJsonObject(character.initialStats);

  return {
    sessionId,
    location: "Điểm khởi đầu",
    worldTime: null,
    playerStats,
    flags: {
      storySlug: story.slug,
      selectedCharacterId: character.id,
      aiEnabled: false
    },
    stateData: {
      initialized: true,
      storyId: story.id,
      characterName: character.name,
      gameplayEnabled: false
    }
  };
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

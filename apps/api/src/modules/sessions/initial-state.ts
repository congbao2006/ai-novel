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
  const storySettings = copyJsonObject(story.settings);
  const characterState = copyJsonObject(character.initialState);
  const initialLocation =
    typeof character.initialLocation === "string" && character.initialLocation.trim()
      ? character.initialLocation.trim()
      : typeof storySettings.initialLocation === "string" &&
          storySettings.initialLocation.trim()
        ? storySettings.initialLocation.trim()
        : "Điểm khởi đầu";
  const worldTime =
    typeof storySettings.initialWorldTime === "string" &&
    storySettings.initialWorldTime.trim()
      ? storySettings.initialWorldTime.trim()
      : null;

  return {
    sessionId,
    location: initialLocation,
    worldTime,
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
      gameplayEnabled: false,
      initialSettings: storySettings,
      characterInitialState: characterState
    }
  };
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

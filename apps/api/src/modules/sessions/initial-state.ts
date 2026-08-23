import type {
  CreateInitialStateInput,
  StoryCharacterRecord,
  StoryVersionCharacterRecord
} from "@ai-novel/db";
import type { AbilityRuntimeState } from "@ai-novel/domain";

type RuntimeStoryConfig = {
  readonly storyId: string;
  readonly storySlug: string;
  readonly storyVersionId: string;
  readonly storyVersionNumber: number;
  readonly settings: Record<string, unknown>;
};

type RuntimeCharacterConfig = StoryCharacterRecord | StoryVersionCharacterRecord;

export function buildInitialGameState(
  sessionId: string,
  story: RuntimeStoryConfig,
  character: RuntimeCharacterConfig,
  abilities?: AbilityRuntimeState
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
      storySlug: story.storySlug,
      selectedCharacterId: character.id,
      storyVersionId: story.storyVersionId,
      storyVersionNumber: story.storyVersionNumber,
      aiEnabled: false
    },
    stateData: {
      initialized: true,
      storyId: story.storyId,
      storyVersionId: story.storyVersionId,
      characterName: character.name,
      abilities: abilities ?? { definitions: [], owned: [] },
      gameplayEnabled: false,
      initialSettings: storySettings,
      characterInitialState: characterState
    }
  };
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

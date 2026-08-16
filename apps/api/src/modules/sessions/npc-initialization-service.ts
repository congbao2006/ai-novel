import type {
  RepositoryContext,
  StoryCharacterRecord,
  StoryRecord
} from "@ai-novel/db";

export class NPCInitializationService {
  async initializeForSession(input: {
    readonly context: RepositoryContext;
    readonly sessionId: string;
    readonly story: StoryRecord;
    readonly selectedCharacterId: string;
  }): Promise<void> {
    const templates = await input.context.repositories.stories.listCharactersForStory(
      input.story.id
    );
    const npcTemplates = templates.filter(
      (template) => template.id !== input.selectedCharacterId
    );

    for (const template of npcTemplates) {
      await input.context.repositories.npcs.create(
        buildRuntimeNPC(input.sessionId, template)
      );
    }
  }
}

function buildRuntimeNPC(sessionId: string, template: StoryCharacterRecord) {
  return {
    sessionId,
    templateCharacterId: template.id,
    name: template.name,
    description: template.description,
    personality: normalizePersonality(template.personality),
    goals: [],
    secrets: {},
    currentState: {
      location: "Điểm khởi đầu",
      mood: "neutral",
      stance: "observing",
      currentGoal: null,
      templateCharacterId: template.id
    },
    alive: true
  };
}

function normalizePersonality(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }

  if (typeof value === "string" && value.trim()) {
    return {
      summary: value.trim()
    };
  }

  return {};
}

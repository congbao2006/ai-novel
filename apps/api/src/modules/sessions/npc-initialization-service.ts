import type {
  RepositoryContext,
  StoryCharacterRecord,
  StoryVersionCharacterRecord
} from "@ai-novel/db";

export class NPCInitializationService {
  async initializeForSession(input: {
    readonly context: RepositoryContext;
    readonly sessionId: string;
    readonly storyVersionId: string;
    readonly selectedVersionCharacterId: string;
  }): Promise<void> {
    const templates =
      await input.context.repositories.storyVersionCharacters.listForVersion(
        input.storyVersionId
      );
    const npcTemplates = templates.filter(
      (template) =>
        template.characterType === "npc" &&
        template.id !== input.selectedVersionCharacterId
    );

    for (const template of npcTemplates) {
      await input.context.repositories.npcs.create(
        buildRuntimeNPC(input.sessionId, template)
      );
    }
  }
}

function buildRuntimeNPC(
  sessionId: string,
  template: StoryCharacterRecord | StoryVersionCharacterRecord
) {
  return {
    sessionId,
    templateCharacterId: "sourceCharacterId" in template ? template.sourceCharacterId : template.id,
    name: template.name,
    description: template.description,
    personality: normalizePersonality(template.personality),
    goals: JSON.parse(JSON.stringify(template.goals)) as unknown[],
    secrets: copyJsonObject(template.secrets),
    currentState: {
      ...copyJsonObject(template.initialState),
      location: template.initialLocation ?? "Điểm khởi đầu",
      mood: "neutral",
      stance: "observing",
      currentGoal: null,
      templateCharacterId: "sourceCharacterId" in template ? template.sourceCharacterId : template.id,
      storyVersionCharacterId: template.id
    },
    alive: true
  };
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
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

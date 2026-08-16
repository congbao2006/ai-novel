import type { RepositoryContext, StoryRecord } from "@ai-novel/db";

export class FactionInitializationService {
  async initializeForSession(input: {
    readonly context: RepositoryContext;
    readonly sessionId: string;
    readonly story: StoryRecord;
  }): Promise<void> {
    const existing = await input.context.repositories.factions.listBySession(
      input.sessionId
    );

    if (existing.length > 0) {
      return;
    }

    const templates = await input.context.repositories.storyFactions.listForStory(
      input.story.id
    );
    const templateToRuntimeId = new Map<string, string>();

    for (const template of templates) {
      const faction = await input.context.repositories.factions.create({
        sessionId: input.sessionId,
        factionKey: template.factionKey,
        name: template.name,
        description: template.description,
        status: template.initialStatus,
        influence: template.initialInfluence,
        resources: copyJsonObject(template.resources),
        goals: copyJsonArray(template.goals),
        state: {
          ...copyJsonObject(template.state),
          templateFactionId: template.id
        }
      });
      templateToRuntimeId.set(template.id, faction.id);
    }

    const relationTemplates =
      await input.context.repositories.storyFactionRelationships.listForStory(
        input.story.id
      );

    for (const relationTemplate of relationTemplates) {
      const sourceFactionId = templateToRuntimeId.get(
        relationTemplate.sourceFactionId
      );
      const targetFactionId = templateToRuntimeId.get(
        relationTemplate.targetFactionId
      );

      if (!sourceFactionId || !targetFactionId) {
        continue;
      }

      await input.context.repositories.factionRelationships.upsertRelation({
        sessionId: input.sessionId,
        sourceFactionId,
        targetFactionId,
        affinity: relationTemplate.affinity,
        tension: relationTemplate.tension,
        metadata: copyJsonObject(relationTemplate.metadata)
      });
    }

    await input.context.repositories.worldSimulationStates.createInitial({
      sessionId: input.sessionId,
      lastTickTurn: 0
    });
  }
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function copyJsonArray(value: unknown[]): unknown[] {
  return JSON.parse(JSON.stringify(value)) as unknown[];
}

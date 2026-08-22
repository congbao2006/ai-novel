import {
  gameSessions,
  getDatabaseClient,
  type RepositoryContext,
  stories,
  withTransaction
} from "../index.js";
import { and, eq, isNull } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log("Story version backfill skipped: DATABASE_URL is not configured.");
  process.exit(0);
}

const db = getDatabaseClient(databaseUrl);

const result = await withTransaction(db, async (context) => {
  const allStories = await context.db.select().from(stories);
  let versionsCreated = 0;
  let sessionsPinned = 0;

  for (const story of allStories) {
    let currentVersion = story.currentPublishedVersionId
      ? await context.repositories.storyVersions.getById(
          story.currentPublishedVersionId
        )
      : null;

    if (!currentVersion && story.status === "published") {
      currentVersion = await createBaselineVersion(context, story.id);
      versionsCreated += 1;
    }

    if (!currentVersion) {
      continue;
    }

    const sessions = await context.db
      .select()
      .from(gameSessions)
      .where(
        and(eq(gameSessions.storyId, story.id), isNull(gameSessions.storyVersionId))
      );
    const versionCharacters =
      await context.repositories.storyVersionCharacters.listForVersion(
        currentVersion.id
      );

    for (const session of sessions) {
      const selectedVersionCharacter =
        session.selectedCharacterId === null
          ? null
          : (versionCharacters.find(
              (character) =>
                character.sourceCharacterId === session.selectedCharacterId
            ) ?? null);

      await context.db
        .update(gameSessions)
        .set({
          storyVersionId: currentVersion.id,
          selectedVersionCharacterId: selectedVersionCharacter?.id ?? null
        })
        .where(eq(gameSessions.id, session.id));
      sessionsPinned += 1;
    }
  }

  return { versionsCreated, sessionsPinned };
});

console.log(
  `Story version backfill complete: ${result.versionsCreated} baseline versions created, ${result.sessionsPinned} sessions pinned.`
);

async function createBaselineVersion(
  context: RepositoryContext,
  storyId: string
) {
  const story = await context.repositories.stories.getById(storyId);
  if (!story) {
    throw new Error(`Story ${storyId} disappeared during backfill.`);
  }

  const existing = await context.repositories.storyVersions.getCurrentPublishedVersion(
    story.id
  );
  if (existing) {
    return existing;
  }

  const [characters, factions, factionRelationships] = await Promise.all([
    context.repositories.stories.listCharactersForStory(story.id),
    context.repositories.storyFactions.listForStory(story.id),
    context.repositories.storyFactionRelationships.listForStory(story.id)
  ]);
  const version = await context.repositories.storyVersions.create({
    storyId: story.id,
    versionNumber: await context.repositories.storyVersions.getNextVersionNumber(
      story.id
    ),
    status: "published",
    worldPrompt: story.worldPrompt,
    openingPrompt: story.openingPrompt,
    settings: copyJsonObject(story.settings),
    createdByUserId: story.createdByUserId
  });

  for (const character of characters) {
    await context.repositories.storyVersionCharacters.create({
      storyVersionId: version.id,
      sourceCharacterId: character.id,
      characterType: character.characterType,
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
    });
  }

  const versionFactionIdsBySource = new Map<string, string>();
  for (const faction of factions) {
    const versionFaction = await context.repositories.storyVersionFactions.create({
      storyVersionId: version.id,
      sourceFactionId: faction.id,
      factionKey: faction.factionKey,
      name: faction.name,
      description: faction.description,
      initialStatus: faction.initialStatus,
      initialInfluence: faction.initialInfluence,
      resources: copyJsonObject(faction.resources),
      goals: copyJsonArray(faction.goals),
      state: copyJsonObject(faction.state)
    });
    versionFactionIdsBySource.set(faction.id, versionFaction.id);
  }

  for (const relationship of factionRelationships) {
    const sourceVersionFactionId = versionFactionIdsBySource.get(
      relationship.sourceFactionId
    );
    const targetVersionFactionId = versionFactionIdsBySource.get(
      relationship.targetFactionId
    );
    if (!sourceVersionFactionId || !targetVersionFactionId) {
      continue;
    }

    await context.repositories.storyVersionFactionRelationships.create({
      storyVersionId: version.id,
      sourceVersionFactionId,
      targetVersionFactionId,
      affinity: relationship.affinity,
      tension: relationship.tension,
      metadata: copyJsonObject(relationship.metadata)
    });
  }

  await context.repositories.stories.update(story.id, {
    currentPublishedVersionId: version.id
  });

  return version;
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function copyJsonArray(value: unknown[]): unknown[] {
  return JSON.parse(JSON.stringify(value)) as unknown[];
}

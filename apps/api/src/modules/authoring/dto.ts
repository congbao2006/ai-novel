import type {
  StoryCharacterRecord,
  StoryAbilityRecord,
  StoryCharacterAbilityRecord,
  StoryFactionRecord,
  StoryRecord,
  StoryVersionAbilityRecord,
  StoryVersionCharacterAbilityRecord,
  StoryVersionCharacterRecord,
  StoryVersionRecord
} from "@ai-novel/db";

export type AuthorAssignedAbilityDto = {
  readonly abilityId: string;
  readonly abilityKey: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly rank: number;
  readonly resourceCost: Record<string, unknown> | null;
  readonly cooldownTurns: number;
  readonly enabled: boolean;
  readonly unlocked: boolean;
};

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
  readonly abilityKeys: readonly string[];
  readonly assignedAbilities: readonly AuthorAssignedAbilityDto[];
};

export type AuthorStoryAbilityDto = {
  readonly id: string;
  readonly abilityKey: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly rank: number;
  readonly resourceCost: Record<string, unknown> | null;
  readonly cooldownTurns: number;
  readonly tags: readonly unknown[];
  readonly effects: Record<string, unknown>;
  readonly requirements: Record<string, unknown>;
  readonly enabled: boolean;
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
  readonly currentPublishedVersionId: string | null;
  readonly updatedAt: string;
};

export type AuthorStoryVersionDto = {
  readonly id: string;
  readonly versionNumber: number;
  readonly status: string;
  readonly createdAt: string;
  readonly publishedAt: string;
};

export type AuthorStoryVersionSnapshotDto = {
  readonly version: AuthorStoryVersionDto;
  readonly characters: readonly AuthorStoryVersionCharacterDto[];
  readonly abilities: readonly AuthorStoryVersionAbilityDto[];
};

export type AuthorStoryVersionAbilityDto = {
  readonly id: string;
  readonly abilityKey: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly rank: number;
  readonly resourceCost: Record<string, unknown> | null;
  readonly cooldownTurns: number;
  readonly enabled: boolean;
};

export type AuthorStoryVersionCharacterDto = {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly description: string;
  readonly initialLocation: string | null;
  readonly assignedAbilities: readonly AuthorAssignedAbilityDto[];
};

export type AuthorStoryDetailDto = AuthorStorySummaryDto & {
  readonly currentPublishedVersionNumber: number | null;
  readonly worldPrompt: string;
  readonly openingPrompt: string;
  readonly settings: Record<string, unknown>;
  readonly characters: readonly AuthorStoryCharacterDto[];
  readonly abilities: readonly AuthorStoryAbilityDto[];
  readonly factions: readonly AuthorStoryFactionDto[];
  readonly versions: readonly AuthorStoryVersionDto[];
};

export type AuthorStoryListResponseDto = {
  readonly stories: readonly AuthorStorySummaryDto[];
};

export type PublishValidationIssueDto = {
  readonly code: string;
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
    currentPublishedVersionId: story.currentPublishedVersionId,
    updatedAt: story.updatedAt.toISOString()
  };
}

export function toAuthorStoryVersionDto(
  version: StoryVersionRecord
): AuthorStoryVersionDto {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    status: version.status,
    createdAt: version.createdAt.toISOString(),
    publishedAt: version.publishedAt.toISOString()
  };
}

export function toAuthorStoryCharacterDto(
  character: StoryCharacterRecord,
  assignments: readonly StoryCharacterAbilityRecord[] = [],
  abilitiesById: ReadonlyMap<string, StoryAbilityRecord> = new Map()
): AuthorStoryCharacterDto {
  const assignedAbilities = assignments
    .filter((assignment) => assignment.characterId === character.id)
    .map((assignment) => {
      const ability = abilitiesById.get(assignment.abilityId);
      return ability ? toAuthorAssignedAbilityDto(ability, assignment) : null;
    })
    .filter(
      (ability): ability is AuthorAssignedAbilityDto => ability !== null
    );

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
    metadata: copyJsonObject(character.metadata),
    abilityKeys: assignedAbilities.map((ability) => ability.abilityKey),
    assignedAbilities
  };
}

export function toAuthorStoryVersionSnapshotDto(
  version: StoryVersionRecord,
  characters: readonly StoryVersionCharacterRecord[],
  abilities: readonly StoryVersionAbilityRecord[],
  assignments: readonly StoryVersionCharacterAbilityRecord[]
): AuthorStoryVersionSnapshotDto {
  const abilitiesById = new Map(abilities.map((ability) => [ability.id, ability]));

  return {
    version: toAuthorStoryVersionDto(version),
    abilities: abilities.map(toAuthorStoryVersionAbilityDto),
    characters: characters.map((character) =>
      toAuthorStoryVersionCharacterDto(character, assignments, abilitiesById)
    )
  };
}

function toAuthorAssignedAbilityDto(
  ability: StoryAbilityRecord | StoryVersionAbilityRecord,
  assignment: StoryCharacterAbilityRecord | StoryVersionCharacterAbilityRecord
): AuthorAssignedAbilityDto {
  return {
    abilityId: ability.id,
    abilityKey: ability.abilityKey,
    name: ability.name,
    description: ability.description,
    category: ability.category,
    rank: assignment.rank,
    resourceCost: ability.resourceCost ? copyJsonObject(ability.resourceCost) : null,
    cooldownTurns: ability.cooldownTurns,
    enabled: assignment.enabled,
    unlocked: assignment.unlocked
  };
}

function toAuthorStoryVersionAbilityDto(
  ability: StoryVersionAbilityRecord
): AuthorStoryVersionAbilityDto {
  return {
    id: ability.id,
    abilityKey: ability.abilityKey,
    name: ability.name,
    description: ability.description,
    category: ability.category,
    rank: ability.rank,
    resourceCost: ability.resourceCost ? copyJsonObject(ability.resourceCost) : null,
    cooldownTurns: ability.cooldownTurns,
    enabled: ability.enabled
  };
}

function toAuthorStoryVersionCharacterDto(
  character: StoryVersionCharacterRecord,
  assignments: readonly StoryVersionCharacterAbilityRecord[],
  abilitiesById: ReadonlyMap<string, StoryVersionAbilityRecord>
): AuthorStoryVersionCharacterDto {
  return {
    id: character.id,
    type: character.characterType,
    name: character.name,
    description: character.description,
    initialLocation: character.initialLocation,
    assignedAbilities: assignments
      .filter((assignment) => assignment.versionCharacterId === character.id)
      .map((assignment) => {
        const ability = abilitiesById.get(assignment.versionAbilityId);
        return ability ? toAuthorAssignedAbilityDto(ability, assignment) : null;
      })
      .filter(
        (ability): ability is AuthorAssignedAbilityDto => ability !== null
      )
  };
}

export function toAuthorStoryAbilityDto(
  ability: StoryAbilityRecord
): AuthorStoryAbilityDto {
  return {
    id: ability.id,
    abilityKey: ability.abilityKey,
    name: ability.name,
    description: ability.description,
    category: ability.category,
    rank: ability.rank,
    resourceCost: ability.resourceCost ? copyJsonObject(ability.resourceCost) : null,
    cooldownTurns: ability.cooldownTurns,
    tags: copyJsonArray(ability.tags),
    effects: copyJsonObject(ability.effects),
    requirements: copyJsonObject(ability.requirements),
    enabled: ability.enabled,
    metadata: copyJsonObject(ability.metadata)
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

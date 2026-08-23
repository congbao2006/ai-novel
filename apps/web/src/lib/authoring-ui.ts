export type AuthoringRuntimeEditStatus = "draft" | "published" | "archived" | string;

export function canSubmitRuntimeAuthoringForm(
  status: AuthoringRuntimeEditStatus
): boolean {
  return status === "draft";
}

export function requiresRevisionBeforeRuntimeEdit(
  status: AuthoringRuntimeEditStatus
): boolean {
  return status !== "draft" && status !== "archived";
}

export function getAbilitySubmitLabel(status: AuthoringRuntimeEditStatus): string {
  return requiresRevisionBeforeRuntimeEdit(status)
    ? "Tạo revision và thêm ability"
    : "Thêm ability";
}

export function getAbilityAssignmentSubmitLabel(
  status: AuthoringRuntimeEditStatus
): string {
  return requiresRevisionBeforeRuntimeEdit(status)
    ? "Tạo revision và gán ability"
    : "Gán ability";
}

export type AssignableStoryCharacter = {
  readonly name: string;
  readonly abilityKeys: readonly string[];
  readonly assignedAbilities?: readonly {
    readonly name: string;
    readonly abilityKey: string;
    readonly category: string;
    readonly rank: number;
    readonly cooldownTurns: number;
  }[];
};

export type RevisionStatusInput = {
  readonly status: string;
  readonly currentPublishedVersionNumber: number | null;
};

export function getAssignedCharacterNamesForAbility(
  characters: readonly AssignableStoryCharacter[],
  abilityKey: string
): string[] {
  return characters
    .filter((character) => character.abilityKeys.includes(abilityKey))
    .map((character) => character.name);
}

export function getCharacterAbilitySummaries(
  character: AssignableStoryCharacter
): string[] {
  return (character.assignedAbilities ?? []).map(
    (ability) =>
      `${ability.name} · ${ability.category} · Rank ${ability.rank} · Cooldown ${ability.cooldownTurns}`
  );
}

export function getRevisionStatusCopy(story: RevisionStatusInput): {
  readonly statusLabel: "LOCKED" | "WORKING REVISION";
  readonly liveLabel: string;
  readonly workingLabel: "NO WORKING REVISION" | "WORKING REVISION: unpublished changes";
} {
  const locked = story.status !== "draft";
  return {
    statusLabel: locked ? "LOCKED" : "WORKING REVISION",
    liveLabel: story.currentPublishedVersionNumber
      ? `v${story.currentPublishedVersionNumber}`
      : "none",
    workingLabel: locked
      ? "NO WORKING REVISION"
      : "WORKING REVISION: unpublished changes"
  };
}

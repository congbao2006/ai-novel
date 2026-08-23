export type AuthoringRuntimeEditStatus = "draft" | "published" | "archived" | string;

export function canSubmitRuntimeAuthoringForm(
  status: AuthoringRuntimeEditStatus
): boolean {
  return status !== "archived";
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

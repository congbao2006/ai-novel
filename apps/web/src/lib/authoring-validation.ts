import type { PublishValidationIssue } from "./api";

export function formatValidationIssue(issue: PublishValidationIssue): string {
  return `${issue.field}: ${issue.message}`;
}

export function getValidationIssueSummary(
  valid: boolean,
  issues: readonly PublishValidationIssue[]
): string {
  if (valid) {
    return "Story hợp lệ để publish.";
  }

  return issues.length > 0
    ? `Story chưa hợp lệ để publish. Cần sửa ${issues.length} lỗi bên dưới.`
    : "Story chưa hợp lệ để publish.";
}

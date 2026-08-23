import { describe, expect, it } from "vitest";
import {
  formatValidationIssue,
  getValidationIssueSummary
} from "./authoring-validation";

describe("authoring validation presentation", () => {
  it("formats every publish validation issue for the editor", () => {
    expect(
      [
        {
          code: "required",
          field: "worldPrompt",
          message: "worldPrompt is required."
        },
        {
          code: "missing_playable_character",
          field: "characters",
          message: "At least one playable character is required."
        }
      ].map(formatValidationIssue)
    ).toEqual([
      "worldPrompt: worldPrompt is required.",
      "characters: At least one playable character is required."
    ]);
  });

  it("summarizes invalid validation without discarding details", () => {
    expect(
      getValidationIssueSummary(false, [
        {
          code: "required",
          field: "worldPrompt",
          message: "worldPrompt is required."
        },
        {
          code: "missing_initial_location",
          field: "settings.initialLocation",
          message: "Initial location is required."
        }
      ])
    ).toBe("Story chưa hợp lệ để publish. Cần sửa 2 lỗi bên dưới.");
  });
});

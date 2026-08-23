import { describe, expect, it } from "vitest";
import {
  canSubmitRuntimeAuthoringForm,
  getAbilityAssignmentSubmitLabel,
  getAbilitySubmitLabel,
  requiresRevisionBeforeRuntimeEdit
} from "./authoring-ui";

describe("authoring UI policy", () => {
  it("keeps ability controls available for published stories through revisions", () => {
    expect(canSubmitRuntimeAuthoringForm("published")).toBe(true);
    expect(requiresRevisionBeforeRuntimeEdit("published")).toBe(true);
    expect(getAbilitySubmitLabel("published")).toBe("Tạo revision và thêm ability");
    expect(getAbilityAssignmentSubmitLabel("published")).toBe(
      "Tạo revision và gán ability"
    );
  });

  it("edits draft ability content directly and blocks archived stories", () => {
    expect(canSubmitRuntimeAuthoringForm("draft")).toBe(true);
    expect(requiresRevisionBeforeRuntimeEdit("draft")).toBe(false);
    expect(getAbilitySubmitLabel("draft")).toBe("Thêm ability");
    expect(canSubmitRuntimeAuthoringForm("archived")).toBe(false);
    expect(requiresRevisionBeforeRuntimeEdit("archived")).toBe(false);
  });
});

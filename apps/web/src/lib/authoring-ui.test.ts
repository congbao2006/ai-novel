import { describe, expect, it } from "vitest";
import {
  canSubmitRuntimeAuthoringForm,
  getAssignedCharacterNamesForAbility,
  getAbilityAssignmentSubmitLabel,
  getAbilitySubmitLabel,
  getCharacterAbilitySummaries,
  getRevisionStatusCopy,
  requiresRevisionBeforeRuntimeEdit
} from "./authoring-ui";

describe("authoring UI policy", () => {
  it("locks runtime-critical controls for published stories until a revision exists", () => {
    expect(canSubmitRuntimeAuthoringForm("published")).toBe(false);
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

  it("distinguishes story ability existence from character assignment", () => {
    const characters = [
      {
        name: "Kẻ Vô Danh",
        abilityKeys: ["shadow-step"],
        assignedAbilities: [
          {
            name: "Ảnh Bộ",
            abilityKey: "shadow-step",
            category: "movement",
            rank: 1,
            cooldownTurns: 2
          }
        ]
      },
      {
        name: "Lý Thanh",
        abilityKeys: []
      }
    ];

    expect(getAssignedCharacterNamesForAbility(characters, "shadow-step")).toEqual([
      "Kẻ Vô Danh"
    ]);
    expect(getAssignedCharacterNamesForAbility(characters, "inner-sight")).toEqual(
      []
    );
    expect(getCharacterAbilitySummaries(characters[0]!)).toEqual([
      "Ảnh Bộ · movement · Rank 1 · Cooldown 2"
    ]);
  });

  it("renders revision status copy for locked and working states", () => {
    expect(
      getRevisionStatusCopy({
        status: "published",
        currentPublishedVersionNumber: 3
      })
    ).toEqual({
      statusLabel: "LOCKED",
      liveLabel: "v3",
      workingLabel: "NO WORKING REVISION"
    });

    expect(
      getRevisionStatusCopy({
        status: "draft",
        currentPublishedVersionNumber: 3
      })
    ).toEqual({
      statusLabel: "WORKING REVISION",
      liveLabel: "v3",
      workingLabel: "WORKING REVISION: unpublished changes"
    });
  });
});

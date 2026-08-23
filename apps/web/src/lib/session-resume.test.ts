import { describe, expect, it } from "vitest";
import type { SessionListItem } from "./api";
import {
  formatSessionResumeLabel,
  getResumeSessionsForStory
} from "./session-resume";

describe("session resume helpers", () => {
  it("selects active sessions for a story and sorts newest first", () => {
    const sessions = [
      createSession({
        id: "old",
        storyId: "story-1",
        lastPlayedAt: "2026-01-01T00:00:00Z",
        status: "active"
      }),
      createSession({
        id: "other-story",
        storyId: "story-2",
        lastPlayedAt: "2026-01-03T00:00:00Z",
        status: "active"
      }),
      createSession({
        id: "new",
        storyId: "story-1",
        lastPlayedAt: "2026-01-02T00:00:00Z",
        status: "active"
      }),
      createSession({
        id: "archived",
        storyId: "story-1",
        lastPlayedAt: "2026-01-04T00:00:00Z",
        status: "completed"
      })
    ];

    expect(getResumeSessionsForStory(sessions, "story-1").map((item) => item.id))
      .toEqual(["new", "old"]);
  });

  it("formats resume labels with character, turn, and pinned version", () => {
    expect(
      formatSessionResumeLabel(
        createSession({
          id: "session-1",
          storyId: "story-1",
          turnCount: 7,
          storyVersionNumber: 2
        })
      )
    ).toBe("Kẻ Vô Danh · turn 7 · v2");
  });
});

function createSession(
  overrides: Partial<
    Pick<
      SessionListItem,
      "id" | "status" | "lastPlayedAt" | "turnCount" | "storyVersionNumber"
    >
  > & {
    readonly storyId: string;
  }
): SessionListItem {
  return {
    id: overrides.id ?? "session-1",
    story: {
      id: overrides.storyId,
      title: "Story",
      slug: "story",
      description: "Description",
      genre: "fantasy"
    },
    selectedCharacter: {
      id: "character-1",
      name: "Kẻ Vô Danh",
      description: "A character.",
      background: "",
      initialStats: {}
    },
    status: overrides.status ?? "active",
    storyVersionId: "version-1",
    storyVersionNumber: overrides.storyVersionNumber ?? 1,
    turnCount: overrides.turnCount ?? 3,
    lastPlayedAt: overrides.lastPlayedAt ?? "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z"
  };
}

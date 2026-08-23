import type { SessionListItem } from "./api";

export function getResumeSessionsForStory(
  sessions: readonly SessionListItem[],
  storyId: string
): SessionListItem[] {
  return sessions
    .filter((session) => session.story.id === storyId && session.status === "active")
    .sort(
      (left, right) =>
        Date.parse(right.lastPlayedAt) - Date.parse(left.lastPlayedAt)
    );
}

export function formatSessionResumeLabel(session: SessionListItem): string {
  const characterName = session.selectedCharacter?.name ?? "Chưa chọn nhân vật";
  const version = session.storyVersionNumber
    ? ` · v${session.storyVersionNumber}`
    : "";
  return `${characterName} · turn ${session.turnCount}${version}`;
}

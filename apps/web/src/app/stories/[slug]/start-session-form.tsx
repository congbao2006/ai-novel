"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  authRequest,
  type SessionListItem,
  type SessionDetail,
  type StoryCharacter
} from "../../../lib/api";
import {
  formatSessionResumeLabel,
  getResumeSessionsForStory
} from "../../../lib/session-resume";

type StartSessionFormProps = {
  readonly storyId: string;
  readonly storySlug: string;
  readonly characters: StoryCharacter[];
};

export function StartSessionForm({
  storyId,
  storySlug,
  characters
}: StartSessionFormProps) {
  const router = useRouter();
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    characters[0]?.id ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [resumeSessions, setResumeSessions] = useState<SessionListItem[]>([]);

  useEffect(() => {
    let active = true;

    authRequest<{ sessions: SessionListItem[] }>("/sessions")
      .then((result) => {
        if (!active) return;
        setResumeSessions(getResumeSessionsForStory(result.sessions, storyId));
      })
      .catch(() => {
        if (!active) return;
        setResumeSessions([]);
      })
      .finally(() => {
        if (!active) return;
        setSessionsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [storyId]);

  async function startSession() {
    setError(null);
    setLoading(true);

    try {
      const result = await authRequest<{ session: SessionDetail }>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          storyId,
          characterId: selectedCharacterId
        })
      });

      router.push(`/play/${result.session.id}`);
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Không thể tạo session.";

      if (message.toLowerCase().includes("unauthenticated")) {
        router.push(`/login?next=/stories/${storySlug}`);
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      <section className="surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Tiếp tục</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Mở lại run đã lưu của story này.
            </p>
          </div>
          <a className="auth-link" href="/sessions">
            My Sessions
          </a>
        </div>

        {!sessionsLoaded ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Đang kiểm tra session đã lưu...
          </p>
        ) : null}

        {sessionsLoaded && resumeSessions.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {resumeSessions.map((session) => (
              <button
                className="rounded border border-[var(--border)] px-4 py-3 text-left hover:border-[var(--accent)]"
                key={session.id}
                onClick={() => router.push(`/play/${session.id}`)}
                type="button"
              >
                <span className="block font-medium">Tiếp tục</span>
                <span className="mt-1 block text-sm text-[var(--muted)]">
                  {formatSessionResumeLabel(session)}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {sessionsLoaded && resumeSessions.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Chưa có run active nào cho story này.
          </p>
        ) : null}
      </section>

      <h2 className="text-xl font-semibold">Chọn nhân vật</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Chọn nhân vật chỉ dành cho run mới. Run cũ luôn nằm ở phần Tiếp tục hoặc
        My Sessions.
      </p>
      <div className="choice-list mt-4">
        {characters.map((character) => (
          <label key={character.id}>
            <span className="font-medium">
              <input
                checked={selectedCharacterId === character.id}
                name="character"
                onChange={() => setSelectedCharacterId(character.id)}
                type="radio"
              />
              {character.name}
            </span>
            <span className="text-sm leading-6 text-[var(--muted)]">
              {character.description}
            </span>
            <span className="text-sm leading-6 text-[var(--muted)]">
              {character.background}
            </span>
          </label>
        ))}
      </div>

      {error ? <p className="auth-error mt-4">{error}</p> : null}
      <button
        className="mt-5 auth-link"
        disabled={loading || !selectedCharacterId}
        onClick={startSession}
        type="button"
      >
        {loading ? "Đang tạo..." : "Chơi lại / New run"}
      </button>
    </div>
  );
}

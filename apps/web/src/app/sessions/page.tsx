"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authRequest, type SessionListItem } from "../../lib/api";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authRequest<{ sessions: SessionListItem[] }>("/sessions")
      .then((result) => setSessions(result.sessions))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Request failed.")
      )
      .finally(() => setLoaded(true));
  }, []);

  return (
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
              Sessions
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Tiếp tục nhập vai</h1>
          </div>
          <Link className="auth-link" href="/stories">
            Stories
          </Link>
        </div>

        {!loaded ? (
          <p className="mt-8 text-sm text-[var(--muted)]">Loading sessions...</p>
        ) : null}

        {loaded && error ? (
          <div className="mt-8 muted-panel">
            <p className="text-sm text-[var(--muted)]">{error}</p>
            <Link className="mt-4 inline-flex auth-link" href="/login">
              Login
            </Link>
          </div>
        ) : null}

        {loaded && !error ? (
          <div className="mt-8 grid gap-4">
            {sessions.map((session) => (
              <article key={session.id} className="surface-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--accent)]">
                      {session.story.genre}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">
                      {session.story.title}
                    </h2>
                  </div>
                  <span className="status-pill">{session.status}</span>
                </div>
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Nhân vật: {session.selectedCharacter?.name ?? "Chưa chọn"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Turn: {session.turnCount}
                </p>
                <Link
                  className="mt-5 inline-flex auth-link"
                  href={`/play/${session.id}`}
                >
                  Mở session
                </Link>
              </article>
            ))}
          </div>
        ) : null}

        {loaded && !error && sessions.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--muted)]">
            Chưa có session nào.
          </p>
        ) : null}
      </section>
    </main>
  );
}

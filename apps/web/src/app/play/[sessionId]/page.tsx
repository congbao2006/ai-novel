"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authRequest, type SessionDetail } from "../../../lib/api";

export default function PlayShellPage() {
  const params = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.sessionId) {
      return;
    }

    authRequest<SessionDetail>(`/sessions/${params.sessionId}`)
      .then((result) => setSession(result))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Request failed.")
      )
      .finally(() => setLoaded(true));
  }, [params.sessionId]);

  return (
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto max-w-5xl">
        <Link className="text-sm text-[var(--accent)]" href="/sessions">
          Back to sessions
        </Link>

        {!loaded ? (
          <p className="mt-8 text-sm text-[var(--muted)]">Loading session...</p>
        ) : null}

        {loaded && error ? (
          <div className="mt-8 muted-panel">
            <p className="text-sm text-[var(--muted)]">{error}</p>
            <Link className="mt-4 inline-flex auth-link" href="/login">
              Login
            </Link>
          </div>
        ) : null}

        {loaded && session ? (
          <div className="mt-8">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
              Play shell
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl font-semibold">{session.story.title}</h1>
              <span className="status-pill">{session.status}</span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="surface-card">
                <p className="text-sm text-[var(--muted)]">Nhân vật</p>
                <p className="mt-2 font-semibold">
                  {session.selectedCharacter?.name ?? "Chưa chọn"}
                </p>
              </div>
              <div className="surface-card">
                <p className="text-sm text-[var(--muted)]">Vị trí</p>
                <p className="mt-2 font-semibold">
                  {session.currentState?.location ?? "Chưa có state"}
                </p>
              </div>
              <div className="surface-card">
                <p className="text-sm text-[var(--muted)]">Turn</p>
                <p className="mt-2 font-semibold">{session.turnCount}</p>
              </div>
            </div>

            <div className="mt-6 muted-panel">
              <p className="text-sm leading-6 text-[var(--muted)]">
                Gameplay AI chưa được bật. Session và GameState đã được tạo để
                chuẩn bị cho engine deterministic ở bước tiếp theo.
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  authRequest,
  type SessionDetail,
  type SessionListItem
} from "../../lib/api";

type SessionCardItem = SessionListItem & {
  readonly location?: string | null;
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionCardItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authRequest<{ sessions: SessionListItem[] }>("/sessions")
      .then(async (result) => {
        const details = await Promise.allSettled(
          result.sessions.map((session) =>
            authRequest<SessionDetail>(`/sessions/${session.id}`)
          )
        );
        setSessions(
          result.sessions.map((session, index) => {
            const detail = details[index];
            return {
              ...session,
              location:
                detail?.status === "fulfilled"
                  ? (detail.value.currentState?.location ?? null)
                  : null
            };
          })
        );
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Request failed.")
      )
      .finally(() => setLoaded(true));
  }, []);

  const grouped = useMemo(() => {
    return sessions.reduce<Record<string, SessionCardItem[]>>((groups, session) => {
      groups[session.story.title] = [...(groups[session.story.title] ?? []), session];
      return groups;
    }, {});
  }, [sessions]);

  return (
    <main className="page-shell page-shell-wide">
      <header className="page-header">
        <div>
          <p className="kicker">Library</p>
          <h1 className="page-title">My Sessions</h1>
          <p className="page-description mt-4">
            Manage persistent runs. Multiple playthroughs of the same story remain
            separate and pinned to their original story version.
          </p>
        </div>
        <Link className="btn" href="/stories">
          Browse Stories
        </Link>
      </header>

      {!loaded ? <p className="text-sm text-[var(--muted)]">Loading sessions...</p> : null}

      {loaded && error ? (
        <div className="panel">
          <p className="alert-error">{error}</p>
          <Link className="btn mt-4" href="/login">
            Login
          </Link>
        </div>
      ) : null}

      {loaded && !error && sessions.length === 0 ? (
        <div className="panel">
          <p className="font-semibold">No saved runs yet.</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Start a story and it will appear here.
          </p>
          <Link className="btn mt-4" href="/stories">
            Discover Stories
          </Link>
        </div>
      ) : null}

      <div className="grid gap-8">
        {Object.entries(grouped).map(([storyTitle, storySessions]) => (
          <section key={storyTitle}>
            <h2 className="text-xl font-semibold">{storyTitle}</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {storySessions.map((session) => (
                <article key={session.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="badge badge-gold">{session.story.genre}</p>
                      <h3 className="mt-3 text-xl font-semibold">
                        {session.selectedCharacter?.name ?? "Chưa chọn"}
                      </h3>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {session.story.description}
                      </p>
                    </div>
                    <span className="badge">{session.status}</span>
                  </div>
                  <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <SessionMeta label="Turn" value={String(session.turnCount)} />
                    <SessionMeta
                      label="Location"
                      value={session.location ?? "Unknown"}
                    />
                    <SessionMeta
                      label="Story Version"
                      value={
                        session.storyVersionNumber
                          ? `v${session.storyVersionNumber}`
                          : "Legacy"
                      }
                    />
                    <SessionMeta
                      label="Last Activity"
                      value={new Date(session.lastPlayedAt).toLocaleString()}
                    />
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link className="btn" href={`/play/${session.id}`}>
                      Continue
                    </Link>
                    <Link className="btn btn-secondary" href={`/stories/${session.story.slug}`}>
                      Story Details
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function SessionMeta({
  label,
  value
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.12em] text-[var(--muted-2)]">
        {label}
      </dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

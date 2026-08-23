"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  authRequest,
  type SessionListItem,
  type StoryListItem
} from "../../lib/api";
import {
  formatSessionResumeLabel,
  getResumeSessionsForStory
} from "../../lib/session-resume";

type StoryListResponse = {
  readonly stories: StoryListItem[];
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
};

export default function StoriesPage() {
  const [stories, setStories] = useState<StoryListItem[]>([]);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      apiRequest<StoryListResponse>("/stories?limit=20", { cache: "no-store" }),
      authRequest<{ sessions: SessionListItem[] }>("/sessions")
    ]).then(([storyResult, sessionResult]) => {
      if (storyResult.status === "fulfilled") {
        setStories(storyResult.value.stories);
      } else {
        setError(storyResult.reason instanceof Error ? storyResult.reason.message : "Không tải được stories.");
      }
      if (sessionResult.status === "fulfilled") {
        setSessions(sessionResult.value.sessions);
      }
      setLoaded(true);
    });
  }, []);

  const sessionsByStory = useMemo(() => {
    return new Map(
      stories.map((story) => [
        story.id,
        getResumeSessionsForStory(sessions, story.id)
      ])
    );
  }, [sessions, stories]);

  return (
    <main className="page-shell page-shell-wide">
      <header className="page-header">
        <div>
          <p className="kicker">Discover</p>
          <h1 className="page-title">Stories</h1>
          <p className="page-description mt-4">
            Browse published worlds. Existing runs are surfaced here so Continue
            and Start New Run stay separate.
          </p>
        </div>
        <Link className="btn btn-secondary" href="/sessions">
          My Sessions
        </Link>
      </header>

      {!loaded ? <p className="text-sm text-[var(--muted)]">Loading stories...</p> : null}
      {error ? <div className="panel alert-error">{error}</div> : null}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {stories.map((story) => {
          const resumeSessions = sessionsByStory.get(story.id) ?? [];
          const latest = resumeSessions[0];
          return (
            <article key={story.id} className="card flex min-h-[22rem] flex-col">
              <div className="mb-4 grid h-24 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]">
                <span className="text-3xl font-black text-[var(--accent)]">
                  {story.title.slice(0, 1)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="badge badge-gold">{story.genre}</span>
                <span className="badge">Published</span>
              </div>
              <h2 className="mt-4 text-xl font-semibold">{story.title}</h2>
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-[var(--muted)]">
                {story.description}
              </p>
              {latest ? (
                <p className="mt-4 text-xs text-[var(--muted)]">
                  Saved run: {formatSessionResumeLabel(latest)}
                </p>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                {latest ? (
                  <Link className="btn" href={`/play/${latest.id}`}>
                    Continue
                  </Link>
                ) : null}
                <Link className={latest ? "btn btn-secondary" : "btn"} href={`/stories/${story.slug}`}>
                  {latest ? "View / New Run" : "View Story"}
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      {loaded && stories.length === 0 ? (
        <div className="panel">
          <p className="font-semibold">No published stories yet.</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Creator Studio can publish the first playable story.
          </p>
        </div>
      ) : null}
    </main>
  );
}

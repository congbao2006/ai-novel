"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  authRequest,
  type AuthorStoryListResponse,
  type AuthorStorySummary,
  type SessionListItem,
  type StoryListItem
} from "../lib/api";
import { formatSessionResumeLabel } from "../lib/session-resume";

type StoryListResponse = {
  readonly stories: StoryListItem[];
};

export default function Home() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [stories, setStories] = useState<StoryListItem[]>([]);
  const [authorStories, setAuthorStories] = useState<readonly AuthorStorySummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      authRequest<{ sessions: SessionListItem[] }>("/sessions"),
      apiRequest<StoryListResponse>("/stories?limit=6", { cache: "no-store" }),
      authRequest<AuthorStoryListResponse>("/author/stories")
    ]).then(([sessionResult, storyResult, authorResult]) => {
      if (sessionResult.status === "fulfilled") {
        setSessions(sessionResult.value.sessions);
      }
      if (storyResult.status === "fulfilled") {
        setStories(storyResult.value.stories);
      }
      if (authorResult.status === "fulfilled") {
        setAuthorStories(authorResult.value.stories);
      }
      setLoaded(true);
    });
  }, []);

  const activeSessions = useMemo(
    () =>
      sessions
        .filter((session) => session.status === "active")
        .sort(
          (left, right) =>
            new Date(right.lastPlayedAt).getTime() -
            new Date(left.lastPlayedAt).getTime()
        )
        .slice(0, 3),
    [sessions]
  );

  return (
    <main className="page-shell page-shell-wide">
      <section className="page-header">
        <div>
          <p className="kicker">Play · Read · Listen · Community</p>
          <h1 className="page-title">AI Interactive Novel + RPG</h1>
          <p className="page-description mt-5">
            Continue persistent runs, discover authored worlds, and build playable
            story versions from one coherent studio.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="btn" href={activeSessions[0] ? `/play/${activeSessions[0].id}` : "/stories"}>
            {activeSessions[0] ? "Continue Playing" : "Browse Stories"}
          </Link>
          <Link className="btn btn-secondary" href="/author">
            Creator Studio
          </Link>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="kicker">Resume</p>
              <h2 className="mt-2 text-2xl font-semibold">Continue Playing</h2>
            </div>
            <Link className="btn btn-secondary" href="/sessions">
              My Sessions
            </Link>
          </div>

          {!loaded ? (
            <p className="mt-6 text-sm text-[var(--muted)]">Loading runs...</p>
          ) : null}

          {loaded && activeSessions.length > 0 ? (
            <div className="mt-5 grid gap-3">
              {activeSessions.map((session) => (
                <article className="subtle-card" key={session.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-[var(--accent)]">
                        {session.story.genre}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold">
                        {session.story.title}
                      </h3>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {formatSessionResumeLabel(session)}
                      </p>
                    </div>
                    <Link className="btn" href={`/play/${session.id}`}>
                      Continue
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {loaded && activeSessions.length === 0 ? (
            <div className="mt-5 panel">
              <p className="font-semibold">No active runs yet.</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Browse published stories and start a first session.
              </p>
              <Link className="btn mt-4" href="/stories">
                Browse Stories
              </Link>
            </div>
          ) : null}
        </section>

        <section className="card">
          <p className="kicker">Creator</p>
          <h2 className="mt-2 text-2xl font-semibold">My Stories</h2>
          <div className="mt-5 grid gap-3">
            {authorStories.slice(0, 4).map((story) => (
              <Link className="subtle-card block" href={`/author/stories/${story.id}`} key={story.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{story.title}</span>
                  <span className="badge">{story.status}</span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{story.genre}</p>
              </Link>
            ))}
            {loaded && authorStories.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No creator stories yet.
              </p>
            ) : null}
          </div>
          <Link className="btn btn-secondary mt-5" href="/author/stories/new">
            Create Story
          </Link>
        </section>
      </div>

      <section className="mt-6 card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="kicker">Discover</p>
            <h2 className="mt-2 text-2xl font-semibold">Published Stories</h2>
          </div>
          <Link className="btn btn-secondary" href="/stories">
            View All
          </Link>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {stories.map((story) => (
            <Link className="subtle-card block" href={`/stories/${story.slug}`} key={story.id}>
              <p className="badge badge-gold">{story.genre}</p>
              <h3 className="mt-3 text-lg font-semibold">{story.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                {story.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

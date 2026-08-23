"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  authRequest,
  type AuthorStoryListResponse,
  type AuthorStorySummary
} from "../../lib/api";

export default function AuthorDashboardPage() {
  const [stories, setStories] = useState<readonly AuthorStorySummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authRequest<AuthorStoryListResponse>("/author/stories")
      .then((result) => setStories(result.stories))
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Không tải được truyện.")
      )
      .finally(() => setLoaded(true));
  }, []);

  return (
    <main className="page-shell page-shell-wide">
      <header className="page-header">
        <div>
          <p className="kicker">Creator Studio</p>
          <h1 className="page-title">My Stories</h1>
          <p className="page-description mt-4">
            Manage drafts, revisions, versions, characters, abilities, and faction
            templates before publishing playable worlds.
          </p>
        </div>
        <Link className="btn" href="/author/stories/new">
          Create Story
        </Link>
      </header>

      {error ? <div className="panel alert-error">{error}</div> : null}
      {!loaded ? <p className="text-sm text-[var(--muted)]">Loading studio...</p> : null}

      {loaded && stories.length === 0 ? (
        <div className="panel">
          <p className="font-semibold">No stories yet.</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Start with a draft, add playable characters, abilities, factions, then
            validate and publish.
          </p>
          <Link className="btn mt-4" href="/author/stories/new">
            Create First Story
          </Link>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {stories.map((story) => (
          <article className="card" key={story.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="badge badge-gold">{story.genre}</p>
                <h2 className="mt-3 text-2xl font-semibold">{story.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">
                  {story.description}
                </p>
              </div>
              <span className="badge">{story.status}</span>
            </div>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-[var(--muted-2)]">
                  Live Version
                </dt>
                <dd className="mt-1 font-semibold">
                  {story.currentPublishedVersionId ? "Published" : "Not live"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-[var(--muted-2)]">
                  Updated
                </dt>
                <dd className="mt-1 font-semibold">
                  {new Date(story.updatedAt).toLocaleString()}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link className="btn" href={`/author/stories/${story.id}`}>
                Edit
              </Link>
              <Link className="btn btn-secondary" href={`/stories/${story.slug}`}>
                Preview
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

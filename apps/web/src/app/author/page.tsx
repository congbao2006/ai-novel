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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authRequest<AuthorStoryListResponse>("/author/stories")
      .then((result) => setStories(result.stories))
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Không tải được truyện.")
      );
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Authoring</h1>
          <p className="text-sm text-zinc-600">Quản lý draft, published và archived stories.</p>
        </div>
        <Link className="rounded bg-zinc-900 px-4 py-2 text-white" href="/author/stories/new">
          Tạo story
        </Link>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="grid gap-3">
        {stories.map((story) => (
          <Link
            className="rounded border border-zinc-200 p-4 hover:border-zinc-400"
            href={`/author/stories/${story.id}`}
            key={story.id}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-medium">{story.title}</h2>
              <span className="text-sm text-zinc-600">{story.status}</span>
            </div>
            <p className="mt-1 text-sm text-zinc-600">{story.genre}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}

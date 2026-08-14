import Link from "next/link";
import { apiRequest, type StoryListItem } from "../../lib/api";

type StoryListResponse = {
  readonly stories: StoryListItem[];
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
};

export default async function StoriesPage() {
  const data = await apiRequest<StoryListResponse>("/stories?limit=20", {
    cache: "no-store"
  });

  return (
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
              Stories
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Chọn thế giới</h1>
          </div>
          <Link className="auth-link" href="/sessions">
            Sessions
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {data.stories.map((story) => (
            <article key={story.id} className="surface-card">
              <p className="text-sm text-[var(--accent)]">{story.genre}</p>
              <h2 className="mt-2 text-xl font-semibold">{story.title}</h2>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
                {story.description}
              </p>
              <Link className="mt-5 inline-flex auth-link" href={`/stories/${story.slug}`}>
                Xem chi tiết
              </Link>
            </article>
          ))}
        </div>

        {data.stories.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--muted)]">
            Chưa có story published.
          </p>
        ) : null}
      </section>
    </main>
  );
}

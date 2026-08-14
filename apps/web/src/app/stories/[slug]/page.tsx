import Link from "next/link";
import { apiRequest, type StoryDetail } from "../../../lib/api";
import { StartSessionForm } from "./start-session-form";

type StoryDetailPageProps = {
  readonly params: Promise<{
    readonly slug: string;
  }>;
};

export default async function StoryDetailPage({ params }: StoryDetailPageProps) {
  const { slug } = await params;
  const story = await apiRequest<StoryDetail>(`/stories/${slug}`, {
    cache: "no-store"
  });

  return (
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto max-w-4xl">
        <Link className="text-sm text-[var(--accent)]" href="/stories">
          Back to stories
        </Link>
        <p className="mt-8 text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
          {story.genre}
        </p>
        <h1 className="mt-3 text-4xl font-semibold">{story.title}</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--muted)]">
          {story.description}
        </p>

        {story.characters.length > 0 ? (
          <StartSessionForm
            characters={story.characters}
            storyId={story.id}
            storySlug={story.slug}
          />
        ) : (
          <p className="mt-8 text-sm text-[var(--muted)]">
            Story này chưa có character template public.
          </p>
        )}
      </section>
    </main>
  );
}

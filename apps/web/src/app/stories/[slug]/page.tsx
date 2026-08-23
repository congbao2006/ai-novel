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
    <main className="page-shell">
      <section>
        <Link className="btn btn-secondary" href="/stories">
          Back to Stories
        </Link>
        <div className="mt-6 card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="kicker">{story.genre}</p>
              <h1 className="page-title">{story.title}</h1>
              <p className="page-description mt-5">{story.description}</p>
            </div>
            <div className="grid gap-2 text-right">
              <span className="badge badge-gold">Published</span>
              <span className="badge">v{story.storyVersionNumber}</span>
            </div>
          </div>
        </div>

        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Story areas">
          <a className="btn btn-secondary" href="#overview">
            Overview
          </a>
          <a className="btn" href="#play">
            Play
          </a>
          <span className="btn btn-secondary opacity-60">Read · Soon</span>
          <span className="btn btn-secondary opacity-60">Listen · Soon</span>
          <span className="btn btn-secondary opacity-60">Community · Soon</span>
        </nav>

        <section id="overview" className="mt-6 grid gap-4 md:grid-cols-2">
          {story.characters.map((character) => (
            <article className="subtle-card" key={character.id}>
              <span className="badge">Playable</span>
              <h2 className="mt-3 text-lg font-semibold">{character.name}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {character.description}
              </p>
            </article>
          ))}
        </section>

        {story.characters.length > 0 ? (
          <section id="play" className="mt-6">
            <StartSessionForm
              characters={story.characters}
              storyId={story.id}
              storySlug={story.slug}
            />
          </section>
        ) : (
          <p className="panel mt-6 text-sm text-[var(--muted)]">
            Story này chưa có character template public.
          </p>
        )}
      </section>
    </main>
  );
}

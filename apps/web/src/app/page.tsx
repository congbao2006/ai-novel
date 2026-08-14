export default function Home() {
  return (
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col justify-center">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
          Application skeleton
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-balance sm:text-6xl">
          AI Interactive Novel + RPG
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
          Frontend is running. Gameplay, payments, coin system, NPC engine, and
          live AI integration are intentionally not implemented yet.
        </p>
      </section>
    </main>
  );
}

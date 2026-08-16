"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { authRequest, type AuthorStoryDetail } from "../../../../lib/api";

export default function NewStoryPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const story = await authRequest<AuthorStoryDetail>("/author/stories", {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          genre: form.get("genre"),
          description: form.get("description")
        })
      });
      router.push(`/author/stories/${story.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tạo được story.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <h1 className="text-3xl font-semibold">Tạo story draft</h1>
      <form className="grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-1 text-sm">
          Title
          <input className="rounded border p-2" name="title" required />
        </label>
        <label className="grid gap-1 text-sm">
          Genre
          <input className="rounded border p-2" name="genre" required />
        </label>
        <label className="grid gap-1 text-sm">
          Description
          <textarea className="min-h-28 rounded border p-2" name="description" required />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Đang tạo..." : "Tạo draft"}
        </button>
      </form>
    </main>
  );
}

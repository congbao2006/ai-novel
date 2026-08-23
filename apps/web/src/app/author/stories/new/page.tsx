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
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="kicker">Creator Studio</p>
          <h1 className="page-title">Tạo story draft</h1>
          <p className="page-description mt-3">
            Start with public metadata, then add world instructions, characters,
            abilities, factions, validation, and published versions in the editor.
          </p>
        </div>
      </header>

      <form className="card grid gap-4" onSubmit={onSubmit}>
        <label className="field">
          <span>Title</span>
          <input className="input" name="title" required />
        </label>
        <label className="field">
          <span>Genre</span>
          <input className="input" name="genre" required />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea className="textarea min-h-28" name="description" required />
        </label>
        {error ? <p className="auth-error text-sm">{error}</p> : null}
        <button className="btn w-max" disabled={submitting} type="submit">
          {submitting ? "Đang tạo..." : "Tạo draft"}
        </button>
      </form>
    </main>
  );
}

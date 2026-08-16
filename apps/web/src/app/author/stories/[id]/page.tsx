"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  authRequest,
  type AuthorStoryDetail,
  type PublishValidationResponse
} from "../../../../lib/api";

export default function EditStoryPage({
  params
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const [storyId, setStoryId] = useState<string | null>(null);
  const [story, setStory] = useState<AuthorStoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    params.then((value) => setStoryId(value.id)).catch(() => setError("URL không hợp lệ."));
  }, [params]);

  useEffect(() => {
    if (!storyId) return;
    loadStory(storyId, setStory, setError);
  }, [storyId]);

  async function patchStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyId) return;
    const form = new FormData(event.currentTarget);
    await runAction(setError, setMessage, async () => {
      const updated = await authRequest<AuthorStoryDetail>(`/author/stories/${storyId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.get("title"),
          slug: form.get("slug"),
          genre: form.get("genre"),
          description: form.get("description"),
          worldPrompt: form.get("worldPrompt"),
          openingPrompt: form.get("openingPrompt"),
          settings: {
            initialLocation: form.get("initialLocation"),
            initialWorldTime: form.get("initialWorldTime")
          }
        })
      });
      setStory(updated);
    });
  }

  async function addCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyId) return;
    const form = new FormData(event.currentTarget);
    await runAction(setError, setMessage, async () => {
      await authRequest(`/author/stories/${storyId}/characters`, {
        method: "POST",
        body: JSON.stringify({
          type: form.get("type"),
          name: form.get("name"),
          description: form.get("description"),
          personality: form.get("personality"),
          background: form.get("background"),
          initialLocation: form.get("initialLocation") || null,
          initialStats: parseJsonObject(String(form.get("initialStats") || "{}")),
          goals: parseJsonArray(String(form.get("goals") || "[]")),
          secrets: parseJsonObject(String(form.get("secrets") || "{}"))
        })
      });
      await loadStory(storyId, setStory, setError);
      event.currentTarget.reset();
    });
  }

  async function addFaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyId) return;
    const form = new FormData(event.currentTarget);
    await runAction(setError, setMessage, async () => {
      await authRequest(`/author/stories/${storyId}/factions`, {
        method: "POST",
        body: JSON.stringify({
          factionKey: form.get("factionKey"),
          name: form.get("name"),
          description: form.get("description"),
          initialInfluence: Number(form.get("initialInfluence") || 50),
          initialStatus: form.get("initialStatus"),
          resources: parseJsonObject(String(form.get("resources") || "{}")),
          goals: parseJsonArray(String(form.get("goals") || "[]"))
        })
      });
      await loadStory(storyId, setStory, setError);
      event.currentTarget.reset();
    });
  }

  async function validateOrPublish(path: "validate" | "publish" | "archive") {
    if (!storyId) return;
    await runAction(setError, setMessage, async () => {
      const result = await authRequest<AuthorStoryDetail | PublishValidationResponse>(
        `/author/stories/${storyId}/${path}`,
        { method: "POST" }
      );
      if ("valid" in result) {
        setMessage(
          result.valid
            ? "Story hợp lệ để publish."
            : result.issues.map((issue) => `${issue.field}: ${issue.message}`).join("\n")
        );
      } else {
        setStory(result);
      }
    });
  }

  if (!story) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-6 py-8">
        <p>{error ?? "Đang tải..."}</p>
      </main>
    );
  }

  const locked = story.status !== "draft";
  const settings = story.settings;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-8">
      <header>
        <h1 className="text-3xl font-semibold">{story.title}</h1>
        <p className="text-sm text-zinc-600">Status: {story.status}</p>
      </header>

      {error ? <p className="whitespace-pre-wrap text-sm text-red-600">{error}</p> : null}
      {message ? <p className="whitespace-pre-wrap text-sm text-emerald-700">{message}</p> : null}

      <form className="grid gap-4 rounded border border-zinc-200 p-4" onSubmit={patchStory}>
        <h2 className="text-xl font-medium">Basic info</h2>
        <input className="rounded border p-2" defaultValue={story.title} name="title" />
        <input className="rounded border p-2" defaultValue={story.slug} name="slug" />
        <input className="rounded border p-2" defaultValue={story.genre} name="genre" />
        <textarea className="min-h-24 rounded border p-2" defaultValue={story.description} name="description" />

        <h2 className="text-xl font-medium">World</h2>
        <input
          className="rounded border p-2"
          defaultValue={String(settings.initialLocation ?? "")}
          disabled={locked}
          name="initialLocation"
          placeholder="Initial location"
        />
        <input
          className="rounded border p-2"
          defaultValue={String(settings.initialWorldTime ?? "")}
          disabled={locked}
          name="initialWorldTime"
          placeholder="Initial world time"
        />
        <textarea className="min-h-40 rounded border p-2" defaultValue={story.worldPrompt} disabled={locked} name="worldPrompt" />
        <textarea className="min-h-32 rounded border p-2" defaultValue={story.openingPrompt} disabled={locked} name="openingPrompt" />
        <button className="rounded bg-zinc-900 px-4 py-2 text-white" type="submit">
          Lưu story
        </button>
      </form>

      <section className="grid gap-4 rounded border border-zinc-200 p-4">
        <h2 className="text-xl font-medium">Characters</h2>
        <div className="grid gap-2">
          {story.characters.map((character) => (
            <div className="rounded border p-3 text-sm" key={character.id}>
              <strong>{character.name}</strong> ({character.type}) - {character.description}
            </div>
          ))}
        </div>
        {!locked ? (
          <form className="grid gap-2" onSubmit={addCharacter}>
            <select className="rounded border p-2" name="type">
              <option value="playable">playable</option>
              <option value="npc">npc</option>
            </select>
            <input className="rounded border p-2" name="name" placeholder="Name" required />
            <textarea className="rounded border p-2" name="description" placeholder="Description" required />
            <input className="rounded border p-2" name="personality" placeholder="Personality" />
            <input className="rounded border p-2" name="background" placeholder="Background" />
            <input className="rounded border p-2" name="initialLocation" placeholder="Initial location" />
            <textarea className="rounded border p-2" name="initialStats" placeholder='{"hp":100}' />
            <textarea className="rounded border p-2" name="goals" placeholder='[]' />
            <textarea className="rounded border p-2" name="secrets" placeholder='{}' />
            <button className="rounded bg-zinc-900 px-4 py-2 text-white" type="submit">Thêm character</button>
          </form>
        ) : null}
      </section>

      <section className="grid gap-4 rounded border border-zinc-200 p-4">
        <h2 className="text-xl font-medium">Factions</h2>
        <div className="grid gap-2">
          {story.factions.map((faction) => (
            <div className="rounded border p-3 text-sm" key={faction.id}>
              <strong>{faction.name}</strong> ({faction.factionKey}) - {faction.initialInfluence}
            </div>
          ))}
        </div>
        {!locked ? (
          <form className="grid gap-2" onSubmit={addFaction}>
            <input className="rounded border p-2" name="factionKey" placeholder="faction_key" required />
            <input className="rounded border p-2" name="name" placeholder="Name" required />
            <textarea className="rounded border p-2" name="description" placeholder="Description" required />
            <select className="rounded border p-2" name="initialStatus">
              <option value="active">active</option>
              <option value="weakened">weakened</option>
              <option value="collapsed">collapsed</option>
              <option value="hidden">hidden</option>
            </select>
            <input className="rounded border p-2" name="initialInfluence" placeholder="50" type="number" />
            <textarea className="rounded border p-2" name="resources" placeholder='{"wealth":50}' />
            <textarea className="rounded border p-2" name="goals" placeholder='[]' />
            <button className="rounded bg-zinc-900 px-4 py-2 text-white" type="submit">Thêm faction</button>
          </form>
        ) : null}
      </section>

      <section className="flex flex-wrap gap-3">
        <button className="rounded border px-4 py-2" onClick={() => validateOrPublish("validate")} type="button">
          Validate
        </button>
        {story.status === "draft" ? (
          <button className="rounded bg-emerald-700 px-4 py-2 text-white" onClick={() => validateOrPublish("publish")} type="button">
            Publish
          </button>
        ) : null}
        {story.status === "published" ? (
          <button className="rounded bg-zinc-900 px-4 py-2 text-white" onClick={() => validateOrPublish("archive")} type="button">
            Archive
          </button>
        ) : null}
      </section>
    </main>
  );
}

async function loadStory(
  storyId: string,
  setStory: (story: AuthorStoryDetail) => void,
  setError: (message: string | null) => void
) {
  try {
    setStory(await authRequest<AuthorStoryDetail>(`/author/stories/${storyId}`));
  } catch (reason) {
    setError(reason instanceof Error ? reason.message : "Không tải được story.");
  }
}

async function runAction(
  setError: (message: string | null) => void,
  setMessage: (message: string | null) => void,
  action: () => Promise<void>
) {
  setError(null);
  setMessage(null);
  try {
    await action();
    setMessage("Đã lưu.");
  } catch (reason) {
    setError(reason instanceof Error ? reason.message : "Thao tác thất bại.");
  }
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value || "{}") as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON object không hợp lệ.");
  }
  return parsed as Record<string, unknown>;
}

function parseJsonArray(value: string): unknown[] {
  const parsed = JSON.parse(value || "[]") as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("JSON array không hợp lệ.");
  }
  return parsed;
}

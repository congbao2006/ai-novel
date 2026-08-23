"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AuthorAbilitySection } from "../../../../components/author-ability-section";
import {
  ApiRequestError,
  authRequest,
  type AuthorStoryCharacter,
  type AuthorStoryDetail,
  type AuthorStoryVersionSnapshot,
  type PublishValidationIssue,
  type PublishValidationResponse
} from "../../../../lib/api";
import {
  formatValidationIssue,
  getValidationIssueSummary
} from "../../../../lib/authoring-validation";
import { getRevisionStatusCopy } from "../../../../lib/authoring-ui";
import { authorEditorSections } from "../../../../lib/product-navigation";

export default function EditStoryPage({
  params
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const [storyId, setStoryId] = useState<string | null>(null);
  const [story, setStory] = useState<AuthorStoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<
    readonly PublishValidationIssue[]
  >([]);
  const [versionSnapshots, setVersionSnapshots] = useState<
    Record<string, AuthorStoryVersionSnapshot>
  >({});
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    params
      .then((value) => setStoryId(value.id))
      .catch(() => setError("URL không hợp lệ."));
  }, [params]);

  useEffect(() => {
    if (!storyId) return;
    loadStory(storyId, setStory, setError);
  }, [storyId]);

  async function patchStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyId) return;
    const form = new FormData(event.currentTarget);
    await runAction(
      setError,
      setMessage,
      setValidationIssues,
      setIsWorking,
      async () => {
        const updated = await authRequest<AuthorStoryDetail>(
          `/author/stories/${storyId}`,
          {
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
          }
        );
        setStory(updated);
      }
    );
  }

  async function addCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyId) return;
    const form = new FormData(event.currentTarget);
    await runAction(
      setError,
      setMessage,
      setValidationIssues,
      setIsWorking,
      async () => {
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
      }
    );
  }

  async function updateCharacter(
    characterId: string,
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (!storyId) return;
    const form = new FormData(event.currentTarget);
    await runAction(
      setError,
      setMessage,
      setValidationIssues,
      setIsWorking,
      async () => {
        await authRequest(`/author/stories/${storyId}/characters/${characterId}`, {
          method: "PATCH",
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
      }
    );
  }

  async function addAbility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyId) return;
    const form = new FormData(event.currentTarget);
    await runAction(
      setError,
      setMessage,
      setValidationIssues,
      setIsWorking,
      async () => {
        const editableStory = await ensureEditableStory();
        if (!editableStory) return;
        const resourceStatKey = String(form.get("resourceStatKey") ?? "").trim();
        const resourceAmount = Number(form.get("resourceAmount") || 0);
        await authRequest(`/author/stories/${editableStory.id}/abilities`, {
          method: "POST",
          body: JSON.stringify({
            abilityKey: form.get("abilityKey"),
            name: form.get("name"),
            description: form.get("description"),
            category: form.get("category"),
            rank: Number(form.get("rank") || 1),
            cooldownTurns: Number(form.get("cooldownTurns") || 0),
            resourceCost: resourceStatKey
              ? { statKey: resourceStatKey, amount: resourceAmount }
              : null
          })
        });
        await loadStory(editableStory.id, setStory, setError);
        event.currentTarget.reset();
      }
    );
  }

  async function assignAbility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyId) return;
    const form = new FormData(event.currentTarget);
    const characterId = String(form.get("characterId") ?? "");
    await runAction(
      setError,
      setMessage,
      setValidationIssues,
      setIsWorking,
      async () => {
        const editableStory = await ensureEditableStory();
        if (!editableStory) return;
        await authRequest(
          `/author/stories/${editableStory.id}/characters/${characterId}/abilities`,
          {
            method: "POST",
            body: JSON.stringify({
              abilityId: form.get("abilityId"),
              rank: Number(form.get("rank") || 1)
            })
          }
        );
        await loadStory(editableStory.id, setStory, setError);
        event.currentTarget.reset();
      }
    );
  }

  async function saveCharacterAbilityAssignments(
    character: AuthorStoryCharacter,
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (!storyId) return;
    const form = new FormData(event.currentTarget);
    const selectedAbilityIds = new Set(
      form.getAll("abilityId").map((value) => String(value))
    );
    const assignedAbilityIds = new Set(
      character.assignedAbilities.map((ability) => ability.abilityId)
    );

    await runAction(
      setError,
      setMessage,
      setValidationIssues,
      setIsWorking,
      async () => {
        const editableStory = await ensureEditableStory();
        if (!editableStory) return;

        for (const abilityId of selectedAbilityIds) {
          if (!assignedAbilityIds.has(abilityId)) {
            await authRequest(
              `/author/stories/${editableStory.id}/characters/${character.id}/abilities`,
              {
                method: "POST",
                body: JSON.stringify({ abilityId, rank: 1 })
              }
            );
          }
        }

        for (const ability of character.assignedAbilities) {
          if (!selectedAbilityIds.has(ability.abilityId)) {
            await authRequest(
              `/author/stories/${editableStory.id}/characters/${character.id}/abilities/${ability.abilityId}`,
              { method: "DELETE" }
            );
          }
        }

        await loadStory(editableStory.id, setStory, setError);
        return "Ability assignments saved.";
      }
    );
  }

  async function deleteAbility(abilityId: string) {
    if (!storyId) return;
    await runAction(
      setError,
      setMessage,
      setValidationIssues,
      setIsWorking,
      async () => {
        const editableStory = await ensureEditableStory();
        if (!editableStory) return;
        await authRequest(`/author/stories/${editableStory.id}/abilities/${abilityId}`, {
          method: "DELETE"
        });
        await loadStory(editableStory.id, setStory, setError);
      }
    );
  }

  async function unassignAbility(characterId: string, abilityId: string) {
    if (!storyId) return;
    await runAction(
      setError,
      setMessage,
      setValidationIssues,
      setIsWorking,
      async () => {
        const editableStory = await ensureEditableStory();
        if (!editableStory) return;
        await authRequest(
          `/author/stories/${editableStory.id}/characters/${characterId}/abilities/${abilityId}`,
          { method: "DELETE" }
        );
        await loadStory(editableStory.id, setStory, setError);
      }
    );
  }

  async function addFaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storyId) return;
    const form = new FormData(event.currentTarget);
    await runAction(
      setError,
      setMessage,
      setValidationIssues,
      setIsWorking,
      async () => {
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
      }
    );
  }

  async function validateOrPublish(path: "validate" | "publish" | "archive") {
    if (!storyId) return;
    await runAction(
      setError,
      setMessage,
      setValidationIssues,
      setIsWorking,
      async () => {
        if (path === "validate" || path === "publish") {
          const validation = await authRequest<PublishValidationResponse>(
            `/author/stories/${storyId}/validate`,
            { method: "POST" }
          );
          setValidationIssues(validation.issues);
          if (!validation.valid) {
            return getValidationIssueSummary(false, validation.issues);
          }
        }

        const result = await authRequest<AuthorStoryDetail | PublishValidationResponse>(
          `/author/stories/${storyId}/${path}`,
          { method: "POST" }
        );
        if ("valid" in result) {
          setValidationIssues(result.issues);
          return getValidationIssueSummary(result.valid, result.issues);
        }
        setStory(result);
        return path === "publish" ? "Story đã publish." : "Đã lưu.";
      }
    );
  }

  async function createRevision() {
    if (!storyId) return;
    await runAction(
      setError,
      setMessage,
      setValidationIssues,
      setIsWorking,
      async () => {
        const updated = await authRequest<AuthorStoryDetail>(
          `/author/stories/${storyId}/revisions`,
          { method: "POST" }
        );
        setStory(updated);
      }
    );
  }

  async function inspectVersion(versionId: string) {
    if (!storyId) return;
    await runAction(
      setError,
      setMessage,
      setValidationIssues,
      setIsWorking,
      async () => {
        const snapshot = await authRequest<AuthorStoryVersionSnapshot>(
          `/author/stories/${storyId}/versions/${versionId}`
        );
        setVersionSnapshots((current) => ({
          ...current,
          [versionId]: snapshot
        }));
        return "Version snapshot loaded.";
      }
    );
  }

  async function ensureEditableStory(): Promise<AuthorStoryDetail | null> {
    if (!storyId) return null;
    if (story?.status === "draft") return story;
    const updated = await authRequest<AuthorStoryDetail>(
      `/author/stories/${storyId}/revisions`,
      { method: "POST" }
    );
    setStory(updated);
    return updated;
  }

  if (!story) {
    return (
      <main className="page-shell">
        <div className="panel">{error ?? "Đang tải story editor..."}</div>
      </main>
    );
  }

  const locked = story.status !== "draft";
  const settings = story.settings;
  const revisionStatus = getRevisionStatusCopy(story);

  return (
    <main className="page-shell page-shell-wide">
      <header className="page-header">
        <div>
          <p className="kicker">Story Editor</p>
          <h1 className="page-title">{story.title}</h1>
          <p className="page-description mt-3">
            Templates define initial conditions. Runtime sessions keep their own
            authoritative state and pinned story version.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-secondary" href="/author">
            Creator Studio
          </Link>
          <Link className="btn btn-secondary" href={`/stories/${story.slug}`}>
            Public Preview
          </Link>
        </div>
      </header>

      {error ? <div className="panel alert-error whitespace-pre-wrap">{error}</div> : null}
      {message ? (
        <div className="panel text-[var(--success)] whitespace-pre-wrap">{message}</div>
      ) : null}

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="kicker">Revision Status</p>
            <h2 className="mt-2 text-2xl font-semibold">
              {revisionStatus.statusLabel}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              LIVE: {revisionStatus.liveLabel} · {revisionStatus.workingLabel}
            </p>
          </div>
          {locked && story.status === "published" ? (
            <button className="btn" disabled={isWorking} onClick={createRevision} type="button">
              Create revision to edit
            </button>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="card h-max lg:sticky lg:top-6">
          <p className="kicker">Sections</p>
          <nav className="mt-4 grid gap-1" aria-label="Story editor sections">
            {authorEditorSections.map((section) => (
              <a className="nav-link" href={`#${section.id}`} key={section.id}>
                {section.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="grid gap-6">
          <form className="grid gap-6" onSubmit={patchStory}>
            <section className="card" id="overview">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="kicker">Overview</p>
                  <h2 className="mt-2 text-2xl font-semibold">Basic information</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="badge">{story.status}</span>
                  <span className="badge badge-gold">
                    {story.currentPublishedVersionNumber
                      ? `Live v${story.currentPublishedVersionNumber}`
                      : "No live version"}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="field">
                  <span>Title</span>
                  <input className="input" defaultValue={story.title} name="title" />
                </label>
                <label className="field">
                  <span>Slug</span>
                  <span className="field-hint">URL-safe identity for the public page.</span>
                  <input className="input" defaultValue={story.slug} name="slug" />
                </label>
                <label className="field">
                  <span>Genre</span>
                  <input className="input" defaultValue={story.genre} name="genre" />
                </label>
                <label className="field md:col-span-2">
                  <span>Public description</span>
                  <textarea
                    className="textarea min-h-28"
                    defaultValue={story.description}
                    name="description"
                  />
                </label>
              </div>
            </section>

            <section className="card" id="world">
              <p className="kicker">World</p>
              <h2 className="mt-2 text-2xl font-semibold">Runtime configuration</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Published versions snapshot these instructions. Existing sessions never
                drift when the working copy changes later.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="field">
                  <span>Initial location</span>
                  <input
                    className="input"
                    defaultValue={String(settings.initialLocation ?? "")}
                    disabled={locked}
                    name="initialLocation"
                  />
                </label>
                <label className="field">
                  <span>Initial world time</span>
                  <input
                    className="input"
                    defaultValue={String(settings.initialWorldTime ?? "")}
                    disabled={locked}
                    name="initialWorldTime"
                  />
                </label>
                <label className="field md:col-span-2">
                  <span>Internal world instructions</span>
                  <span className="field-hint">
                    Server-side story guidance. This is not exposed on public story pages.
                  </span>
                  <textarea
                    className="textarea min-h-48"
                    defaultValue={story.worldPrompt}
                    disabled={locked}
                    name="worldPrompt"
                  />
                </label>
                <label className="field md:col-span-2">
                  <span>Opening setup</span>
                  <textarea
                    className="textarea min-h-36"
                    defaultValue={story.openingPrompt}
                    disabled={locked}
                    name="openingPrompt"
                  />
                </label>
              </div>

              <div className="mt-5 flex justify-end">
                <button className="btn" disabled={isWorking} type="submit">
                  Lưu story
                </button>
              </div>
            </section>
          </form>

          <section className="card" id="characters">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="kicker">Characters</p>
                <h2 className="mt-2 text-2xl font-semibold">Playable and NPC templates</h2>
              </div>
              <span className="badge">{story.characters.length} templates</span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {story.characters.length > 0 ? (
                story.characters.map((character) => (
                  <article className="subtle-card" key={character.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-semibold">{character.name}</h3>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {character.description}
                        </p>
                      </div>
                      <span className="badge">{character.type}</span>
                    </div>
                    <dl className="mt-4 grid gap-2 text-xs text-[var(--muted)]">
                      <div>
                        <dt className="font-semibold text-[var(--foreground)]">
                          Initial location
                        </dt>
                        <dd>{character.initialLocation ?? "Story default"}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-[var(--foreground)]">
                          Abilities
                        </dt>
                        <dd>
                          {character.assignedAbilities.length > 0 ? (
                            <span className="grid gap-2">
                              {character.assignedAbilities.map((ability) => (
                                <span key={ability.abilityKey}>
                                  <span className="block font-semibold text-[var(--foreground)]">
                                    {ability.name}
                                  </span>
                                  <span>
                                    {ability.category} · Rank {ability.rank} ·
                                    Cooldown {ability.cooldownTurns}
                                  </span>
                                </span>
                              ))}
                            </span>
                          ) : (
                            "None assigned"
                          )}
                        </dd>
                      </div>
                    </dl>
                    {!locked ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a className="btn btn-secondary" href={`#edit-${character.id}`}>
                          Edit
                        </a>
                        <a
                          className="btn btn-secondary"
                          href={`#abilities-${character.id}`}
                        >
                          Manage Abilities
                        </a>
                      </div>
                    ) : null}
                    {locked ? null : (
                      <details className="mt-4 panel" id={`edit-${character.id}`}>
                        <summary className="cursor-pointer font-semibold">
                          Edit character
                        </summary>
                        <form
                          className="mt-4 grid gap-4"
                          onSubmit={(event) => updateCharacter(character.id, event)}
                        >
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="field">
                              <span>Type</span>
                              <select
                                className="select"
                                defaultValue={character.type}
                                name="type"
                              >
                                <option value="playable">playable</option>
                                <option value="npc">npc</option>
                              </select>
                            </label>
                            <label className="field">
                              <span>Name</span>
                              <input
                                className="input"
                                defaultValue={character.name}
                                name="name"
                                required
                              />
                            </label>
                            <label className="field md:col-span-2">
                              <span>Description</span>
                              <textarea
                                className="textarea"
                                defaultValue={character.description}
                                name="description"
                                required
                              />
                            </label>
                            <label className="field">
                              <span>Personality</span>
                              <input
                                className="input"
                                defaultValue={character.personality}
                                name="personality"
                              />
                            </label>
                            <label className="field">
                              <span>Initial location</span>
                              <input
                                className="input"
                                defaultValue={character.initialLocation ?? ""}
                                name="initialLocation"
                              />
                            </label>
                            <label className="field md:col-span-2">
                              <span>Background</span>
                              <textarea
                                className="textarea"
                                defaultValue={character.background}
                                name="background"
                              />
                            </label>
                            <label className="field">
                              <span>Initial stats JSON</span>
                              <textarea
                                className="textarea"
                                defaultValue={JSON.stringify(character.initialStats)}
                                name="initialStats"
                              />
                            </label>
                            <label className="field">
                              <span>Goals JSON array</span>
                              <textarea
                                className="textarea"
                                defaultValue={JSON.stringify(character.goals)}
                                name="goals"
                              />
                            </label>
                            <label className="field md:col-span-2">
                              <span>Secrets JSON object</span>
                              <textarea
                                className="textarea"
                                defaultValue={JSON.stringify(character.secrets)}
                                name="secrets"
                              />
                            </label>
                          </div>
                          <button className="btn w-max" disabled={isWorking} type="submit">
                            Save character
                          </button>
                        </form>
                      </details>
                    )}
                    {locked ? null : (
                      <details className="mt-4 panel" id={`abilities-${character.id}`}>
                        <summary className="cursor-pointer font-semibold">
                          Manage abilities
                        </summary>
                        <form
                          className="mt-4 grid gap-4"
                          onSubmit={(event) =>
                            saveCharacterAbilityAssignments(character, event)
                          }
                        >
                          <div className="grid gap-3">
                            {story.abilities.length > 0 ? (
                              story.abilities.map((ability) => {
                                const assigned = character.abilityKeys.includes(
                                  ability.abilityKey
                                );
                                return (
                                  <label className="subtle-card" key={ability.id}>
                                    <span className="flex items-start gap-3">
                                      <input
                                        defaultChecked={assigned}
                                        name="abilityId"
                                        type="checkbox"
                                        value={ability.id}
                                      />
                                      <span>
                                        <span className="block font-semibold">
                                          {ability.name}
                                        </span>
                                        <span className="block font-mono text-xs text-[var(--muted)]">
                                          {ability.abilityKey}
                                        </span>
                                        <span className="mt-2 block text-xs text-[var(--muted)]">
                                          {ability.category} · Rank {ability.rank} ·
                                          Cooldown {ability.cooldownTurns}
                                        </span>
                                      </span>
                                    </span>
                                  </label>
                                );
                              })
                            ) : (
                              <p className="text-sm text-[var(--muted)]">
                                Create an ability definition before assigning.
                              </p>
                            )}
                          </div>
                          <button className="btn w-max" disabled={isWorking} type="submit">
                            Save assignments
                          </button>
                        </form>
                      </details>
                    )}
                  </article>
                ))
              ) : (
                <div className="panel md:col-span-2">
                  No character templates yet. Add at least one playable character
                  before publishing.
                </div>
              )}
            </div>

            {!locked ? (
              <form className="mt-6 grid gap-4" onSubmit={addCharacter}>
                <h3 className="text-lg font-semibold">Create Character</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="field">
                    <span>Type</span>
                    <select className="select" name="type">
                      <option value="playable">playable</option>
                      <option value="npc">npc</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Name</span>
                    <input className="input" name="name" required />
                  </label>
                  <label className="field md:col-span-2">
                    <span>Description</span>
                    <textarea className="textarea" name="description" required />
                  </label>
                  <label className="field">
                    <span>Personality</span>
                    <input className="input" name="personality" />
                  </label>
                  <label className="field">
                    <span>Initial location</span>
                    <input className="input" name="initialLocation" />
                  </label>
                  <label className="field md:col-span-2">
                    <span>Background</span>
                    <textarea className="textarea" name="background" />
                  </label>
                  <label className="field">
                    <span>Initial stats JSON</span>
                    <textarea
                      className="textarea"
                      name="initialStats"
                      placeholder='{"hp":100}'
                    />
                  </label>
                  <label className="field">
                    <span>Goals JSON array</span>
                    <textarea className="textarea" name="goals" placeholder="[]" />
                  </label>
                  <label className="field md:col-span-2">
                    <span>Secrets JSON object</span>
                    <textarea className="textarea" name="secrets" placeholder="{}" />
                  </label>
                </div>
                <button className="btn w-max" disabled={isWorking} type="submit">
                  Thêm character
                </button>
              </form>
            ) : (
              <p className="mt-5 text-sm text-[var(--muted)]">
                LOCKED: Create revision to edit characters and ability assignments.
              </p>
            )}
          </section>

          <div id="abilities">
            <AuthorAbilitySection
              disabled={isWorking}
              handlers={{
                addAbility,
                assignAbility,
                createRevision,
                deleteAbility,
                unassignAbility
              }}
              story={story}
            />
          </div>

          <section className="card" id="factions">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="kicker">Factions</p>
                <h2 className="mt-2 text-2xl font-semibold">World powers</h2>
              </div>
              <span className="badge">{story.factions.length} factions</span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {story.factions.length > 0 ? (
                story.factions.map((faction) => (
                  <article className="subtle-card" key={faction.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-semibold">{faction.name}</h3>
                        <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                          {faction.factionKey}
                        </p>
                      </div>
                      <span className="badge">{faction.initialStatus}</span>
                    </div>
                    <p className="mt-3 text-sm text-[var(--muted)]">
                      {faction.description}
                    </p>
                    <p className="mt-3 text-sm font-semibold">
                      Influence {faction.initialInfluence}
                    </p>
                  </article>
                ))
              ) : (
                <div className="panel md:col-span-2">
                  No faction templates. Stories without factions are still playable.
                </div>
              )}
            </div>

            {!locked ? (
              <form className="mt-6 grid gap-4" onSubmit={addFaction}>
                <h3 className="text-lg font-semibold">Create Faction</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="field">
                    <span>Faction key</span>
                    <input className="input" name="factionKey" required />
                  </label>
                  <label className="field">
                    <span>Name</span>
                    <input className="input" name="name" required />
                  </label>
                  <label className="field md:col-span-2">
                    <span>Description</span>
                    <textarea className="textarea" name="description" required />
                  </label>
                  <label className="field">
                    <span>Status</span>
                    <select className="select" name="initialStatus">
                      <option value="active">active</option>
                      <option value="weakened">weakened</option>
                      <option value="collapsed">collapsed</option>
                      <option value="hidden">hidden</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Influence</span>
                    <input className="input" name="initialInfluence" type="number" />
                  </label>
                  <label className="field">
                    <span>Resources JSON object</span>
                    <textarea
                      className="textarea"
                      name="resources"
                      placeholder='{"wealth":50}'
                    />
                  </label>
                  <label className="field">
                    <span>Goals JSON array</span>
                    <textarea className="textarea" name="goals" placeholder="[]" />
                  </label>
                </div>
                <button className="btn w-max" disabled={isWorking} type="submit">
                  Thêm faction
                </button>
              </form>
            ) : null}
          </section>

          <section className="card" id="versions">
            <p className="kicker">Versions</p>
            <h2 className="mt-2 text-2xl font-semibold">Published snapshots</h2>
            <div className="mt-5 grid gap-3">
              {story.versions.length > 0 ? (
                story.versions.map((version) => (
                  <article className="subtle-card" key={version.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">v{version.versionNumber}</p>
                        <p className="text-xs text-[var(--muted)]">
                          Published {new Date(version.publishedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={
                            version.id === story.currentPublishedVersionId
                              ? "badge badge-ready"
                              : "badge"
                          }
                        >
                          {version.id === story.currentPublishedVersionId
                            ? "Live"
                            : version.status}
                        </span>
                        <button
                          className="btn btn-secondary"
                          disabled={isWorking}
                          onClick={() => inspectVersion(version.id)}
                          type="button"
                        >
                          Inspect snapshot
                        </button>
                      </div>
                    </div>
                    {versionSnapshots[version.id] ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {versionSnapshots[version.id]!.characters.map(
                          (character) => (
                            <div className="panel" key={character.id}>
                              <p className="font-semibold">{character.name}</p>
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                {character.type} ·{" "}
                                {character.initialLocation ?? "Story default"}
                              </p>
                              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-2)]">
                                Abilities
                              </p>
                              <div className="mt-2 grid gap-2 text-sm">
                                {character.assignedAbilities.length > 0 ? (
                                  character.assignedAbilities.map((ability) => (
                                    <span key={ability.abilityKey}>
                                      {ability.name} · {ability.category} · Rank{" "}
                                      {ability.rank}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[var(--muted)]">
                                    None assigned
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Chưa có published version.
                </p>
              )}
            </div>
          </section>

          <section className="card" id="publish">
            <p className="kicker">Publish</p>
            <h2 className="mt-2 text-2xl font-semibold">Validation and lifecycle</h2>
            {validationIssues.length > 0 ? (
              <div className="mt-5 panel">
                <h3 className="font-semibold text-[var(--danger)]">
                  Issues to fix
                </h3>
                <ul className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
                  {validationIssues.map((issue, index) => (
                    <li key={`${issue.field}-${issue.code ?? "issue"}-${index}`}>
                      {formatValidationIssue(issue)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-5 panel">
                Run validation to check basic info, world configuration, playable
                characters, ability references, and faction templates.
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="btn btn-secondary"
                disabled={isWorking}
                onClick={() => validateOrPublish("validate")}
                type="button"
              >
                Validate
              </button>
              {story.status === "draft" ? (
                <button
                  className="btn"
                  disabled={isWorking}
                  onClick={() => validateOrPublish("publish")}
                  type="button"
                >
                  Publish
                </button>
              ) : null}
              {story.status === "published" ? (
                <>
                  <button
                    className="btn"
                    disabled={isWorking}
                    onClick={createRevision}
                    type="button"
                  >
                    Create revision
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={isWorking}
                    onClick={() => validateOrPublish("archive")}
                    type="button"
                  >
                    Archive
                  </button>
                </>
              ) : null}
            </div>
          </section>
        </div>
      </div>
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
  setValidationIssues: (issues: readonly PublishValidationIssue[]) => void,
  setWorking: (working: boolean) => void,
  action: () => Promise<string | void>
) {
  setError(null);
  setMessage(null);
  setValidationIssues([]);
  setWorking(true);
  try {
    const successMessage = await action();
    setMessage(successMessage ?? "Đã lưu.");
  } catch (reason) {
    if (reason instanceof ApiRequestError && reason.issues) {
      setValidationIssues(reason.issues);
    }
    setError(reason instanceof Error ? reason.message : "Thao tác thất bại.");
  } finally {
    setWorking(false);
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

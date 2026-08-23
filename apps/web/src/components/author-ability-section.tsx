"use client";

import type { FormEvent } from "react";
import type { AuthorStoryAbility, AuthorStoryDetail } from "../lib/api";
import {
  canSubmitRuntimeAuthoringForm,
  getAssignedCharacterNamesForAbility,
  getAbilityAssignmentSubmitLabel,
  getAbilitySubmitLabel,
  requiresRevisionBeforeRuntimeEdit
} from "../lib/authoring-ui";

export type AbilitySectionHandlers = {
  readonly addAbility: (event: FormEvent<HTMLFormElement>) => void;
  readonly assignAbility: (event: FormEvent<HTMLFormElement>) => void;
  readonly deleteAbility: (abilityId: string) => void;
  readonly unassignAbility: (characterId: string, abilityId: string) => void;
  readonly createRevision: () => void;
};

export function AuthorAbilitySection({
  story,
  disabled,
  handlers
}: {
  readonly story: AuthorStoryDetail;
  readonly disabled: boolean;
  readonly handlers: AbilitySectionHandlers;
}) {
  const archived = story.status === "archived";
  const canSubmit = canSubmitRuntimeAuthoringForm(story.status);
  const needsRevision = requiresRevisionBeforeRuntimeEdit(story.status);
  const playableCharacters = story.characters.filter(
    (character) => character.type === "playable"
  );

  return (
    <section className="card grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="kicker">Abilities</p>
          <h2 className="mt-2 text-2xl font-semibold">Ability manager</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Define server-authoritative story abilities, then assign them to
            playable characters. Runtime sessions snapshot assignments at creation.
          </p>
          {needsRevision ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Thay đổi ability sẽ tạo working revision mới; phiên bản live hiện tại
              vẫn giữ nguyên cho các session đã tạo.
            </p>
          ) : null}
          {archived ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Story đã archived nên không thể chỉnh sửa ability.
            </p>
          ) : null}
        </div>
        {needsRevision ? (
          <button
            className="btn btn-secondary"
            disabled={disabled}
            onClick={handlers.createRevision}
            type="button"
          >
            Create revision
          </button>
        ) : null}
      </div>

      {story.abilities.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {story.abilities.map((ability) => (
            <AbilityRow
              ability={ability}
              assignedCharacterNames={getAssignedCharacterNamesForAbility(
                story.characters,
                ability.abilityKey
              )}
              disabled={disabled || archived}
              key={ability.id}
              onDelete={handlers.deleteAbility}
            />
          ))}
        </div>
      ) : (
        <div className="panel">
          <p className="font-semibold">No abilities yet.</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Create an ability such as Ảnh Bộ, then assign it to a playable character.
          </p>
        </div>
      )}

      {canSubmit ? (
        <>
          <form className="panel grid gap-4" onSubmit={handlers.addAbility}>
            <h3 className="text-lg font-semibold">Create Ability</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="field">
                <span>Key / slug</span>
                <span className="field-hint">Stable identity, e.g. shadow-step.</span>
                <input
                  className="input"
                  disabled={disabled}
                  name="abilityKey"
                  placeholder="shadow-step"
                  required
                />
              </label>
              <label className="field">
                <span>Display name</span>
                <input
                  className="input"
                  disabled={disabled}
                  name="name"
                  placeholder="Ảnh Bộ"
                  required
                />
              </label>
              <label className="field md:col-span-2">
                <span>Description</span>
                <textarea
                  className="textarea"
                  disabled={disabled}
                  name="description"
                  placeholder="Short player-facing description"
                />
              </label>
              <label className="field">
                <span>Category</span>
                <select className="select" disabled={disabled} name="category">
                  <option value="movement">movement</option>
                  <option value="combat">combat</option>
                  <option value="perception">perception</option>
                  <option value="social">social</option>
                  <option value="utility">utility</option>
                  <option value="magic">magic</option>
                  <option value="other">other</option>
                </select>
              </label>
              <label className="field">
                <span>Default rank</span>
                <input
                  className="input"
                  disabled={disabled}
                  name="rank"
                  placeholder="1"
                  type="number"
                />
              </label>
              <label className="field">
                <span>Cooldown turns</span>
                <input
                  className="input"
                  disabled={disabled}
                  name="cooldownTurns"
                  placeholder="2"
                  type="number"
                />
              </label>
              <label className="field">
                <span>Resource key</span>
                <input
                  className="input"
                  disabled={disabled}
                  name="resourceStatKey"
                  placeholder="stamina"
                />
              </label>
              <label className="field">
                <span>Resource cost</span>
                <input
                  className="input"
                  disabled={disabled}
                  name="resourceAmount"
                  placeholder="0"
                  type="number"
                />
              </label>
            </div>
            <button className="btn w-max" disabled={disabled} type="submit">
              {getAbilitySubmitLabel(story.status)}
            </button>
          </form>

          {story.abilities.length > 0 && playableCharacters.length > 0 ? (
            <form className="panel grid gap-4" onSubmit={handlers.assignAbility}>
              <h3 className="text-lg font-semibold">Assign Ability</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="field">
                  <span>Playable character</span>
                  <select className="select" disabled={disabled} name="characterId">
                    {playableCharacters.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.name} ({character.type})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Ability</span>
                  <select className="select" disabled={disabled} name="abilityId">
                    {story.abilities.map((ability) => (
                      <option key={ability.id} value={ability.id}>
                        {ability.name} ({ability.abilityKey})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Rank</span>
                  <input
                    className="input"
                    disabled={disabled}
                    name="rank"
                    placeholder="1"
                    type="number"
                  />
                </label>
              </div>
              <button className="btn btn-secondary w-max" disabled={disabled} type="submit">
                {getAbilityAssignmentSubmitLabel(story.status)}
              </button>
            </form>
          ) : null}

          {story.abilities.length > 0 && playableCharacters.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Cần ít nhất một playable character để gán ability.
            </p>
          ) : null}

          <AssignedAbilities
            abilities={story.abilities}
            disabled={disabled || archived}
            onUnassign={handlers.unassignAbility}
            story={story}
          />
        </>
      ) : null}
    </section>
  );
}

function AbilityRow({
  ability,
  assignedCharacterNames,
  disabled,
  onDelete
}: {
  readonly ability: AuthorStoryAbility;
  readonly assignedCharacterNames: readonly string[];
  readonly disabled: boolean;
  readonly onDelete: (abilityId: string) => void;
}) {
  const resourceCost = formatResourceCost(ability.resourceCost);

  return (
    <article className="subtle-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{ability.name}</p>
          <p className="mt-1 font-mono text-xs text-[var(--muted)]">
            {ability.abilityKey}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="badge">{ability.category}</span>
            <span className="badge">Rank {ability.rank}</span>
            <span className="badge">Cooldown {ability.cooldownTurns}</span>
            {resourceCost ? <span className="badge">Cost {resourceCost}</span> : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {ability.description || "Không có mô tả."}
          </p>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">
              Assigned to
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {assignedCharacterNames.length > 0
                ? assignedCharacterNames.join(", ")
                : "Nobody"}
            </p>
          </div>
        </div>
        <button
          className="btn btn-danger min-h-0 px-3 py-1 text-xs"
          disabled={disabled}
          onClick={() => onDelete(ability.id)}
          type="button"
        >
          Xóa
        </button>
      </div>
    </article>
  );
}

function AssignedAbilities({
  story,
  abilities,
  disabled,
  onUnassign
}: {
  readonly story: AuthorStoryDetail;
  readonly abilities: readonly AuthorStoryAbility[];
  readonly disabled: boolean;
  readonly onUnassign: (characterId: string, abilityId: string) => void;
}) {
  const abilitiesByKey = new Map(abilities.map((ability) => [ability.abilityKey, ability]));
  const assignedCharacters = story.characters.filter(
    (character) => character.assignedAbilities.length > 0
  );

  if (assignedCharacters.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <h3 className="text-lg font-semibold">Current assignments</h3>
      {assignedCharacters.map((character) => (
        <div className="subtle-card" key={character.id}>
          <p className="font-medium">{character.name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {character.assignedAbilities.map((assignment) => {
              const ability = abilitiesByKey.get(assignment.abilityKey);
              return (
                <span
                  className="badge"
                  key={`${character.id}-${assignment.abilityKey}`}
                >
                  {ability?.name ?? assignment.name}
                  {ability ? (
                    <button
                      className="text-xs text-[var(--danger)] disabled:text-[var(--muted-2)]"
                      disabled={disabled}
                      onClick={() => onUnassign(character.id, ability.id)}
                      type="button"
                    >
                      bỏ gán
                    </button>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatResourceCost(resourceCost: Record<string, unknown> | null): string {
  if (!resourceCost) return "";
  const statKey = typeof resourceCost.statKey === "string" ? resourceCost.statKey : "";
  const amount =
    typeof resourceCost.amount === "number" && Number.isFinite(resourceCost.amount)
      ? resourceCost.amount
      : null;
  if (!statKey || amount === null) return "";
  return `${amount} ${statKey}`;
}

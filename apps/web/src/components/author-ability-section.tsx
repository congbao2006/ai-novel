"use client";

import type { FormEvent } from "react";
import type { AuthorStoryAbility, AuthorStoryDetail } from "../lib/api";
import {
  canSubmitRuntimeAuthoringForm,
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
    <section className="grid gap-4 rounded border border-zinc-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium">Abilities</h2>
          {needsRevision ? (
            <p className="mt-1 text-sm text-zinc-600">
              Thay đổi ability sẽ tạo working revision mới; phiên bản live hiện tại
              vẫn giữ nguyên cho các session đã tạo.
            </p>
          ) : null}
          {archived ? (
            <p className="mt-1 text-sm text-zinc-600">
              Story đã archived nên không thể chỉnh sửa ability.
            </p>
          ) : null}
        </div>
        {needsRevision ? (
          <button
            className="rounded border px-4 py-2 text-sm"
            disabled={disabled}
            onClick={handlers.createRevision}
            type="button"
          >
            Create revision
          </button>
        ) : null}
      </div>

      {story.abilities.length > 0 ? (
        <div className="grid gap-2">
          {story.abilities.map((ability) => (
            <AbilityRow
              ability={ability}
              disabled={disabled || archived}
              key={ability.id}
              onDelete={handlers.deleteAbility}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-600">Chưa có ability nào.</p>
      )}

      {canSubmit ? (
        <>
          <form className="grid gap-2" onSubmit={handlers.addAbility}>
            <input
              className="rounded border p-2"
              disabled={disabled}
              name="abilityKey"
              placeholder="shadow-step"
              required
            />
            <input
              className="rounded border p-2"
              disabled={disabled}
              name="name"
              placeholder="Ảnh Bộ"
              required
            />
            <textarea
              className="rounded border p-2"
              disabled={disabled}
              name="description"
              placeholder="Description"
            />
            <select className="rounded border p-2" disabled={disabled} name="category">
              <option value="movement">movement</option>
              <option value="combat">combat</option>
              <option value="perception">perception</option>
              <option value="social">social</option>
              <option value="utility">utility</option>
              <option value="magic">magic</option>
              <option value="other">other</option>
            </select>
            <input
              className="rounded border p-2"
              disabled={disabled}
              name="rank"
              placeholder="1"
              type="number"
            />
            <input
              className="rounded border p-2"
              disabled={disabled}
              name="cooldownTurns"
              placeholder="2"
              type="number"
            />
            <input
              className="rounded border p-2"
              disabled={disabled}
              name="resourceStatKey"
              placeholder="Resource stat key, optional"
            />
            <input
              className="rounded border p-2"
              disabled={disabled}
              name="resourceAmount"
              placeholder="0"
              type="number"
            />
            <button
              className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-60"
              disabled={disabled}
              type="submit"
            >
              {getAbilitySubmitLabel(story.status)}
            </button>
          </form>

          {story.abilities.length > 0 && playableCharacters.length > 0 ? (
            <form className="grid gap-2" onSubmit={handlers.assignAbility}>
              <select className="rounded border p-2" disabled={disabled} name="characterId">
                {playableCharacters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name} ({character.type})
                  </option>
                ))}
              </select>
              <select className="rounded border p-2" disabled={disabled} name="abilityId">
                {story.abilities.map((ability) => (
                  <option key={ability.id} value={ability.id}>
                    {ability.name} ({ability.abilityKey})
                  </option>
                ))}
              </select>
              <input
                className="rounded border p-2"
                disabled={disabled}
                name="rank"
                placeholder="1"
                type="number"
              />
              <button
                className="rounded border px-4 py-2 disabled:opacity-60"
                disabled={disabled}
                type="submit"
              >
                {getAbilityAssignmentSubmitLabel(story.status)}
              </button>
            </form>
          ) : null}

          {story.abilities.length > 0 && playableCharacters.length === 0 ? (
            <p className="text-sm text-zinc-600">
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
  disabled,
  onDelete
}: {
  readonly ability: AuthorStoryAbility;
  readonly disabled: boolean;
  readonly onDelete: (abilityId: string) => void;
}) {
  const resourceCost = formatResourceCost(ability.resourceCost);

  return (
    <div className="rounded border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <strong>{ability.name}</strong> ({ability.abilityKey}) ·{" "}
          {ability.category} · cooldown {ability.cooldownTurns}
          {resourceCost ? ` · cost ${resourceCost}` : ""}
          <p className="mt-1 text-zinc-600">{ability.description}</p>
        </div>
        <button
          className="rounded border px-3 py-1 text-xs disabled:opacity-60"
          disabled={disabled}
          onClick={() => onDelete(ability.id)}
          type="button"
        >
          Xóa
        </button>
      </div>
    </div>
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
    (character) => character.abilityKeys.length > 0
  );

  if (assignedCharacters.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-medium">Ability assignments</h3>
      {assignedCharacters.map((character) => (
        <div className="rounded border p-3 text-sm" key={character.id}>
          <p className="font-medium">{character.name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {character.abilityKeys.map((abilityKey) => {
              const ability = abilitiesByKey.get(abilityKey);
              return (
                <span
                  className="inline-flex items-center gap-2 rounded border px-2 py-1"
                  key={`${character.id}-${abilityKey}`}
                >
                  {ability?.name ?? abilityKey}
                  {ability ? (
                    <button
                      className="text-xs text-red-700 disabled:text-zinc-400"
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

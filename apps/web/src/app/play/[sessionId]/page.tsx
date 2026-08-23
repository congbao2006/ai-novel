"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiRequestError,
  authRequest,
  type AbilityAttempt,
  type ConsequenceSummary,
  type Faction,
  type FactionListResponse,
  type GameMessage,
  type GameplayTurnResponse,
  type InventoryItem,
  type InventoryResponse,
  type Quest,
  type QuestListResponse,
  type SessionDetail
} from "../../../lib/api";
import {
  formatAbilityAttemptReason,
  formatResourceCost,
  readLatestAbilityAttempt,
  readRuntimeAbilities
} from "../../../lib/play-session-ui";

export default function PlayShellPage() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [action, setAction] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [consequences, setConsequences] = useState<ConsequenceSummary[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const debugEnabled =
    searchParams.get("debug") === "1" || process.env.NODE_ENV !== "production";

  useEffect(() => {
    if (!params.sessionId) {
      return;
    }

    loadSession();
  }, [params.sessionId]);

  async function loadSession() {
    setLoaded(false);
    setError(null);

    try {
      const result = await authRequest<SessionDetail>(
        `/sessions/${params.sessionId}`
      );
      setSession(result);
      setMessages(result.recentMessages);
      const [factionResult, questResult, inventoryResult] = await Promise.all([
        authRequest<FactionListResponse>(`/sessions/${params.sessionId}/factions`),
        authRequest<QuestListResponse>(`/sessions/${params.sessionId}/quests`),
        authRequest<InventoryResponse>(`/sessions/${params.sessionId}/inventory`)
      ]);
      setFactions(factionResult.factions);
      setQuests(questResult.quests);
      setInventory(inventoryResult.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setLoaded(true);
    }
  }

  async function submitAction(formData: FormData) {
    const nextAction = String(formData.get("action") ?? "");
    setError(null);
    setSubmitting(true);

    try {
      const result = await authRequest<GameplayTurnResponse>(
        `/sessions/${params.sessionId}/turns`,
        {
          method: "POST",
          body: JSON.stringify({ action: nextAction })
        }
      );

      setMessages((current) => [
        ...current,
        result.playerMessage,
        result.resultMessage
      ]);
      setConsequences([...(result.consequences ?? [])]);
      void refreshRuntimePanels();
      setSession((current) =>
        current
          ? {
              ...current,
              currentState: result.state,
              turnCount: Math.max(current.turnCount + 1, result.turnNumber)
            }
          : current
      );
      setAction("");
    } catch (caught) {
      setError(formatPlayError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshRuntimePanels() {
    try {
      const [factionResult, questResult, inventoryResult] = await Promise.all([
        authRequest<FactionListResponse>(`/sessions/${params.sessionId}/factions`),
        authRequest<QuestListResponse>(`/sessions/${params.sessionId}/quests`),
        authRequest<InventoryResponse>(`/sessions/${params.sessionId}/inventory`)
      ]);
      setFactions(factionResult.factions);
      setQuests(questResult.quests);
      setInventory(inventoryResult.items);
    } catch {
      // Runtime side panels are supplemental; gameplay UI should remain usable.
    }
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto max-w-5xl">
        <Link className="text-sm text-[var(--accent)]" href="/sessions">
          Back to sessions
        </Link>

        {!loaded ? (
          <p className="mt-8 text-sm text-[var(--muted)]">Loading session...</p>
        ) : null}

        {loaded && error ? (
          <div className="mt-8 muted-panel">
            <p className="text-sm text-[var(--muted)]">{error}</p>
            <Link className="mt-4 inline-flex auth-link" href="/login">
              Login
            </Link>
          </div>
        ) : null}

        {loaded && session ? (
          <div className="mt-8">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
              Play
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl font-semibold">{session.story.title}</h1>
              <span className="status-pill">{session.status}</span>
            </div>

            <SessionStatusPanel session={session} />

            <div className="mt-6 muted-panel">
              <p className="text-sm leading-6 text-[var(--muted)]">
                Gameplay engine đang xử lý ở server. Streaming chưa được bật.
              </p>
            </div>

            {session.currentState ? (
              <AbilityPanel stateData={session.currentState.stateData} />
            ) : null}

            {debugEnabled && session.currentState ? (
              <SessionDebugPanel session={session} />
            ) : null}

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="surface-card">
                <p className="text-sm text-[var(--muted)]">Nhân vật</p>
                <p className="mt-2 font-semibold">
                  {session.selectedCharacter?.name ?? "Chưa chọn"}
                </p>
              </div>
              <div className="surface-card">
                <p className="text-sm text-[var(--muted)]">Vị trí</p>
                <p className="mt-2 font-semibold">
                  {session.currentState?.location ?? "Chưa có state"}
                </p>
              </div>
              <div className="surface-card">
                <p className="text-sm text-[var(--muted)]">Turn</p>
                <p className="mt-2 font-semibold">{session.turnCount}</p>
              </div>
            </div>

            {factions.length > 0 ? (
              <section className="mt-6">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  Thế lực
                </h2>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {factions.map((faction) => (
                    <article className="surface-card" key={faction.id}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{faction.name}</p>
                        <span className="status-pill">{faction.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        Ảnh hưởng {faction.influence}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {quests.length > 0 ? (
              <section className="mt-6">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  Nhiệm vụ
                </h2>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {quests.map((quest) => (
                    <article className="surface-card" key={quest.questKey}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{quest.title}</p>
                        <span className="status-pill">{quest.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {quest.description}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {inventory.length > 0 ? (
              <section className="mt-6">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  Túi đồ
                </h2>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {inventory.map((item) => (
                    <article className="surface-card" key={item.itemKey}>
                      <p className="text-sm font-semibold">{item.name}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        Số lượng {item.quantity}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {consequences.length > 0 ? (
              <div className="mt-6 grid gap-2">
                {consequences.map((item, index) => (
                  <div
                    className="muted-panel"
                    key={`${item.type}-${item.title}-${index}`}
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                      {item.type}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              {messages.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  Chưa có hành động nào trong session này.
                </p>
              ) : null}
              {messages.map((message) => (
                <article key={message.id} className="muted-panel">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                    {message.role} · turn {message.turnNumber}
                  </p>
                  <p className="mt-2 text-sm leading-6">{message.content}</p>
                  {message.abilityAttempt ? (
                    <AbilityAttemptCard attempt={message.abilityAttempt} />
                  ) : null}
                </article>
              ))}
            </div>

            <form action={submitAction} className="mt-6 grid gap-3">
              <label className="grid gap-2 text-sm text-[var(--muted)]">
                Action
                <textarea
                  className="action-input"
                  maxLength={2000}
                  name="action"
                  onChange={(event) => setAction(event.target.value)}
                  placeholder="quan sát, nghỉ, đi Chợ Đông, trạng thái..."
                  required
                  rows={4}
                  value={action}
                />
              </label>
              {error ? <p className="auth-error">{error}</p> : null}
              <button
                className="auth-link justify-self-start"
                disabled={submitting || action.trim().length === 0}
                type="submit"
              >
                {submitting ? "Đang xử lý..." : "Gửi action"}
              </button>
            </form>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function SessionStatusPanel({ session }: { readonly session: SessionDetail }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Session Status
      </h2>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <StatusCard label="Story" value={session.story.title} />
        <StatusCard label="Session" value={session.status} />
        <StatusCard
          label="Playable character"
          value={session.selectedCharacter?.name ?? "Chưa chọn"}
        />
        <StatusCard
          label="Current location"
          value={session.currentState?.location ?? "Chưa có state"}
        />
        <StatusCard label="Current turn" value={String(session.turnCount)} />
        <StatusCard
          label="Story version"
          value={
            session.storyVersionNumber
              ? `v${session.storyVersionNumber}`
              : "Legacy/unknown"
          }
        />
      </div>
    </section>
  );
}

function StatusCard({
  label,
  value
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <article className="surface-card">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
    </article>
  );
}

function AbilityPanel({
  stateData
}: {
  readonly stateData: Record<string, unknown>;
}) {
  const abilities = readRuntimeAbilities(stateData);
  if (abilities.length === 0) {
    return null;
  }

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Abilities
      </h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {abilities.map((ability) => (
          <article className="surface-card" key={ability.abilityKey}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{ability.name}</p>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                  {ability.abilityKey}
                </p>
              </div>
              <span className="status-pill">{ability.status}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {ability.description || "Không có mô tả."}
            </p>
            <div className="mt-3 grid gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
              <p>Type: {ability.category}</p>
              <p>Rank: {ability.rank}</p>
              <p>Cooldown: {ability.currentCooldown}/{ability.cooldownTurns}</p>
              <p>Resource: {formatResourceCost(ability.resourceCost)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AbilityAttemptCard({
  attempt
}: {
  readonly attempt: AbilityAttempt;
}) {
  return (
    <div className="mt-3 rounded border border-[var(--border)] p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="status-pill">
          {attempt.authorized ? "AUTHORIZED" : formatAbilityAttemptReason(attempt.reason)}
        </span>
        <span className="font-semibold">
          {attempt.abilityName ?? attempt.requestedName ?? "Ability attempt"}
        </span>
        {attempt.abilityKey ? (
          <span className="font-mono text-[var(--muted)]">{attempt.abilityKey}</span>
        ) : null}
      </div>
      {attempt.authorized ? (
        <p className="mt-2 text-[var(--muted)]">
          Cooldown applied: {attempt.cooldownApplied ?? 0}. Resource cost:{" "}
          {formatResourceCost(attempt.resourceCost)}.
        </p>
      ) : (
        <p className="mt-2 text-[var(--muted)]">
          Attempted: {attempt.requestedName ?? attempt.requestedKey ?? "unknown"}.
          No ability was granted and no ability state was mutated.
        </p>
      )}
    </div>
  );
}

function SessionDebugPanel({ session }: { readonly session: SessionDetail }) {
  const stateData = session.currentState?.stateData ?? {};
  const abilities = readRuntimeAbilities(stateData);
  const latestAttempt = readLatestAbilityAttempt(stateData);

  return (
    <details className="mt-6 muted-panel">
      <summary className="cursor-pointer text-sm font-semibold">
        Developer/debug
      </summary>
      <div className="mt-4 grid gap-3 text-xs text-[var(--muted)]">
        <p>Session ID: {session.id}</p>
        <p>Story version ID: {session.storyVersionId ?? "unknown"}</p>
        <p>Story version number: {session.storyVersionNumber ?? "unknown"}</p>
        <p>Character ID: {session.selectedCharacter?.id ?? "unknown"}</p>
        <p>Authoritative ability count: {abilities.length}</p>
        <pre className="overflow-auto rounded border border-[var(--border)] p-3">
          {JSON.stringify(stateData.abilities ?? null, null, 2)}
        </pre>
        <pre className="overflow-auto rounded border border-[var(--border)] p-3">
          {JSON.stringify(latestAttempt, null, 2)}
        </pre>
      </div>
    </details>
  );
}

function formatPlayError(caught: unknown): string {
  if (caught instanceof ApiRequestError && caught.statusCode === 409) {
    return "Phiên chơi vừa được cập nhật ở nơi khác. Hãy tải lại.";
  }

  if (
    caught instanceof ApiRequestError &&
    caught.errorCode === "ai_budget_exceeded"
  ) {
    return "Bạn đã đạt giới hạn sử dụng AI hiện tại.";
  }

  return caught instanceof Error ? caught.message : "Request failed.";
}

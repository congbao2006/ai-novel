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
    <main className="page-shell page-shell-wide">
      <section>
        <Link className="btn btn-secondary" href="/sessions">
          Back to Sessions
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
          <div className="mt-6">
            <header className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="kicker">Interactive RPG Session</p>
                  <h1 className="mt-2 text-3xl font-semibold">
                    {session.story.title}
                  </h1>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {session.selectedCharacter?.name ?? "Chưa chọn"} ·{" "}
                    {session.currentState?.location ?? "Unknown location"} · turn{" "}
                    {session.turnCount}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="badge">{session.status}</span>
                  <span className="badge badge-gold">
                    v{session.storyVersionNumber ?? "?"}
                  </span>
                  <Link className="btn btn-secondary" href={`/stories/${session.story.slug}`}>
                    Back to Story
                  </Link>
                </div>
              </div>
            </header>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <section className="grid gap-5">
                <div className="card">
                  <p className="kicker">Narrative Timeline</p>
                  <div className="mt-6 grid gap-7">
                    {messages.length === 0 ? (
                      <div className="panel">
                        <p className="font-semibold">No turns yet.</p>
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          Type an action below to begin this run.
                        </p>
                      </div>
                    ) : null}
                    {groupMessagesByTurn(messages).map((turn) => (
                      <article className="border-l border-[var(--border)] pl-5" key={turn.turnNumber}>
                        <p className="kicker">Turn {turn.turnNumber}</p>
                        {turn.player ? (
                          <div className="mt-3 subtle-card">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                              You
                            </p>
                            <p className="mt-2 text-sm leading-7">
                              “{turn.player.content}”
                            </p>
                            {turn.player.abilityAttempt ? (
                              <AbilityAttemptCard attempt={turn.player.abilityAttempt} />
                            ) : null}
                          </div>
                        ) : null}
                        {turn.assistant ? (
                          <div className="mt-3">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
                              Narrator
                            </p>
                            <p className="timeline-prose mt-2">
                              {turn.assistant.content}
                            </p>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>

                {consequences.length > 0 ? (
                  <section className="card">
                    <p className="kicker">Latest Consequences</p>
                    <div className="mt-4 grid gap-2">
                      {consequences.map((item, index) => (
                        <div className="subtle-card" key={`${item.type}-${item.title}-${index}`}>
                          <p className="badge">{item.type}</p>
                          <p className="mt-2 text-sm font-semibold">{item.title}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {item.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <form action={submitAction} className="sticky bottom-4 z-20 card">
                  <label className="field">
                    <span>Action</span>
                    <span className="field-hint">
                      Try: quan sát, trạng thái, nghỉ, đi Chợ Đông, or a character action.
                    </span>
                    <textarea
                      className="action-input"
                      maxLength={2000}
                      name="action"
                      onChange={(event) => setAction(event.target.value)}
                      placeholder="Tôi bước vào màn sương và hỏi Lý Thanh về dấu hiệu lạ..."
                      required
                      rows={4}
                      value={action}
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                      <button className="btn btn-secondary" onClick={() => setAction("quan sát")} type="button">
                        Observe
                      </button>
                      <button className="btn btn-secondary" onClick={() => setAction("trạng thái")} type="button">
                        Status
                      </button>
                    </div>
                    <button
                      className="btn"
                      disabled={submitting || action.trim().length === 0}
                      type="submit"
                    >
                      {submitting ? "World is responding..." : "Send Action"}
                    </button>
                  </div>
                  {error ? <p className="auth-error mt-3">{error}</p> : null}
                </form>
              </section>

              <aside className="grid content-start gap-4">
                <SessionStatusPanel session={session} />
                {session.currentState ? (
                  <AbilityPanel stateData={session.currentState.stateData} />
                ) : null}
                <RuntimePanel
                  factions={factions}
                  inventory={inventory}
                  quests={quests}
                />
                {debugEnabled && session.currentState ? (
                  <SessionDebugPanel session={session} />
                ) : null}
              </aside>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function SessionStatusPanel({ session }: { readonly session: SessionDetail }) {
  return (
    <section className="card">
      <h2 className="kicker">
        Session Status
      </h2>
      <div className="mt-3 grid gap-3">
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
    <article className="subtle-card">
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
    <section className="card">
      <h2 className="kicker">
        Abilities
      </h2>
      <div className="mt-3 grid gap-3">
        {abilities.map((ability) => (
          <article className="subtle-card" key={ability.abilityKey}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{ability.name}</p>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                  {ability.abilityKey}
                </p>
              </div>
              <span className={ability.status === "READY" ? "badge badge-ready" : "badge"}>
                {ability.status}
              </span>
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

function RuntimePanel({
  factions,
  quests,
  inventory
}: {
  readonly factions: Faction[];
  readonly quests: Quest[];
  readonly inventory: InventoryItem[];
}) {
  return (
    <section className="card">
      <p className="kicker">World State</p>

      <div className="mt-4 grid gap-5">
        <div>
          <h3 className="font-semibold">Quests</h3>
          <div className="mt-2 grid gap-2">
            {quests.length > 0 ? (
              quests.map((quest) => (
                <article className="subtle-card" key={quest.questKey}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{quest.title}</p>
                    <span className="badge">{quest.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {quest.description}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No active quest data.</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold">Factions</h3>
          <div className="mt-2 grid gap-2">
            {factions.length > 0 ? (
              factions.map((faction) => (
                <article className="subtle-card" key={faction.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{faction.name}</p>
                    <span className="badge">{faction.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Influence {faction.influence}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No faction runtime rows.</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold">Inventory</h3>
          <div className="mt-2 grid gap-2">
            {inventory.length > 0 ? (
              inventory.map((item) => (
                <article className="subtle-card" key={item.itemKey}>
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Quantity {item.quantity}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">Inventory is empty.</p>
            )}
          </div>
        </div>
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

function groupMessagesByTurn(messages: GameMessage[]): {
  readonly turnNumber: number;
  readonly player: GameMessage | null;
  readonly assistant: GameMessage | null;
}[] {
  const turns = new Map<
    number,
    { turnNumber: number; player: GameMessage | null; assistant: GameMessage | null }
  >();

  for (const message of messages) {
    const existing =
      turns.get(message.turnNumber) ?? {
        turnNumber: message.turnNumber,
        player: null,
        assistant: null
      };
    if (message.role === "player") {
      existing.player = message;
    }
    if (message.role === "assistant") {
      existing.assistant = message;
    }
    turns.set(message.turnNumber, existing);
  }

  return [...turns.values()].sort((left, right) => left.turnNumber - right.turnNumber);
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

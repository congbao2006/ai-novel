"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiRequestError,
  authRequest,
  type GameMessage,
  type GameplayTurnResponse,
  type SessionDetail
} from "../../../lib/api";

export default function PlayShellPage() {
  const params = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [action, setAction] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
              Play shell
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl font-semibold">{session.story.title}</h1>
              <span className="status-pill">{session.status}</span>
            </div>

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

            <div className="mt-6 muted-panel">
              <p className="text-sm leading-6 text-[var(--muted)]">
                Gameplay engine đang xử lý ở server. Streaming chưa được bật.
              </p>
            </div>

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

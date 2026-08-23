"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authRequest, type CurrentUser } from "../lib/api";

let currentUserRequest: Promise<CurrentUser | null> | null = null;

export function AuthStatus({ compact = false }: { readonly compact?: boolean }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCurrentUserOnce()
      .then((result) => setUser(result))
      .catch(() => setUser(null))
      .finally(() => setLoaded(true));
  }, []);

  async function logout() {
    setBusy(true);
    try {
      await authRequest("/auth/logout", { method: "POST" });
      currentUserRequest = null;
      setUser(null);
      window.location.href = "/login";
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <p className={compact ? "text-xs text-[var(--muted)]" : "mt-8 text-sm text-[var(--muted)]"}>
        Checking session...
      </p>
    );
  }

  if (user) {
    return (
      <div className={compact ? "grid gap-2" : "mt-8 grid gap-3 text-sm"}>
        <div>
          <p className="text-xs text-[var(--muted)]">Signed in</p>
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
            {user.displayName || user.email}
          </p>
        </div>
        <button
          className="btn btn-secondary min-h-0 px-3 py-2 text-xs"
          disabled={busy}
          onClick={logout}
          type="button"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className={compact ? "grid gap-2 text-sm" : "mt-8 flex gap-3 text-sm"}>
      <Link className={compact ? "btn btn-secondary min-h-0 px-3 py-2 text-xs" : "auth-link"} href="/login">
        Login
      </Link>
      <Link className={compact ? "btn min-h-0 px-3 py-2 text-xs" : "auth-link"} href="/register">
        Register
      </Link>
    </div>
  );
}

function getCurrentUserOnce(): Promise<CurrentUser | null> {
  currentUserRequest ??= authRequest<{ user: CurrentUser }>("/auth/me")
    .then((result) => result.user)
    .catch(() => null)
    .finally(() => {
      currentUserRequest = null;
    });

  return currentUserRequest;
}

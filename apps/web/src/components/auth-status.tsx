"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authRequest, type CurrentUser } from "../lib/api";

export function AuthStatus() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    authRequest<{ user: CurrentUser }>("/auth/me")
      .then((result) => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return <p className="mt-8 text-sm text-[var(--muted)]">Checking session...</p>;
  }

  if (user) {
    return (
      <p className="mt-8 text-sm text-[var(--muted)]">
        Signed in as <span className="text-[var(--foreground)]">{user.email}</span>
      </p>
    );
  }

  return (
    <div className="mt-8 flex gap-3 text-sm">
      <Link className="auth-link" href="/login">
        Login
      </Link>
      <Link className="auth-link" href="/register">
        Register
      </Link>
    </div>
  );
}

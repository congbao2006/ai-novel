"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authRequest } from "../lib/api";

type AuthFormProps = {
  readonly mode: "login" | "register";
  readonly nextPath?: string | undefined;
};

export function AuthForm({ mode, nextPath }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setError(null);
    setLoading(true);

    try {
      const payload =
        mode === "register"
          ? {
              email: String(formData.get("email") ?? ""),
              password: String(formData.get("password") ?? ""),
              displayName: String(formData.get("displayName") ?? "")
            }
          : {
              email: String(formData.get("email") ?? ""),
              password: String(formData.get("password") ?? "")
            };

      await authRequest(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      router.push(nextPath && nextPath.startsWith("/") ? nextPath : "/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={submit} className="auth-form">
      {mode === "register" ? (
        <label>
          Display name
          <input name="displayName" required minLength={2} maxLength={80} />
        </label>
      ) : null}
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <label>
        Password
        <input name="password" type="password" required minLength={8} />
      </label>
      {error ? <p className="auth-error">{error}</p> : null}
      <button disabled={loading} type="submit">
        {loading ? "Please wait..." : mode === "register" ? "Register" : "Login"}
      </button>
    </form>
  );
}

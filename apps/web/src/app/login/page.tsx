import Link from "next/link";
import { AuthForm } from "../../components/auth-form";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="auth-kicker">AI Novel</p>
        <h1>Login</h1>
        <AuthForm mode="login" />
        <p className="auth-alt">
          No account yet? <Link href="/register">Register</Link>
        </p>
      </section>
    </main>
  );
}

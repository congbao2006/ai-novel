import Link from "next/link";
import { AuthForm } from "../../components/auth-form";

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="auth-kicker">AI Novel</p>
        <h1>Register</h1>
        <AuthForm mode="register" />
        <p className="auth-alt">
          Already have an account? <Link href="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}

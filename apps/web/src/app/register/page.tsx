import Link from "next/link";
import { AuthForm } from "../../components/auth-form";

type RegisterPageProps = {
  readonly searchParams: Promise<{
    readonly next?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { next } = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="auth-kicker">AI Novel</p>
        <h1>Register</h1>
        <AuthForm mode="register" nextPath={next} />
        <p className="auth-alt">
          Already have an account?{" "}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}

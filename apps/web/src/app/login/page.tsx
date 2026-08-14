import Link from "next/link";
import { AuthForm } from "../../components/auth-form";

type LoginPageProps = {
  readonly searchParams: Promise<{
    readonly next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="auth-kicker">AI Novel</p>
        <h1>Login</h1>
        <AuthForm mode="login" nextPath={next} />
        <p className="auth-alt">
          No account yet?{" "}
          <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}>
            Register
          </Link>
        </p>
      </section>
    </main>
  );
}

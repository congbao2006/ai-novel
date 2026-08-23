import Link from "next/link";
import { productNavGroups } from "../lib/product-navigation";
import { AuthStatus } from "./auth-status";

export function AppShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link aria-label="AI Novel home" className="grid gap-1" href="/">
          <span className="text-xl font-black tracking-wide">AI Novel</span>
          <span className="text-xs text-[var(--muted)]">
            Interactive RPG Studio
          </span>
        </Link>

        <nav className="grid gap-5" aria-label="Primary navigation">
          {productNavGroups.map((group) => (
            <div className="grid gap-2" key={group.title}>
              <p className="nav-section-title">{group.title}</p>
              <div className="grid gap-1">
                {group.links.map((link) =>
                  link.disabled ? (
                    <span
                      className="nav-link nav-link-disabled"
                      key={`${group.title}-${link.label}`}
                    >
                      {link.label}
                      <span className="text-[0.65rem]">Soon</span>
                    </span>
                  ) : (
                    <Link className="nav-link" href={link.href} key={link.label}>
                      {link.label}
                    </Link>
                  )
                )}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto">
          <AuthStatus compact />
        </div>
      </aside>

      <div className="app-content">
        <header className="mobile-topbar">
          <div className="flex items-center justify-between gap-3">
            <Link className="font-black" href="/">
              AI Novel
            </Link>
            <AuthStatus compact />
          </div>
          <nav className="mobile-nav" aria-label="Mobile navigation">
            <Link className="nav-link" href="/stories">
              Stories
            </Link>
            <Link className="nav-link" href="/sessions">
              Sessions
            </Link>
            <Link className="nav-link" href="/author">
              Studio
            </Link>
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}

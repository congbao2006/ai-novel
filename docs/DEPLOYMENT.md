# Deployment

## MVP Topology

Recommended production topology:

```text
Browser
  -> Web app (Vercel or equivalent Next.js host)
  -> API (long-running Node.js/Fastify service)
  -> Managed PostgreSQL with pgvector support
  -> External AI provider
```

The web app only receives public configuration such as `NEXT_PUBLIC_API_URL`. The API owns authentication, session cookies, database access, AI provider credentials, usage budgets, story runtime snapshots, and all game-state mutation.

## Prerequisites

- Node.js 22 and pnpm 11 for builds.
- Managed PostgreSQL with the `vector` extension available when semantic memory is enabled.
- A runtime for the API that supports long-running Node.js processes and graceful `SIGTERM`.
- A secret manager or platform environment variables for all server-side secrets.

## Environment Variables

Required in production:

- `NODE_ENV=production`
- `WEB_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `DATABASE_URL`
- `AUTH_COOKIE_NAME`
- `AUTH_SESSION_TTL_SECONDS`
- `API_ALLOWED_ORIGINS`

Required only when enabled:

- `AI_PROVIDER=openai` requires `OPENAI_API_KEY` and `OPENAI_MODEL`.
- `GAMEPLAY_ENGINE_MODE=ai` requires a configured AI provider.
- `MEMORY_SEMANTIC_SEARCH_ENABLED=true` requires `AI_EMBEDDING_PROVIDER`, `OPENAI_EMBEDDING_MODEL`, and provider credentials.
- Any enabled AI budget requires matching model pricing in `AI_MODEL_PRICING_JSON`.

Operational knobs:

- `DATABASE_POOL_MAX`
- `DATABASE_POOL_IDLE_TIMEOUT_MS`
- `DATABASE_POOL_CONNECTION_TIMEOUT_MS`
- `API_BODY_LIMIT_BYTES`
- `API_SLOW_REQUEST_THRESHOLD_MS`
- `API_SLOW_AI_REQUEST_THRESHOLD_MS`
- `LOG_LEVEL`

Never set `NEXT_PUBLIC_OPENAI_API_KEY` or expose provider keys to the web app.

## Build

Install and validate:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:structure
```

Build commands:

```bash
pnpm build
pnpm --filter @ai-novel/api start
```

The API also has a production Dockerfile at `apps/api/Dockerfile` for container hosts. The web app is expected to run on Vercel or an equivalent Next.js platform unless a future deployment target requires containerization.

## Database Migrations

Migrations are never run automatically during API startup.

Deploy order:

1. Confirm managed database backups/PITR are enabled.
2. Apply migrations with `pnpm db:migrate`.
3. Check migration/schema state with `pnpm db:status`.
4. Run required backfills when applicable.
5. Start or roll the API service.
6. Run health/readiness and smoke checks.

Known backfills:

- `pnpm story:version-backfill`: creates baseline story versions for legacy published stories/sessions.
- `pnpm memory:embed-backfill`: embeds active persistent memories for the configured embedding provider/model.

Backfills are explicit and should not be run automatically at application startup.

## Health And Readiness

- `GET /health` checks that the API process is alive. It does not require database access.
- `GET /ready` checks critical dependencies, currently database reachability and pgvector availability when semantic memory is enabled.

Readiness responses never expose connection strings, API keys, cookies, or provider internals.

## CORS, Cookies, And CSRF

Use an explicit same-site deployment when possible:

- Web: `https://app.example.com`
- API: `https://api.example.com`
- `API_ALLOWED_ORIGINS=https://app.example.com`

The API does not allow wildcard credentialed CORS. Mutating browser requests are protected by explicit Origin validation plus httpOnly `SameSite=Lax` cookies. If a future cross-site cookie setup requires `SameSite=None`, it must also use Secure cookies and should add a stronger CSRF token flow.

Production cookies are:

- httpOnly
- Secure
- SameSite=Lax
- path `/`
- explicit max age from `AUTH_SESSION_TTL_SECONDS`

## Internal Endpoints

Internal AI smoke endpoints are disabled in production by default. They do not expose API keys and should only be enabled deliberately for controlled operational testing.

## Smoke Checks

Set:

```bash
export API_BASE_URL="https://api.example.com"
pnpm smoke:production
```

This checks only:

- `/health`
- `/ready`
- `/stories`

It does not create production users, sessions, gameplay turns, or AI calls.

Manual smoke checklist:

1. Register/login with a controlled test account.
2. Confirm `/auth/me` returns the current user.
3. Open public story catalog.
4. Create a session from a published story.
5. Submit a deterministic turn if the environment is in deterministic mode.
6. Run optional AI smoke only if provider keys and budgets are intentionally configured.

## Rollback Basics

- Prefer backward-compatible migrations.
- Keep previous API and web artifacts available during rollout.
- If a deploy fails after migrations, roll back application code only when the migration is compatible.
- Do not delete story versions, runtime sessions, usage records, or memory embeddings as part of routine rollback.

## Backups And Retention

Use managed PostgreSQL backups/PITR for production. MVP retention is conservative:

- Auth sessions expire by `expiresAt`; expired-session cleanup can be added as an explicit maintenance job.
- AI usage records are retained for audit/cost analysis.
- Messages, game state, memories, embeddings, quests, inventory, and world events are retained with the session.

No automatic destructive retention job runs in the application today.

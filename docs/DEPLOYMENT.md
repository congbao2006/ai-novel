# Closed Beta Deployment Runbook

## Target Topology

Closed beta target:

```text
Browser
  -> Next.js Web on Vercel
  -> Fastify API on Railway
  -> Supabase PostgreSQL with pgvector
  -> OpenAI API
```

The architecture remains portable. Vercel, Railway, and Supabase are recommended deployment targets for the first closed beta because they keep setup small while preserving the split between web, API, database, and AI provider.

## Deployment Readiness Findings

- Web build/start works through the `@ai-novel/web` package scripts.
- Web resolves the API URL from `NEXT_PUBLIC_API_URL` in `apps/web/src/lib/api.ts`.
- Authenticated browser API calls use `credentials: "include"`.
- API runs as a long-running Fastify process and binds `0.0.0.0` by default.
- API accepts `API_PORT`; it also falls back to platform `PORT`, which Railway provides.
- API Docker build context should be the repository root with Dockerfile path `apps/api/Dockerfile`.
- `/health` is process-only liveness.
- `/ready` checks database connectivity and pgvector when semantic memory is enabled.
- Migrations are explicit through `pnpm db:migrate`; they are not run on API startup or by the API Docker `CMD`.
- Current migration set runs from `0000_thin_loki.sql` through `0007_tricky_prima.sql`.
- `pnpm db:check` validates local Drizzle migration files. `pnpm db:status` connects to the configured database and checks how many migrations have actually been applied.
- Migration `0004_careless_yellow_claw.sql` contains `CREATE EXTENSION IF NOT EXISTS vector`.
- Internal AI smoke is disabled by default in production.
- For Vercel default domains plus Railway default domains, auth is cross-site and requires `AUTH_COOKIE_SAME_SITE=none`.

## Environment Matrix

### Supabase / Database

Required:

| Variable | Where Used | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Railway/API, local migration commands | Use a server-side PostgreSQL connection string. Do not expose to Vercel browser config. |

Manual/database requirement:

| Requirement | Notes |
| --- | --- |
| pgvector | Migration creates `CREATE EXTENSION IF NOT EXISTS vector`, but Supabase permissions can vary. If migration cannot create it, enable the `vector` extension in Supabase first. |
| Backups/PITR | Enable managed backups before beta users create real sessions. |

### Railway / API

Required production variables:

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `production`. |
| `DATABASE_URL` | yes | Supabase PostgreSQL URL. |
| `WEB_APP_URL` | yes | Final Vercel web origin, for example `https://your-app.vercel.app`. |
| `API_ALLOWED_ORIGINS` | yes | Comma-separated allowed web origins. No wildcard. |
| `AUTH_COOKIE_NAME` | yes | Example `ai_novel_session`. |
| `AUTH_SESSION_TTL_SECONDS` | yes | Example `1209600`. |
| `AUTH_COOKIE_SAME_SITE` | yes | Use `none` for Vercel/Railway default cross-site domains. Use `lax` for same-site custom domains. |

Railway/platform variables:

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | platform-provided | API uses this when `API_PORT` is unset. |
| `API_HOST` | optional | Defaults to `0.0.0.0`. |
| `API_PORT` | optional | Override only if the platform expects it. Railway usually uses `PORT`. |

Operational optional variables:

| Variable | Notes |
| --- | --- |
| `DATABASE_POOL_MAX` | Default `10`. Keep conservative for Supabase pool limits. |
| `DATABASE_POOL_IDLE_TIMEOUT_MS` | Default `30000`. |
| `DATABASE_POOL_CONNECTION_TIMEOUT_MS` | Default `10000`. |
| `API_BODY_LIMIT_BYTES` | Default `1048576`. |
| `API_SLOW_REQUEST_THRESHOLD_MS` | Default `1000`. |
| `API_SLOW_AI_REQUEST_THRESHOLD_MS` | Default `15000`. |
| `LOG_LEVEL` | Default `info`. |

Closed beta safe defaults:

| Variable | Recommended First Deploy |
| --- | --- |
| `GAMEPLAY_ENGINE_MODE` | `deterministic` |
| `AI_PROVIDER` | `disabled` |
| `MEMORY_SEMANTIC_SEARCH_ENABLED` | `false` |
| `AI_EMBEDDING_PROVIDER` | `disabled` |
| `AI_INTERNAL_SMOKE_ENABLED` | `false` |

AI-only variables:

| Variable | Required When |
| --- | --- |
| `AI_PROVIDER=openai` | Enabling AI gateway/generation. |
| `OPENAI_API_KEY` | `AI_PROVIDER=openai` or `AI_EMBEDDING_PROVIDER=openai`. |
| `OPENAI_MODEL` | `AI_PROVIDER=openai`. |
| `AI_REQUEST_TIMEOUT_MS` | Optional, default `30000`. |
| `AI_MAX_RETRIES` | Optional, default `2`. |
| `AI_MAX_OUTPUT_TOKENS` | Optional, default `256`. |
| `AI_MODEL_PRICING_JSON` | Required if any AI budget is enabled for active model/provider. |
| `AI_USER_DAILY_BUDGET_MICROS` | Optional budget. |
| `AI_USER_MONTHLY_BUDGET_MICROS` | Optional budget. |
| `AI_SESSION_BUDGET_MICROS` | Optional budget. |
| `AI_MAX_NPC_REACTIONS_PER_TURN` | Optional, default `2`. |

Semantic-memory-only variables:

| Variable | Required When |
| --- | --- |
| `MEMORY_SEMANTIC_SEARCH_ENABLED=true` | Enabling semantic retrieval. |
| `AI_EMBEDDING_PROVIDER=openai` | Semantic retrieval with OpenAI embeddings. |
| `OPENAI_EMBEDDING_MODEL` | `AI_EMBEDDING_PROVIDER=openai`. |
| `MEMORY_SEMANTIC_TOP_K` | Optional, default `12`. |
| `MEMORY_SEMANTIC_MIN_SCORE` | Optional, default `0.72`. |

Memory context variables:

| Variable | Notes |
| --- | --- |
| `AI_CONTEXT_MAX_RECENT_MESSAGES` | Default `20`. |
| `AI_CONTEXT_MAX_MEMORIES` | Default `20`. |
| `AI_CONTEXT_MAX_WORLD_EVENTS` | Default `10`. |
| `AI_CONTEXT_MAX_SUMMARY_CHARS` | Default `6000`. |
| `AI_CONTEXT_MAX_MEMORY_CHARS` | Default `1000`. |
| `AI_SUMMARY_INTERVAL_TURNS` | Default `10`. |

World variable:

| Variable | Notes |
| --- | --- |
| `WORLD_TICK_INTERVAL_TURNS` | Default `5`. |

### Vercel / Web

Required:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Public Railway API origin, for example `https://your-api.up.railway.app`. Browser code uses this value directly. |

Do not configure server secrets such as `DATABASE_URL`, `OPENAI_API_KEY`, or AI budget variables in Vercel unless a future web server-only feature explicitly needs them.

## Phase A - Database

1. Create a Supabase project.
2. Confirm the database supports pgvector.
3. Enable the `vector` extension manually if the migration role cannot run `CREATE EXTENSION IF NOT EXISTS vector`.
4. Copy the server-side `DATABASE_URL` into the environment where migrations will run.
5. From a trusted local/admin environment:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:status
```

`pnpm db:status` should report the same number of applied migrations as migration files and should show `story_factions table: present`.

6. For a brand-new beta database, legacy backfills are normally not needed.
7. For an existing/legacy database:

```bash
pnpm story:version-backfill
```

8. Run memory embedding backfill only after semantic memory is enabled and provider config is intentionally set:

```bash
pnpm memory:embed-backfill
```

Backfills must not run automatically during API startup.

## Phase B - API On Railway

1. Connect the GitHub repository to Railway.
2. Build from repository root.
3. Set Dockerfile path to `apps/api/Dockerfile`.
4. Do not override the Dockerfile start command unless necessary.
5. Configure Railway environment variables from the Railway/API matrix above.
6. Deploy.
7. Apply database migrations as a one-off Railway command after the deploy has access to production `DATABASE_URL`:

```bash
railway run --service <api-service-name> pnpm db:migrate:prod
```

If using the Railway dashboard instead of the CLI, run this same one-off command in the API service environment:

```bash
pnpm db:migrate:prod
```

Do not put `pnpm db:migrate` in the API start command. Migrations must be an explicit deploy step so startup remains fast, repeatable, and non-destructive.

8. Set Railway healthcheck path to `/ready`.
9. Verify:

```bash
curl https://your-api.up.railway.app/health
curl https://your-api.up.railway.app/ready
```

`/ready` should return `200` only after database connectivity and required pgvector readiness pass.

## Phase C - Web On Vercel

1. Connect the same GitHub repository to Vercel.
2. Set Root Directory to `apps/web`.
3. Framework preset should detect Next.js.
4. Install command can remain Vercel default pnpm install, or explicitly use:

```bash
pnpm install --frozen-lockfile
```

5. Build command:

```bash
pnpm build
```

6. Set:

```bash
NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
```

7. Deploy and note the final Vercel production origin.

## Phase D - Origin And Cookie Finalization

If using Vercel/Railway default domains:

```bash
WEB_APP_URL=https://your-app.vercel.app
API_ALLOWED_ORIGINS=https://your-app.vercel.app
AUTH_COOKIE_SAME_SITE=none
```

Reason: `your-app.vercel.app` and `your-api.up.railway.app` are cross-site. Browser `fetch(..., { credentials: "include" })` will not reliably send `SameSite=Lax` cookies on cross-site XHR/fetch requests. `SameSite=None` requires HTTPS and `Secure`, which the API sets in production.

If using same-site custom domains:

```bash
WEB_APP_URL=https://app.example.com
API_ALLOWED_ORIGINS=https://app.example.com
AUTH_COOKIE_SAME_SITE=lax
```

Example API domain: `https://api.example.com`. This is preferred long-term because `SameSite=Lax` gives a tighter CSRF posture.

CSRF posture:

- No wildcard credentialed CORS.
- Mutating requests require an allowed `Origin`.
- Cookies are httpOnly.
- Production cookies are Secure.
- If `SameSite=None` is used for closed beta default domains, keep `API_ALLOWED_ORIGINS` narrow and do not add wildcard origins.

After finalizing the web origin, redeploy the API so CORS and cookies use the final values.

## Phase E - Smoke

Safe automated smoke:

```bash
export API_BASE_URL=https://your-api.up.railway.app
pnpm smoke:production
```

This checks:

- `/health`
- `/ready`
- `/stories`

Optional authenticated smoke uses an existing test user only:

```bash
export API_BASE_URL=https://your-api.up.railway.app
export SMOKE_RUN_AUTH=true
export SMOKE_TEST_EMAIL=<existing-test-user-email>
export SMOKE_TEST_PASSWORD=<existing-test-user-password>
pnpm smoke:production
```

The script does not create production users automatically.

Manual smoke:

1. Register a beta test account.
2. Login.
3. Confirm `/auth/me` works.
4. Browse published stories.
5. Create a session.
6. Submit a deterministic turn.
7. Reload the session.
8. Confirm history/state persisted.

## Phase F - AI Activation

Start closed beta with deterministic gameplay first:

```bash
GAMEPLAY_ENGINE_MODE=deterministic
MEMORY_SEMANTIC_SEARCH_ENABLED=false
AI_PROVIDER=disabled
AI_EMBEDDING_PROVIDER=disabled
```

Reason: first verify hosting, auth, CORS, cookies, migrations, DB persistence, and session continuity without external AI cost or provider failure in the loop.

Second-stage AI activation:

```bash
GAMEPLAY_ENGINE_MODE=ai
AI_PROVIDER=openai
OPENAI_API_KEY=<server-side-secret>
OPENAI_MODEL=<model>
AI_MODEL_PRICING_JSON=<pricing-json>
AI_USER_DAILY_BUDGET_MICROS=<optional-budget>
AI_USER_MONTHLY_BUDGET_MICROS=<optional-budget>
AI_SESSION_BUDGET_MICROS=<optional-budget>
```

Semantic memory activation:

```bash
MEMORY_SEMANTIC_SEARCH_ENABLED=true
AI_EMBEDDING_PROVIDER=openai
OPENAI_EMBEDDING_MODEL=<embedding-model>
```

If budgets are enabled, include pricing for both the generation model and embedding model. Verify AI turns, usage ledger rows, summary calls, embeddings, and semantic retrieval after enabling.

## Observability During Beta

Watch:

- Request error rate and request IDs.
- `/ready` failures.
- Turn latency.
- AI input tokens per turn.
- AI output tokens per turn.
- Estimated cost per turn.
- Estimated cost per session.
- AI error/rate-limit/timeout rate.
- Summary call count and failures.
- Embedding call count and failures.
- Semantic memory fallback rate when instrumented.
- 409 conflict rate.
- World tick failure count.

Current sources are structured API logs and the AI usage ledger. A dashboard can come later.

## Rollback Basics

- Prefer backward-compatible migrations.
- Keep previous API and web artifacts available during rollout.
- If a deploy fails after migrations, roll back application code only when the migration is compatible.
- Do not delete story versions, runtime sessions, usage records, or memory embeddings as part of routine rollback.

# Closed Beta Production Checklist

## Git And CI

- [ ] Working tree clean.
- [ ] Latest commit pushed to GitHub.
- [ ] GitHub Actions CI is green.
- [ ] `pnpm lint` passes locally.
- [ ] `pnpm typecheck` passes locally.
- [ ] `pnpm test` passes locally.
- [ ] `pnpm build` passes locally.
- [ ] `pnpm check` passes locally.
- [ ] `pnpm audit --prod` has no production vulnerabilities.

## Database / Supabase

- [ ] Supabase PostgreSQL project created.
- [ ] `vector` extension available.
- [ ] `CREATE EXTENSION IF NOT EXISTS vector` migration works, or extension enabled manually before migrations.
- [ ] `DATABASE_URL` configured only in trusted API/migration environments.
- [ ] `pnpm db:migrate` completed.
- [ ] `pnpm db:status` completed and reports all migration files applied.
- [ ] `story_factions table: present`.
- [ ] `story_version_factions table: present`.
- [ ] On Railway, migrations were run as a one-off command: `pnpm db:migrate:prod`.
- [ ] Managed backups/PITR enabled.
- [ ] `pnpm story:version-backfill` run only if legacy published stories/sessions exist.
- [ ] `pnpm memory:embed-backfill` run only if semantic memory is enabled and existing memories need embeddings.

## API / Railway

- [ ] Railway connected to the GitHub repository.
- [ ] Railway builds from repository root.
- [ ] Dockerfile path is `apps/api/Dockerfile`.
- [ ] API uses production command from Dockerfile, not dev watcher.
- [ ] `NODE_ENV=production`.
- [ ] `DATABASE_URL` configured.
- [ ] `WEB_APP_URL` configured to final Vercel/custom web origin.
- [ ] `API_ALLOWED_ORIGINS` configured with no wildcard.
- [ ] `AUTH_COOKIE_NAME` configured.
- [ ] `AUTH_SESSION_TTL_SECONDS` configured.
- [ ] `AUTH_COOKIE_SAME_SITE` selected correctly.
- [ ] `GAMEPLAY_ENGINE_MODE=deterministic` for first infrastructure smoke.
- [ ] `MEMORY_SEMANTIC_SEARCH_ENABLED=false` for first infrastructure smoke.
- [ ] `AI_INTERNAL_SMOKE_ENABLED=false`.
- [ ] Secrets are not committed or printed in logs.
- [ ] `/health` returns `200`.
- [ ] `/ready` returns `200`.
- [ ] Railway healthcheck path is `/ready`.
- [ ] Logs include request IDs.
- [ ] Error responses include safe request IDs and no production stack traces.

## Web / Vercel

- [ ] Vercel connected to the same GitHub repository.
- [ ] Root Directory is `apps/web`.
- [ ] Framework preset is Next.js.
- [ ] Build command is `pnpm build`.
- [ ] `NEXT_PUBLIC_API_URL` points to the production Railway API origin.
- [ ] No server secrets such as `DATABASE_URL` or `OPENAI_API_KEY` are configured as public web variables.
- [ ] Browser auth requests include credentials.
- [ ] Web production build succeeds.

## CORS / Cookie / CSRF

- [ ] For Vercel/Railway default domains, `AUTH_COOKIE_SAME_SITE=none`.
- [ ] For same-site custom domains, `AUTH_COOKIE_SAME_SITE=lax`.
- [ ] Production auth cookies include `HttpOnly`.
- [ ] Production auth cookies include `Secure`.
- [ ] Production auth cookies have path `/`.
- [ ] CORS allows only the final web origin.
- [ ] CORS credentials are enabled.
- [ ] Untrusted origins are rejected.
- [ ] Mutating browser requests require an allowed `Origin`.

## Product Smoke

- [ ] Register works.
- [ ] Login works.
- [ ] Logout revokes the session.
- [ ] `/auth/me` works after login and returns `401` after logout.
- [ ] Public story catalog shows only published stories.
- [ ] Story detail does not expose internal prompts.
- [ ] Session creation works from a published story.
- [ ] Created session is pinned to a `StoryVersion`.
- [ ] Existing session reload works.
- [ ] Deterministic turn persists.
- [ ] Reloaded play page shows recent message history.
- [ ] Faction/world tick endpoints remain protected.

## AI Activation

- [ ] `AI_PROVIDER=openai`.
- [ ] `OPENAI_API_KEY` configured only on Railway/API.
- [ ] `OPENAI_MODEL` configured.
- [ ] `AI_MODEL_PRICING_JSON` includes the generation model when budgets are enabled.
- [ ] `AI_USER_DAILY_BUDGET_MICROS` configured for beta guardrail if desired.
- [ ] `AI_USER_MONTHLY_BUDGET_MICROS` configured for beta guardrail if desired.
- [ ] `AI_SESSION_BUDGET_MICROS` configured for beta guardrail if desired.
- [ ] AI gameplay turn works.
- [ ] AI usage ledger records provider/model/tokens/cost/status.
- [ ] Summary calls use purpose `summary`.
- [ ] `MEMORY_SEMANTIC_SEARCH_ENABLED=true` only after pgvector and embedding config are ready.
- [ ] `AI_EMBEDDING_PROVIDER=openai`.
- [ ] `OPENAI_EMBEDDING_MODEL` configured.
- [ ] Embedding usage ledger records purpose `embedding`.
- [ ] Semantic retrieval can recall relevant older memory.

## Beta Observability

- [ ] Track AI input tokens per turn.
- [ ] Track AI output tokens per turn.
- [ ] Track estimated cost per turn.
- [ ] Track estimated cost per session.
- [ ] Track turn latency.
- [ ] Track AI error rate.
- [ ] Track summary call count/failures.
- [ ] Track embedding call count/failures.
- [ ] Track memory retrieval fallback rate when available.
- [ ] Track 409 conflict rate.
- [ ] Track world tick failure count.

## Operational Risks To Revisit

- [ ] Expired auth session cleanup job.
- [ ] Hard quota reservation before paid Xu/payment launch.
- [ ] Central metrics dashboard.
- [ ] Incident playbooks and alert routing.
- [ ] Load test against expected beta concurrency.
- [ ] Moderation/reporting workflow before open public launch.

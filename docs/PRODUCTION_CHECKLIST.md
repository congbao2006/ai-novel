# Production Checklist

## Before Deploy

- [ ] Production secrets are configured in the hosting platform or secret manager.
- [ ] No real secrets are committed to Git.
- [ ] `NODE_ENV=production`.
- [ ] `WEB_APP_URL` is HTTPS.
- [ ] `NEXT_PUBLIC_API_URL` points to the production API.
- [ ] `API_ALLOWED_ORIGINS` contains only trusted HTTPS web origins.
- [ ] `DATABASE_URL` points to managed PostgreSQL.
- [ ] Database backups/PITR are enabled.
- [ ] pgvector is available if semantic memory is enabled.
- [ ] AI provider keys are configured only server-side.
- [ ] AI pricing registry is configured when budgets are enabled.
- [ ] AI budgets are configured for the intended beta limits.
- [ ] Internal AI smoke endpoints are disabled unless explicitly needed.

## Migration And Backfill

- [ ] `pnpm db:migrate` completed.
- [ ] `pnpm db:status` completed.
- [ ] `pnpm story:version-backfill` completed if legacy sessions/stories exist.
- [ ] `pnpm memory:embed-backfill` completed if semantic memory is enabled and existing memories need embeddings.
- [ ] Seed data policy is clear for the environment.

## Application Checks

- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes.
- [ ] `pnpm check` passes.
- [ ] CI passes on GitHub.

## Runtime Checks

- [ ] `GET /health` returns `200`.
- [ ] `GET /ready` returns `200`.
- [ ] `pnpm smoke:production` passes with `API_BASE_URL`.
- [ ] API logs include request IDs.
- [ ] Error responses include a safe request ID and no stack trace in production.
- [ ] CORS rejects untrusted origins.
- [ ] Auth cookies are `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`.
- [ ] Security headers are present.

## Product Smoke

- [ ] Register works.
- [ ] Login works.
- [ ] Logout revokes the session.
- [ ] `/auth/me` works after login and returns `401` after logout.
- [ ] Public story catalog shows only published stories.
- [ ] Story detail does not expose internal prompts.
- [ ] Session creation works from a published story.
- [ ] Existing session reload works.
- [ ] Deterministic turn works when `GAMEPLAY_ENGINE_MODE=deterministic`.
- [ ] Optional AI smoke works only when provider keys, model, pricing, and budget are intentionally configured.

## Operational Risks To Revisit

- [ ] Expired auth session cleanup job.
- [ ] Hard quota reservation before paid Xu/payment launch.
- [ ] Central metrics backend.
- [ ] Incident playbooks and alert routing.
- [ ] Load test against expected beta concurrency.
- [ ] Moderation/reporting workflow before open public launch.

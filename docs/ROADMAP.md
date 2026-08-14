# Roadmap

## Phase 0: Foundation

Status: completed.

Goals:

- Establish production repository structure.
- Document product boundaries.
- Choose initial technical architecture.
- Define database, memory, and AI engine principles.
- Add structure checks.

Not included:

- Gameplay implementation.
- Payment implementation.
- AI provider integration.
- Admin dashboard.

## Phase 1: Application Skeleton

Status: completed.

Goals:

- Initialize frontend app.
- Initialize API app.
- Add shared TypeScript configuration.
- Add linting, formatting, and test runner.
- Add environment validation pattern.
- Add local development documentation.

Completed:

- `apps/web` has a minimal Next.js App Router skeleton with TypeScript, Tailwind CSS, and ESLint.
- `apps/api` has a Fastify TypeScript skeleton with `GET /health`.
- Workspace packages exist for domain, database, AI engine, and shared config.
- The AI engine package defines provider-neutral contracts without live provider integration.
- The database package is prepared for PostgreSQL with Drizzle infrastructure but no gameplay schema.

Next step:

- Database schema foundations were added after this skeleton.

## Phase 1.5: Database Schema Foundations

Status: completed.

Goals:

- Implement foundational PostgreSQL schema with Drizzle.
- Add initial migration.
- Add development seed data.
- Add domain enum/type exports for shared database values.
- Keep runtime state separate from story templates.

Completed:

- Added tables for users, stories, story characters, game sessions, game messages, game states, NPCs, relationships, inventory items, quests, and world events.
- Added PostgreSQL enums for story status, session status, message role, quest status, and entity type.
- Added indexes and constraints for session loading, transcript ordering, runtime state uniqueness, quest uniqueness, relationship edge uniqueness, and numeric ranges.
- Added development seed data with one demo user and three original stories.

Next step:

- Phase 2 should add authentication/user identity foundations or a repository/data-access layer before gameplay implementation.

## Phase 2: Authentication And Catalog

Goals:

- User registration and login.
- Story catalog browsing.
- Story detail pages.
- Authorization foundations.

## Phase 3: Character And Session Foundations

Goals:

- Character templates.
- Character creation constraints.
- Session creation.
- Save and resume mechanics without AI generation.
- Server-owned session state model.

## Phase 4: Gameplay Engine

Goals:

- Turn model.
- Domain event model.
- Inventory, relationship, quest, and world flag transitions.
- Deterministic validators.
- Tests for state transitions.

## Phase 5: AI Engine Integration

Goals:

- Provider-neutral AI engine contracts.
- First provider adapter.
- Token estimation.
- Budget enforcement.
- Usage ledger.
- Structured output validation.
- No direct database writes from AI output.

## Phase 6: Story Creation Tools

Goals:

- Story authoring model.
- Story versioning.
- Draft/publish workflow.
- Validation for story data.

## Phase 7: Coins And Payments

Goals:

- Wallet.
- Coin ledger.
- Payment provider integration.
- Purchase reconciliation.
- Refund/admin adjustment flow.

## Phase 8: Admin Dashboard

Goals:

- Story management.
- User/session inspection.
- AI usage and cost monitoring.
- Payment support tools.
- Abuse/moderation workflows.

## Phase 9: Production Hardening

Goals:

- Observability.
- Rate limiting.
- Backups.
- Load testing.
- Security review.
- Incident playbooks.

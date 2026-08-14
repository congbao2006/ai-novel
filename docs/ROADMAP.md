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

## Phase 1.6: Repository/Data-Access Layer

Status: completed.

Goals:

- Add repository interfaces and Drizzle-backed implementations.
- Keep application code away from direct Drizzle query syntax.
- Add shared transaction context for future gameplay turns.
- Add optimistic concurrency for `game_states.version`.
- Add structured data-access errors.
- Prepare API dependency wiring without adding business endpoints.

Completed:

- Added repositories for users, stories, sessions, messages, game state, NPCs, relationships, inventory, quests, and world events.
- Added `withTransaction` and `RepositoryContext` so future service operations can share one transaction.
- Added `StateVersionConflictError`, `ConflictError`, and `NotFoundError`.
- Added API dependency wiring through `buildApp({ dependencies })`.
- Added contract tests for repository exports, optimistic state conflicts, relationship entity validation, inventory validation, and transaction context behavior.

Next step:

- Phase 2 should add authentication/user identity foundations.

## Phase 2.1: Authentication And User Identity

Status: completed.

Goals:

- User registration and login.
- Server-side session creation and revocation.
- httpOnly cookie authentication.
- Current-user API.
- Minimal web login/register pages.

Completed:

- Added email/password registration and login with Argon2id password hashing.
- Added `auth_sessions` storing hashed session tokens only.
- Added `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, and `GET /auth/me`.
- Added Fastify request identity helpers for protected routes.
- Added minimal `/login` and `/register` web pages.

Next step:

- Build story browsing and session creation foundations.

## Phase 2.2: Story Browsing And Catalog

Status: completed.

Goals:

- Story catalog browsing.
- Story detail pages.
- Authorization foundations.

Completed:

- Added `GET /stories` for published story browsing with optional genre and page/limit query parameters.
- Added `GET /stories/:slug` with public story metadata and character templates.
- Added explicit DTOs that do not expose internal story prompts.
- Added minimal `/stories` and `/stories/[slug]` web routes.

## Phase 2.3: Game Session Creation Foundation

Status: completed.

Goals:

- Character templates.
- Character creation constraints.
- Session creation.
- Save and resume mechanics without AI generation.
- Server-owned session state model.

Completed:

- Added protected `POST /sessions`.
- Added protected `GET /sessions` and `GET /sessions/:id`.
- Session creation validates published story and selected character membership.
- Session creation creates `game_sessions` and initial `game_states` atomically through the repository transaction boundary.
- Initial game state is deterministic and copies selected character `initial_stats`.
- Added minimal `/sessions` and `/play/[sessionId]` web routes.
- No assistant opening message is created before gameplay/AI exists.

Next step:

- Deterministic Gameplay Turn Engine.

## Phase 3: Deterministic Gameplay Turn Engine

Status: pending.

Goals:

- Turn model.
- Domain event model.
- Inventory, relationship, quest, and world flag transitions.
- Deterministic validators.
- Tests for state transitions.

## Phase 4: AI Engine Integration

Goals:

- Provider-neutral AI engine contracts.
- First provider adapter.
- Token estimation.
- Budget enforcement.
- Usage ledger.
- Structured output validation.
- No direct database writes from AI output.

## Phase 5: Story Creation Tools

Goals:

- Story authoring model.
- Story versioning.
- Draft/publish workflow.
- Validation for story data.

## Phase 6: Coins And Payments

Goals:

- Wallet.
- Coin ledger.
- Payment provider integration.
- Purchase reconciliation.
- Refund/admin adjustment flow.

## Phase 7: Admin Dashboard

Goals:

- Story management.
- User/session inspection.
- AI usage and cost monitoring.
- Payment support tools.
- Abuse/moderation workflows.

## Phase 8: Production Hardening

Goals:

- Observability.
- Rate limiting.
- Backups.
- Load testing.
- Security review.
- Incident playbooks.

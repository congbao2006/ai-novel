# Roadmap

## Phase 0: Foundation

Status: current.

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

Goals:

- Initialize frontend app.
- Initialize API app.
- Add shared TypeScript configuration.
- Add linting, formatting, and test runner.
- Add environment validation pattern.
- Add local development documentation.

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

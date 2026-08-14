# Architecture

## Purpose

This project will become a production AI Interactive Novel + RPG platform where players choose stories, create or select characters, roleplay through typed actions/dialogue, and resume persistent sessions.

This phase intentionally designs the architecture without implementing gameplay, payment, or AI integration.

## Technical Stack

Recommended stack for the first production version:

- Runtime: Node.js with TypeScript.
- Package manager: pnpm workspaces.
- Frontend app: Next.js or another React-based web app inside `apps/web`.
- Backend app: TypeScript API service inside `apps/api`.
- Database: PostgreSQL.
- ORM/migrations: Prisma or Drizzle, to be chosen when schema implementation begins.
- Cache/queues: Redis and a job queue only when async AI generation or background processing is introduced.
- Observability: structured logs, request IDs, metrics, and later tracing.
- Deployment target: container-friendly services, with frontend and API deployable separately.

## Why This Stack

TypeScript across frontend, backend, and shared packages keeps domain contracts consistent. A workspace layout allows the game domain, AI engine contracts, and database layer to evolve independently. PostgreSQL is a strong fit for durable relational state such as sessions, quests, inventory, relations, and ledgers.

The AI provider must remain replaceable. Gameplay code should depend on internal interfaces, not on OpenAI, Anthropic, Google, local models, or any specific SDK.

## Repository Layout

```text
apps/
  web/        Future player-facing web application.
  api/        Future server API and application services.
packages/
  domain/     Story, session, world, quest, inventory, and event rules.
  ai-engine/  Provider-neutral AI orchestration contracts.
  db/         Database schema, migrations, and data access.
  config/     Shared configuration and environment validation.
docs/
  PRODUCT.md
  DATABASE.md
  AI_ENGINE.md
  MEMORY.md
  ROADMAP.md
scripts/
  check-structure.mjs
```

## System Boundaries

### Frontend

The frontend is responsible for rendering UI, collecting player input, and calling server APIs. It must not contain API keys, provider credentials, pricing logic, or trusted game-state mutation rules.

### API Service

The API service owns authentication, authorization, session orchestration, save/resume flows, state transitions, and AI request budgeting. It is the only layer allowed to mutate persistent game state.

### Domain Package

The domain package contains deterministic rules and validated state transitions. It should be testable without a database, network, or LLM provider.

### AI Engine Package

The AI engine package defines provider-neutral contracts for prompt assembly, model routing, token budgeting, response normalization, safety checks, and structured output validation. It must not directly write to the database.

### Database Package

The database package owns schema, migrations, repositories, and transaction helpers. It should expose explicit persistence operations rather than allowing arbitrary writes from feature code.

Application code should not depend directly on Drizzle query syntax. API/application services should use repository interfaces from `packages/db`, while SQL builders and PostgreSQL-specific details stay inside repository implementations.

Expected dependency flow:

```text
apps/api
  -> application/service layer
  -> repository interfaces
  -> packages/db repositories
  -> Drizzle/PostgreSQL
```

Repository contexts support shared transaction boundaries so a future gameplay turn can persist messages, state, NPC updates, relationships, inventory, events, and turn counters in one transaction.

## Game State Rule

The LLM never directly updates the database.

Expected future flow:

1. Player sends an action to the API.
2. API loads the current session state.
3. Domain layer builds a controlled state snapshot.
4. AI engine prepares a provider-neutral generation request.
5. Provider adapter returns candidate narrative and proposed state changes.
6. Domain layer validates and converts proposed changes into allowed events.
7. API persists events and derived state through repositories in a transaction.
8. API returns updated narrative/state view to the frontend.

## Provider Abstraction

The platform should depend on interfaces such as:

- `LLMProvider`
- `GenerationRequest`
- `GenerationResult`
- `TokenUsage`
- `ModelPolicy`
- `StructuredOutputValidator`

Provider adapters can later implement OpenAI, Anthropic, Google, local models, or routing services without rewriting gameplay code.

## Cost Control

AI cost control must be part of request orchestration:

- Per-user, per-session, per-story, and global request budgets.
- Model policy by feature and story tier.
- Token estimation before request.
- Hard caps on prompt and completion tokens.
- Usage ledger storing input tokens, output tokens, model, provider, latency, and estimated cost.
- Graceful fallback when budget is exceeded.

## Security

- Secrets live only in server-side environment variables or secret managers.
- Frontend receives public config only.
- API validates all user input.
- Authorization checks are required for every session, save, character, and purchase-related resource.
- Admin operations must be isolated from player APIs.

## Future Services

Future additions may include:

- Story creation tools.
- Coin wallet and payments.
- Admin dashboard.
- Moderation and abuse detection.
- Background AI jobs.
- Analytics and balancing tools.

These should be added as separate modules or services only when requirements justify them.

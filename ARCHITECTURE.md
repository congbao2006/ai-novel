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

Current application services:

- `AuthService` owns registration, login, logout, password hashing, and session cookie identity.
- `StoryService` owns public story browsing DTOs and prevents internal prompt fields from reaching clients.
- `StoryAuthoringService` owns authenticated story draft creation, owner-only editing, template management, publish validation, immutable version creation, revision workflow, and archive transitions.
- `SessionService` owns authenticated session creation, ownership checks, session listing/loading, and deterministic initial state creation.
- `GameplayService` owns authenticated turn submission and transactional persistence of messages, state updates, world events, turn count, and last-played timestamps. It supports deterministic mode and AI proposal mode.
- `BudgetService` owns server-side preflight budget checks before paid AI calls.
- `RepositoryAIUsageLedger` records provider/model/token/cost metadata through the database repository layer.
- `MemoryContextBuilder` owns bounded AI gameplay context assembly from authoritative state, recent transcript rows, rolling summaries, important memories, and important world events.
- `SummaryService` owns rolling summary refresh and important memory extraction when configured turn thresholds are reached.
- `MemoryEmbeddingService` owns embedding generation/backfill for persistent memories without making repositories call external providers.
- `SemanticMemoryService` owns query embedding and hybrid semantic/importance/recency ranking for memory retrieval.
- `NPCInitializationService` clones story character templates into session-owned runtime NPC rows when a session starts.
- `NPCReactionService` selects relevant runtime NPCs during AI gameplay turns, builds NPC-specific knowledge context, calls an NPC reaction engine, and persists only server-validated NPC state/relationship/memory effects.
- `ConsequenceEngine` normalizes deterministic actions, AI turn proposals, and NPC reaction proposals into validated quest, inventory, relationship, state, NPC, memory, and world-event effects before persistence.
- `WorldSimulationService` runs explicit deterministic world ticks after gameplay turns or manual requests; it persists faction/world effects in a separate transaction.

### Domain Package

The domain package contains deterministic rules and validated state transitions. It should be testable without a database, network, or LLM provider.

### AI Engine Package

The AI engine package defines provider-neutral contracts for prompt assembly, model routing, token budgeting, response normalization, safety checks, and structured output validation. It now includes an OpenAI provider behind `AIGateway`, but it must not directly write to the database.

AI dependency flow:

```text
apps/api
  -> AIGateway
  -> ModelPolicy
  -> LLMProvider
  -> OpenAIProvider
  -> OpenAI Responses API
```

Embedding dependency flow:

```text
apps/api
  -> MemoryEmbeddingService / SemanticMemoryService
  -> EmbeddingGateway
  -> EmbeddingProvider
  -> OpenAIEmbeddingProvider
  -> OpenAI Embeddings API
```

Gameplay defaults to the deterministic turn engine. When `GAMEPLAY_ENGINE_MODE=ai`, gameplay calls `AIGateway` for a structured narrative proposal, then server-side validators decide what can be persisted.

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

Repository contexts support shared transaction boundaries so a gameplay turn can persist messages, state, NPC updates, relationships, inventory, quests, events, memories, and turn counters in one transaction.

The current session creation flow already uses that transaction boundary and pins immutable story versions:

```text
Browser
  -> POST /sessions
  -> requireUser
  -> SessionService
  -> StoryRepository resolves public story catalog row
  -> StoryVersionRepository resolves current published version
  -> StoryVersionCharacterRepository validates playable version character
  -> withTransaction
      -> GameSessionRepository.create with storyVersionId
      -> GameStateRepository.createInitialState from version settings
      -> NPCInitializationService clones version NPC templates
      -> FactionInitializationService clones version faction templates
  -> session detail DTO
```

The initial state builder is deterministic and does not call an LLM. It copies public playable character template stats and uses authored initial world settings when present, with legacy safe fallbacks only for older data.

Playable content authoring keeps authoring templates, immutable versions, and runtime state separate:

```text
Author
  -> story draft
      -> world config
      -> playable character templates
      -> NPC templates
      -> faction templates
  -> publish validation
  -> immutable story version
  -> current published version pointer
  -> player creates session
      -> session pins storyVersionId
      -> game state initialized from version settings
      -> version NPC templates cloned into runtime NPCs
      -> version faction templates cloned into runtime factions
```

Templates define initial conditions. Runtime tables own evolving state and never write changes back to story authoring data.

Published versions are immutable. The `stories` row is the catalog plus owner working copy. A creator can create a new revision, edit the working copy, and publish a new version. Existing sessions continue to use their pinned `storyVersionId`; new sessions use the latest current published version. Runtime gameplay must never read mutable authoring rows for world prompts, opening prompts, initial settings, NPC templates, faction templates, or selected player template data.

The current deterministic turn flow uses the same boundary:

```text
Browser
  -> POST /sessions/:id/turns
  -> requireUser
  -> GameplayService
  -> withTransaction
      -> load session and enforce ownership
      -> load current GameState
      -> determine next turn number
      -> append player message
      -> run pure deterministic domain engine
      -> ConsequenceEngine normalizes command-derived consequences
      -> validate state patch and consequence plan
      -> update GameState with expected version
      -> persist quests, inventory, relationships, NPC state, and memory candidates
      -> append world events
      -> append assistant result message
      -> increment turn count
      -> touch lastPlayedAt
  -> turn response DTO
```

Player and assistant messages for the same action share the same `turnNumber`. This keeps one user action plus one deterministic result grouped as a single turn.

The AI turn flow is similar, but the provider call is intentionally outside the database transaction:

```text
Browser
  -> POST /sessions/:id/turns
  -> requireUser
  -> GameplayService
      -> load session/state/story-version snapshot
      -> MemoryContextBuilder loads bounded context layers
      -> BudgetService checks user/session usage aggregates
      -> build GenerationRequest with bounded context
      -> AIGateway returns AITurnProposal
      -> AIUsageLedger records provider usage outside gameplay transaction
      -> domain validator accepts only safe proposal fields
      -> NPCReactionService may collect bounded NPC proposals
      -> ConsequenceEngine builds a server-owned TurnPersistencePlan
  -> withTransaction
      -> reload session and current GameState
      -> reject if game_states.version changed
      -> append player message
      -> update GameState with expected version
      -> persist validated quests, inventory, relationships, NPC state, and memories
      -> append validated world events
      -> append assistant narrative message
      -> increment turn count
      -> touch lastPlayedAt
  -> turn response DTO
```

AI is a proposer, not the authority. It cannot supply database IDs, owners, versions, event timestamps, or arbitrary JSON patches. The server assigns those values and rejects invalid proposals.

AI usage accounting is intentionally independent from the gameplay transaction. A successful provider call is recorded even if the later proposal validation or optimistic concurrency check prevents game-state persistence.

Memory maintenance is intentionally separate from gameplay persistence. After an AI gameplay turn is committed, `SummaryService` may refresh the rolling summary and upsert important memories if the configured interval is reached. A summary failure leaves the committed gameplay turn intact and keeps the previous summary/memory set.

AI gameplay context is assembled from ordered layers:

```text
Authoritative GameState
  + bounded recent messages
  + rolling session summary
  + deterministic important memories
  + semantic memory retrieval
  + important world events
  -> MemoryContextBuilder
  -> StoryTurnPromptBuilder
  -> AIGateway
```

`game_states` remains the source of truth. Summaries and memories help the AI reason about long-running context, but they do not override current state or mutate state directly.

NPC runtime intelligence follows the same authority rule:

```text
NPC template
  -> session-owned NPC runtime
  -> NPC profile + relationship + NPC memory + current scene + player action
  -> NPCKnowledgeBuilder
  -> AINPCReactionEngine
  -> server validator
  -> gameplay transaction persists allowed NPC state, relationship deltas, memories, and events
```

NPC AI is a proposer, not the authority. It does not run outside player turns, does not write the database, and does not receive another NPC's secrets, full session memory, full world prompt, auth data, or cross-session memories. Runtime NPC memories reuse `session_memories` with `subject_type = npc` and `subject_id = <npc id>`.

Quest and consequence expansion follows the same authority rule:

```text
Player action
  -> AI/NPC proposals
  -> server validation
  -> ConsequenceEngine
  -> bounded RuleRegistry
  -> TurnPersistencePlan
  -> optimistic state check
  -> atomic transaction
```

Narrative describes. Proposals suggest. The consequence engine decides which effects are allowed. The database remains authoritative.

The current consequence types are bounded to quest lifecycle changes, relationship deltas, inventory add/remove, safe state/flag/reputation updates, NPC-owned state updates, world events, and custom safe server-recognized effects. There is no arbitrary operation object and no path for AI JSON to be spread directly into database records.

Consequence chaining is deterministic and capped. Rule outputs such as quest completion events, inventory acquisition events, and relationship threshold events are generated by explicit code, not by a scripting language or another AI call.

World/faction simulation is a deterministic post-turn layer:

```text
Gameplay consequences
  -> WorldTickPolicy
  -> WorldSimulationEngine
  -> WorldRuleRegistry
  -> WorldTickPlan
  -> server validation
  -> atomic world transaction
  -> factions / faction relationships / events / memories
```

AI narrates. NPC AI proposes. The consequence engine resolves player-turn effects. The world simulation engine resolves bounded world-level effects. The database remains authoritative.

There is no background scheduler. A tick runs only through explicit service calls, currently after gameplay when the interval or a major signal requires it, or through the protected manual tick endpoint. Tick persistence is separate from gameplay persistence, so a failed world tick does not corrupt or roll back a completed player turn.

Factions are session-owned runtime rows. Faction relationships use a dedicated directed table rather than the player/NPC `relationships` table, because the existing polymorphic relationship table is intentionally constrained to `player|npc`.

Semantic memory retrieval is hybrid:

```text
Player action
  -> query embedding
  -> SemanticMemoryRepository.searchSimilar(sessionId, vector)
  -> hybrid rank
       semantic similarity * 0.65
       importance          * 0.25
       recency             * 0.10
  -> dedup with deterministic memories
  -> context budget
```

The vector store is PostgreSQL with pgvector, using a separate `memory_embeddings` table so provider/model/dimension changes can be backfilled without rewriting `session_memories`. Vector queries are scoped by `session_id` at the repository query level.

## Game State Rule

The LLM never directly updates the database.

Expected future flow:

1. Player sends an action to the API.
2. API loads the current session state.
3. Domain layer builds a controlled state snapshot.
4. Deterministic mode parses simple commands and returns a validated patch plus optional events.
5. AI mode builds a provider-neutral generation request after loading bounded context.
6. Provider adapter returns candidate narrative and proposed state changes as structured output.
7. Domain layer validates and converts proposed changes into allowed patches/events.
8. API persists events and derived state through repositories in a transaction.
9. API returns updated narrative/state view to the frontend.
10. Optional summary refresh may run after turn persistence; its failures do not roll back gameplay.

## Provider Abstraction

The platform should depend on interfaces such as:

- `LLMProvider`
- `GenerationRequest`
- `GenerationResult`
- `TokenUsage`
- `ModelPolicy`
- `StructuredOutputValidator`

Provider adapters can later implement OpenAI, Anthropic, Google, local models, or routing services without rewriting gameplay code.

The current provider factory supports:

- `disabled`
- `openai`

Unsupported providers fail with a provider-neutral configuration error.

## Cost Control

AI cost control must be part of request orchestration:

- Per-user, per-session, per-story, and global request budgets.
- Model policy by feature and story tier.
- Token estimation before request.
- Hard caps on prompt and completion tokens.
- Usage ledger storing input tokens, output tokens, model, provider, latency, and estimated cost.
- Graceful fallback when budget is exceeded.

The current gateway captures provider usage when available and estimates cost through an injectable pricing registry. Pricing comes from server-side operational config (`AI_MODEL_PRICING_JSON`) because provider pricing can change independently of source code.

Budget enforcement is a server-side preflight check:

```text
GameplayService
  -> BudgetService
  -> AIUsageRepository.getUserCostSince / getSessionCostSince
  -> allow or throw ai_budget_exceeded
```

If budgets are enabled for AI gameplay and the configured model has no pricing, startup fails closed. The preflight check is not a distributed reservation system; concurrent requests may overshoot slightly until future payment/Xu work adds atomic quota reservations.

Summary refresh calls use the same gateway and ledger with purpose `summary`, so they are budgeted and usage-accounted separately from gameplay turns.

Embedding calls use purpose `embedding` in the same usage ledger. Runtime semantic retrieval falls back to deterministic memory selection if embeddings are disabled, unavailable, or below threshold.

## Security

- Secrets live only in server-side environment variables or secret managers.
- Frontend receives public config only.
- API validates all user input.
- Authorization checks are required for every session, save, character, and purchase-related resource.
- Admin operations must be isolated from player APIs.
- Story catalog/detail DTOs must not expose `world_prompt`, `opening_prompt`, password hashes, auth sessions, or other internal orchestration data.
- Session reads are scoped to `request.currentUser`; user IDs from request bodies are ignored.
- Gameplay turn requests accept only player action text. Clients cannot send state patches, user IDs, session owners, or event payloads.
- `game_states.version` provides optimistic concurrency. A stale turn receives HTTP 409 rather than being silently retried.
- `OPENAI_API_KEY` is server-only and must never be exposed through frontend config, logs, or API responses.
- Internal AI smoke endpoints are disabled in production unless explicitly gated by server config.
- `GAMEPLAY_ENGINE_MODE=ai` requires a configured AI provider; the default local mode is deterministic.
- AI proposals are validated with allowlists for state fields, bounded text, finite numbers, and event limits before persistence.
- Usage records never store API keys, cookies, emails, full prompts, or full AI output.
- Budget enforcement is server-side; frontend state cannot raise or bypass AI budgets.
- Memory and summary records never become authority over `game_states`; prompt builders explicitly tell the AI to prefer current state over stale memory.
- NPC reactions are bounded by `AI_MAX_NPC_REACTIONS_PER_TURN`; NPC prompts receive only NPC-scoped knowledge and validated reaction proposals cannot patch player/auth/session state.

## Authentication

The MVP uses email/password authentication with server-side sessions and httpOnly cookies. Server-side sessions were chosen over self-contained JWTs because they are easy to revoke, support logout server-side, and leave a clear path to logout-all-devices, session rotation, and OAuth account linking later.

Auth flow:

```text
Browser
  -> POST /auth/login or /auth/register
  -> AuthService
  -> UserRepository
  -> Argon2id password verify/hash
  -> AuthSessionRepository creates token hash
  -> API sets httpOnly cookie with raw random token
  -> browser sends cookie on later requests
  -> auth middleware hashes cookie token
  -> AuthSessionRepository validates non-expired, non-revoked session
  -> request.currentUser is available to protected routes
```

The database stores only session token hashes, never raw session tokens. Password hashes are never returned in API responses.

## Production Runtime

MVP deployment topology:

```text
Browser
  -> Next.js web app
  -> Fastify API
  -> Managed PostgreSQL with pgvector
  -> External AI provider
```

The API validates server-side configuration at startup. Production fails fast when critical config is missing, including `DATABASE_URL`, HTTPS web origin configuration, AI provider requirements, semantic memory provider requirements, and pricing when AI budgets are enabled.

Health checks are split:

- `GET /health` returns process liveness and does not touch the database.
- `GET /ready` checks critical dependencies, currently PostgreSQL reachability and pgvector availability when semantic memory is enabled.

The Fastify process uses structured Pino logs with request IDs, safe redaction for cookies/authorization/passwords/API keys/internal prompts, global request body limits, explicit credentialed CORS origins, Origin validation for mutating browser requests, and production-safe error responses. Errors return a stable code, safe message, and request ID; production responses do not expose stack traces or raw SQL/provider errors.

Graceful shutdown handles `SIGTERM` and `SIGINT` by closing Fastify first and then closing the shared PostgreSQL pool. The application does not create a database connection per request and does not run migrations automatically at startup.

Closed beta deployment targets Vercel for web, Railway for API, and Supabase PostgreSQL with pgvector for the database. The API uses `API_PORT` when configured and otherwise accepts platform `PORT`, which Railway provides.

Cookie policy depends on topology:

- Same-site custom domains such as `app.example.com` and `api.example.com` should use `AUTH_COOKIE_SAME_SITE=lax`.
- Cross-site default hostnames such as `*.vercel.app` and `*.up.railway.app` require `AUTH_COOKIE_SAME_SITE=none` with production Secure cookies.

Both modes keep explicit credentialed CORS and Origin validation for mutating browser requests. Wildcard credentialed CORS is not allowed.

Migrations and backfills are explicit operational steps:

- `pnpm db:migrate`
- `pnpm db:status`
- `pnpm story:version-backfill`
- `pnpm memory:embed-backfill`

Production smoke checks live in `pnpm smoke:production` and cover only safe public readiness paths.

## Future Services

Future additions may include:

- Story creation tools.
- Coin wallet and payments.
- Admin dashboard.
- Moderation and abuse detection.
- Background AI jobs.
- Analytics and balancing tools.

These should be added as separate modules or services only when requirements justify them.

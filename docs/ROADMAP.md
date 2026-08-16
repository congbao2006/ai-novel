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

Status: completed.

Goals:

- Turn model.
- Domain event model.
- Inventory, relationship, quest, and world flag transitions.
- Deterministic validators.
- Tests for state transitions.

Completed:

- Added protected `POST /sessions/:id/turns`.
- Added pure deterministic turn engine in `packages/domain`.
- Added simple Vietnamese/English command parsing for look, rest, move, and status.
- Unknown actions are persisted and receive a safe deterministic fallback.
- Player and assistant messages are persisted with the same `turnNumber`.
- Movement turns update location and append a `movement` world event.
- Turn persistence is atomic through the repository transaction boundary.
- `game_states.version` conflicts map to HTTP 409 with no automatic retry.
- Updated `/play/[sessionId]` with recent messages and a minimal action form.

Next step:

- AI Gateway Provider Integration.

## Phase 4: AI Gateway Provider Integration

Status: completed.

Goals:

- Provider-neutral AI engine contracts.
- First provider adapter.
- Token estimation.
- Budget enforcement.
- Usage ledger.
- Structured output validation.
- No direct database writes from AI output.

Completed:

- Added provider-neutral `AIGateway`.
- Added `OpenAIProvider` using the official OpenAI SDK and Responses API.
- Added provider factory for `disabled` and `openai`.
- Added model policy foundation with `defaultStoryModel`.
- Added timeout, bounded retry, and provider-neutral AI error mapping.
- Added token usage normalization and injectable cost estimation in integer micros.
- Added structured output schema support at the gateway/provider boundary.
- Added internal HTTP smoke endpoint and optional `pnpm ai:smoke` CLI.
- Kept deterministic gameplay turns unchanged.

Next step:

- AI Narrative + Structured Turn Proposal.

## Phase 4.5: AI Narrative + Structured Turn Proposal

Status: completed.

Goals:

- Use the AI gateway to propose narrative text.
- Request structured turn proposals.
- Validate AI-proposed state patches with domain rules.
- Keep server-side deterministic persistence authority.
- Continue tracking usage/cost.

Completed:

- Added strict provider-neutral `AITurnProposal` contract and JSON schema.
- Added prompt/context builder with bounded recent messages and important world events.
- Added prompt-injection defenses that treat player action as untrusted fictional input.
- Added `GAMEPLAY_ENGINE_MODE=deterministic|ai`; deterministic remains the default.
- Added AI turn flow that calls `AIGateway` outside the PostgreSQL transaction.
- Added server-side proposal validation for narrative, location, existing numeric player stats, safe AI state keys, and bounded world events.
- Added optimistic version re-check before persisting AI proposals.
- Added optional `pnpm ai:turn-smoke` live structured proposal smoke test.
- Kept deterministic gameplay tests and behavior intact.

Next step:

- Persistent AI Usage Ledger + Cost/Budget Enforcement.

## Phase 4.6: Persistent AI Usage Ledger + Cost/Budget Enforcement

Status: completed.

Goals:

- Persist AI generation usage records.
- Track provider, model, purpose, token usage, estimated cost, latency, request ID, and status.
- Link records to user/session when available.
- Enforce server-side user/session AI cost budgets before provider calls.
- Keep budget enforcement independent of frontend state.

Completed:

- Added `ai_usage_records` table with `ai_usage_purpose` and `ai_usage_status` enums.
- Added indexes for user/session/provider/model/purpose/status cost and usage queries.
- Added `AIUsageRepository` with success/failure recording and database-side aggregate cost queries.
- Added `RepositoryAIUsageLedger` adapter for `AIGateway`.
- Added `BudgetService` preflight checks for daily user, monthly user, and session budgets.
- Added server-side pricing registry config through `AI_MODEL_PRICING_JSON`.
- Added fail-closed config behavior when AI gameplay budgets are enabled without model pricing.
- Added web handling for `ai_budget_exceeded`.
- Documented the soft preflight budget race and future hard reservation need.

Next step:

- Memory Foundation.

## Phase 4.7: Memory Foundation

Status: completed.

Goals:

- Build bounded AI gameplay context from multiple memory layers.
- Persist rolling session summaries.
- Persist structured important memories.
- Keep GameState authoritative over memory.
- Add summary refresh and memory extraction without vector search.

Completed:

- Added `session_summaries` with `summarizedThroughTurn` and optimistic `version`.
- Added `session_memories` with memory type, importance, active flag, stable key, and observed/confirmed turn fields.
- Added `SessionSummaryRepository` and `MemoryRepository`.
- Added provider-neutral domain contracts for `ContextBundle`, `SessionSummary`, `PersistentMemory`, `MemoryCandidate`, and structured summary output.
- Added `MemoryContextBuilder` to assemble current state, bounded recent messages, rolling summary, important memories, and important world events.
- Added server-side context budget config for recent messages, memories, events, summary chars, and memory chars.
- Added `SummaryService` for threshold-based rolling summary refresh and important memory extraction through `AIGateway` purpose `summary`.
- Added deterministic memory dedup by stable key or exact normalized content.
- Summary refresh is best-effort after gameplay commit and does not roll back a completed turn.

Next step:

- Semantic Memory Retrieval. This should add embeddings/vector search and relevance scoring before NPC runtime intelligence depends on long-term memory.

## Phase 4.8: Semantic Memory Retrieval

Status: completed.

Goals:

- Retrieve persistent memories by semantic similarity without sending full history.
- Keep deterministic memory selection as fallback.
- Store embeddings in PostgreSQL with pgvector.
- Track embedding usage and estimated cost.
- Keep vector search scoped to the current session.

Completed:

- Added provider-neutral `EmbeddingProvider` and `EmbeddingGateway`.
- Added `OpenAIEmbeddingProvider` behind the provider abstraction.
- Added `memory_embeddings` table with pgvector `vector`, provider/model/dimensions, and content hash.
- Added `SemanticMemoryRepository` for embedding upsert, backfill lookup, and session-scoped similarity search.
- Added `MemoryEmbeddingService` for content-hash skip, batch embedding, best-effort summary integration, and backfill support.
- Added `SemanticMemoryService` for query embedding and hybrid ranking by similarity, importance, and recency.
- Updated `MemoryContextBuilder` to merge deterministic and semantic memories with dedup and context caps.
- Added optional `pnpm memory:embed-backfill` and `pnpm ai:embedding-smoke`.
- Semantic retrieval falls back to deterministic memory selection when disabled or unavailable.

Next step:

- NPC Runtime Intelligence Foundation.

## Phase 4.9: NPC Runtime Intelligence Foundation

Status: completed.

Goals:

- Give each game session its own runtime NPC identities.
- Keep NPC secrets and knowledge boundaries server-side.
- Allow NPCs to react during AI gameplay turns when selected by the turn flow.
- Reuse relationship and memory foundations without adding autonomous background simulation.
- Keep NPC AI as a proposer, with server validation and persistence authority.

Completed:

- Added `NPCInitializationService` to clone non-selected story character templates into session-owned runtime NPC rows during session creation.
- Added provider-neutral NPC domain contracts and strict `NPCReactionProposal` validation.
- Added `NPCParticipationSelector` with deterministic name/location selection and a configurable reaction cap.
- Added `NPCKnowledgeBuilder` to assemble NPC-specific context from own profile, own secrets, relationship edge, bounded memories, bounded recent dialogue, relevant events, current scene, and player action.
- Added `AINPCReactionEngine` and `NPCReactionService` so NPC calls go through `AIGateway` with `purpose=npc`.
- Persisted validated NPC state patches, relationship deltas, memory candidates, and NPC events inside the gameplay turn transaction.
- Kept NPC memory embedding best-effort after commit.
- Kept deterministic gameplay mode free of NPC AI calls.

Next step:

- Quest/Consequence Engine Expansion. This should turn validated player/NPC outcomes into more explicit quest, inventory, relationship, and world consequence rules before adding broader world/faction simulation.

## Phase 4.10: Quest/Consequence Engine Expansion

Status: completed.

Goals:

- Normalize gameplay consequences from deterministic commands, main AI proposals, NPC reaction proposals, and future rule sources.
- Keep AI/NPC AI as proposers while the server validates and persists all effects.
- Add bounded quest lifecycle, inventory, relationship, state/reputation, NPC state, memory, and world-event consequences.
- Keep consequence chaining deterministic, capped, and testable.
- Preserve atomic gameplay transaction behavior.

Completed:

- Added provider-neutral consequence contracts and validators in the domain package.
- Added `ConsequenceEngine` to build a server-owned `TurnPersistencePlan`.
- Added deterministic command intents for quest activation/completion/failure and inventory add/remove.
- Added quest lifecycle enforcement for `inactive -> active`, `active -> completed`, and `active -> failed`.
- Added inventory underflow rejection, relationship delta bounds/clamping, safe state/reputation namespaces, and NPC-owned state patch policy.
- Added bounded rule chaining for quest events, quest memories, inventory acquisition events, and relationship threshold events.
- Updated gameplay turn persistence to apply state, quests, inventory, relationships, NPC state, world events, messages, turn count, and last-played timestamp atomically.
- Added protected quest and inventory read endpoints for session owners.
- Added minimal play-page consequence summaries.

Next step:

- World/Faction Simulation Foundation. This should add explicit world-level systems and faction state without introducing autonomous background ticks until the simulation boundaries are designed.

## Phase 4.11: World/Faction Simulation Foundation

Status: completed.

Goals:

- Add session-owned runtime factions.
- Add faction relationship and world tick persistence.
- Keep world simulation deterministic, explicit, bounded, and testable.
- Let important consequences/world events affect faction/world state through server rules.
- Avoid background schedulers, autonomous NPC turns, and AI faction planning.

Completed:

- Added `faction_status`, `factions`, `faction_relationships`, and `world_simulation_states`.
- Added `FactionRepository`, `FactionRelationshipRepository`, and `WorldSimulationStateRepository`.
- Added provider-neutral domain contracts for faction runtime, faction relations, world signals, world simulation context, and world tick plans.
- Added deterministic `runWorldSimulation`, `shouldRunWorldTick`, and explicit signal derivation from safe metadata.
- Added `FactionInitializationService` for deterministic runtime faction cloning. The temporary default faction policy has been superseded by authored faction templates in the playable content authoring phase.
- Added `WorldSimulationService` with post-turn/manual explicit tick execution and optimistic tick state concurrency.
- Added protected `GET /sessions/:id/factions` and `POST /sessions/:id/world-tick`.
- Added minimal play-page faction status display.
- Added tests for domain rules, repository exports/validation, session initialization, faction DTOs, and world tick behavior.

Next step:

- Playable Content Authoring Foundation. This should replace default runtime faction/quest setup with authored templates and validation before deeper world event propagation or NPC affiliation features.

## Phase 4.12: Playable Content Authoring Foundation

Status: completed.

Goals:

- Add owner-managed story drafts.
- Let authenticated authors edit story metadata, public description, internal world instructions, opening setup, playable character templates, NPC templates, faction templates, and initial world settings.
- Validate drafts before publishing.
- Ensure published stories can be played by the existing runtime engine without hardcoded story slugs.
- Keep template data separate from runtime data.

Completed:

- Added `story_character_type` with explicit `playable` and `npc` template roles.
- Added bounded `stories.settings` for initial location and world time.
- Added NPC-template fields on `story_characters`: goals, secrets, initial state, initial location, and metadata.
- Added `story_factions` and `story_faction_relationships` for authored faction templates and initial faction relations.
- Added `StoryAuthoringService` with create draft, owner-only read/update, character/faction template management, publish validation, publish, and archive.
- Added protected `/author/stories` authoring APIs.
- Added minimal `/author`, `/author/stories/new`, and `/author/stories/[id]` web routes.
- Updated session creation so selected player characters must be `playable`.
- Updated NPC initialization to clone only `npc` templates.
- Updated faction initialization to clone authored faction templates instead of hardcoded seed-story defaults.
- Updated initial game state to use authored initial world settings.
- Updated seed data with explicit playable/NPC templates, story settings, and faction templates.

Policy:

- Drafts are freely editable by the owner.
- Published runtime-critical fields are locked in the MVP: world instructions, opening setup, initial settings, character templates, and faction templates.
- Public metadata may still be edited.
- Runtime state never writes back to story authoring templates.

Next step:

- Story Versioning + Runtime Snapshot Hardening. This should introduce durable runtime story snapshots or version records so future published changes can coexist safely with active sessions.

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

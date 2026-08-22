# Database Design

## Database Choice

PostgreSQL is the primary database. The project uses Drizzle ORM for TypeScript schema definitions and checked-in SQL migrations.

## Current Status

The foundational business schema is implemented for the AI Interactive Novel platform. It supports users, auth sessions, story templates, runtime sessions, messages, current state, NPCs, relationships, inventory, quests, factions, world simulation state, and world events.

Memory foundation tables now support rolling summaries, persistent important memories, and pgvector-backed semantic memory retrieval for AI gameplay context.

Not implemented yet:

- Payment, coin, or wallet tables.
- Branching/merge version history, moderation workflow, or marketplace tables.

## Entity Overview

### `users`

Represents an application user with MVP email/password identity fields.

Important columns:

- `id`
- `email`
- `display_name`
- `password_hash`
- `email_verified_at`
- `created_at`
- `updated_at`

`email` is unique. `password_hash` is required for email/password auth and must never be returned in API responses.

### `auth_sessions`

Represents a server-side login session.

Important columns:

- `id`
- `user_id`
- `token_hash`
- `created_at`
- `expires_at`
- `last_used_at`
- `revoked_at`

The raw session token lives only in the browser cookie. The database stores `token_hash`, which is unique. Sessions are valid only when `expires_at` is in the future and `revoked_at` is null.

### `stories`

Represents an authored playable story/world.

Important columns:

- `id`
- `title`
- `slug`
- `description`
- `genre`
- `status`
- `world_prompt`
- `opening_prompt`
- `settings`
- `current_published_version_id`
- `created_by_user_id`
- `created_at`
- `updated_at`

`slug` is unique. `status` uses `story_status`: `draft`, `published`, `archived`.

`settings` stores bounded authoring configuration for initial runtime setup. Current supported keys are:

- `initialLocation`
- `initialWorldTime`
- optional future-safe `statDefinitions`

`stories` is the catalog and owner working-copy record. Runtime-critical published data is copied into immutable `story_versions`. A story can be public while its working copy is back in `draft` for the next revision as long as `current_published_version_id` points at a published version and the story is not archived.

### `story_versions`

Represents an immutable published runtime snapshot for a story.

Important columns:

- `id`
- `story_id`
- `version_number`
- `status`
- `world_prompt`
- `opening_prompt`
- `settings`
- `created_by_user_id`
- `published_at`
- `created_at`

`(story_id, version_number)` is unique. Normal application APIs do not update version prompts/settings after creation. Older versions may be marked `retired`, but existing sessions can keep using them.

### `story_version_characters`

Represents the playable and NPC character templates copied into a specific story version. Public story detail returns playable rows from the current published version, so session creation receives a version-character id instead of a mutable authoring character id.

### `story_version_factions`

Represents faction templates copied into a specific story version. Runtime faction initialization reads these rows, never mutable `story_factions`.

### `story_version_faction_relationships`

Represents initial faction relationships copied into a specific story version. Runtime faction relationship initialization reads these rows together with version factions so a session never mixes templates from different versions.

### `story_characters`

Represents character templates belonging to a story. These are not runtime NPC rows.

Important columns:

- `id`
- `story_id`
- `character_type`
- `name`
- `description`
- `personality`
- `background`
- `goals`
- `secrets`
- `initial_stats`
- `initial_state`
- `initial_location`
- `metadata`
- `created_at`
- `updated_at`

`character_type` uses `story_character_type`: `playable`, `npc`.

Session creation accepts only `playable` templates as the selected player character. NPC initialization clones only `npc` templates into `npcs`. This replaces the previous temporary policy that inferred NPCs from all non-selected characters.

NPC template `secrets` are authoring/server data. They are copied into runtime NPC rows for NPC AI context but are not exposed through public story DTOs, session DTOs, logs, or browser APIs.

### `story_factions`

Represents authored faction templates for a story.

Important columns:

- `id`
- `story_id`
- `faction_key`
- `name`
- `description`
- `initial_status`
- `initial_influence`
- `resources`
- `goals`
- `state`
- `created_at`
- `updated_at`

`(story_id, faction_key)` is unique. `initial_influence` is constrained to `0..100`.

When a session starts, `FactionInitializationService` clones these rows into session-owned `factions`. A story with no faction templates creates zero runtime factions and remains playable.

### `story_faction_relationships`

Represents optional authored directed initial relationships between story faction templates.

Important columns:

- `id`
- `story_id`
- `source_faction_id`
- `target_faction_id`
- `affinity`
- `tension`
- `metadata`
- `created_at`
- `updated_at`

The application clones these relationships into runtime `faction_relationships` after faction templates are cloned. Self-edges are rejected and values are constrained to `-100..100`.

### `game_sessions`

Represents one playthrough by one user in one story.

Important columns:

- `id`
- `user_id`
- `story_id`
- `story_version_id`
- `selected_character_id`
- `selected_version_character_id`
- `title`
- `status`
- `turn_count`
- `created_at`
- `updated_at`
- `last_played_at`

`status` uses `session_status`: `active`, `completed`, `abandoned`.

Every new session pins `story_version_id` and `selected_version_character_id` at creation time. `story_id` remains a catalog reference. Legacy nullable columns are kept so existing sessions can be backfilled safely.

### `game_messages`

Stores ordered session transcript messages.

Important columns:

- `id`
- `session_id`
- `role`
- `content`
- `turn_number`
- `created_at`

`role` uses `message_role`: `system`, `player`, `assistant`.

For deterministic gameplay turns, both the player action message and assistant result message use the same `turn_number`. The turn number represents one user action plus one server result, not an individual row index.

### `game_states`

Stores the current structured state for a session.

Important columns:

- `id`
- `session_id`
- `version`
- `location`
- `world_time`
- `player_stats`
- `flags`
- `state_data`
- `created_at`
- `updated_at`

`session_id` is unique so each session has one current state row. `version` is reserved for optimistic state versioning.

When a session is created from a published story, the API resolves `stories.current_published_version_id`, validates the selected playable `story_version_characters` row, then creates the `game_sessions` row and first `game_states` row in one transaction. The initial state is deterministic and uses versioned story settings where available:

- `location`: selected version character `initial_location`, then story version `settings.initialLocation`, then legacy fallback `Điểm khởi đầu`
- `world_time`: story version `settings.initialWorldTime` or `NULL`
- `player_stats`: deep copy of the selected version character's `initial_stats`
- `flags`: selected story/version/character markers and `aiEnabled: false`
- `state_data`: initialization metadata, copied version settings, copied character initial state, and `gameplayEnabled: false`

The fallback exists only for legacy data. New publish validation requires an authored initial location.

### `npcs`

Stores runtime NPC state for a session. An NPC may optionally reference a story character template, but runtime state is separate.

Important columns:

- `id`
- `session_id`
- `template_character_id`
- `name`
- `description`
- `personality`
- `goals`
- `secrets`
- `current_state`
- `alive`
- `created_at`
- `updated_at`

The current schema is sufficient for the NPC runtime intelligence foundation, so no migration was added for this step. `personality`, `goals`, and `secrets` hold runtime NPC identity, while `current_state` stores safe server-owned runtime fields such as location, mood, stance, current goal, attention, and last interaction turn.

When a session starts, the application clones only `story_characters.character_type = npc` templates into session-owned NPC rows.

NPC secrets are never returned to browser DTOs and are not written into messages, world events, or usage records by default.

### `relationships`

Stores runtime relationship edges. It supports `player -> npc`, `npc -> player`, and `npc -> npc`.

Important columns:

- `id`
- `session_id`
- `source_type`
- `source_id`
- `target_type`
- `target_id`
- `affinity`
- `trust`
- `fear`
- `metadata`
- `updated_at`

`source_type` and `target_type` use `entity_type`: `player`, `npc`. When an endpoint is `player`, its ID is `NULL`; when it is `npc`, its ID must be present. Range checks keep `affinity` and `trust` between `-100..100`, and `fear` between `0..100`.

NPC reaction proposals can suggest relationship deltas only. The application validates the target, clamps values to table ranges, and persists the resulting edge through `RelationshipRepository.upsertRelationship`.

### `inventory_items`

Stores runtime inventory items owned by the player or an NPC.

Important columns:

- `id`
- `session_id`
- `owner_type`
- `owner_id`
- `item_key`
- `name`
- `description`
- `quantity`
- `metadata`
- `created_at`
- `updated_at`

`quantity` must be positive. Player ownership uses `owner_id = NULL`; NPC ownership requires `owner_id`.

### `quests`

Stores runtime quest state for a session.

Important columns:

- `id`
- `session_id`
- `quest_key`
- `title`
- `description`
- `status`
- `progress`
- `created_at`
- `updated_at`

`status` uses `quest_status`: `inactive`, `active`, `completed`, `failed`. `(session_id, quest_key)` is unique.

Quest lifecycle is enforced by the application service:

- `inactive -> active`
- `active -> completed`
- `active -> failed`

Completed or failed quests cannot be reopened by AI output. A future reset/reopen mechanic would need an explicit server-side rule.

`progress` is JSONB, but consequence validation keeps it conservative: bounded depth, bounded key count, scalar values only, finite numeric ranges, and no arbitrary oversized nested structures. Runtime quests can be created by validated consequences using a stable `quest_key`; duplicate keys are not silently overwritten.

### `world_events`

Stores validated world events in a session.

Important columns:

- `id`
- `session_id`
- `event_type`
- `title`
- `description`
- `importance`
- `payload`
- `turn_number`
- `created_at`

`importance` is an integer from `1..5`, not an enum, because the product will need sorting, threshold filters, and balancing without changing enum values.

Consequence-generated events are server-owned. AI and NPC proposals cannot provide IDs, timestamps, session IDs, or turn numbers. The service caps event count per turn and persists only meaningful events such as quest state changes, important item acquisition, major movement, and relationship threshold crossings.

### `factions`

Stores session-owned runtime faction state.

Important columns:

- `id`
- `session_id`
- `faction_key`
- `name`
- `description`
- `status`
- `influence`
- `resources`
- `goals`
- `state`
- `created_at`
- `updated_at`

`status` uses `faction_status`: `active`, `weakened`, `collapsed`, `hidden`. `(session_id, faction_key)` is unique. `influence` is constrained to `0..100`.

`resources`, `goals`, and `state` are JSONB, but the world simulation layer treats them as bounded server-owned runtime state. MVP resource keys are `wealth`, `manpower`, `supplies`, and `politicalPower`; broader economy simulation is future work.

Runtime factions are cloned from `story_factions`. Application runtime logic should not create factions based on hardcoded story slugs.

### `faction_relationships`

Stores directed faction-to-faction runtime edges.

Important columns:

- `id`
- `session_id`
- `source_faction_id`
- `target_faction_id`
- `affinity`
- `tension`
- `metadata`
- `updated_at`

`affinity` and `tension` are constrained to `-100..100`. Self-edges are rejected. Edges are directed so `A -> B` can diverge from `B -> A` in future faction systems.

This table is separate from `relationships` because the existing relationship model is intentionally constrained to player/NPC runtime entities.

### `world_simulation_states`

Stores per-session tick bookkeeping.

Important columns:

- `id`
- `session_id`
- `last_tick_turn`
- `version`
- `created_at`
- `updated_at`

`session_id` is unique. `version` supports optimistic tick concurrency so two requests cannot apply the same due tick twice.

### `ai_usage_records`

Stores provider-neutral AI usage accounting records.

Important columns:

- `id`
- `user_id`, nullable
- `session_id`, nullable
- `provider`
- `model`
- `purpose`
- `status`
- `input_tokens`
- `output_tokens`
- `total_tokens`
- `estimated_cost_micros`
- `latency_ms`
- `provider_request_id`
- `error_code`
- `created_at`

`purpose` uses `ai_usage_purpose`: `gameplay_turn`, `smoke`, `summary`, `npc`, `memory`, `embedding`, `other`.

`status` uses `ai_usage_status`: `success`, `failed`.

The table does not store API keys, auth cookies, emails, full prompts, or full AI output.

### `session_summaries`

Stores one rolling compact narrative summary per game session.

Important columns:

- `id`
- `session_id`
- `summary_text`
- `summarized_through_turn`
- `version`
- `created_at`
- `updated_at`

`session_id` is unique. `version` supports optimistic summary updates so an older summary refresh cannot silently overwrite a newer one.

### `session_memories`

Stores structured long-term memory facts for a game session.

Important columns:

- `id`
- `session_id`
- `memory_type`
- `subject_type`, nullable
- `subject_id`, nullable
- `key`, nullable
- `content`
- `importance`
- `first_observed_turn`, nullable
- `last_confirmed_turn`, nullable
- `active`
- `metadata`
- `created_at`
- `updated_at`

`memory_type` uses `memory_type`: `fact`, `relationship`, `event`, `player`, `world`, `npc`, `quest`, `other`.

`importance` is constrained to `1..5`. Stable-key dedup uses the unique `(session_id, key)` index when `key` is present. Memories without keys use conservative application-level normalized exact-content dedup for now.

Memory records help build AI context. They are not authoritative state and do not override `game_states`.

### `memory_embeddings`

Stores pgvector embeddings for active persistent memories.

Important columns:

- `id`
- `memory_id`
- `provider`
- `model`
- `dimensions`
- `embedding`
- `content_hash`
- `created_at`
- `updated_at`

`embedding` uses pgvector's `vector` type, not JSONB. The migration creates `CREATE EXTENSION IF NOT EXISTS vector`, so PostgreSQL deployments must support pgvector.

`(memory_id, provider, model)` is unique. This allows safe re-embedding and model migration without mixing incompatible provider/model rows.

The table does not store prompt text, API keys, cookies, emails, or full transcript rows.

## Table Relationships

- `stories.created_by_user_id -> users.id`, nullable.
- `auth_sessions.user_id -> users.id`.
- `story_characters.story_id -> stories.id`.
- `game_sessions.user_id -> users.id`.
- `game_sessions.story_id -> stories.id`.
- `game_sessions.selected_character_id -> story_characters.id`, nullable.
- `game_messages.session_id -> game_sessions.id`.
- `game_states.session_id -> game_sessions.id`, unique.
- `npcs.session_id -> game_sessions.id`.
- `npcs.template_character_id -> story_characters.id`, nullable.
- `relationships.session_id -> game_sessions.id`.
- `inventory_items.session_id -> game_sessions.id`.
- `quests.session_id -> game_sessions.id`.
- `world_events.session_id -> game_sessions.id`.
- `factions.session_id -> game_sessions.id`.
- `faction_relationships.session_id -> game_sessions.id`.
- `faction_relationships.source_faction_id -> factions.id`.
- `faction_relationships.target_faction_id -> factions.id`.
- `world_simulation_states.session_id -> game_sessions.id`, unique.
- `ai_usage_records.user_id -> users.id`, nullable.
- `ai_usage_records.session_id -> game_sessions.id`, nullable.
- `session_summaries.session_id -> game_sessions.id`, unique.
- `session_memories.session_id -> game_sessions.id`.
- `memory_embeddings.memory_id -> session_memories.id`.

Polymorphic runtime references such as relationship endpoints and inventory owners are represented by `entity_type` plus nullable UUID columns. They are constrained for player/NPC shape, but exact NPC existence is expected to be enforced by domain/application services until a dedicated entity registry is introduced.

## Template Vs Runtime

Templates are authored story data:

- `stories`
- `story_characters`

Runtime data belongs to a specific playthrough:

- `game_sessions`
- `game_messages`
- `game_states`
- `npcs`
- `relationships`
- `inventory_items`
- `quests`
- `world_events`
- `factions`
- `faction_relationships`
- `world_simulation_states`
- `ai_usage_records`
- `session_summaries`
- `session_memories`
- `memory_embeddings`

This separation prevents story templates from being mutated by playthrough state. A runtime NPC can reference a template through `npcs.template_character_id`, but its current goals, secrets, alive status, and state are session-owned.

Story browsing APIs expose only published story metadata and character template fields intended for players. `world_prompt` and `opening_prompt` remain internal orchestration fields and are not returned by catalog/detail DTOs.

## Repository Query Patterns

Application services use repository interfaces from `packages/db`; they do not use Drizzle query syntax directly.

Current story/session browsing operations:

- `StoryRepository.listPublishedPage({ genre, limit, offset })` powers `GET /stories`.
- `StoryRepository.getBySlug(slug)` plus `listCharactersForStory(storyId)` powers `GET /stories/:slug`.
- `StoryRepository.getCharacterForStory(storyId, characterId)` validates that a selected character belongs to the selected story.
- `GameSessionRepository.create(...)` and `GameStateRepository.createInitialState(...)` are composed by the API service inside a shared transaction.
- `GameSessionRepository.listForUser(userId)` and owner checks on `getById(id)` ensure users can only list/open their own sessions.
- `SessionSummaryRepository.getForSession(sessionId)` loads the compact rolling summary.
- `SessionSummaryRepository.upsertSummary(...)` and `updateWithVersion(...)` persist summary refreshes with optimistic concurrency.
- `MemoryRepository.listImportantForSession(sessionId, limit)` selects bounded memory by importance and recency for AI context.
- `MemoryRepository.findByKey(sessionId, key)` supports deterministic memory dedup without embeddings.
- `MemoryRepository.createMemory(...)`, `updateMemory(...)`, `deactivateMemory(...)`, and `confirmMemory(...)` manage validated persistent memory facts.
- `SemanticMemoryRepository.upsertEmbedding(...)` stores provider/model/dimension-scoped memory embeddings.
- `SemanticMemoryRepository.searchSimilar(...)` performs session-scoped vector search and returns memories with similarity scores.
- `SemanticMemoryRepository.listActiveMemoriesMissingEmbedding(...)` supports explicit backfill without running embedding work at startup.
- `QuestRepository.getByQuestKey(...)`, `create(...)`, and `updateStatusOrProgress(...)` apply validated quest lifecycle changes from the consequence engine.
- `InventoryRepository.addOrUpdateQuantity(...)` and `changeQuantity(...)` apply validated player/NPC inventory consequences and reject underflow.
- `RelationshipRepository.getRelationship(...)` and `upsertRelationship(...)` apply validated relationship deltas after target/session checks.
- `WorldEventRepository.append(...)` stores server-assigned events generated by deterministic commands, AI proposals, NPC reactions, or rule chaining.
- `FactionRepository.create(...)`, `listBySession(...)`, `getByKey(...)`, `getByIdForSession(...)`, and `updateRuntimeState(...)` manage session-owned faction runtime state.
- `FactionRelationshipRepository.listForSession(...)`, `getRelation(...)`, and `upsertRelation(...)` manage directed faction edges.
- `WorldSimulationStateRepository.getForSession(...)`, `createInitial(...)`, and `updateAfterTickWithVersion(...)` guard explicit world tick execution.

The foundation currently uses page/limit pagination for story catalog browsing. Cursor pagination can replace or supplement it when catalog size, ranking, or search requirements justify it.

## Session Creation Transaction

Session creation is atomic:

```text
SessionService
  -> validate story is published
  -> validate selected character belongs to story
  -> withTransaction
      -> create game_sessions row
      -> create initial game_states row
  -> load session detail DTO
```

No repository opens its own transaction for this use case. The application service owns the boundary so future gameplay initialization can add NPC runtime rows, relationships, inventory, quests, and world events to the same unit of work.

No assistant/opening message is created during session creation. Transcript rows begin only when the player submits a turn.

## Deterministic Turn Transaction

Gameplay turns are persisted atomically:

```text
GameplayService
  -> withTransaction
      -> load session and enforce ownership
      -> load current game_states row
      -> get last message turn number
      -> append player game_messages row
      -> run deterministic domain engine
      -> build and validate consequence plan
      -> update game_states where version = expectedVersion
      -> persist validated quests, inventory, relationships, NPC state, and memory candidates
      -> append world_events rows when the transition is significant
      -> append assistant game_messages row
      -> increment game_sessions.turn_count
      -> touch game_sessions.last_played_at
  -> response DTO
```

If the state update fails because `game_states.version` changed, the repository raises `StateVersionConflictError` and the API returns HTTP 409. The turn is not retried automatically because retrying could apply the same player action twice. PostgreSQL transaction rollback ensures partial messages/events do not remain after a failed turn.

Current deterministic commands:

- `look`, `quan sát`, `quan sat`, `nhìn`, `nhin`: returns a location/story description and records `lastCommand`.
- `rest`, `nghỉ`, `nghi`: increments `state_data.restCount` and records `lastCommand`.
- `move <location>`, `go <location>`, `đi <location>`, `di <location>`: updates `game_states.location` and appends a `movement` world event.
- `status`, `trạng thái`, `trang thai`: returns a state summary and records `lastCommand`.
- Unknown actions: player input is stored and an assistant fallback is stored; no location change or world event is created.

Session detail reads load at most 50 recent messages for the play page. Full transcript pagination remains the responsibility of future transcript/history endpoints.

## Memory Context Queries

AI gameplay context is assembled without loading full history:

```text
MemoryContextBuilder
  -> GameStateRepository.getCurrentState
  -> GameMessageRepository.getRecentMessages(limit)
  -> SessionSummaryRepository.getForSession
  -> MemoryRepository.listImportantForSession(limit)
  -> WorldEventRepository.getImportantEvents(minImportance, limit)
```

The current caps come from server config:

- `AI_CONTEXT_MAX_RECENT_MESSAGES`
- `AI_CONTEXT_MAX_MEMORIES`
- `AI_CONTEXT_MAX_WORLD_EVENTS`
- `AI_CONTEXT_MAX_SUMMARY_CHARS`
- `AI_CONTEXT_MAX_MEMORY_CHARS`

The baseline selection is deterministic: state first, summary, recent messages, important memories by importance/confirmation recency, and important world events.
When semantic retrieval is enabled, the deterministic memory set is merged with vector results and ranked by similarity, importance, and recency before the final memory cap is applied.

## Semantic Memory Search

Vector search is scoped at the repository query level:

```text
SemanticMemoryRepository.searchSimilar
  -> memory_embeddings
  -> join session_memories
  -> filter session_memories.session_id = requested session
  -> filter active memories
  -> filter provider/model/dimensions
  -> order by pgvector distance
```

The API does not run a global vector search and then filter another user's memories in application code.

The current pgvector column is unbounded `vector` plus a `dimensions` column. Search only compares rows matching the configured provider/model and query dimensions. This keeps model migration safe without destructive schema changes.

## Consequence Persistence Plan

Gameplay persistence now flows through a server-owned consequence plan:

```text
AI/NPC/deterministic proposals
  -> validate consequence proposals
  -> ConsequenceEngine
  -> bounded rule registry
  -> TurnPersistencePlan
  -> transaction
```

The plan can contain safe state patches, quest changes, inventory changes, relationship deltas, NPC-owned state updates, world events, and memory candidates. It is not exposed to clients and is never constructed directly by AI output.

Quest transitions are validated before persistence. Inventory removal rejects underflow instead of clamping silently. Relationship deltas are bounded per turn and final values are clamped to table ranges. Reputation-like values are stored only in approved `game_states.state_data.reputation.*` keys.

Consequence chaining is capped at a small deterministic depth. Current generic rules can derive world events from quest changes, important item acquisition, and relationship threshold crossings. There is no recursive AI call and no scripting language.

If any validated consequence cannot persist, the gameplay transaction rolls back. AI usage rows remain outside this transaction because provider cost has already been incurred.

## World Tick Transaction

World simulation runs outside the gameplay transaction:

```text
Gameplay turn commits
  -> WorldTickPolicy checks interval/signals
  -> WorldSimulationEngine builds deterministic WorldTickPlan
  -> withTransaction
      -> recheck world_simulation_states.version
      -> update factions
      -> upsert faction_relationships
      -> update game_states only for server-owned world patch when present
      -> append world_events
      -> upsert session_memories
      -> advance world_simulation_states.last_tick_turn and version
```

If world tick persistence fails, the tick transaction rolls back. The already-committed gameplay turn remains committed. Memory embedding for world memories remains best-effort after the tick transaction commits.

World ticks are explicit. There is no cron, scheduler, worker, or background loop in this phase.

## AI Turn Proposal Transaction

When `GAMEPLAY_ENGINE_MODE=ai`, the AI call is deliberately separated from the database transaction:

```text
GameplayService
  -> load owned active session snapshot
  -> load current game_states row and version
  -> load bounded memory context
  -> call AIGateway for AITurnProposal
  -> validate proposal with domain allowlists
  -> collect bounded NPC reaction proposals when relevant
  -> build server-owned TurnPersistencePlan
  -> withTransaction
      -> reload session and current game_states row
      -> reject if version changed
      -> append player game_messages row
      -> update game_states where version = expectedVersion
      -> persist validated quests, inventory, relationships, NPC state, and memory candidates
      -> append validated world_events rows
      -> append assistant narrative game_messages row
      -> increment game_sessions.turn_count
      -> touch game_sessions.last_played_at
```

This avoids holding PostgreSQL locks or transaction resources while waiting for the external AI provider. If the state version changes after the AI response but before persistence, the proposal is discarded and the API returns HTTP 409. No player message, assistant message, event, turn count, or state change is partially committed.

AI proposals cannot directly set IDs, owners, session IDs, timestamps, versions, turn counts, or arbitrary event payloads. The server validates state patches and assigns persistence metadata.

## Summary Refresh

After an AI gameplay turn commits, `SummaryService` may refresh memory when the number of unsummarized turns reaches `AI_SUMMARY_INTERVAL_TURNS`.

```text
SummaryService
  -> load previous session_summaries row
  -> load bounded messages/events after summarizedThroughTurn
  -> BudgetService check for purpose=summary
  -> AIGateway structured summary call
  -> validate SummaryOutput
  -> update session_summaries with expected version
  -> upsert session_memories from validated importantFacts
```

Summary refresh is outside the gameplay transaction. If summary AI, validation, or persistence fails, the already-committed gameplay turn remains committed and the previous summary/memory state remains usable.

## AI Usage Ledger

`ai_usage_records` is written by the API-side `RepositoryAIUsageLedger`, not by provider adapters.

Ledger rows capture:

- `user_id`
- `session_id`, nullable
- purpose
- provider
- model
- input tokens
- output tokens
- total tokens
- estimated cost micros
- latency milliseconds
- status
- provider request ID
- safe error code
- created time

AI usage persistence is intentionally outside the gameplay transaction. If the provider call succeeds but proposal validation or optimistic concurrency later rejects the gameplay turn, the usage row stays committed because the call already incurred cost.

Cost fields are nullable. If provider usage is unavailable or model pricing is not configured, the system records the tokens it has and leaves `estimated_cost_micros = NULL`.

## AI Budget Queries

`AIUsageRepository` exposes aggregate cost queries:

- `getUserCostSince(userId, since)`
- `getSessionCostSince(sessionId, since)`

These use database-side `sum(estimated_cost_micros)` rather than loading rows into application memory.

Budget checks currently use:

- current UTC day for daily user budget
- current UTC month for monthly user budget
- lifetime session usage for session budget

This is preflight enforcement, not an atomic reservation. Concurrent requests can overshoot slightly before their usage rows are written. A future payment/Xu system should add quota reservations or ledger debits for hard enforcement.

## JSONB Strategy

JSONB is used only for flexible data whose shape may vary by story or future gameplay module:

- `story_characters.initial_stats`
- `game_states.player_stats`
- `game_states.flags`
- `game_states.state_data`
- `npcs.personality`
- `npcs.goals`
- `npcs.secrets`
- `npcs.current_state`
- `relationships.metadata`
- `inventory_items.metadata`
- `quests.progress`
- `world_events.payload`

Frequently filtered fields remain real columns: status, slug, session ID, story ID, user ID, turn number, item key, quest key, alive, and importance.

The full game is not stored as one JSON blob. Structured tables keep persistent state queryable and auditable.

## Index Strategy

Current indexes:

- `auth_sessions_token_hash_unique`
- `auth_sessions_user_id_idx`
- `auth_sessions_expires_at_idx`
- `stories_status_idx`
- `story_characters_story_id_idx`
- `game_sessions_user_id_idx`
- `game_sessions_story_id_idx`
- `game_sessions_status_idx`
- `game_sessions_last_played_at_idx`
- `game_messages_session_turn_idx`
- `game_states_session_id_unique`
- `npcs_session_id_idx`
- `npcs_template_character_id_idx`
- `relationships_unique_edge_idx`
- `relationships_session_source_idx`
- `relationships_session_target_idx`
- `inventory_items_session_owner_idx`
- `inventory_items_session_item_key_idx`
- `quests_session_quest_key_unique`
- `quests_session_status_idx`
- `world_events_session_turn_idx`
- `world_events_session_importance_idx`
- `factions_session_key_unique`
- `factions_session_status_idx`
- `faction_relationships_unique_edge_idx`
- `faction_relationships_session_source_idx`
- `faction_relationships_session_target_idx`
- `world_simulation_states_session_unique`
- `ai_usage_records_user_created_at_idx`
- `ai_usage_records_session_created_at_idx`
- `ai_usage_records_provider_model_created_at_idx`
- `ai_usage_records_purpose_created_at_idx`
- `ai_usage_records_status_created_at_idx`
- `session_summaries_session_id_unique`
- `session_memories_session_active_idx`
- `session_memories_session_importance_idx`
- `session_memories_session_memory_type_idx`
- `session_memories_session_last_confirmed_idx`
- `session_memories_session_key_unique`
- `memory_embeddings_memory_provider_model_unique`
- `memory_embeddings_memory_id_idx`
- `memory_embeddings_provider_model_idx`

These support common access patterns: loading a user's sessions, filtering story/session status, loading transcript by turn, loading current state, loading runtime entities by session, querying important world events, and aggregating AI cost by user/session/provider/purpose/status windows.

The memory indexes support loading active memories, important memories, memories by type, recent confirmations, stable-key dedup per session, and embedding lookup/backfill by memory/provider/model.

No approximate vector index is added yet. For MVP, vector search is scoped to one session's embedded memories. If sessions grow large enough, add a pgvector HNSW/IVFFlat index after choosing fixed operational dimensions for the active embedding model.

## Deletion And Cascade Strategy

- Deleting a user cascades their `game_sessions`. This removes session-owned runtime rows through session cascades.
- Deleting a user cascades their `auth_sessions`.
- Deleting a story is restricted when sessions reference it, preserving playthrough history.
- Deleting a story cascades its `story_characters` only when no session restriction blocks the story deletion.
- `stories.created_by_user_id` is set to null when the creator user is deleted.
- `game_sessions.selected_character_id` is set to null if a character template is removed.
- `npcs.template_character_id` is set to null if a template is removed.
- Session-owned runtime rows cascade on session deletion: messages, current state, NPCs, relationships, inventory items, quests, factions, faction relationships, world simulation state, world events, summaries, memories, and memory embeddings through memory cascade.
- `ai_usage_records.session_id` is set to null when a session is deleted so cost/accounting history can remain without retaining the deleted session link.
- `ai_usage_records.user_id` cascades when a user is deleted, aligning with user data deletion.

## LLM Safety Boundary

The LLM may propose narrative text and candidate state changes, but it must never write directly to these tables. Future AI output must pass through server-side schema validation, domain validation, authorization, and transaction-controlled persistence.

No schema field hardcodes OpenAI or any provider-specific concept.

## Enum Source Of Truth

TypeScript constants in `@ai-novel/domain` define enum values:

- `storyStatuses`
- `sessionStatuses`
- `messageRoles`
- `questStatuses`
- `entityTypes`

Drizzle `pgEnum` declarations import those constants. This keeps TypeScript unions and PostgreSQL enum values aligned from one source. When enum values change, migration review is still required because PostgreSQL enum changes are database operations.

## Migration Strategy

Migration files are checked into `packages/db/drizzle`.

Current migration:

- `0000_thin_loki.sql`
- `0001_high_starhawk.sql`
- `0002_funny_rhodey.sql`
- `0003_salty_mimic.sql`
- `0004_careless_yellow_claw.sql`
- `0005_curvy_gressill.sql`
- `0006_grey_nekra.sql`

Migration generation does not require a local PostgreSQL server. Applying migrations will require a target database and should not be done against production manually.

## Development Seed

Development seed data exists in `packages/db/src/seed/development.ts`.

It includes:

- One demo user.
- Three original stories: `Đại Việt 1288`, `Ngày Thứ Nhất`, `Căn Phòng Khóa Kín`.
- Two character templates per story.

The seed contains original short content only and no third-party copyrighted story/IP material.

## Repository Strategy

Application code should use repository interfaces instead of Drizzle query builders directly. The current repository layer lives in `packages/db/src/repositories`.

Repository groups:

- `UserRepository`
- `AuthSessionRepository`
- `StoryRepository`
- `StoryFactionRepository`
- `StoryFactionRelationshipRepository`
- `GameSessionRepository`
- `GameMessageRepository`
- `GameStateRepository`
- `NPCRepository`
- `RelationshipRepository`
- `InventoryRepository`
- `QuestRepository`
- `WorldEventRepository`
- `FactionRepository`
- `FactionRelationshipRepository`
- `WorldSimulationStateRepository`
- `AIUsageRepository`

The repositories are organized around aggregates and use cases rather than one generic CRUD abstraction. For example, `GameSessionRepository` exposes session-specific operations such as `listForUser`, `touchLastPlayedAt`, and `incrementTurnCount`; `GameStateRepository` exposes `updateStateWithVersion` for optimistic concurrency.

The factory `createRepositories(db)` builds a repository set from a database executor. API/application code should depend on these interfaces and persisted record/input DTOs, not on Drizzle internals.

## Transaction Strategy

`withTransaction(db, work)` creates a `RepositoryContext` with repositories bound to the same transaction client. This keeps transaction ownership at the application/service layer.

A future gameplay turn should use one transaction boundary for operations such as:

- append player message
- update game state
- update NPC state
- upsert relationships
- change inventory
- append world events
- append assistant message
- increment session turn count

Repositories do not open their own transaction for each method. This prevents a multi-step turn from partially committing when later steps fail.

## Optimistic Concurrency

`game_states.version` is used by `GameStateRepository.updateStateWithVersion`.

The update pattern is:

```text
UPDATE game_states
SET version = version + 1, ...
WHERE session_id = ?
AND version = ?
RETURNING *
```

If no row is returned, the repository throws `StateVersionConflictError`. This prevents silent overwrites when two requests try to update the same session state from different versions.

## Query Patterns

Current repository query patterns include:

- user lookup by ID or email
- auth session create/validate/revoke/touch
- story lookup by ID or slug
- story create/update for owner authoring
- published story listing
- story listing by genre or creator
- character template create/update/delete/list by type
- story faction template create/update/delete/list
- story faction relationship template list/create/delete
- session create/get/list/touch/status update/turn increment
- message append/recent/page/last turn lookup
- current state create/get/versioned update
- NPC list/get/update runtime state
- relationship edge lookup/list/upsert
- inventory list/add/decrement/remove
- quest list/get/create/update status or progress
- world event append/recent/important listing
- faction list/get/create/update
- faction relationship list/get/upsert
- world simulation state get/create/versioned tick update
- AI usage record success/failure insert
- AI usage listing by user/session
- AI usage aggregate cost by user/session since a timestamp

Integration tests are opt-in through `TEST_DATABASE_URL`; local unit and contract tests do not require PostgreSQL.

## Production Lifecycle

The API uses a singleton PostgreSQL pool for the server process. Pool sizing is controlled by:

- `DATABASE_POOL_MAX`
- `DATABASE_POOL_IDLE_TIMEOUT_MS`
- `DATABASE_POOL_CONNECTION_TIMEOUT_MS`

The application must not create a new connection pool per request. Graceful shutdown closes the Fastify server and then closes the shared pool.

Migrations are explicit operational commands and are not run during API startup:

```bash
pnpm db:migrate
pnpm db:status
```

Deploy order:

1. Confirm managed PostgreSQL backups/PITR.
2. Apply migrations.
3. Run required backfills such as `pnpm story:version-backfill`.
4. Run `pnpm memory:embed-backfill` when semantic memory is enabled and existing memories need embeddings.
5. Start the API.
6. Verify `/health`, `/ready`, and production smoke checks.

`GET /ready` checks database connectivity. When semantic memory is enabled it also checks that the PostgreSQL `vector` extension is enabled. The readiness response is safe and never includes `DATABASE_URL`, SQL text, connection strings, or provider secrets.

Production PostgreSQL should be managed with backups/PITR. No destructive data-retention job runs automatically in the application today.

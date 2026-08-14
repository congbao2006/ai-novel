# Database Design

## Database Choice

PostgreSQL is the primary database. The project uses Drizzle ORM for TypeScript schema definitions and checked-in SQL migrations.

## Current Status

The foundational business schema is implemented for the AI Interactive Novel platform. It supports users, auth sessions, story templates, runtime sessions, messages, current state, NPCs, relationships, inventory, quests, and world events.

Not implemented yet:

- Payment, coin, or wallet tables.
- AI usage ledger tables.
- AI-generated gameplay writes.
- Story editor/versioning tables.

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
- `created_by_user_id`
- `created_at`
- `updated_at`

`slug` is unique. `status` uses `story_status`: `draft`, `published`, `archived`.

### `story_characters`

Represents character templates belonging to a story. These are not runtime NPC rows.

Important columns:

- `id`
- `story_id`
- `name`
- `description`
- `personality`
- `background`
- `initial_stats`
- `created_at`
- `updated_at`

### `game_sessions`

Represents one playthrough by one user in one story.

Important columns:

- `id`
- `user_id`
- `story_id`
- `selected_character_id`
- `title`
- `status`
- `turn_count`
- `created_at`
- `updated_at`
- `last_played_at`

`status` uses `session_status`: `active`, `completed`, `abandoned`.

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

When a session is created from a published story, the API creates the `game_sessions` row and first `game_states` row in one transaction. The initial state is deterministic and uses safe defaults:

- `location`: `Điểm khởi đầu`
- `world_time`: `NULL`
- `player_stats`: deep copy of the selected story character's `initial_stats`
- `flags`: selected story/character markers and `aiEnabled: false`
- `state_data`: initialization metadata and `gameplayEnabled: false`

The current schema does not yet include authored public initial location/world-time fields on story templates. That is an intentional technical debt for the story-authoring phase, not a reason to expose internal prompts.

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
      -> update game_states where version = expectedVersion
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

These support common access patterns: loading a user's sessions, filtering story/session status, loading transcript by turn, loading current state, loading runtime entities by session, and querying important world events.

## Deletion And Cascade Strategy

- Deleting a user cascades their `game_sessions`. This removes session-owned runtime rows through session cascades.
- Deleting a user cascades their `auth_sessions`.
- Deleting a story is restricted when sessions reference it, preserving playthrough history.
- Deleting a story cascades its `story_characters` only when no session restriction blocks the story deletion.
- `stories.created_by_user_id` is set to null when the creator user is deleted.
- `game_sessions.selected_character_id` is set to null if a character template is removed.
- `npcs.template_character_id` is set to null if a template is removed.
- Session-owned runtime rows cascade on session deletion: messages, current state, NPCs, relationships, inventory items, quests, and world events.

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
- `GameSessionRepository`
- `GameMessageRepository`
- `GameStateRepository`
- `NPCRepository`
- `RelationshipRepository`
- `InventoryRepository`
- `QuestRepository`
- `WorldEventRepository`

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
- published story listing
- story listing by genre or creator
- session create/get/list/touch/status update/turn increment
- message append/recent/page/last turn lookup
- current state create/get/versioned update
- NPC list/get/update runtime state
- relationship edge lookup/list/upsert
- inventory list/add/decrement/remove
- quest list/get/create/update status or progress
- world event append/recent/important listing

Integration tests are opt-in through `TEST_DATABASE_URL`; local unit and contract tests do not require PostgreSQL.

# Database Design

## Database Choice

PostgreSQL is the primary database. The project uses Drizzle ORM for TypeScript schema definitions and checked-in SQL migrations.

## Current Status

The foundational business schema is implemented for the AI Interactive Novel platform. It supports users, story templates, runtime sessions, messages, current state, NPCs, relationships, inventory, quests, and world events.

Not implemented yet:

- Authentication/password tables.
- Payment, coin, or wallet tables.
- AI usage ledger tables.
- Gameplay engine writes.

## Entity Overview

### `users`

Represents an application user without auth/password implementation.

Important columns:

- `id`
- `email`
- `display_name`
- `created_at`
- `updated_at`

`email` is unique.

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

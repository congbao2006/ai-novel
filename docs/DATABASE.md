# Database Design

## Database Choice

PostgreSQL is the recommended primary database because the product needs durable relational state, transactional updates, indexing, JSON support for flexible story data, and a clear migration path as gameplay expands.

## Design Goals

- Preserve full session history.
- Keep game state server-authoritative.
- Support save/resume reliably.
- Track AI usage and cost from the beginning.
- Allow future payment, coin, and admin modules without rewriting core gameplay data.

## High-Level Entity Groups

### Identity

- `users`
- `user_profiles`
- `auth_accounts` or external-auth mapping
- `user_settings`

### Catalog

- `stories`
- `story_versions`
- `story_tags`
- `story_entry_points`
- `story_character_templates`
- `story_world_templates`

### Gameplay

- `characters`
- `sessions`
- `turns`
- `session_events`
- `session_state_snapshots`
- `saves`

### World State

- `world_entities`
- `npcs`
- `relationships`
- `locations`
- `inventory_items`
- `character_inventory`
- `quests`
- `quest_steps`
- `session_quests`
- `world_flags`

### AI Governance

- `ai_requests`
- `ai_usage_ledger`
- `ai_model_policies`
- `ai_budget_limits`
- `ai_prompt_templates`

### Future Monetization

- `wallets`
- `coin_ledger`
- `payment_orders`
- `payment_events`

These tables are documented for future planning only and should not be implemented in the current phase unless requested later.

## State Persistence Model

Use an event-first model with periodic snapshots.

- `session_events` stores append-only validated changes.
- `session_state_snapshots` stores compact reconstructed state for fast resume.
- `turns` stores player input, system response, and references to generated events.
- Current state can be rebuilt from the latest snapshot plus later events.

This keeps history auditable while avoiding expensive full replays for every request.

## LLM Safety Boundary

The LLM may propose:

- Narrative text.
- Candidate state changes.
- Candidate quest updates.
- Candidate NPC reactions.

The LLM may not:

- Write to the database.
- Bypass domain validation.
- Create purchases, balances, or admin changes.
- Override story rules or authorization.

All database writes must come from server-side domain/application services.

## AI Usage Ledger

Each AI generation should eventually record:

- User ID.
- Session ID.
- Story ID.
- Provider.
- Model.
- Feature name.
- Input token count.
- Output token count.
- Estimated cost.
- Latency.
- Budget decision.
- Request status.
- Error category if failed.

This supports cost control, debugging, analytics, and abuse prevention.

## Migration Strategy

When implementation begins:

- Use checked-in migrations.
- Review schema changes before applying.
- Never rely on manual production database edits.
- Keep seed data separate from migrations.
- Avoid storing secrets in seed data or migrations.

## Indexing Principles

Expected important indexes:

- Session lookup by `user_id`.
- Session lookup by `story_id`.
- Turn ordering by `session_id` and sequence.
- Events by `session_id` and sequence.
- Saves by `session_id`.
- AI usage by `user_id`, `session_id`, `provider`, and creation time.

Exact indexes should be chosen after concrete query patterns are implemented.

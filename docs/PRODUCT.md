# Product

## Vision

Build an AI Interactive Novel + RPG platform where players can enter authored worlds, roleplay through free-form input, and return to persistent sessions whose world state evolves over time.

## Target Experience

Players should be able to:

- Register and sign in.
- Discover available stories.
- Choose a story.
- Select or create a character.
- Start a roleplay session.
- Type actions or dialogue.
- Receive AI-assisted continuation from the world.
- Persist progress and resume later.

## Current Phase

This phase is foundation-only.

In scope:

- Production-oriented repository structure.
- Product, architecture, database, memory, AI engine, and roadmap documentation.
- Technical decisions that protect future gameplay implementation.
- MVP account registration, login, logout, and current-user identity foundation.
- Story browsing for published stories.
- Story detail pages with public character templates.
- Authenticated session creation and resume.
- Deterministic gameplay turns for simple typed commands.
- Provider-neutral AI gateway with OpenAI smoke testing.
- Optional AI narrative turn proposal mode guarded by server-side validation.
- Persistent AI usage ledger and server-side cost budget enforcement.
- Memory foundation for AI gameplay context using current state, bounded recent messages, rolling summaries, important memories, and important world events.
- Semantic memory retrieval for persistent memories using deterministic filtering, embeddings, importance, and recency.

Out of scope:

- Autonomous NPC AI and AI-generated quest gameplay.
- Payment or coin system implementation.
- User-visible token/cost dashboard.
- Admin dashboard implementation.
- Story creation implementation.
- NPC behavior and runtime quest generation.

## Core Product Concepts

### User

A registered account that owns characters, sessions, saves, inventory progress, wallets in a future phase, and user preferences.

### Story

A playable narrative world with metadata, genre, entry points, rules, character options, world state templates, NPC definitions, and quest/event configuration.

### Character

A player-controlled identity inside a story. A character can be selected from templates or created by the player under story constraints.

### Session

A single ongoing playthrough of a story by a user and character. It owns current state, transcript, events, memory, inventory, relationships, quests, and save points.

The current MVP can create a session from a published story and selected character template, initialize deterministic server-owned state, list the signed-in user's sessions, reopen a play page, and submit simple deterministic text actions.

### Turn

One player action plus the system response generated from current state, story rules, and AI assistance.

Current turn support defaults to deterministic mode. Supported deterministic commands include observe, rest, move, and status in simple Vietnamese/English forms. Unknown actions are recorded and receive a safe deterministic fallback without dangerous state changes.

When `GAMEPLAY_ENGINE_MODE=ai` is configured, a turn can ask the AI gateway for a narrative and structured proposal. The proposal is not trusted: the server validates allowed state fields and world events before anything is persisted. Deterministic mode remains the development/fallback path.

AI gameplay calls are usage-accounted server-side. The product can enforce configured daily, monthly, and per-session AI cost limits before a provider call is made. This is a platform budget guard, not a payment/Xu system.

AI gameplay context now includes persistent memory layers so long sessions do not require sending the entire transcript. Rolling summaries and important memories help the AI understand history, but they are not the source of truth and cannot override `game_states`.

When semantic memory is enabled, old persistent memories can be retrieved by meaning rather than only by recency or importance. This applies only to `session_memories`, not the full message history.

### Save

A restorable snapshot or checkpoint for a session.

## Product Principles

- Player agency should be high, but not unlimited.
- The world must stay coherent across turns.
- Persistent state is a product feature, not a prompt trick.
- The server is the source of truth.
- AI output must be constrained, validated, and cost-aware.
- Authored story rules should outrank generic model creativity.

## Future Monetization

The future coin system should support:

- Coin balance.
- Usage costs by feature or story.
- Purchase history.
- Refunds or grants.
- Payment provider records.
- Admin adjustments.

No monetization implementation should be added during this phase.

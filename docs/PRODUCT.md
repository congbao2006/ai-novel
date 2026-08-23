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
- NPC runtime intelligence foundation for session-owned NPC identity, bounded NPC knowledge context, and optional AI-driven NPC reactions during player turns.
- Quest/consequence engine expansion for validated quest lifecycle changes, inventory changes, relationship deltas, reputation-like state flags, NPC runtime state patches, memories, and meaningful world events.
- World/faction simulation foundation with session-owned factions, faction relationships, explicit deterministic ticks, bounded rule outputs, and server-owned persistence.
- Playable content authoring foundation for owner-managed story drafts, world instructions, opening setup, playable/NPC character templates, faction templates, initial settings, validation, publishing, and immutable runtime versions.

Out of scope:

- Autonomous/background NPC turns.
- Payment or coin system implementation.
- User-visible token/cost dashboard.
- Admin dashboard implementation.
- Collaborative story creation, marketplace workflows, ratings/comments, and AI-assisted full-story generation.
- Autonomous NPC/world simulation, background world ticks, and runtime quest generation.

## Core Product Concepts

### User

A registered account that owns characters, sessions, saves, inventory progress, wallets in a future phase, and user preferences.

### Story

A playable narrative world with metadata, genre, entry points, rules, character options, world state templates, NPC definitions, and quest/event configuration.

Authors can now create story drafts, edit owner-only authoring fields, validate them, and publish playable content. Publishing creates an immutable story version containing runtime-critical prompts, settings, playable/NPC templates, faction templates, and faction relation templates. Public catalog endpoints expose only story metadata and playable character templates from the current published version; internal world instructions, opening setup, NPC secrets, and authoring-only template data remain server-side.

Published versions are never mutated by normal application APIs. Creators can create a new working revision, edit runtime-critical fields there, and publish a new version. Existing game sessions stay pinned to the story version they were created with, while new sessions use the latest current published version.

### Character

A player-controlled identity inside a story. A character can be selected from templates or created by the player under story constraints.

Story character templates now have an explicit type:

- `playable`: selectable by players when creating a session.
- `npc`: cloned into session-owned runtime NPC rows when a session starts.

Template data defines initial conditions only. Runtime gameplay never writes changes back to story templates.

### Session

A single ongoing playthrough of a story by a user and character. It owns current state, transcript, events, memory, inventory, relationships, quests, and save points.

The current MVP can create a session from a published story and selected character template, initialize deterministic server-owned state, list the signed-in user's sessions, reopen a play page, and submit simple deterministic text actions.

### Turn

One player action plus the system response generated from current state, story rules, and AI assistance.

Current turn support defaults to deterministic mode. Supported deterministic commands include observe, rest, move, and status in simple Vietnamese/English forms. Unknown actions are recorded and receive a safe deterministic fallback without dangerous state changes.

When `GAMEPLAY_ENGINE_MODE=ai` is configured, a turn can ask the AI gateway for a narrative and structured proposal. The proposal is not trusted: the server validates allowed state fields and world events before anything is persisted. Deterministic mode remains the development/fallback path.

AI gameplay calls are usage-accounted server-side. The product can enforce configured daily, monthly, and per-session AI cost limits before a provider call is made. This is a platform budget guard, not a payment/Xu system.

AI gameplay context now includes persistent memory layers so long sessions do not require sending the entire transcript. Rolling summaries and important memories help the AI understand history, but they are not the source of truth and cannot override `game_states`.

Abilities are server-authoritative. Story authors can define ability templates and assign them to playable characters. When a session starts, the selected character's abilities are copied into runtime state with cooldowns. If a player claims an unowned ability, the game treats it as an attempted but unauthorized fictional action; the AI may narrate failure, but it cannot grant the power or change ability ownership.

When semantic memory is enabled, old persistent memories can be retrieved by meaning rather than only by recency or importance. This applies only to `session_memories`, not the full message history.

### NPC

NPCs are session-owned runtime identities cloned from story templates when a session starts. Each runtime NPC can have its own personality, goals, secrets, relationship edges, current state, and scoped memories.

NPC AI reactions are optional parts of player turns in AI gameplay mode. They do not run autonomously, do not write the database, and cannot override authoritative state. The server selects relevant NPCs, builds a knowledge-limited context for each NPC, validates the AI's proposed dialogue/intent/relationship/memory effects, and persists only allowed changes.

### Quest And Consequence

Quest state is session-owned runtime state with a small lifecycle: `inactive -> active`, `active -> completed`, or `active -> failed`. Completed and failed quests do not reopen without a future explicit mechanic.

Gameplay outcomes can now produce structured consequences. The AI and NPC reaction engines may suggest intent, but the server validates every target, key, delta, quantity, and quest transition before persistence. Consequences can affect quests, inventory, relationships, reputation-like state namespaces, NPC-owned runtime state, world events, and important memories.

Consequence chaining is intentionally bounded and deterministic. For example, completing a quest can create a world event and quest memory, but it cannot recurse indefinitely or run another AI call.

### Faction And World Simulation

Factions are session-owned runtime entities with identity, status, influence, resources, goals, and state. Two users playing the same story receive separate faction runtime rows.

Faction runtime rows are cloned from authored story faction templates. Stories may publish with zero factions; gameplay still works. Application runtime logic no longer depends on hardcoded seed-story slugs to create factions.

World simulation is explicit and deterministic. It can run after gameplay turns when tick policy says it is due, or through a protected manual tick path. It does not run in the background and does not use AI for faction planning.

Consequences and important world events may provide explicit faction signals such as a faction being helped or harmed. The world simulation engine turns those signals into bounded faction changes, faction relationship changes, world events, and world memories. The server validates and persists the result; AI never directly mutates faction or world state.

### Save

A restorable snapshot or checkpoint for a session.

## Product Principles

- Player agency should be high, but not unlimited.
- The world must stay coherent across turns.
- Persistent state is a product feature, not a prompt trick.
- The server is the source of truth.
- AI output must be constrained, validated, and cost-aware.
- Authored story rules should outrank generic model creativity.
- Production environments must fail fast on missing critical configuration and expose safe health/readiness checks for operations.

## Production MVP Expectations

The current product foundation is designed for a closed beta style deployment:

- Web and API deploy separately.
- API owns cookies, server-side sessions, database access, AI provider secrets, usage budgets, and runtime state.
- Public story browsing must not expose internal prompts.
- Health/readiness checks and smoke checks must pass before traffic is routed.
- The first beta rollout should use deterministic gameplay before enabling OpenAI and semantic memory.
- Cross-site Vercel/Railway default hostnames require `SameSite=None; Secure` cookies; same-site custom domains should use `SameSite=Lax`.
- Payment, marketplace, creator AI, streaming, and moderation workflows remain out of scope until explicitly implemented.

## Future Monetization

The future coin system should support:

- Coin balance.
- Usage costs by feature or story.
- Purchase history.
- Refunds or grants.
- Payment provider records.
- Admin adjustments.

No monetization implementation should be added during this phase.

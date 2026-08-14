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

Out of scope:

- Gameplay implementation.
- Payment or coin system implementation.
- Live AI provider integration.
- Admin dashboard implementation.
- Story creation implementation.

## Core Product Concepts

### User

A registered account that owns characters, sessions, saves, inventory progress, wallets in a future phase, and user preferences.

### Story

A playable narrative world with metadata, genre, entry points, rules, character options, world state templates, NPC definitions, and quest/event configuration.

### Character

A player-controlled identity inside a story. A character can be selected from templates or created by the player under story constraints.

### Session

A single ongoing playthrough of a story by a user and character. It owns current state, transcript, events, memory, inventory, relationships, quests, and save points.

### Turn

One player action plus the system response generated from current state, story rules, and AI assistance.

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

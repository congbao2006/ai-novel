# Memory And Persistent State

## Purpose

The platform needs memory that is more reliable than sending the full transcript to an LLM. Memory must be persisted, queryable, validated, and controlled by the server.

## Memory Types

### Transcript Memory

The ordered history of player turns and system responses.

Use for:

- Exact reconstruction.
- Debugging.
- Player review.
- Summaries.

### World State

Structured state for the current session.

Examples:

- Current location.
- Known NPCs.
- Relationship values.
- Inventory.
- Quest status.
- World flags.
- Recent consequences.

### Narrative Summary

Compressed session history used to reduce context size.

Summaries are useful for prompts, but they are not the source of truth. Structured state and events remain authoritative.

### Entity Memory

Facts attached to characters, NPCs, places, factions, items, and quests.

Examples:

- NPC attitude toward the player.
- Promises made.
- Discovered secrets.
- Item ownership.
- Quest dependencies.

## Persistence Strategy

Use append-only events plus snapshots:

- Events record validated changes.
- Snapshots speed up loading.
- Summaries help AI context construction.
- Raw turns preserve exact player-visible history.

## Context Selection

Future AI requests should not blindly include all memory.

Context selection should consider:

- Current scene.
- Active quests.
- Nearby NPCs.
- Recently changed flags.
- Important unresolved commitments.
- Token budget.
- Story-specific rules.

## Memory Validation

AI-generated memory updates are untrusted.

Before persistence, the server must verify:

- The update targets valid entities.
- The change is allowed by story rules.
- Numeric changes are within bounds.
- Inventory changes have a valid cause.
- Quest progression follows required prerequisites.
- The player is authorized for the session.

## Token Budgeting

Memory must be selected under a budget:

- Reserve tokens for system instructions.
- Reserve tokens for player input.
- Reserve tokens for required structured state.
- Reserve tokens for model output.
- Fill remaining tokens with relevant summaries and recent turns.

When budget is tight, prefer structured current state over long transcript excerpts.

## Save And Resume

A resumed session should load:

- User and character.
- Story version.
- Latest snapshot.
- Events after snapshot.
- Recent turns.
- Relevant summaries.
- Active quests and inventory.

The resume path must not rely on re-asking an LLM what happened.

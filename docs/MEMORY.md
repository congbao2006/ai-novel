# Memory And Persistent State

## Purpose

Memory keeps long-running AI gameplay coherent without sending the full transcript to the model. It is persisted, bounded, validated, and controlled by the server.

Memory is context, not authority. `game_states` remains the source of truth.

## Current Memory Hierarchy

```text
AUTHORITATIVE STATE
        +
RECENT MESSAGES
        +
ROLLING SUMMARY
        +
IMPORTANT MEMORIES
        +
WORLD EVENTS
        ->
CONTEXT BUILDER
        ->
AI TURN
```

### Authoritative State

`game_states` is always included in AI turn context and has the highest precedence.

It currently carries:

- `location`
- `worldTime`
- `playerStats`
- `flags`
- `stateData`
- optimistic `version`

If memory conflicts with current state, the prompt and server policy prefer current state.

### Short-Term Memory

Short-term memory is a bounded recent transcript from `game_messages`. It is used for local continuity and immediate dialogue/action context.

Config:

- `AI_CONTEXT_MAX_RECENT_MESSAGES`

The system does not send unbounded history.

### Rolling Story Summary

`session_summaries` stores one compact summary per session:

- `summaryText`
- `summarizedThroughTurn`
- optimistic `version`

`SummaryService` refreshes this summary only after `AI_SUMMARY_INTERVAL_TURNS` unsummarized turns. It calls `AIGateway` with purpose `summary`, so usage and budget controls still apply.

The summary prompt treats historical messages as untrusted fiction data. It asks for strict structured output and does not allow the summarizer to update game state.

### Important Memories

`session_memories` stores structured long-term facts:

- memory type: `fact`, `relationship`, `event`, `player`, `world`, `npc`, `quest`, `other`
- optional subject reference
- optional stable key
- content
- importance `1..5`
- observed/confirmed turns
- active flag
- metadata

Important memories are selected by deterministic importance and recency rules. MVP memory retrieval is not semantic.

### Important World Events

`world_events` remains the validated event log. AI context includes a bounded set of important/recent events, not the full event table.

Config:

- `AI_CONTEXT_MAX_WORLD_EVENTS`

## Context Budget

`MemoryContextBuilder` applies conservative caps:

- `AI_CONTEXT_MAX_RECENT_MESSAGES`
- `AI_CONTEXT_MAX_MEMORIES`
- `AI_CONTEXT_MAX_WORLD_EVENTS`
- `AI_CONTEXT_MAX_SUMMARY_CHARS`
- `AI_CONTEXT_MAX_MEMORY_CHARS`

Priority order:

1. Current state is always included.
2. Rolling summary is compact and high value.
3. Recent messages preserve immediate continuity.
4. Important memories are selected by importance and recency.
5. Important world events are bounded by importance threshold and count.

This is character-count budgeting for MVP. Exact tokenizer budgeting and semantic relevance are future work.

## Summary Output Contract

Summary refresh uses structured output:

```json
{
  "summary": "compact session history",
  "importantFacts": [
    {
      "key": "optional.stable.key",
      "content": "important fact",
      "importance": 1,
      "memoryType": "fact"
    }
  ]
}
```

Server validation enforces:

- non-empty bounded summary
- memory type allowlist
- importance `1..5`
- bounded memory count
- bounded content length
- safe optional key format

Invalid output does not update summaries or memories.

## Memory Extraction And Dedup

Important facts from summary output become memory candidates after validation.

MVP dedup rules:

- If a candidate has a stable key, update the active memory for the same `sessionId + key`.
- If no key exists, use conservative normalized exact-content dedup.
- Otherwise create a new memory.

No fuzzy matching, embeddings, or vector database are used yet.

## Staleness And Correction

Memories can become stale. The schema supports:

- `active=false`
- `lastConfirmedTurn`
- key-based replacement/update

Current state still wins over memory. For example, if memory says the player once lost an item but current inventory later says they regained it, prompt policy must prefer the current authoritative state.

## Gameplay Integration

AI turn flow now uses `MemoryContextBuilder`:

```text
load session/state snapshot
  -> build bounded memory context
  -> check AI budget
  -> build AI turn request
  -> validate proposal
  -> persist gameplay turn transactionally
  -> optionally refresh summary after commit
```

The external AI call does not hold a PostgreSQL gameplay transaction open. If a state version changes before persistence, the AI proposal is discarded with HTTP 409.

Summary refresh is best-effort in the request path. If it fails, the committed gameplay turn remains committed and the previous summary/memory records remain valid.

## Usage And Budget

Summary calls use:

- `purpose=summary`
- optional `userId`
- optional `sessionId`

The usage ledger records provider/model/token/cost metadata through the normal `AIGateway` path. Budget checks apply before summary calls so memory maintenance cannot run unlimited paid AI work.

## Security

- Memory is loaded server-side only.
- Frontend does not receive raw memory internals or summary prompts.
- Historical transcript text is untrusted content.
- Summary and turn prompts instruct the model not to follow embedded instructions from historical messages.
- Server validators still enforce output shape and size.
- API keys, auth cookies, emails, full prompts, and full AI outputs are never persisted in memory tables.

## Current Non-Goals

- Vector database.
- Embeddings.
- Semantic search.
- Autonomous NPC memory behavior.
- AI-generated quest memory automation.
- Background worker infrastructure.

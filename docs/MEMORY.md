# Memory And Persistent State

## Purpose

Memory keeps long-running AI gameplay coherent without sending the full transcript to the model. It is persisted, bounded, validated, and controlled by the server.

Memory is context, not authority. `game_states` remains the source of truth.

Story authoring templates are also not memory. They define initial runtime conditions at session creation time. Runtime memory, summaries, NPC state, factions, inventory, quests, and relationships evolve inside session-owned tables and never mutate story authoring data.

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

Semantic retrieval now supplements deterministic memory selection when configured:

```text
                Current state
                     |
        +------------+------------+
        |                         |
Deterministic memories     Semantic search
                                  |
                           query embedding
                                  |
                              pgvector
                                  |
                           similar memories
        |                         |
        +------------+------------+
                     |
               Hybrid ranking
                     |
                  Dedup
                     |
             Context budget
                     |
                  AI Turn
```

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
5. Semantic memories are selected by similarity, importance, and recency.
6. Important world events are bounded by importance threshold and count.

This is character-count budgeting for MVP. Exact tokenizer budgeting is future work.

## Semantic Retrieval

Semantic retrieval is enabled by server-side config:

- `MEMORY_SEMANTIC_SEARCH_ENABLED`
- `MEMORY_SEMANTIC_TOP_K`
- `MEMORY_SEMANTIC_MIN_SCORE`
- `AI_EMBEDDING_PROVIDER`
- `OPENAI_EMBEDDING_MODEL`

When disabled, missing, or unavailable, the system continues with deterministic important-memory retrieval.

The query is intentionally short:

```text
Location: current location
Player action: current player action
```

It does not embed full `GameState`, full transcript history, auth data, emails, cookies, API keys, or story prompts.

## Vector Storage

The MVP vector store is PostgreSQL with pgvector.

Reasons:

- Memory already lives in PostgreSQL.
- Session ownership and transaction boundaries remain simple.
- It avoids introducing Pinecone, Qdrant, Weaviate, or another service before scale requires it.

The migration creates:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Deployment environments must provide PostgreSQL with pgvector available. Normal unit/build tests do not require a live pgvector server. Vector integration tests remain opt-in through a vector-capable test database.

Embeddings are stored in `memory_embeddings`, not as JSONB and not inside `session_memories`.

This separate table supports:

- provider/model changes
- dimension changes
- re-embedding
- multiple embedding versions per memory
- non-destructive cleanup later

## Embedding Lifecycle

`MemoryEmbeddingService` embeds only active persistent memories.

Flow:

```text
SummaryService persists memories
  -> MemoryEmbeddingService
  -> content hash check
  -> batch EmbeddingGateway call
  -> memory_embeddings upsert
```

If memory content has the same hash for the configured provider/model, embedding is skipped. If content changes, the embedding is regenerated and the row is updated.

If embedding fails, the memory still exists. Gameplay and summary persistence are not rolled back. Semantic retrieval simply misses that memory until a later backfill or retry.

## Content Hash

The content hash is deterministic SHA-256 over the safe embedding input:

```text
[memoryType] subject:key content
```

It prevents repeated embedding calls for unchanged memory content and configured provider/model.

## Hybrid Ranking

Semantic search does not use similarity alone. Results are ranked with a deterministic formula:

```text
score =
  semanticScore * 0.65
  + importanceNormalized * 0.25
  + recencyNormalized * 0.10
```

Deterministic high-importance memories are merged with semantic results before ranking. Final context is deduplicated by stable memory key when present, otherwise by memory ID.

`MEMORY_SEMANTIC_MIN_SCORE` filters weak vector matches even if they appear in top K. Threshold tuning will need real gameplay data.

## Session Isolation

Semantic vector search is scoped by `session_id` inside `SemanticMemoryRepository.searchSimilar`.

The query joins `memory_embeddings` to `session_memories` and filters the session before returning results. The application does not perform a global vector search and then filter another user's memories afterward.

## NPC Memory Context

NPC runtime reactions reuse the same persistent memory foundation instead of adding a second vector store.

NPC-specific memories are stored as `session_memories` rows with:

- `memory_type = npc` when the fact is NPC-specific
- `subject_type = npc`
- `subject_id = <runtime npc id>`

`NPCKnowledgeBuilder` builds a smaller context than the main turn context:

- the NPC's own profile, current runtime state, goals, and secrets
- relationship edge from that NPC to the player
- active memories for that NPC, plus bounded relevant relationship/event memories
- bounded recent messages that mention the NPC
- bounded important world events the NPC plausibly observed or would know
- the current scene/location and player action

The NPC does not automatically receive another NPC's secrets, full session memory, full world prompt, auth data, emails, or cross-session memories.

Semantic retrieval may supplement NPC memory selection by embedding a short query that includes NPC identity and the player action, then filtering/merging through the same session-scoped memory architecture. If semantic retrieval is disabled or unavailable, deterministic NPC memory selection continues to work.

NPC memory is still context, not authority. `game_states` and validated runtime tables remain the source of truth.

## Quest And Consequence Memories

The consequence engine can create server-generated memory candidates for important quest changes:

- quest activated
- quest completed
- quest failed
- major objective or progress milestone

These are stored as `session_memories` with `memory_type = quest` and a stable key when available. Server-generated quest memories are preferred over trying to infer durable quest facts from narrative prose.

NPC-specific consequence memories can be stored with `subject_type = npc` and `subject_id = <runtime npc id>` only when the server has a validated reason that the NPC witnessed or learned the fact. There is no global broadcast to all NPCs.

Embedding remains best-effort after the gameplay transaction commits. If memory embedding fails, the quest/inventory/relationship/state consequence remains committed and deterministic memory retrieval still works.

## World Simulation Memories

World ticks can create server-generated `memory_type = world` memories for major faction/world changes:

- faction weakened
- faction collapsed
- major influence shift
- notable faction relationship tension

Trivial numerical changes do not create memory spam. World memories are context for future AI turns; they do not override `game_states`, `factions`, or `faction_relationships`.

A world memory does not automatically become knowledge for every NPC. NPC knowledge builders may include only public or explicitly relevant world events/memories according to the existing NPC knowledge boundary. Future event propagation can make this richer without changing the core memory storage model.

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

No fuzzy matching is used yet. Embeddings cover only `session_memories`, not the whole message transcript.

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

Semantic memory retrieval is also best-effort. Query embedding failure, provider outage, pgvector unavailability, no embedded memories, or low similarity results all fall back to deterministic memory selection.

## Usage And Budget

Summary calls use:

- `purpose=summary`
- optional `userId`
- optional `sessionId`

The usage ledger records provider/model/token/cost metadata through the normal `AIGateway` path. Budget checks apply before summary calls so memory maintenance cannot run unlimited paid AI work.

Embedding calls use `EmbeddingGateway` and usage purpose `embedding`. They record provider, model, tokens when available, estimated cost when pricing is configured, latency, status, and safe error code.

If AI budgets are enabled and semantic search is enabled, configured embedding model pricing is required. This fails closed rather than making paid embedding calls with unknown cost.

## Backfill

Existing active memories may not have embeddings after semantic retrieval is introduced.

Use:

```bash
pnpm memory:embed-backfill
```

The backfill command:

- finds active memories missing the current provider/model embedding
- processes in batches
- skips unchanged hashes
- is resumable
- prints counts only
- does not run automatically on application startup

## Model Migration

Search uses embeddings matching the configured provider/model and vector dimensions. If `OPENAI_EMBEDDING_MODEL` changes, old embeddings are not mixed silently with new ones.

Backfill can generate rows for the new provider/model. Old rows remain until a future explicit cleanup operation.

## Security

- Memory is loaded server-side only.
- Frontend does not receive raw memory internals or summary prompts.
- Historical transcript text is untrusted content.
- Summary and turn prompts instruct the model not to follow embedded instructions from historical messages.
- Server validators still enforce output shape and size.
- API keys, auth cookies, emails, full prompts, and full AI outputs are never persisted in memory tables.
- Raw embeddings and similarity scores are not exposed to the frontend.

## Current Non-Goals

- Autonomous background NPC memory behavior.
- AI-generated quest memory automation.
- Full transcript semantic search.
- Background worker infrastructure.

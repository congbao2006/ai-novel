# AI Engine

## Purpose

The AI engine is a provider-neutral orchestration layer for AI-assisted narrative generation. It now has a real OpenAI provider integration and can produce structured gameplay turn proposals when `GAMEPLAY_ENGINE_MODE=ai`.

## Current Boundary

```text
application
  -> AIGateway
  -> ModelPolicy
  -> LLMProvider
  -> OpenAIProvider
  -> OpenAI Responses API
```

Embedding flow:

```text
application
  -> EmbeddingGateway
  -> EmbeddingProvider
  -> OpenAIEmbeddingProvider
  -> OpenAI Embeddings API
```

Gameplay code must not call a provider SDK directly. The OpenAI SDK is isolated inside `packages/ai-engine`.

## Provider Abstraction

Application code depends on:

- `AIGateway`
- `LLMProvider`
- `GenerationRequest`
- `GenerationResult`
- `ModelPolicy`
- provider-neutral AI errors

Provider-specific adapters translate these contracts to real APIs. Adding `AnthropicProvider` or `GeminiProvider` should require a new provider implementation and factory registration, not gameplay rewrites.

## Request Lifecycle

```text
API/internal caller
  -> create GenerationRequest
  -> AIGateway resolves ModelPolicy
  -> AIGateway applies timeout and retry policy
  -> provider translates request to external API format
  -> provider normalizes response
  -> AIGateway estimates cost from usage and pricing registry
  -> AIGateway records usage through AIUsageLedger
  -> caller receives provider-neutral GenerationResult
```

The current smoke paths are:

- `POST /internal/ai/smoke` for development/internal HTTP testing.
- `pnpm ai:smoke` for optional CLI live testing.
- `pnpm ai:turn-smoke` for optional live structured turn proposal testing without database writes.
- `pnpm ai:summary-smoke` for optional live structured summary output testing without gameplay writes.
- `pnpm ai:embedding-smoke` for optional live embedding shape/sanity testing without database writes.

None of the smoke paths mutate gameplay sessions or game state.

## AI Gameplay Proposal Flow

AI gameplay mode keeps the server authoritative:

```text
Player action
  -> GameplayService loads bounded session snapshot
  -> MemoryContextBuilder loads state, recent messages, summary, memories, events
  -> SemanticMemoryService optionally retrieves relevant old memories
  -> BudgetService checks recorded user/session usage
  -> StoryTurnPromptBuilder builds provider-neutral GenerationRequest
  -> AIGateway calls the configured provider
  -> AIGateway records success/failure usage outside gameplay transaction
  -> provider returns AITurnProposal as structured output
  -> domain validator normalizes allowed proposal fields
  -> optional NPC reaction proposals are collected under the NPC knowledge boundary
  -> ConsequenceEngine creates a server-owned TurnPersistencePlan
  -> GameplayService re-checks game_states.version
  -> one transaction persists messages, state patch, quests, inventory, relationships, NPC state, memories, events, turn count, lastPlayedAt
```

The OpenAI call happens before the gameplay PostgreSQL transaction starts. This avoids holding a gameplay transaction open while waiting on the network. If another turn changes `game_states.version` while the AI call is running, the service returns HTTP 409 and discards the stale proposal.

Usage persistence is independent from gameplay persistence. If an AI request succeeds but the later gameplay state write fails due to a stale version or invalid proposal, the usage record remains because the provider call already consumed budget.

## OpenAI Provider

`OpenAIProvider` uses the official OpenAI JavaScript SDK and the Responses API. Request fields are translated from provider-neutral contracts:

- `model` comes from model policy/config.
- `instructions` maps to Responses API instructions.
- `input` or `messages` maps to Responses API input.
- `maxOutputTokens` maps to `max_output_tokens`.
- `responseSchema` maps to structured output through `text.format`.
- `safetyIdentifier` is reserved for privacy-safe pseudonymous identifiers.

The provider returns:

- `text`
- `provider`
- `model`
- `usage.inputTokens`
- `usage.outputTokens`
- `usage.totalTokens`
- `requestId` when available
- `status`/finish information
- `latencyMs`

Raw provider responses and API keys are not exposed to the application layer.

## Model Policy

The current policy set only needs:

- `defaultStoryModel`

Future policy names are reserved for:

- `story.premium`
- `summary`
- `npc`
- `stateExtraction`

Model names must come from config or policy. They must not be hardcoded in gameplay services or routes.

## Structured Output

Structured output is supported at gateway/provider contract level through `StructuredOutputSchema`.

Gameplay AI requests the provider-neutral `AITurnProposal` schema:

```json
{
  "narrative": "...",
  "proposedStatePatch": {},
  "proposedEvents": []
}
```

The schema is strict:

- `narrative` is required and bounded.
- `proposedStatePatch` is required but may be `{}`.
- `proposedEvents` is required but may be `[]`.
- Unknown top-level fields and event fields are rejected.
- Event importance must be an integer from `1..5`.

The structured proposal remains untrusted until domain validators accept it.

Quest and inventory consequences do not require changing the `AITurnProposal` contract. The main AI still proposes narrative, safe state patch, and events. The server combines that with deterministic command intents and NPC reaction proposals, then passes everything through the consequence pipeline.

## Server Validation Policy

AI is a proposer, not the authority.

Allowed proposal effects are intentionally narrow:

- `location`: non-empty text with length/control-character checks.
- `playerStats`: only existing numeric stat keys may be updated.
- `flags`: only safe AI-owned keys such as `aiSceneTone`.
- `stateData`: only safe AI-owned keys such as `aiLastActionSummary` and `aiSceneSummary`.
- `proposedEvents`: at most five validated events; IDs, timestamps, session IDs, and turn numbers are assigned by the server.

Rejected fields include IDs, `userId`, `sessionId`, `version`, `turnCount`, auth fields, timestamps, unknown state keys, non-finite numbers, nested arbitrary JSON, and oversized text.

Narrative is user-facing prose only. It is not the source of truth for state. If narrative says a stat changed but the validated structured patch does not include that change, the stat does not change.

## Consequence Proposal Pipeline

AI and NPC systems can suggest effects, but only the server consequence engine decides what is persisted:

```text
Player action
  -> main AI proposal and/or deterministic command
  -> optional NPCReactionProposal
  -> server validators
  -> ConsequenceEngine
  -> bounded RuleRegistry
  -> TurnPersistencePlan
  -> gameplay transaction
```

Supported consequence families are intentionally narrow:

- quest activate/progress/complete/fail
- relationship delta
- inventory add/remove
- safe flag/state/reputation updates
- NPC-owned state updates
- world event
- custom safe server-recognized effect

The engine rejects arbitrary operation objects, direct IDs/timestamps/session ownership from AI, invalid quest transitions, inventory underflow, unsafe state namespaces, oversized progress JSON, unknown NPC action targets, and relationship deltas outside per-turn bounds.

Rule chaining is deterministic and capped. Current rules derive generic events and memory candidates for quest changes, inventory acquisition, and relationship threshold crossings. The rule registry does not call an LLM.

## World And Faction Simulation

World/faction simulation is intentionally not an AI planning system.

```text
Gameplay consequences
  -> WorldTickPolicy
  -> WorldSimulationEngine
  -> WorldRuleRegistry
  -> WorldTickPlan
  -> server validation
  -> atomic world transaction
```

The simulation engine is deterministic and provider-neutral. It consumes bounded explicit signals from validated consequences/world events, such as `faction_helped`, `faction_harmed`, `quest_completed`, or `major_loss`. It does not infer faction effects from raw narrative prose and does not call `AIGateway`.

AI narrates. NPC AI proposes. Consequence engine resolves player-turn effects. World simulation resolves bounded world-level faction effects. The database remains authoritative.

## Prompt, Context, And Memory Strategy

The prompt builder separates:

- system/developer instructions
- world context from server-side story fields
- player character
- current `game_states` snapshot
- rolling story summary
- persistent important memories
- bounded recent transcript messages
- recent important world events
- untrusted player action
- output contract

Player action is explicitly labeled as untrusted fictional input. It must not be treated as system/developer instruction, and the model is told not to reveal internal prompts or alter the output schema.

Context is built by `MemoryContextBuilder` under server-side caps:

- `AI_CONTEXT_MAX_RECENT_MESSAGES`
- `AI_CONTEXT_MAX_MEMORIES`
- `AI_CONTEXT_MAX_WORLD_EVENTS`
- `AI_CONTEXT_MAX_SUMMARY_CHARS`
- `AI_CONTEXT_MAX_MEMORY_CHARS`

Current `game_states` is authoritative. Rolling summaries and memories help the model understand distant history, but they never override state or become a source of truth.

Semantic memory retrieval is hybrid when enabled:

```text
player action + current location
  -> EmbeddingGateway
  -> SemanticMemoryRepository.searchSimilar scoped by sessionId
  -> hybrid rank by semantic similarity, importance, recency
  -> dedup with deterministic memories
  -> context budget
```

The rank formula is:

```text
semanticScore * 0.65
  + importanceNormalized * 0.25
  + recencyNormalized * 0.10
```

If semantic retrieval fails, is disabled, or returns only low-score results, deterministic important-memory selection continues to work.

## NPC Runtime Reactions

NPC runtime intelligence is integrated only into AI gameplay mode and only during player-submitted turns.

```text
Main AI turn proposal
  -> select relevant NPCs
  -> build NPC-specific knowledge context
  -> AIGateway purpose=npc
  -> NPCReactionProposal
  -> server validation
  -> gameplay transaction persists allowed effects
```

The NPC reaction schema is separate from `AITurnProposal`. It can propose:

- short dialogue
- one allowlisted semantic intent such as `speak`, `observe`, `move`, `refuse`, `assist`, `threaten`, `flee`, `attack_intent`, `give_item_intent`, or `custom_narrative`
- NPC-owned state keys such as mood, stance, current goal, attention, and location
- relationship deltas, not absolute relationship replacement
- bounded NPC memory candidates
- bounded world events

Server validation rejects unknown action types, protected fields, `alive=false`, player/session/user patches, excessive relationship deltas, invalid targets, excessive events, and oversized text.

NPC calls use `purpose=npc`, so they pass through the same gateway, usage ledger, pricing, and budget precheck path as gameplay and summary calls. Deterministic gameplay mode makes zero NPC AI calls.

## Rolling Summary

`SummaryService` refreshes one persisted rolling summary per session after `AI_SUMMARY_INTERVAL_TURNS` unsummarized turns. It calls `AIGateway` with purpose `summary`, validates strict structured output, updates `session_summaries`, and extracts bounded important memory candidates into `session_memories`.

Summary calls are not part of the gameplay transaction. If summary refresh fails after a turn commits, gameplay remains committed and the previous summary/memory state is kept.

After memory persistence, `MemoryEmbeddingService` may embed newly created or changed active memories through `EmbeddingGateway`. Embedding failures do not roll back summary or gameplay state.

Summary prompts treat historical messages as untrusted fiction data and require strict structured output:

```json
{
  "summary": "...",
  "importantFacts": []
}
```

## Error Model

Provider-specific SDK errors are mapped to neutral errors:

- `AIAuthenticationError`
- `AIRateLimitError`
- `AITimeoutError`
- `AIProviderError`
- `AIInvalidResponseError`
- `AIConfigurationError`

The API maps these to safe HTTP responses without leaking API keys, cookies, or raw provider internals.

## Timeout And Retry

`AIGateway` owns timeout and retry behavior.

- Timeout is configured by `AI_REQUEST_TIMEOUT_MS`.
- Retry count is configured by `AI_MAX_RETRIES`.
- Retryable errors include timeout, rate limit, transient connection, and provider 5xx-style errors.
- Authentication/configuration/invalid response errors are not retried.
- Backoff is bounded exponential delay with light jitter.

Retries are not infinite. GameplayService does not retry a whole turn after a stale state conflict because that could apply the player action twice.

## Token Accounting

Every normalized generation result includes token usage when the provider returns it:

- `inputTokens`
- `outputTokens`
- `totalTokens`

If a provider does not return usage, fields remain `null`. The system does not invent token counts.

Embedding results also include usage when the provider returns it. OpenAI embedding usage maps prompt tokens to `inputTokens`; `outputTokens` is recorded as `0`.

## Cost Estimation

Cost estimation is separate from providers.

```text
estimateGenerationCostMicros({
  provider,
  model,
  inputTokens,
  outputTokens,
  pricingRegistry
})
```

Costs are represented in integer micros to avoid floating point money. Pricing is provided through the server-side `AI_MODEL_PRICING_JSON` operational config. Pricing changes over time and must be treated as operational configuration, not permanent source code truth. Tests use fixture pricing.

If pricing is missing, token usage is still recorded and `estimatedCostMicros` remains `null`. If any cost budget is enabled for AI gameplay, startup fails unless pricing exists for the configured provider/model. This fails closed instead of allowing unlimited paid calls with unknown cost.

## Usage Ledger

The gateway records usage through an `AIUsageLedger` interface backed by `AIUsageRepository` in the API process. Providers do not write database records.

Ledger rows record:

- `userId`
- `sessionId`
- purpose
- provider
- model
- input tokens
- output tokens
- total tokens
- estimated cost micros
- latency
- status
- provider request ID
- safe error code
- creation time

The ledger deliberately does not store API keys, cookies, emails, full prompts, or full AI outputs.

Failure records are written for attempted provider calls that timeout, rate-limit, fail, or return invalid provider-level responses. If no trustworthy usage is available for a failure, token fields remain `null`.

## Budget Enforcement

`BudgetService` enforces server-side cost budgets before the external AI call:

```text
Gameplay request
  -> BudgetService
  -> AIUsageRepository aggregate cost queries
  -> allow or throw ai_budget_exceeded
  -> AIGateway
  -> provider
  -> AIUsageLedger persist
  -> proposal validation
  -> gameplay transaction
```

Supported limits:

- `AI_USER_DAILY_BUDGET_MICROS`
- `AI_USER_MONTHLY_BUDGET_MICROS`
- `AI_SESSION_BUDGET_MICROS`

Unset values disable that limit. Daily and monthly budgets are evaluated against UTC day/month windows. Session budget is lifetime-to-date for the session.

This is a preflight budget check. Concurrent requests can pass the same budget check before either usage record is written, so small overshoot is possible. Future payment/Xu work should introduce reservations or hard quota debits if exact atomic billing is required.

Summary refresh uses the same budget service before its AI call. If budget is exceeded, summary is skipped through a controlled failure path and the gameplay turn is not rolled back.

Embedding calls use the same usage ledger with purpose `embedding`. If budgets are enabled while semantic memory is enabled, startup requires pricing for the configured embedding provider/model.

## Secrets Strategy

Server-only environment variables:

- `AI_PROVIDER`
- `AI_EMBEDDING_PROVIDER`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `AI_REQUEST_TIMEOUT_MS`
- `AI_MAX_RETRIES`
- `AI_MAX_OUTPUT_TOKENS`
- `AI_INTERNAL_SMOKE_ENABLED`
- `GAMEPLAY_ENGINE_MODE`
- `AI_MAX_NPC_REACTIONS_PER_TURN`
- `AI_MODEL_PRICING_JSON`
- `AI_USER_DAILY_BUDGET_MICROS`
- `AI_USER_MONTHLY_BUDGET_MICROS`
- `AI_SESSION_BUDGET_MICROS`
- `AI_CONTEXT_MAX_RECENT_MESSAGES`
- `AI_CONTEXT_MAX_MEMORIES`
- `AI_CONTEXT_MAX_WORLD_EVENTS`
- `AI_CONTEXT_MAX_SUMMARY_CHARS`
- `AI_CONTEXT_MAX_MEMORY_CHARS`
- `AI_SUMMARY_INTERVAL_TURNS`
- `MEMORY_SEMANTIC_SEARCH_ENABLED`
- `MEMORY_SEMANTIC_TOP_K`
- `MEMORY_SEMANTIC_MIN_SCORE`

`OPENAI_API_KEY` is never exposed through frontend config, JSON responses, logs, or `NEXT_PUBLIC_*`.

Production startup fails clearly when `AI_PROVIDER=openai` but required OpenAI config is missing. `GAMEPLAY_ENGINE_MODE=ai` requires a configured AI provider. The default mode remains `deterministic` for local development.

## Observability

Safe metadata can be logged:

- provider
- model
- request ID
- latency
- input/output token counts
- estimated cost
- success/failure

Do not log:

- API keys
- auth cookies
- complete prompts by default
- internal secret prompts

## Current Non-Goals

- Autonomous NPC turns or background world simulation.
- AI quest generation.
- Streaming gameplay.
- Payment/Xu-backed hard quota reservation.

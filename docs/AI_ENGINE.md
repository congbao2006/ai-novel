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
  -> caller receives provider-neutral GenerationResult
```

The current smoke paths are:

- `POST /internal/ai/smoke` for development/internal HTTP testing.
- `pnpm ai:smoke` for optional CLI live testing.
- `pnpm ai:turn-smoke` for optional live structured turn proposal testing without database writes.

None of the smoke paths mutate gameplay sessions or game state.

## AI Gameplay Proposal Flow

AI gameplay mode keeps the server authoritative:

```text
Player action
  -> GameplayService loads bounded session snapshot
  -> StoryTurnPromptBuilder builds provider-neutral GenerationRequest
  -> AIGateway calls the configured provider
  -> provider returns AITurnProposal as structured output
  -> domain validator normalizes allowed proposal fields
  -> GameplayService re-checks game_states.version
  -> one transaction persists messages, state patch, events, turn count, lastPlayedAt
```

The OpenAI call happens before the PostgreSQL transaction starts. This avoids holding a database transaction open while waiting on the network. If another turn changes `game_states.version` while the AI call is running, the service returns HTTP 409 and discards the stale proposal.

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

## Prompt And Context Strategy

The prompt builder separates:

- system/developer instructions
- world context from server-side story fields
- player character
- current `game_states` snapshot
- bounded recent transcript messages
- recent important world events
- untrusted player action
- output contract

Player action is explicitly labeled as untrusted fictional input. It must not be treated as system/developer instruction, and the model is told not to reveal internal prompts or alter the output schema.

Context is bounded to recent messages and important events. Semantic/vector memory is still future work.

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

Costs are represented in integer micros to avoid floating point money. The default pricing registry is intentionally empty. Pricing changes over time and must be treated as operational configuration, not permanent source code truth. Tests use fixture pricing.

## Usage Ledger Preparation

There is no AI usage ledger table yet. The gateway exposes an `AIUsageLedger` interface so future persistence can record:

- `userId`
- `sessionId`
- provider
- model
- input tokens
- output tokens
- estimated cost micros
- latency
- status
- creation time

Adding the database ledger remains future work and should be introduced with a dedicated migration when usage billing/accounting is in scope. GameplayService receives usage metadata through the `GenerationResult`; wiring it to persistent cost/budget enforcement is the next dedicated phase.

## Secrets Strategy

Server-only environment variables:

- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AI_REQUEST_TIMEOUT_MS`
- `AI_MAX_RETRIES`
- `AI_MAX_OUTPUT_TOKENS`
- `AI_INTERNAL_SMOKE_ENABLED`
- `GAMEPLAY_ENGINE_MODE`

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

- NPC AI behavior.
- Semantic memory or vector search.
- AI quest generation.
- Streaming gameplay.
- AI usage ledger persistence and budget enforcement.

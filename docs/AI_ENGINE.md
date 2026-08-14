# AI Engine

## Purpose

The AI engine is a provider-neutral orchestration layer for future AI-assisted narrative generation. It must be designed now, but not integrated with a live provider in this phase.

## Core Rule

Gameplay code must not call a provider SDK directly.

All model calls should eventually pass through internal contracts that support provider switching, structured output validation, token budgeting, logging, and policy enforcement.

## Responsibilities

The AI engine should own:

- Prompt assembly.
- Context selection.
- Model policy selection.
- Token estimation.
- Budget checks.
- Provider adapter routing.
- Response normalization.
- Structured output validation.
- Usage reporting.
- Error classification.

The AI engine should not own:

- Direct database writes.
- Authorization.
- Payment logic.
- Final game-state mutation.
- Frontend rendering.

## Provider-Neutral Contracts

Future implementation should define contracts similar to:

```text
GenerationRequest
  feature
  userId
  sessionId
  storyId
  modelPolicy
  messages or prompt parts
  responseSchema
  tokenBudget

GenerationResult
  narrativeText
  structuredCandidate
  provider
  model
  usage
  finishReason
  safetySignals

LLMProvider
  generate(request): GenerationResult
```

Provider-specific adapters translate these contracts to real APIs.

## Gameplay Flow

Future turn generation should follow this boundary:

1. API receives player input.
2. API authenticates and authorizes the session.
3. Domain layer prepares a validated world snapshot.
4. Memory layer selects relevant context.
5. AI engine builds a generation request.
6. Budget policy approves, downgrades, or rejects the request.
7. Provider adapter returns a normalized result.
8. Domain validators inspect proposed state changes.
9. API persists accepted events and usage records.
10. API returns a player-facing result.

## Structured Output

The model may be asked for structured candidate changes, but those changes are untrusted.

Examples:

- NPC mood changes.
- Quest progress candidates.
- Inventory candidates.
- World flag candidates.
- Relationship candidates.

Every candidate must pass schema validation, story-rule validation, and authorization before persistence.

## Cost Controls

Required future controls:

- Feature-level model policies.
- Maximum context tokens per request.
- Maximum output tokens per request.
- Per-user daily and monthly limits.
- Per-session limits.
- Per-story limits.
- Provider fallback policy.
- Request deduplication for retries.
- Usage ledger writes even when generation fails after provider call.

## Provider Switching

Provider switching should require adding or configuring an adapter, not rewriting the gameplay engine.

Adapter-specific code belongs in the AI engine package or a provider subpackage. Domain and gameplay code should depend only on internal request/result interfaces.

## No Live Integration Yet

This repository phase must not include:

- Real provider API keys.
- Provider SDK wiring.
- Live model calls.
- Prompt templates that imply production behavior.

Only contracts, docs, and placeholders are acceptable until the implementation phase is explicitly requested.

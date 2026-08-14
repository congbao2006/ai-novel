export type LLMProviderId = string;

export type AIMessageRole = "system" | "developer" | "user" | "assistant";

export type AIMessage = {
  readonly role: AIMessageRole;
  readonly content: string;
};

export type TokenBudget = {
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly maxEstimatedCostUsd?: number;
};

export type ModelPolicy = {
  readonly feature: string;
  readonly preferredProvider?: LLMProviderId;
  readonly preferredModel?: string;
  readonly allowedProviders: readonly LLMProviderId[];
  readonly tokenBudget: TokenBudget;
};

export type UsageEstimate = {
  readonly inputTokens: number;
  readonly maxOutputTokens: number;
  readonly estimatedCostUsd?: number;
};

export type TokenUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly estimatedCostUsd?: number;
};

export type GenerationRequest<TStructuredOutput = unknown> = {
  readonly requestId: string;
  readonly feature: string;
  readonly userId?: string;
  readonly storyId?: string;
  readonly sessionId?: string;
  readonly messages: readonly AIMessage[];
  readonly modelPolicy: ModelPolicy;
  readonly responseSchemaName?: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly structuredOutputExample?: TStructuredOutput;
};

export type GenerationFinishReason =
  | "stop"
  | "length"
  | "content_filter"
  | "tool_call"
  | "error";

export type GenerationResult<TStructuredOutput = unknown> = {
  readonly requestId: string;
  readonly provider: LLMProviderId;
  readonly model: string;
  readonly narrativeText: string;
  readonly structuredOutput?: TStructuredOutput;
  readonly usage: TokenUsage;
  readonly finishReason: GenerationFinishReason;
  readonly safetySignals?: readonly string[];
};

export type LLMProvider<TStructuredOutput = unknown> = {
  readonly id: LLMProviderId;
  estimateUsage(
    request: GenerationRequest<TStructuredOutput>
  ): Promise<UsageEstimate>;
  generate(
    request: GenerationRequest<TStructuredOutput>
  ): Promise<GenerationResult<TStructuredOutput>>;
};

export class AIProviderUnavailableError extends Error {
  constructor(providerId: LLMProviderId) {
    super(`AI provider is unavailable: ${providerId}`);
    this.name = "AIProviderUnavailableError";
  }
}

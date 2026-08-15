export type LLMProviderId = "disabled" | "openai" | (string & {});

export type AIUsagePurpose =
  | "gameplay_turn"
  | "smoke"
  | "summary"
  | "npc"
  | "memory"
  | "other";

export type AIMessageRole = "system" | "developer" | "user" | "assistant";

export type AIMessage = {
  readonly role: AIMessageRole;
  readonly content: string;
};

export type TokenBudget = {
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly maxEstimatedCostMicros?: number;
};

export type ModelPolicy = {
  readonly feature: string;
  readonly preferredProvider?: LLMProviderId;
  readonly preferredModel?: string;
  readonly allowedProviders: readonly LLMProviderId[];
  readonly tokenBudget: TokenBudget;
};

export type ModelPolicySet = {
  readonly defaultStoryModel: ModelPolicy;
  readonly summary?: ModelPolicy;
  readonly npc?: ModelPolicy;
  readonly stateExtraction?: ModelPolicy;
};

export type JsonSchema = {
  readonly type: string;
  readonly properties?: Record<string, unknown>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly items?: unknown;
  readonly [key: string]: unknown;
};

export type StructuredOutputSchema = {
  readonly name: string;
  readonly description?: string;
  readonly schema: JsonSchema;
  readonly strict?: boolean;
};

export type UsageEstimate = {
  readonly inputTokens?: number;
  readonly maxOutputTokens: number;
  readonly estimatedCostMicros?: number;
};

export type TokenUsage = {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
  readonly estimatedCostMicros?: number;
};

export type GenerationRequest<TStructuredOutput = unknown> = {
  readonly requestId?: string;
  readonly feature: string;
  readonly userId?: string;
  readonly storyId?: string;
  readonly sessionId?: string;
  readonly model?: string;
  readonly instructions?: string;
  readonly messages?: readonly AIMessage[];
  readonly input?: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly modelPolicy?: ModelPolicy;
  readonly responseSchema?: StructuredOutputSchema;
  readonly responseSchemaName?: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly safetyIdentifier?: string;
  readonly structuredOutputExample?: TStructuredOutput;
};

export type GenerationFinishReason =
  | "stop"
  | "length"
  | "content_filter"
  | "tool_call"
  | "error"
  | "incomplete"
  | "unknown";

export type GenerationResult<TStructuredOutput = unknown> = {
  readonly requestId: string | null;
  readonly provider: LLMProviderId;
  readonly model: string;
  readonly text: string;
  readonly narrativeText: string;
  readonly structuredOutput?: TStructuredOutput;
  readonly usage: TokenUsage;
  readonly finishReason: GenerationFinishReason;
  readonly latencyMs: number;
  readonly status?: string;
  readonly safetySignals?: readonly string[];
  readonly estimatedCostMicros?: number;
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

export type AIGatewayGenerateOptions = {
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
};

export type AIUsageLedgerRecordInput = {
  readonly userId?: string;
  readonly sessionId?: string;
  readonly provider: LLMProviderId;
  readonly model: string;
  readonly purpose: AIUsagePurpose;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
  readonly estimatedCostMicros?: number;
  readonly latencyMs: number | null;
  readonly providerRequestId?: string | null;
  readonly errorCode?: string | null;
  readonly status: "success" | "failed";
  readonly createdAt: Date;
};

export type AIUsageLedger = {
  recordUsage(input: AIUsageLedgerRecordInput): Promise<void>;
};

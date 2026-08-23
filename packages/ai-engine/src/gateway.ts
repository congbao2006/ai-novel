import { estimateGenerationCostMicros } from "./cost.js";
import type { ModelPricingRegistry } from "./cost.js";
import {
  AIConfigurationError,
  AIError,
  AITimeoutError,
  AIProviderUnavailableError
} from "./errors.js";
import type {
  AIGatewayGenerateOptions,
  AIUsagePurpose,
  AIUsageLedger,
  GenerationRequest,
  GenerationResult,
  LLMProvider,
  ModelPolicy,
} from "./types.js";

export type AIGatewayOptions = {
  readonly providers: readonly LLMProvider[];
  readonly defaultModelPolicy: ModelPolicy;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly pricingRegistry?: ModelPricingRegistry;
  readonly usageLedger?: AIUsageLedger;
  readonly logger?: {
    info(metadata: Record<string, unknown>, message: string): void;
    warn(metadata: Record<string, unknown>, message: string): void;
  };
};

export class AIGateway {
  private readonly providers = new Map<string, LLMProvider>();

  constructor(private readonly options: AIGatewayOptions) {
    for (const provider of options.providers) {
      this.providers.set(provider.id, provider);
    }
  }

  async generate<TStructuredOutput = unknown>(
    request: GenerationRequest<TStructuredOutput>,
    options: AIGatewayGenerateOptions = {}
  ): Promise<GenerationResult<TStructuredOutput>> {
    const policy = request.modelPolicy ?? this.options.defaultModelPolicy;
    const providerId = policy.preferredProvider ?? policy.allowedProviders[0];

    if (!providerId) {
      throw new AIConfigurationError("Model policy has no allowed provider.");
    }

    const provider = this.providers.get(providerId) as
      | LLMProvider<TStructuredOutput>
      | undefined;

    if (!provider) {
      throw new AIProviderUnavailableError(providerId);
    }

    const maxRetries = options.maxRetries ?? this.options.maxRetries;
    const timeoutMs = options.timeoutMs ?? this.options.timeoutMs;
    const model = request.model ?? policy.preferredModel;

    if (!model) {
      throw new AIConfigurationError("Model policy has no model.");
    }

    const normalizedRequest = {
      ...request,
      model,
      maxOutputTokens:
        request.maxOutputTokens ?? policy.tokenBudget.maxOutputTokens,
      modelPolicy: policy
    };
    const startedAt = Date.now();

    try {
      const result = await retryWithBackoff(
        () => withTimeout(provider.generate(normalizedRequest), timeoutMs),
        maxRetries
      );
      const estimatedCostMicros = estimateGenerationCostMicros({
        provider: result.provider,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        ...(this.options.pricingRegistry
          ? { pricingRegistry: this.options.pricingRegistry }
          : {})
      });
      const enrichedResult: GenerationResult<TStructuredOutput> = {
        ...result,
        ...(estimatedCostMicros !== undefined
          ? {
              estimatedCostMicros,
              usage: {
                ...result.usage,
                estimatedCostMicros
              }
            }
          : {})
      };

      this.options.logger?.info(
        safeLogMetadata(enrichedResult, "success"),
        "ai generation completed"
      );
      await this.options.usageLedger?.recordUsage({
        ...(request.userId ? { userId: request.userId } : {}),
        ...(request.sessionId ? { sessionId: request.sessionId } : {}),
        provider: enrichedResult.provider,
        model: enrichedResult.model,
        purpose: usagePurposeFromRequest(request),
        inputTokens: enrichedResult.usage.inputTokens,
        outputTokens: enrichedResult.usage.outputTokens,
        totalTokens: enrichedResult.usage.totalTokens,
        ...(estimatedCostMicros !== undefined ? { estimatedCostMicros } : {}),
        latencyMs: enrichedResult.latencyMs,
        providerRequestId: enrichedResult.requestId,
        errorCode: null,
        status: "success",
        createdAt: new Date()
      });

      return enrichedResult;
    } catch (error) {
      const aiError = normalizeGatewayError(error);
      const latencyMs = Date.now() - startedAt;

      this.options.logger?.warn(
        safeFailureLogMetadata(provider.id, model, latencyMs, aiError),
        "ai generation failed"
      );
      await this.options.usageLedger?.recordUsage({
        ...(request.userId ? { userId: request.userId } : {}),
        ...(request.sessionId ? { sessionId: request.sessionId } : {}),
        provider: provider.id,
        model,
        purpose: usagePurposeFromRequest(request),
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        latencyMs,
        providerRequestId: null,
        errorCode: aiError.code,
        status: "failed",
        createdAt: new Date()
      });

      throw aiError;
    }
  }
}

function safeFailureLogMetadata(
  provider: string,
  model: string,
  latencyMs: number,
  error: AIError
): Record<string, unknown> {
  return {
    provider,
    model,
    latencyMs,
    success: false,
    errorCode: error.code,
    retryable: error.retryable,
    ...(error.diagnostics ? { aiProvider: error.diagnostics } : {})
  };
}

function usagePurposeFromRequest(request: GenerationRequest): AIUsagePurpose {
  const purpose = request.metadata?.purpose;

  if (
    purpose === "gameplay_turn" ||
    purpose === "smoke" ||
    purpose === "summary" ||
    purpose === "npc" ||
    purpose === "memory" ||
    purpose === "embedding" ||
    purpose === "other"
  ) {
    return purpose;
  }

  return "other";
}

async function retryWithBackoff<T>(
  work: () => Promise<T>,
  maxRetries: number
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await work();
    } catch (error) {
      const aiError = normalizeGatewayError(error);

      if (!aiError.retryable || attempt >= maxRetries) {
        throw aiError;
      }

      await sleep(backoffMs(attempt));
      attempt += 1;
    }
  }
}

async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new AITimeoutError()), timeoutMs);
  });

  try {
    return await Promise.race([work, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function normalizeGatewayError(error: unknown): AIError {
  if (error instanceof AIError) {
    return error;
  }

  return new AIError("AI gateway failed.", "ai_error", false, error);
}

function backoffMs(attempt: number): number {
  const base = 100 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 50);
  return base + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeLogMetadata(
  result: GenerationResult,
  status: "success" | "failure"
): Record<string, unknown> {
  return {
    provider: result.provider,
    model: result.model,
    requestId: result.requestId,
    latencyMs: result.latencyMs,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    estimatedCostMicros: result.estimatedCostMicros,
    success: status === "success"
  };
}

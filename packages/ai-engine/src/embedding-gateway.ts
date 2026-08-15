import { estimateGenerationCostMicros } from "./cost.js";
import type { ModelPricingRegistry } from "./cost.js";
import {
  AIConfigurationError,
  AIError,
  AIInvalidResponseError,
  AIProviderUnavailableError,
  AITimeoutError
} from "./errors.js";
import type {
  AIUsageLedger,
  EmbeddingGatewayOptions,
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResult
} from "./types.js";

export type EmbeddingGatewayConfig = {
  readonly providers: readonly EmbeddingProvider[];
  readonly defaultProvider: string;
  readonly defaultModel: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly pricingRegistry?: ModelPricingRegistry;
  readonly usageLedger?: AIUsageLedger;
  readonly logger?: {
    info(metadata: Record<string, unknown>, message: string): void;
    warn(metadata: Record<string, unknown>, message: string): void;
  };
};

export class EmbeddingGateway {
  private readonly providers = new Map<string, EmbeddingProvider>();

  constructor(private readonly config: EmbeddingGatewayConfig) {
    for (const provider of config.providers) {
      this.providers.set(provider.id, provider);
    }
  }

  async embed(
    request: EmbeddingRequest,
    options: EmbeddingGatewayOptions = {}
  ): Promise<EmbeddingResult> {
    if (!request.texts.length) {
      throw new AIInvalidResponseError("Embedding request must include text.");
    }

    const providerId = this.config.defaultProvider;
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new AIProviderUnavailableError(providerId);
    }

    const model = request.model ?? this.config.defaultModel;

    if (!model) {
      throw new AIConfigurationError("Embedding model is required.");
    }

    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const maxRetries = options.maxRetries ?? this.config.maxRetries;
    const startedAt = Date.now();
    const normalizedRequest = {
      ...request,
      model,
      metadata: {
        ...(request.metadata ?? {}),
        purpose: request.metadata?.purpose ?? "embedding"
      }
    };

    try {
      const result = await retryWithBackoff(
        () => withTimeout(provider.embed(normalizedRequest), timeoutMs),
        maxRetries
      );

      if (result.embeddings.length !== request.texts.length) {
        throw new AIInvalidResponseError(
          "Embedding provider returned a mismatched vector count."
        );
      }

      const estimatedCostMicros = estimateGenerationCostMicros({
        provider: result.provider,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: 0,
        ...(this.config.pricingRegistry
          ? { pricingRegistry: this.config.pricingRegistry }
          : {})
      });
      const enrichedResult: EmbeddingResult = {
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

      this.config.logger?.info(
        {
          provider: enrichedResult.provider,
          model: enrichedResult.model,
          vectorCount: enrichedResult.embeddings.length,
          latencyMs: enrichedResult.latencyMs,
          inputTokens: enrichedResult.usage.inputTokens,
          estimatedCostMicros,
          success: true
        },
        "embedding completed"
      );

      await this.config.usageLedger?.recordUsage({
        ...(request.userId ? { userId: request.userId } : {}),
        ...(request.sessionId ? { sessionId: request.sessionId } : {}),
        provider: enrichedResult.provider,
        model: enrichedResult.model,
        purpose: "embedding",
        inputTokens: enrichedResult.usage.inputTokens,
        outputTokens: 0,
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
      const aiError = normalizeEmbeddingError(error);
      const latencyMs = Date.now() - startedAt;

      this.config.logger?.warn(
        {
          provider: provider.id,
          model,
          vectorCount: request.texts.length,
          latencyMs,
          success: false,
          errorCode: aiError.code
        },
        "embedding failed"
      );

      await this.config.usageLedger?.recordUsage({
        ...(request.userId ? { userId: request.userId } : {}),
        ...(request.sessionId ? { sessionId: request.sessionId } : {}),
        provider: provider.id,
        model,
        purpose: "embedding",
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

async function retryWithBackoff<T>(
  work: () => Promise<T>,
  maxRetries: number
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await work();
    } catch (error) {
      const aiError = normalizeEmbeddingError(error);

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

function normalizeEmbeddingError(error: unknown): AIError {
  if (error instanceof AIError) {
    return error;
  }

  return new AIError("Embedding gateway failed.", "ai_error", false, error);
}

function backoffMs(attempt: number): number {
  return 100 * 2 ** attempt + Math.floor(Math.random() * 50);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

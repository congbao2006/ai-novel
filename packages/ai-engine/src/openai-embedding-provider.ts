import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  InternalServerError,
  RateLimitError
} from "openai";
import {
  AIAuthenticationError,
  AIInvalidResponseError,
  AIProviderError,
  AIRateLimitError,
  AITimeoutError
} from "./errors.js";
import type {
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResult,
  TokenUsage
} from "./types.js";

export type OpenAIEmbeddingProviderOptions = {
  readonly apiKey: string;
  readonly timeoutMs: number;
};

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = "openai";
  private readonly client: OpenAI;

  constructor(options: OpenAIEmbeddingProviderOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      timeout: options.timeoutMs,
      maxRetries: 0
    });
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    if (!request.model) {
      throw new AIProviderError("OpenAI embedding request is missing model.");
    }

    const startedAt = Date.now();

    try {
      const response = await this.client.embeddings.create({
        model: request.model,
        input: [...request.texts],
        ...(request.metadata ? { user: request.metadata.user } : {})
      });
      const latencyMs = Date.now() - startedAt;
      const embeddings = normalizeEmbeddings(response, request.texts.length);

      return {
        requestId: getStringProperty(response, "_request_id"),
        provider: this.id,
        model: getStringProperty(response, "model") ?? request.model,
        embeddings,
        usage: normalizeUsage(response),
        latencyMs
      };
    } catch (error) {
      throw mapOpenAIError(error);
    }
  }
}

function normalizeEmbeddings(
  response: unknown,
  expectedCount: number
): readonly (readonly number[])[] {
  const data = getArrayProperty(response, "data");

  if (!data || data.length !== expectedCount) {
    throw new AIInvalidResponseError(
      "OpenAI embedding response returned an unexpected vector count."
    );
  }

  return data.map((item) => {
    const embedding = getArrayProperty(item, "embedding");

    if (!embedding || !embedding.every((value) => typeof value === "number")) {
      throw new AIInvalidResponseError(
        "OpenAI embedding response included an invalid vector."
      );
    }

    return embedding as number[];
  });
}

function normalizeUsage(response: unknown): TokenUsage {
  const usage = getObjectProperty(response, "usage");
  const inputTokens = getNumberProperty(usage, "prompt_tokens");
  const totalTokens = getNumberProperty(usage, "total_tokens") ?? inputTokens;

  return {
    inputTokens,
    outputTokens: 0,
    totalTokens
  };
}

function mapOpenAIError(error: unknown): Error {
  if (error instanceof AuthenticationError) {
    return new AIAuthenticationError(undefined, error);
  }

  if (error instanceof RateLimitError) {
    return new AIRateLimitError(undefined, error);
  }

  if (error instanceof APIConnectionTimeoutError) {
    return new AITimeoutError(undefined, error);
  }

  if (error instanceof APIConnectionError) {
    return new AIProviderError("OpenAI embedding connection failed.", true, error);
  }

  if (error instanceof InternalServerError) {
    return new AIProviderError("OpenAI embedding server error.", true, error);
  }

  if (error instanceof APIError) {
    return new AIProviderError(
      `OpenAI embedding request failed with status ${error.status ?? "unknown"}.`,
      Boolean(error.status && error.status >= 500),
      error
    );
  }

  return new AIProviderError("OpenAI embedding request failed.", false, error);
}

function getObjectProperty(value: unknown, key: string): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "object" && candidate !== null
    ? (candidate as Record<string, unknown>)
    : null;
}

function getArrayProperty(value: unknown, key: string): unknown[] | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return Array.isArray(candidate) ? candidate : null;
}

function getStringProperty(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : null;
}

function getNumberProperty(value: unknown, key: string): number | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "number" ? candidate : null;
}

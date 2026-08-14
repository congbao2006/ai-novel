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
  AIMessage,
  GenerationFinishReason,
  GenerationRequest,
  GenerationResult,
  LLMProvider,
  TokenUsage,
  UsageEstimate
} from "./types.js";

export type OpenAIProviderOptions = {
  readonly apiKey: string;
  readonly timeoutMs: number;
};

export class OpenAIProvider implements LLMProvider {
  readonly id = "openai";
  private readonly client: OpenAI;

  constructor(options: OpenAIProviderOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      timeout: options.timeoutMs,
      maxRetries: 0
    });
  }

  async estimateUsage(request: GenerationRequest): Promise<UsageEstimate> {
    return {
      maxOutputTokens:
        request.maxOutputTokens ??
        request.modelPolicy?.tokenBudget.maxOutputTokens ??
        0
    };
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const startedAt = Date.now();

    try {
      const response = await this.client.responses.create(
        buildResponsesRequest(request) as never
      );
      const latencyMs = Date.now() - startedAt;
      const text = extractText(response);
      const usage = normalizeUsage(response);
      const structuredOutput = request.responseSchema
        ? parseStructuredOutput(text)
        : undefined;

      const status = getStringProperty(response, "status");

      return {
        requestId: getStringProperty(response, "_request_id") ?? null,
        provider: this.id,
        model: getStringProperty(response, "model") ?? request.model ?? "unknown",
        text,
        narrativeText: text,
        ...(structuredOutput === undefined ? {} : { structuredOutput }),
        usage,
        finishReason: normalizeFinishReason(response),
        latencyMs,
        ...(status ? { status } : {})
      };
    } catch (error) {
      throw mapOpenAIError(error);
    }
  }
}

function buildResponsesRequest(request: GenerationRequest): Record<string, unknown> {
  const model = request.model ?? request.modelPolicy?.preferredModel;

  if (!model) {
    throw new AIProviderError("OpenAI request is missing model.");
  }

  const body: Record<string, unknown> = {
    model,
    input: buildInput(request)
  };

  if (request.instructions) {
    body.instructions = request.instructions;
  }

  if (request.maxOutputTokens !== undefined) {
    body.max_output_tokens = request.maxOutputTokens;
  }

  if (request.temperature !== undefined) {
    body.temperature = request.temperature;
  }

  if (request.metadata) {
    body.metadata = request.metadata;
  }

  if (request.safetyIdentifier) {
    body.safety_identifier = request.safetyIdentifier;
  }

  if (request.responseSchema) {
    body.text = {
      format: {
        type: "json_schema",
        name: request.responseSchema.name,
        ...(request.responseSchema.description
          ? { description: request.responseSchema.description }
          : {}),
        strict: request.responseSchema.strict ?? true,
        schema: request.responseSchema.schema
      }
    };
  }

  return body;
}

function buildInput(request: GenerationRequest): string | readonly Record<string, string>[] {
  if (request.messages?.length) {
    return request.messages.map(toOpenAIMessage);
  }

  return request.input ?? "";
}

function toOpenAIMessage(message: AIMessage): Record<string, string> {
  return {
    role: message.role === "system" ? "developer" : message.role,
    content: message.content
  };
}

function extractText(response: unknown): string {
  const outputText = getStringProperty(response, "output_text");

  if (outputText !== null) {
    return outputText;
  }

  throw new AIInvalidResponseError("OpenAI response did not include output text.");
}

function normalizeUsage(response: unknown): TokenUsage {
  const usage = getObjectProperty(response, "usage");
  const inputTokens = getNumberProperty(usage, "input_tokens");
  const outputTokens = getNumberProperty(usage, "output_tokens");
  const totalTokens =
    getNumberProperty(usage, "total_tokens") ??
    (inputTokens !== null && outputTokens !== null
      ? inputTokens + outputTokens
      : null);

  return {
    inputTokens,
    outputTokens,
    totalTokens
  };
}

function normalizeFinishReason(response: unknown): GenerationFinishReason {
  const status = getStringProperty(response, "status");

  if (status === "completed") {
    return "stop";
  }

  if (status === "incomplete") {
    return "incomplete";
  }

  return "unknown";
}

function parseStructuredOutput(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new AIInvalidResponseError(
      "OpenAI structured output was not valid JSON.",
      error
    );
  }
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
    return new AIProviderError("OpenAI connection failed.", true, error);
  }

  if (error instanceof InternalServerError) {
    return new AIProviderError("OpenAI server error.", true, error);
  }

  if (error instanceof APIError) {
    return new AIProviderError(
      `OpenAI request failed with status ${error.status ?? "unknown"}.`,
      Boolean(error.status && error.status >= 500),
      error
    );
  }

  return new AIProviderError("OpenAI request failed.", false, error);
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

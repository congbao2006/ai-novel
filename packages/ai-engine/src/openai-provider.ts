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
  AIError,
  type AIProviderDiagnostics,
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
  LLMProviderId,
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

      return normalizeOpenAIResponse(response, request, latencyMs, this.id);
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }

      throw mapOpenAIError(error, request);
    }
  }
}

export function normalizeOpenAIResponse<TStructuredOutput = unknown>(
  response: unknown,
  request: GenerationRequest<TStructuredOutput>,
  latencyMs: number,
  provider: LLMProviderId = "openai"
): GenerationResult<TStructuredOutput> {
  const usage = normalizeUsage(response);
  assertResponseCompleted(response);
  assertNoRefusal(response);
  const text = extractText(response);
  const structuredOutput = request.responseSchema
    ? (parseStructuredOutput(text) as TStructuredOutput)
    : undefined;
  const status = getStringProperty(response, "status");

  return {
    requestId: getStringProperty(response, "_request_id") ?? null,
    provider,
    model: getStringProperty(response, "model") ?? request.model ?? "unknown",
    text,
    narrativeText: text,
    ...(structuredOutput === undefined ? {} : { structuredOutput }),
    usage,
    finishReason: normalizeFinishReason(response),
    latencyMs,
    ...(status ? { status } : {})
  };
}

export function buildResponsesRequest(
  request: GenerationRequest
): Record<string, unknown> {
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
      format: buildTextFormat(request.responseSchema)
    };
  }

  return body;
}

function buildTextFormat(
  responseSchema: NonNullable<GenerationRequest["responseSchema"]>
): Record<string, unknown> {
  const requestedStrict = responseSchema.strict ?? true;
  const strict = requestedStrict
    ? isOpenAIStrictSchemaCompatible(responseSchema.schema)
    : false;

  return {
    type: "json_schema",
    name: responseSchema.name,
    ...(responseSchema.description
      ? { description: responseSchema.description }
      : {}),
    strict,
    schema: responseSchema.schema
  };
}

function isOpenAIStrictSchemaCompatible(schema: unknown): boolean {
  return isOpenAIStrictSchemaNodeCompatible(schema);
}

function isOpenAIStrictSchemaNodeCompatible(node: unknown): boolean {
  if (typeof node !== "object" || node === null) {
    return true;
  }

  const record = node as Record<string, unknown>;
  const properties = getObjectProperty(record, "properties");
  const isObjectSchema =
    record.type === "object" ||
    properties !== null ||
    "additionalProperties" in record;

  if (isObjectSchema) {
    if (record.additionalProperties !== false) {
      return false;
    }

    if (properties) {
      const required = Array.isArray(record.required)
        ? new Set(record.required.filter((key): key is string => typeof key === "string"))
        : new Set<string>();

      for (const key of Object.keys(properties)) {
        if (!required.has(key)) {
          return false;
        }
      }
    }
  }

  if (properties) {
    for (const child of Object.values(properties)) {
      if (!isOpenAIStrictSchemaNodeCompatible(child)) {
        return false;
      }
    }
  }

  if ("items" in record && !isOpenAIStrictSchemaNodeCompatible(record.items)) {
    return false;
  }

  if (Array.isArray(record.anyOf)) {
    for (const child of record.anyOf) {
      if (!isOpenAIStrictSchemaNodeCompatible(child)) {
        return false;
      }
    }
  }

  return true;
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
  const outputParts = extractOutputTextParts(response);

  if (outputParts.length > 0) {
    return outputParts.join("");
  }

  const outputText = getStringProperty(response, "output_text");

  if (outputText !== null) {
    return outputText;
  }

  throw new AIInvalidResponseError("OpenAI response did not include output text.");
}

function extractOutputTextParts(response: unknown): string[] {
  const output = getArrayProperty(response, "output");

  if (!output) {
    return [];
  }

  const parts: string[] = [];

  for (const item of output) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    if (getStringProperty(item, "type") !== "message") {
      continue;
    }

    const content = getArrayProperty(item, "content");

    if (!content) {
      continue;
    }

    for (const part of content) {
      if (
        typeof part === "object" &&
        part !== null &&
        getStringProperty(part, "type") === "output_text"
      ) {
        const text = getStringProperty(part, "text");

        if (text !== null) {
          parts.push(text);
        }
      }
    }
  }

  return parts;
}

function assertResponseCompleted(response: unknown): void {
  const status = getStringProperty(response, "status");

  if (!status || status === "completed") {
    return;
  }

  const incompleteDetails = getObjectProperty(response, "incomplete_details");
  const reason = getStringProperty(incompleteDetails, "reason");
  const message =
    status === "incomplete"
      ? `OpenAI response was incomplete${reason ? `: ${reason}` : ""}.`
      : `OpenAI response was not completed: ${status}.`;

  throw new AIInvalidResponseError(message, undefined, {
    provider: "openai",
    ...(getStringProperty(response, "model")
      ? { model: getStringProperty(response, "model")! }
      : {}),
    requestId: getStringProperty(response, "_request_id"),
    providerErrorCode:
      status === "incomplete" ? "openai_response_incomplete" : "openai_response_not_completed",
    providerErrorType: status,
    providerErrorParam: reason,
    providerMessage: message
  });
}

function assertNoRefusal(response: unknown): void {
  const output = getArrayProperty(response, "output");

  if (!output) {
    return;
  }

  for (const item of output) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const content = getArrayProperty(item, "content");

    if (!content) {
      continue;
    }

    for (const part of content) {
      if (
        typeof part === "object" &&
        part !== null &&
        getStringProperty(part, "type") === "refusal"
      ) {
        throw new AIInvalidResponseError("OpenAI response was a refusal.", undefined, {
          provider: "openai",
          ...(getStringProperty(response, "model")
            ? { model: getStringProperty(response, "model")! }
            : {}),
          requestId: getStringProperty(response, "_request_id"),
          providerErrorType: "refusal",
          providerErrorCode: "openai_refusal",
          providerMessage: "OpenAI response was a refusal."
        });
      }
    }
  }
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
      error,
      {
        provider: "openai",
        providerErrorCode: "openai_invalid_structured_json",
        providerErrorType: "invalid_response",
        providerMessage: "OpenAI structured output was not valid JSON.",
        ...(error instanceof Error ? { cause: serializeDiagnosticCause(error) } : {})
      }
    );
  }
}

export function mapOpenAIError(
  error: unknown,
  request?: Pick<GenerationRequest, "model" | "modelPolicy">
): Error {
  const diagnostics = extractOpenAIErrorDiagnostics(
    error,
    request?.model ?? request?.modelPolicy?.preferredModel
  );

  if (error instanceof AuthenticationError) {
    return new AIAuthenticationError(undefined, error, diagnostics);
  }

  if (error instanceof RateLimitError) {
    return new AIRateLimitError(undefined, error, diagnostics);
  }

  if (error instanceof APIConnectionTimeoutError) {
    return new AITimeoutError(undefined, error, diagnostics);
  }

  if (error instanceof APIConnectionError) {
    return new AIProviderError(
      "OpenAI connection failed.",
      true,
      error,
      diagnostics
    );
  }

  if (error instanceof InternalServerError) {
    return new AIProviderError(
      "OpenAI server error.",
      true,
      error,
      diagnostics
    );
  }

  if (error instanceof APIError) {
    return new AIProviderError(
      "AI provider request failed.",
      Boolean(error.status && error.status >= 500),
      error,
      diagnostics
    );
  }

  return new AIProviderError(
    "AI provider request failed.",
    Boolean(diagnostics.httpStatus && diagnostics.httpStatus >= 500),
    error,
    diagnostics
  );
}

export function extractOpenAIErrorDiagnostics(
  error: unknown,
  model?: string
): AIProviderDiagnostics {
  const openAIError = getObjectProperty(error, "error");
  const httpStatus =
    getNumberProperty(error, "status") ?? getNumberProperty(error, "statusCode");
  const requestId =
    getStringProperty(error, "request_id") ??
    getStringProperty(error, "requestID") ??
    getStringProperty(error, "_request_id");
  const providerErrorType =
    getStringProperty(error, "type") ?? getStringProperty(openAIError, "type");
  const providerErrorCode =
    getStringProperty(error, "code") ?? getStringProperty(openAIError, "code");
  const providerErrorParam =
    getStringProperty(error, "param") ?? getStringProperty(openAIError, "param");
  const providerMessage =
    getStringProperty(openAIError, "message") ??
    (error instanceof Error ? error.message : undefined);

  return {
    provider: "openai",
    ...(model ? { model } : {}),
    ...(httpStatus !== null ? { httpStatus } : {}),
    ...(providerErrorType ? { providerErrorType } : {}),
    ...(providerErrorCode ? { providerErrorCode } : {}),
    ...(providerErrorParam !== null ? { providerErrorParam } : {}),
    ...(providerMessage ? { providerMessage: sanitizeDiagnosticString(providerMessage) } : {}),
    ...(requestId !== null ? { requestId } : {}),
    ...(error instanceof Error ? { cause: serializeDiagnosticCause(error) } : {})
  };
}

function serializeDiagnosticCause(error: Error): NonNullable<AIProviderDiagnostics["cause"]> {
  const code = getStringProperty(error, "code");
  const status =
    getNumberProperty(error, "status") ?? getNumberProperty(error, "statusCode");

  return {
    name: error.name,
    message: sanitizeDiagnosticString(error.message),
    ...(code ? { code } : {}),
    ...(status !== null ? { status } : {}),
    ...(error.cause instanceof Error
      ? { cause: serializeDiagnosticCause(error.cause) }
      : {})
  };
}

function sanitizeDiagnosticString(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-openai-key]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .slice(0, 1000);
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

function getArrayProperty(value: unknown, key: string): readonly unknown[] | null {
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

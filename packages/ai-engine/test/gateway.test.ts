import { describe, expect, it } from "vitest";
import {
  AIAuthenticationError,
  AIBudgetExceededError,
  AIGateway,
  EmbeddingGateway,
  AIProviderError,
  AIProviderUnavailableError,
  AIRateLimitError,
  AITimeoutError,
  buildResponsesRequest,
  createAIGateway,
  createEmbeddingGateway,
  mapOpenAIError,
  createPolicy,
  evaluateAIBudget,
  estimateGenerationCostMicros,
  hasEnabledBudget,
  pricingKey,
  type AIUsageLedgerRecordInput,
  type GenerationRequest,
  type GenerationResult,
  type EmbeddingProvider,
  type EmbeddingRequest,
  type EmbeddingResult,
  type LLMProvider,
  type ModelPolicy
} from "../src/index.js";

const policy = createPolicy({
  feature: "story.default",
  provider: "test-provider",
  model: "test-model",
  maxOutputTokens: 64
});

function createEmbeddingResult(request: EmbeddingRequest): EmbeddingResult {
  return {
    requestId: request.requestId ?? "embedding-request-id",
    provider: "test-provider",
    model: request.model ?? "embedding-model",
    embeddings: request.texts.map((_, index) => [index + 1, index + 2, index + 3]),
    usage: {
      inputTokens: 12,
      outputTokens: 0,
      totalTokens: 12
    },
    latencyMs: 8
  };
}

function createFakeEmbeddingProvider(
  embed: (request: EmbeddingRequest) => Promise<EmbeddingResult>
): EmbeddingProvider {
  return {
    id: "test-provider",
    embed
  };
}

function createResult(request: GenerationRequest): GenerationResult {
  return {
    requestId: request.requestId ?? "provider-request-id",
    provider: "test-provider",
    model: request.model ?? "test-model",
    text: "{\"ok\":true}",
    narrativeText: "{\"ok\":true}",
    structuredOutput: { ok: true },
    usage: {
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120
    },
    finishReason: "stop",
    latencyMs: 15,
    status: "completed"
  };
}

function createFakeProvider(
  generate: (request: GenerationRequest) => Promise<GenerationResult>
): LLMProvider {
  return {
    id: "test-provider",
    async estimateUsage() {
      return {
        inputTokens: 100,
        maxOutputTokens: 64
      };
    },
    generate
  };
}

describe("AIGateway", () => {
  it("normalizes requests through a provider-neutral gateway", async () => {
    let captured: GenerationRequest | undefined;
    const gateway = new AIGateway({
      providers: [
        createFakeProvider(async (request) => {
          captured = request;
          return createResult(request);
        })
      ],
      defaultModelPolicy: policy,
      timeoutMs: 100,
      maxRetries: 0
    });

    const result = await gateway.generate({
      feature: "story.default",
      input: "hello"
    });

    expect(captured).toMatchObject({
      model: "test-model",
      maxOutputTokens: 64
    });
    expect(result).toMatchObject({
      provider: "test-provider",
      model: "test-model",
      text: "{\"ok\":true}",
      structuredOutput: { ok: true }
    });
  });

  it("retries transient failures and does not retry auth failures", async () => {
    let rateLimitAttempts = 0;
    const retryGateway = new AIGateway({
      providers: [
        createFakeProvider(async (request) => {
          rateLimitAttempts += 1;

          if (rateLimitAttempts === 1) {
            throw new AIRateLimitError();
          }

          return createResult(request);
        })
      ],
      defaultModelPolicy: policy,
      timeoutMs: 100,
      maxRetries: 1
    });

    await expect(
      retryGateway.generate({ feature: "story.default", input: "hello" })
    ).resolves.toMatchObject({ text: "{\"ok\":true}" });
    expect(rateLimitAttempts).toBe(2);

    let authAttempts = 0;
    const authGateway = new AIGateway({
      providers: [
        createFakeProvider(async () => {
          authAttempts += 1;
          throw new AIAuthenticationError();
        })
      ],
      defaultModelPolicy: policy,
      timeoutMs: 100,
      maxRetries: 3
    });

    await expect(
      authGateway.generate({ feature: "story.default", input: "hello" })
    ).rejects.toBeInstanceOf(AIAuthenticationError);
    expect(authAttempts).toBe(1);
  });

  it("maps provider timeout to AITimeoutError", async () => {
    const gateway = new AIGateway({
      providers: [
        createFakeProvider(
          () => new Promise<GenerationResult>(() => undefined)
        )
      ],
      defaultModelPolicy: policy,
      timeoutMs: 5,
      maxRetries: 0
    });

    await expect(
      gateway.generate({ feature: "story.default", input: "slow" })
    ).rejects.toBeInstanceOf(AITimeoutError);
  });

  it("adds cost estimates using injectable pricing", async () => {
    const gateway = new AIGateway({
      providers: [createFakeProvider(async (request) => createResult(request))],
      defaultModelPolicy: policy,
      timeoutMs: 100,
      maxRetries: 0,
      pricingRegistry: {
        [pricingKey("test-provider", "test-model")]: {
          inputMicrosPerMillionTokens: 1_000_000,
          outputMicrosPerMillionTokens: 2_000_000
        }
      }
    });

    const result = await gateway.generate({
      feature: "story.default",
      input: "hello"
    });

    expect(result.usage.estimatedCostMicros).toBe(140);
    expect(result.estimatedCostMicros).toBe(140);
  });

  it("records successful and failed generations through the usage ledger", async () => {
    const records: AIUsageLedgerRecordInput[] = [];
    const successGateway = new AIGateway({
      providers: [createFakeProvider(async (request) => createResult(request))],
      defaultModelPolicy: policy,
      timeoutMs: 100,
      maxRetries: 0,
      pricingRegistry: {
        [pricingKey("test-provider", "test-model")]: {
          inputMicrosPerMillionTokens: 1_000_000,
          outputMicrosPerMillionTokens: 2_000_000
        }
      },
      usageLedger: {
        async recordUsage(input) {
          records.push(input);
        }
      }
    });

    await successGateway.generate({
      feature: "story.default",
      userId: "user-1",
      sessionId: "session-1",
      input: "hello",
      metadata: {
        purpose: "gameplay_turn"
      }
    });

    expect(records[0]).toMatchObject({
      userId: "user-1",
      sessionId: "session-1",
      provider: "test-provider",
      model: "test-model",
      purpose: "gameplay_turn",
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      estimatedCostMicros: 140,
      latencyMs: 15,
      providerRequestId: "provider-request-id",
      errorCode: null,
      status: "success"
    });

    const failedGateway = new AIGateway({
      providers: [
        createFakeProvider(async () => {
          throw new AIRateLimitError();
        })
      ],
      defaultModelPolicy: policy,
      timeoutMs: 100,
      maxRetries: 0,
      usageLedger: {
        async recordUsage(input) {
          records.push(input);
        }
      }
    });

    await expect(
      failedGateway.generate({
        feature: "story.default",
        userId: "user-1",
        input: "hello",
        metadata: { purpose: "gameplay_turn" }
      })
    ).rejects.toBeInstanceOf(AIRateLimitError);

    expect(records[1]).toMatchObject({
      provider: "test-provider",
      model: "test-model",
      purpose: "gameplay_turn",
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      providerRequestId: null,
      errorCode: "ai_rate_limit_error",
      status: "failed"
    });
  });

  it("keeps structured output schema provider-neutral", async () => {
    let captured: GenerationRequest | undefined;
    const gateway = new AIGateway({
      providers: [
        createFakeProvider(async (request) => {
          captured = request;
          return createResult(request);
        })
      ],
      defaultModelPolicy: policy,
      timeoutMs: 100,
      maxRetries: 0
    });

    await gateway.generate({
      feature: "stateExtraction",
      input: "return json",
      responseSchema: {
        name: "turn_proposal",
        strict: true,
        schema: {
          type: "object",
          properties: {
            ok: { type: "boolean" }
          },
          required: ["ok"],
          additionalProperties: false
        }
      }
    });

    expect(captured?.responseSchema?.name).toBe("turn_proposal");
  });

  it("logs safe OpenAI provider diagnostics for failed generations", async () => {
    const logs: Record<string, unknown>[] = [];
    const gateway = new AIGateway({
      providers: [
        createFakeProvider(async () => {
          throw new AIProviderError(
            "AI provider request failed.",
            false,
            new Error("OpenAI request failed with status 400."),
            {
              provider: "openai",
              model: "gpt-5.4-mini",
              httpStatus: 400,
              providerErrorType: "invalid_request_error",
              providerErrorCode: "invalid_schema",
              providerErrorParam: "text.format.schema",
              providerMessage: "Invalid schema for response format.",
              requestId: "req_openai_123",
              cause: {
                name: "BadRequestError",
                message: "OpenAI request failed with status 400.",
                code: "400",
                status: 400
              }
            }
          );
        })
      ],
      defaultModelPolicy: policy,
      timeoutMs: 100,
      maxRetries: 0,
      logger: {
        info() {
          throw new Error("unexpected success log");
        },
        warn(metadata) {
          logs.push(metadata);
        }
      }
    });

    await expect(
      gateway.generate({
        feature: "story.default",
        input: "private player action sk-test-secret"
      })
    ).rejects.toBeInstanceOf(AIProviderError);

    expect(logs[0]).toMatchObject({
      provider: "test-provider",
      model: "test-model",
      success: false,
      errorCode: "ai_provider_error",
      aiProvider: {
        provider: "openai",
        model: "gpt-5.4-mini",
        httpStatus: 400,
        providerErrorType: "invalid_request_error",
        providerErrorCode: "invalid_schema",
        providerErrorParam: "text.format.schema",
        providerMessage: "Invalid schema for response format.",
        requestId: "req_openai_123",
        cause: {
          name: "BadRequestError",
          status: 400
        }
      }
    });
    expect(JSON.stringify(logs[0])).not.toContain("private player action");
    expect(JSON.stringify(logs[0])).not.toContain("sk-test-secret");
  });

  it("maps OpenAI 400 errors to provider-neutral errors with diagnostics", () => {
    const openAIError = Object.assign(
      new Error("400 Invalid schema; Authorization: Bearer sk-test-secret"),
      {
        status: 400,
        code: "invalid_schema",
        type: "invalid_request_error",
        param: "text.format.schema",
        request_id: "req_openai_400",
        error: {
          message: "Invalid schema for response format.",
          type: "invalid_request_error",
          code: "invalid_schema",
          param: "text.format.schema"
        }
      }
    );

    const mapped = mapOpenAIError(openAIError, { model: "gpt-5.4-mini" });

    expect(mapped).toBeInstanceOf(AIProviderError);
    expect(mapped).toMatchObject({
      message: "AI provider request failed.",
      code: "ai_provider_error",
      retryable: false,
      diagnostics: {
        provider: "openai",
        model: "gpt-5.4-mini",
        httpStatus: 400,
        providerErrorType: "invalid_request_error",
        providerErrorCode: "invalid_schema",
        providerErrorParam: "text.format.schema",
        providerMessage: "Invalid schema for response format.",
        requestId: "req_openai_400"
      }
    });
    expect(JSON.stringify((mapped as AIProviderError).diagnostics)).not.toContain(
      "sk-test-secret"
    );
  });

  it("does not send OpenAI strict mode for schemas with dynamic object maps", () => {
    const body = buildResponsesRequest({
      feature: "story.default",
      input: "return json",
      model: "gpt-5.4-mini",
      responseSchema: {
        name: "ai_turn_proposal",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["narrative", "proposedStatePatch"],
          properties: {
            narrative: { type: "string" },
            proposedStatePatch: {
              type: "object",
              additionalProperties: false,
              properties: {
                flags: {
                  type: "object",
                  additionalProperties: { type: "string" }
                }
              }
            }
          }
        }
      }
    });

    expect(body).toMatchObject({
      text: {
        format: {
          type: "json_schema",
          name: "ai_turn_proposal",
          strict: false
        }
      }
    });
  });

  it("keeps OpenAI strict mode for compatible schemas", () => {
    const body = buildResponsesRequest({
      feature: "story.default",
      input: "return json",
      model: "gpt-5.4-mini",
      responseSchema: {
        name: "strict_schema",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["ok"],
          properties: {
            ok: { type: "boolean" }
          }
        }
      }
    });

    expect(body).toMatchObject({
      text: {
        format: {
          type: "json_schema",
          name: "strict_schema",
          strict: true
        }
      }
    });
  });
});

describe("EmbeddingGateway", () => {
  it("normalizes batch embedding through a provider-neutral gateway", async () => {
    let captured: EmbeddingRequest | undefined;
    const gateway = new EmbeddingGateway({
      providers: [
        createFakeEmbeddingProvider(async (request) => {
          captured = request;
          return createEmbeddingResult(request);
        })
      ],
      defaultProvider: "test-provider",
      defaultModel: "embedding-model",
      timeoutMs: 100,
      maxRetries: 0
    });

    const result = await gateway.embed({
      texts: ["memory one", "memory two"]
    });

    expect(captured).toMatchObject({
      model: "embedding-model",
      metadata: { purpose: "embedding" }
    });
    expect(result.embeddings).toHaveLength(2);
    expect(result.provider).toBe("test-provider");
  });

  it("rejects mismatched provider vector count", async () => {
    const gateway = new EmbeddingGateway({
      providers: [
        createFakeEmbeddingProvider(async (request) => ({
          ...createEmbeddingResult(request),
          embeddings: [[1, 2, 3]]
        }))
      ],
      defaultProvider: "test-provider",
      defaultModel: "embedding-model",
      timeoutMs: 100,
      maxRetries: 0
    });

    await expect(
      gateway.embed({ texts: ["one", "two"] })
    ).rejects.toThrow("mismatched vector count");
  });

  it("maps embedding timeout and records failed usage", async () => {
    const records: AIUsageLedgerRecordInput[] = [];
    const gateway = new EmbeddingGateway({
      providers: [
        createFakeEmbeddingProvider(
          () => new Promise<EmbeddingResult>(() => undefined)
        )
      ],
      defaultProvider: "test-provider",
      defaultModel: "embedding-model",
      timeoutMs: 5,
      maxRetries: 0,
      usageLedger: {
        async recordUsage(input) {
          records.push(input);
        }
      }
    });

    await expect(gateway.embed({ texts: ["slow"] })).rejects.toBeInstanceOf(
      AITimeoutError
    );
    expect(records[0]).toMatchObject({
      purpose: "embedding",
      status: "failed",
      errorCode: "ai_timeout_error"
    });
  });

  it("records embedding success with integer cost", async () => {
    const records: AIUsageLedgerRecordInput[] = [];
    const gateway = new EmbeddingGateway({
      providers: [
        createFakeEmbeddingProvider(async (request) => createEmbeddingResult(request))
      ],
      defaultProvider: "test-provider",
      defaultModel: "embedding-model",
      timeoutMs: 100,
      maxRetries: 0,
      pricingRegistry: {
        [pricingKey("test-provider", "embedding-model")]: {
          inputMicrosPerMillionTokens: 1_000_000,
          outputMicrosPerMillionTokens: 0
        }
      },
      usageLedger: {
        async recordUsage(input) {
          records.push(input);
        }
      }
    });

    const result = await gateway.embed({
      userId: "user-1",
      sessionId: "session-1",
      texts: ["memory"],
      metadata: { purpose: "embedding" }
    });

    expect(result.estimatedCostMicros).toBe(12);
    expect(records[0]).toMatchObject({
      userId: "user-1",
      sessionId: "session-1",
      purpose: "embedding",
      inputTokens: 12,
      outputTokens: 0,
      totalTokens: 12,
      estimatedCostMicros: 12,
      providerRequestId: "embedding-request-id",
      status: "success"
    });
  });
});

describe("provider factory and cost estimation", () => {
  it("rejects unsupported providers and missing OpenAI keys", () => {
    expect(() =>
      createAIGateway({
        provider: "anthropic",
        timeoutMs: 100,
        maxRetries: 0,
        maxOutputTokens: 16
      })
    ).toThrow(AIProviderUnavailableError);

    expect(() =>
      createAIGateway({
        provider: "openai",
        openaiModel: "gpt-5.6",
        timeoutMs: 100,
        maxRetries: 0,
        maxOutputTokens: 16
      })
    ).toThrow("OPENAI_API_KEY");

    expect(() =>
      createEmbeddingGateway({
        provider: "openai",
        timeoutMs: 100,
        maxRetries: 0
      })
    ).toThrow("OPENAI_API_KEY");
  });

  it("estimates cost in integer micros without floating point money", () => {
    expect(
      estimateGenerationCostMicros({
        provider: "test-provider",
        model: "test-model",
        inputTokens: 100,
        outputTokens: 20,
        pricingRegistry: {
          [pricingKey("test-provider", "test-model")]: {
            inputMicrosPerMillionTokens: 1_000_000,
            outputMicrosPerMillionTokens: 2_000_000
          }
        }
      })
    ).toBe(140);

    expect(
      estimateGenerationCostMicros({
        provider: "test-provider",
        model: "test-model",
        inputTokens: 0,
        outputTokens: 0,
        pricingRegistry: {
          [pricingKey("test-provider", "test-model")]: {
            inputMicrosPerMillionTokens: 1_000_000,
            outputMicrosPerMillionTokens: 2_000_000
          }
        }
      })
    ).toBe(0);

    expect(
      estimateGenerationCostMicros({
        provider: "test-provider",
        model: "unknown-model",
        inputTokens: 100,
        outputTokens: 20,
        pricingRegistry: {}
      })
    ).toBeUndefined();
  });

  it("evaluates provider-neutral AI budget policies", () => {
    expect(hasEnabledBudget({})).toBe(false);
    expect(
      evaluateAIBudget(
        { userDailyBudgetMicros: 1000 },
        { userDailyCostMicros: 999, userMonthlyCostMicros: 0 }
      )
    ).toEqual({ allowed: true });
    expect(
      evaluateAIBudget(
        { userDailyBudgetMicros: 1000 },
        { userDailyCostMicros: 1000, userMonthlyCostMicros: 0 }
      )
    ).toMatchObject({ allowed: false, exceeded: "user_daily" });
    expect(
      evaluateAIBudget(
        { userMonthlyBudgetMicros: 3000 },
        { userDailyCostMicros: 0, userMonthlyCostMicros: 3000 }
      )
    ).toMatchObject({ allowed: false, exceeded: "user_monthly" });
    expect(
      evaluateAIBudget(
        { sessionBudgetMicros: 2000 },
        {
          userDailyCostMicros: 0,
          userMonthlyCostMicros: 0,
          sessionCostMicros: 2000
        }
      )
    ).toMatchObject({ allowed: false, exceeded: "session" });
    expect(new AIBudgetExceededError()).toMatchObject({
      code: "ai_budget_exceeded",
      retryable: false
    });
  });

  it("preserves the existing LLMProvider contract", async () => {
    const provider: LLMProvider = createFakeProvider(async (request) =>
      createResult(request)
    );
    const request: GenerationRequest = {
      requestId: "req_1",
      feature: "contract-test",
      messages: [],
      modelPolicy: policy as ModelPolicy
    };

    await expect(provider.estimateUsage(request)).resolves.toEqual({
      inputTokens: 100,
      maxOutputTokens: 64
    });
    await expect(provider.generate(request)).resolves.toMatchObject({
      provider: "test-provider",
      model: "test-model"
    });
  });
});

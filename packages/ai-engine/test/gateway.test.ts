import { describe, expect, it } from "vitest";
import {
  AIAuthenticationError,
  AIGateway,
  AIProviderUnavailableError,
  AIRateLimitError,
  AITimeoutError,
  createAIGateway,
  createPolicy,
  estimateGenerationCostMicros,
  pricingKey,
  type GenerationRequest,
  type GenerationResult,
  type LLMProvider,
  type ModelPolicy
} from "../src/index.js";

const policy = createPolicy({
  feature: "story.default",
  provider: "test-provider",
  model: "test-model",
  maxOutputTokens: 64
});

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

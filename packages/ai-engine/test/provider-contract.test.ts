import { describe, expect, it } from "vitest";
import type { GenerationRequest, LLMProvider } from "../src/index.js";

describe("LLM provider contract", () => {
  it("supports provider-neutral usage estimation and generation", async () => {
    const provider: LLMProvider = {
      id: "test-provider",
      async estimateUsage() {
        return {
          inputTokens: 10,
          maxOutputTokens: 20
        };
      },
      async generate(request) {
        return {
          requestId: request.requestId,
          provider: "test-provider",
          model: "test-model",
          narrativeText: "",
          usage: {
            inputTokens: 10,
            outputTokens: 0,
            totalTokens: 10
          },
          finishReason: "stop"
        };
      }
    };

    const request: GenerationRequest = {
      requestId: "req_1",
      feature: "contract-test",
      messages: [],
      modelPolicy: {
        feature: "contract-test",
        allowedProviders: ["test-provider"],
        tokenBudget: {
          maxInputTokens: 100,
          maxOutputTokens: 100
        }
      }
    };

    await expect(provider.estimateUsage(request)).resolves.toEqual({
      inputTokens: 10,
      maxOutputTokens: 20
    });
    await expect(provider.generate(request)).resolves.toMatchObject({
      provider: "test-provider",
      model: "test-model"
    });
  });
});

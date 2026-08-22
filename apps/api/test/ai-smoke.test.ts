import { describe, expect, it } from "vitest";
import type { AIGateway } from "@ai-novel/ai-engine";
import { getServerConfig } from "@ai-novel/config";
import { buildApp } from "../src/app.js";

function createFakeGateway(): AIGateway {
  return {
    async generate() {
      return {
        requestId: "req_ai_smoke",
        provider: "openai",
        model: "test-model",
        text: "OK",
        narrativeText: "OK",
        usage: {
          inputTokens: 5,
          outputTokens: 1,
          totalTokens: 6,
          estimatedCostMicros: 1
        },
        finishReason: "stop",
        latencyMs: 12,
        status: "completed",
        estimatedCostMicros: 1
      };
    }
  } as unknown as AIGateway;
}

describe("internal AI smoke route", () => {
  it("is unavailable without a configured gateway", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/internal/ai/smoke",
      payload: {
        prompt: "Reply with exactly: OK"
      }
    });

    expect(response.statusCode).toBe(503);
    await app.close();
  });

  it("returns normalized AI smoke output without secrets", async () => {
    const app = await buildApp({
      dependencies: {
        aiGateway: createFakeGateway()
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/internal/ai/smoke",
      payload: {
        prompt: "Reply with exactly: OK"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      text: "OK",
      provider: "openai",
      model: "test-model",
      usage: {
        inputTokens: 5,
        outputTokens: 1,
        totalTokens: 6,
        estimatedCostMicros: 1
      },
      latencyMs: 12,
      requestId: "req_ai_smoke",
      estimatedCostMicros: 1
    });
    expect(response.body).not.toContain("OPENAI_API_KEY");

    await app.close();
  });

  it("is disabled by default in production even when a gateway exists", async () => {
    const app = await buildApp({
      config: getServerConfig({
        NODE_ENV: "production",
        WEB_APP_URL: "https://app.example.com",
        API_ALLOWED_ORIGINS: "https://app.example.com",
        DATABASE_URL: "postgresql://user:pass@example.com:5432/ai_novel"
      }),
      dependencies: {
        aiGateway: createFakeGateway()
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/internal/ai/smoke",
      headers: {
        origin: "https://app.example.com"
      },
      payload: {
        prompt: "Reply with exactly: OK"
      }
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("OPENAI_API_KEY");

    await app.close();
  });
});

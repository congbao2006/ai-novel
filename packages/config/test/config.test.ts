import { describe, expect, it } from "vitest";
import { getPublicServerConfig, getServerConfig } from "../src/index.js";

describe("config package", () => {
  it("validates server config without exposing secrets through public config", () => {
    const env = {
      NODE_ENV: "test",
      WEB_APP_URL: "http://localhost:3000",
      API_HOST: "127.0.0.1",
      API_PORT: "4000",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/ai_novel",
      AI_PROVIDER: "disabled",
      AI_EMBEDDING_PROVIDER: "disabled",
      OPENAI_API_KEY: "secret",
      OPENAI_MODEL: "gpt-5.6",
      OPENAI_EMBEDDING_MODEL: "text-embedding-3-small",
      AI_REQUEST_TIMEOUT_MS: "10000",
      AI_MAX_RETRIES: "1",
      AI_MAX_OUTPUT_TOKENS: "128",
      AI_INTERNAL_SMOKE_ENABLED: "false",
      AI_MODEL_PRICING_JSON: "{}"
    };

    expect(getServerConfig(env).ai.openaiApiKey).toBe("secret");
    expect(getServerConfig(env).ai.openaiEmbeddingModel).toBe(
      "text-embedding-3-small"
    );
    expect(getServerConfig(env).ai.internalSmokeEnabled).toBe(false);
    expect(getPublicServerConfig(env)).toEqual({
      nodeEnv: "test",
      webAppUrl: "http://localhost:3000"
    });
  });

  it("parses semantic memory configuration", () => {
    const config = getServerConfig({
      NODE_ENV: "test",
      WEB_APP_URL: "http://localhost:3000",
      AI_PROVIDER: "disabled",
      AI_EMBEDDING_PROVIDER: "openai",
      OPENAI_API_KEY: "secret",
      OPENAI_EMBEDDING_MODEL: "text-embedding-3-small",
      MEMORY_SEMANTIC_SEARCH_ENABLED: "true",
      MEMORY_SEMANTIC_TOP_K: "8",
      MEMORY_SEMANTIC_MIN_SCORE: "0.65"
    });

    expect(config.memory.semanticSearchEnabled).toBe(true);
    expect(config.memory.semanticTopK).toBe(8);
    expect(config.memory.semanticMinScore).toBe(0.65);
  });

  it("fails clearly when semantic memory is enabled without embedding config", () => {
    expect(() =>
      getServerConfig({
        NODE_ENV: "production",
        WEB_APP_URL: "https://example.com",
        MEMORY_SEMANTIC_SEARCH_ENABLED: "true"
      })
    ).toThrow("AI_EMBEDDING_PROVIDER");
  });

  it("fails clearly when OpenAI is enabled without a key", () => {
    expect(() =>
      getServerConfig({
        NODE_ENV: "production",
        WEB_APP_URL: "https://example.com",
        AI_PROVIDER: "openai",
        OPENAI_MODEL: "gpt-5.6"
      })
    ).toThrow("OPENAI_API_KEY");
  });

  it("parses server-side pricing and budget configuration", () => {
    const config = getServerConfig({
      NODE_ENV: "test",
      WEB_APP_URL: "http://localhost:3000",
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "secret",
      OPENAI_MODEL: "test-model",
      GAMEPLAY_ENGINE_MODE: "ai",
      AI_MODEL_PRICING_JSON:
        '{"openai:test-model":{"inputMicrosPerMillionTokens":100,"outputMicrosPerMillionTokens":200}}',
      AI_USER_DAILY_BUDGET_MICROS: "1000",
      AI_USER_MONTHLY_BUDGET_MICROS: "30000",
      AI_SESSION_BUDGET_MICROS: "5000"
    });

    expect(config.ai.modelPricingRegistry["openai:test-model"]).toEqual({
      inputMicrosPerMillionTokens: 100,
      outputMicrosPerMillionTokens: 200
    });
    expect(config.budget).toEqual({
      userDailyBudgetMicros: 1000,
      userMonthlyBudgetMicros: 30000,
      sessionBudgetMicros: 5000
    });
  });

  it("fails closed when AI budget is enabled without model pricing", () => {
    expect(() =>
      getServerConfig({
        NODE_ENV: "production",
        WEB_APP_URL: "https://example.com",
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "secret",
        OPENAI_MODEL: "test-model",
        GAMEPLAY_ENGINE_MODE: "ai",
        AI_USER_DAILY_BUDGET_MICROS: "1000",
        AI_MODEL_PRICING_JSON: "{}"
      })
    ).toThrow("Budget enforcement requires pricing");
  });
});

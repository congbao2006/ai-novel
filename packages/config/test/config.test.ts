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
      OPENAI_API_KEY: "secret",
      OPENAI_MODEL: "gpt-5.6",
      AI_REQUEST_TIMEOUT_MS: "10000",
      AI_MAX_RETRIES: "1",
      AI_MAX_OUTPUT_TOKENS: "128",
      AI_INTERNAL_SMOKE_ENABLED: "false"
    };

    expect(getServerConfig(env).ai.openaiApiKey).toBe("secret");
    expect(getServerConfig(env).ai.internalSmokeEnabled).toBe(false);
    expect(getPublicServerConfig(env)).toEqual({
      nodeEnv: "test",
      webAppUrl: "http://localhost:3000"
    });
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
});

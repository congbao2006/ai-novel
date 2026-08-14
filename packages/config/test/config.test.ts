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
      AI_PROVIDER_API_KEY: "secret"
    };

    expect(getServerConfig(env).ai.providerApiKey).toBe("secret");
    expect(getPublicServerConfig(env)).toEqual({
      nodeEnv: "test",
      webAppUrl: "http://localhost:3000"
    });
  });
});

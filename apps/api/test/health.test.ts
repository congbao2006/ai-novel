import { describe, expect, it } from "vitest";
import { getServerConfig } from "@ai-novel/config";
import { buildApp } from "../src/app.js";

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = await buildApp({
      dependencies: {}
    });
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    expect(response.headers["x-request-id"]).toBeDefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");

    await app.close();
  });

  it("reports readiness without exposing connection details", async () => {
    const fakeDatabase = {
      async execute() {
        return { rows: [{ "?column?": 1 }] };
      }
    };
    const app = await buildApp({
      dependencies: {
        database: fakeDatabase as never
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/ready"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      checks: {
        database: "ok",
        pgvector: "skipped"
      }
    });
    expect(response.body).not.toContain("postgresql://");

    await app.close();
  });

  it("fails readiness safely when the database is unavailable", async () => {
    const app = await buildApp({
      dependencies: {}
    });

    const response = await app.inject({
      method: "GET",
      url: "/ready",
      headers: {
        "x-request-id": "test-ready-fail"
      }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: "error",
      requestId: "test-ready-fail",
      checks: {
        database: "unavailable",
        pgvector: "skipped"
      }
    });

    await app.close();
  });

  it("rejects disallowed mutating origins while allowing configured origins", async () => {
    const config = getServerConfig({
      NODE_ENV: "test",
      WEB_APP_URL: "http://localhost:3000",
      API_ALLOWED_ORIGINS: "http://localhost:3000"
    });
    const app = await buildApp({
      config,
      dependencies: {}
    });

    const rejected = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        origin: "https://evil.example"
      },
      payload: {
        email: "user@example.com",
        password: "password123"
      }
    });
    expect(rejected.statusCode).toBe(403);
    expect(rejected.body).toContain("requestId");

    const allowed = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        origin: "http://localhost:3000"
      },
      payload: {
        email: "user@example.com",
        password: "password123"
      }
    });
    expect(allowed.statusCode).toBe(503);

    await app.close();
  });
});

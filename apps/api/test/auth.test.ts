import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { AuthService } from "../src/modules/auth/service.js";
import { UnauthenticatedError } from "../src/modules/auth/errors.js";

const testUser = {
  userId: "user-1",
  email: "user@example.com",
  displayName: "User One"
};

function createFakeAuthService(): AuthService {
  return {
    async register() {
      return {
        rawToken: "raw-register-token",
        expiresAt: new Date(Date.now() + 1000),
        user: testUser
      };
    },
    async login() {
      return {
        rawToken: "raw-login-token",
        expiresAt: new Date(Date.now() + 1000),
        user: testUser
      };
    },
    async logout() {},
    async getCurrentUser(token: string | undefined) {
      if (token !== "valid-token") {
        throw new UnauthenticatedError();
      }

      return testUser;
    }
  } as unknown as AuthService;
}

describe("auth routes", () => {
  it("registers and sets an httpOnly session cookie", async () => {
    const app = await buildApp({
      dependencies: {
        authService: createFakeAuthService()
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "user@example.com",
        password: "password123",
        displayName: "User One"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ user: testUser });
    expect(response.headers["set-cookie"]).toContain("ai_novel_session=");
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Lax");
    expect(response.headers["set-cookie"]).toContain("Path=/");

    await app.close();
  });

  it("logs in and returns the current user through /auth/me", async () => {
    const app = await buildApp({
      dependencies: {
        authService: createFakeAuthService()
      }
    });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "user@example.com",
        password: "password123"
      }
    });
    const meResponse = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: {
        ai_novel_session: "valid-token"
      }
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toEqual({ user: testUser });

    await app.close();
  });

  it("rejects /auth/me without a valid session", async () => {
    const app = await buildApp({
      dependencies: {
        authService: createFakeAuthService()
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/auth/me"
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it("logs out by clearing the auth cookie", async () => {
    const app = await buildApp({
      dependencies: {
        authService: createFakeAuthService()
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: {
        ai_novel_session: "valid-token"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["set-cookie"]).toContain("ai_novel_session=");
    expect(response.headers["set-cookie"]).toContain("Max-Age=0");

    await app.close();
  });
});

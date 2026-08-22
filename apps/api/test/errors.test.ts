import { describe, expect, it } from "vitest";
import { getServerConfig } from "@ai-novel/config";
import { buildApp } from "../src/app.js";
import { getErrorLogDetails } from "../src/errors.js";
import { UnauthenticatedError } from "../src/modules/auth/errors.js";
import type { AuthService } from "../src/modules/auth/service.js";
import type { StoryAuthoringService } from "../src/modules/authoring/service.js";

const testUser = {
  userId: "user-1",
  email: "user@example.com",
  displayName: "User One"
};

describe("API error handling", () => {
  it("serializes useful server-side error log details", () => {
    const cause = Object.assign(new Error("parser cause"), {
      code: "PARSER_CAUSE"
    });
    const error = Object.assign(new Error("Body cannot be empty."), {
      code: "FST_ERR_CTP_EMPTY_JSON_BODY",
      statusCode: 400,
      cause
    });

    const details = getErrorLogDetails(error, {
      requestId: "req-1",
      method: "POST",
      url: "/author/stories/story-1/publish"
    });

    expect(details).toMatchObject({
      requestId: "req-1",
      method: "POST",
      url: "/author/stories/story-1/publish",
      errorName: "Error",
      errorMessage: "Body cannot be empty.",
      errorCode: "FST_ERR_CTP_EMPTY_JSON_BODY",
      statusCode: 400
    });
    expect(details.stack).toContain("Body cannot be empty.");
    expect(details.cause).toMatchObject({
      name: "Error",
      message: "parser cause",
      code: "PARSER_CAUSE"
    });
  });

  it("maps Fastify empty JSON body errors to safe 400 responses", async () => {
    const app = await buildApp({
      config: getServerConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:password@localhost:5432/app",
        WEB_APP_URL: "https://app.example.com",
        API_ALLOWED_ORIGINS: "https://app.example.com"
      }),
      dependencies: {
        authService: createFakeAuthService(),
        storyAuthoringService: {
          async validateForPublish() {
            return { valid: true, issues: [] };
          }
        } as unknown as StoryAuthoringService
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/author/stories/11111111-1111-4111-8111-111111111111/validate",
      headers: {
        "content-type": "application/json",
        cookie: "ai_novel_session=valid-token",
        "x-request-id": "empty-json-body"
      },
      payload: ""
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "FST_ERR_CTP_EMPTY_JSON_BODY",
      requestId: "empty-json-body"
    });
    expect(response.body).not.toContain("stack");
    expect(response.body).not.toContain("postgresql://");

    await app.close();
  });
});

function createFakeAuthService(): AuthService {
  return {
    async getCurrentUser(token: string | undefined) {
      if (token !== "valid-token") {
        throw new UnauthenticatedError();
      }

      return testUser;
    }
  } as unknown as AuthService;
}

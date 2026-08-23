import { describe, expect, it } from "vitest";
import { getServerConfig } from "@ai-novel/config";
import { AIProviderError } from "@ai-novel/ai-engine";
import { buildApp } from "../src/app.js";
import {
  getErrorLogDetails,
  sendApplicationError,
  ValidationIssuesError
} from "../src/errors.js";
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

  it("serializes nested PostgreSQL driver fields safely", () => {
    const pgCause = Object.assign(new Error("duplicate key value"), {
      code: "23505",
      detail:
        'Key (story_id, faction_key)=(story-1, hac-nguyet-hoi) already exists.',
      constraint: "story_factions_story_key_unique",
      table: "story_factions",
      column: "faction_key",
      schema: "public"
    });
    const drizzleCause = Object.assign(
      new Error(
        'Failed query: insert into "story_factions" ...\nparams: secret-token'
      ),
      { cause: pgCause }
    );
    const error = Object.assign(new Error("Database operation failed."), {
      cause: drizzleCause
    });

    const details = getErrorLogDetails(error, {
      method: "POST",
      url: "/author/stories/story-1/factions"
    });

    expect(details.cause).toMatchObject({
      name: "Error",
      message: 'Failed query: insert into "story_factions" ...\nparams: [redacted]',
      cause: {
        name: "Error",
        message: "duplicate key value",
        code: "23505",
        sqlState: "23505",
        detail:
          'Key (story_id, faction_key)=(story-1, hac-nguyet-hoi) already exists.',
        constraint: "story_factions_story_key_unique",
        table: "story_factions",
        column: "faction_key",
        schema: "public"
      }
    });
  });

  it("serializes AI provider diagnostics without exposing client secrets", () => {
    const error = new AIProviderError(
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

    const details = getErrorLogDetails(error, {
      requestId: "req-1",
      method: "POST",
      url: "/sessions/session-1/turns"
    });

    expect(details).toMatchObject({
      requestId: "req-1",
      method: "POST",
      url: "/sessions/session-1/turns",
      errorName: "AIProviderError",
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
          code: "400",
          status: 400
        }
      }
    });
    expect(JSON.stringify(details)).not.toContain("OPENAI_API_KEY");
    expect(JSON.stringify(details)).not.toContain("sk-test");
  });

  it("keeps production AI provider errors generic for clients", () => {
    let statusCode: number | undefined;
    let payload: unknown;

    sendApplicationError(
      new AIProviderError(
        "OpenAI request failed with status 400: Invalid schema."
      ),
      {
        code(code) {
          statusCode = code;
          return {
            send(body) {
              payload = body;
            }
          };
        }
      },
      "req-1",
      "production"
    );

    expect(statusCode).toBe(502);
    expect(payload).toMatchObject({
      error: "ai_provider_error",
      message: "AI provider request failed.",
      requestId: "req-1"
    });
    expect(JSON.stringify(payload)).not.toContain("Invalid schema");
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

  it("returns structured validation issues without exposing stack traces", async () => {
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
          async publish() {
            throw new ValidationIssuesError("Story is not valid for publishing.", [
              {
                code: "required",
                field: "worldPrompt",
                message: "worldPrompt is required."
              },
              {
                code: "missing_playable_character",
                field: "characters",
                message: "At least one playable character is required."
              }
            ]);
          }
        } as unknown as StoryAuthoringService
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/author/stories/11111111-1111-4111-8111-111111111111/publish",
      headers: {
        cookie: "ai_novel_session=valid-token",
        "x-request-id": "publish-validation"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "validation_error",
      message: "Story is not valid for publishing.",
      requestId: "publish-validation",
      issues: [
        {
          code: "required",
          field: "worldPrompt",
          message: "worldPrompt is required."
        },
        {
          code: "missing_playable_character",
          field: "characters",
          message: "At least one playable character is required."
        }
      ]
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

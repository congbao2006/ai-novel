import { z } from "zod";
import { AIError } from "@ai-novel/ai-engine";
import {
  AuthUnavailableError,
  UnauthenticatedError
} from "./modules/auth/errors.js";

export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export class BadRequestError extends ApplicationError {
  constructor(message = "Invalid request.") {
    super(message, "validation_error", 400);
    this.name = "BadRequestError";
  }
}

export type StructuredValidationIssue = {
  readonly code?: string | undefined;
  readonly field: string;
  readonly message: string;
};

export class ValidationIssuesError extends ApplicationError {
  constructor(
    message = "Request validation failed.",
    readonly issues: readonly StructuredValidationIssue[]
  ) {
    super(message, "validation_error", 400);
    this.name = "ValidationIssuesError";
  }
}

export class ResourceNotFoundError extends ApplicationError {
  constructor(message = "Resource was not found.") {
    super(message, "not_found", 404);
    this.name = "ResourceNotFoundError";
  }
}

export class ConflictApplicationError extends ApplicationError {
  constructor(message = "Conflict.") {
    super(message, "conflict", 409);
    this.name = "ConflictApplicationError";
  }
}

export class AccessDeniedError extends ApplicationError {
  constructor(message = "Access denied.") {
    super(message, "access_denied", 403);
    this.name = "AccessDeniedError";
  }
}

export class ServiceUnavailableError extends ApplicationError {
  constructor(message = "Service is unavailable.") {
    super(message, "service_unavailable", 503);
    this.name = "ServiceUnavailableError";
  }
}

export type ErrorLogDetails = {
  readonly requestId?: string | undefined;
  readonly method?: string | undefined;
  readonly url?: string | undefined;
  readonly errorName: string;
  readonly errorMessage?: string | undefined;
  readonly errorCode?: string | undefined;
  readonly statusCode?: number | undefined;
  readonly stack?: string | undefined;
  readonly cause?: SerializedErrorCause | undefined;
};

type SerializedErrorCause = {
  readonly name?: string | undefined;
  readonly message?: string | undefined;
  readonly code?: string | undefined;
  readonly sqlState?: string | undefined;
  readonly detail?: string | undefined;
  readonly constraint?: string | undefined;
  readonly table?: string | undefined;
  readonly column?: string | undefined;
  readonly schema?: string | undefined;
  readonly stack?: string | undefined;
  readonly cause?: SerializedErrorCause | undefined;
  readonly value?: string | undefined;
};

export function sendApplicationError(error: unknown, reply: {
  code(statusCode: number): { send(payload: unknown): unknown };
}, requestId?: string, nodeEnv: "development" | "test" | "production" = "development"): unknown {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({
      error: "validation_error",
      message: z.prettifyError(error),
      ...(requestId ? { requestId } : {})
    });
  }

  if (error instanceof ApplicationError) {
    return reply.code(error.statusCode).send({
      error: error.code,
      message: error.message,
      ...(error instanceof ValidationIssuesError ? { issues: error.issues } : {}),
      ...(requestId ? { requestId } : {})
    });
  }

  if (error instanceof AIError) {
    const statusCode =
      error.code === "ai_authentication_error"
        ? 401
        : error.code === "ai_rate_limit_error"
          ? 429
          : error.code === "ai_budget_exceeded"
            ? 429
            : error.code === "ai_timeout_error"
              ? 504
              : error.code === "ai_configuration_error"
                ? 503
                : 502;

    return reply.code(statusCode).send({
      error: error.code,
      message: error.message,
      ...(requestId ? { requestId } : {})
    });
  }

  if (error instanceof UnauthenticatedError) {
    return reply
      .code(401)
      .send({
        error: "unauthenticated",
        message: error.message,
        ...(requestId ? { requestId } : {})
      });
  }

  if (error instanceof AuthUnavailableError) {
    return reply
      .code(503)
      .send({
        error: "auth_unavailable",
        message: error.message,
        ...(requestId ? { requestId } : {})
      });
  }

  const fastifyStatusCode = getFastifyStatusCode(error);
  if (fastifyStatusCode && fastifyStatusCode >= 400 && fastifyStatusCode < 500) {
    return reply.code(fastifyStatusCode).send({
      error: getErrorCode(error) ?? "bad_request",
      message: getErrorMessage(error) ?? "Invalid request.",
      ...(requestId ? { requestId } : {})
    });
  }

  return reply.code(500).send({
    error: "internal_error",
    message:
      nodeEnv === "production"
        ? "Unexpected server error."
        : error instanceof Error
          ? error.message
          : "Unexpected server error.",
    ...(requestId ? { requestId } : {})
  });
}

export function getErrorLogDetails(
  error: unknown,
  context: {
    readonly requestId?: string | undefined;
    readonly method?: string | undefined;
    readonly url?: string | undefined;
  } = {}
): ErrorLogDetails {
  return {
    ...context,
    errorName: getErrorName(error),
    ...(getErrorMessage(error) ? { errorMessage: getErrorMessage(error) } : {}),
    ...(getErrorCode(error) ? { errorCode: getErrorCode(error) } : {}),
    ...(getFastifyStatusCode(error)
      ? { statusCode: getFastifyStatusCode(error) }
      : {}),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    ...(error instanceof Error && error.cause
      ? { cause: serializeCause(error.cause) }
      : {})
  };
}

export function isExpectedRequestError(error: unknown): boolean {
  if (
    error instanceof z.ZodError ||
    error instanceof ApplicationError ||
    error instanceof AIError ||
    error instanceof UnauthenticatedError ||
    error instanceof AuthUnavailableError
  ) {
    return true;
  }

  const statusCode = getFastifyStatusCode(error);
  return statusCode !== undefined && statusCode >= 400 && statusCode < 500;
}

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return sanitizeLogString(error.message);
  }

  return typeof error === "string" ? sanitizeLogString(error) : undefined;
}

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { readonly code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

function getErrorField(error: unknown, field: string): string | undefined {
  if (error && typeof error === "object" && field in error) {
    const value = (error as Record<string, unknown>)[field];
    return typeof value === "string" ? sanitizeLogString(value) : undefined;
  }

  return undefined;
}

function getFastifyStatusCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = (error as { readonly statusCode?: unknown }).statusCode;
    return typeof statusCode === "number" ? statusCode : undefined;
  }

  return undefined;
}

function serializeCause(cause: unknown): SerializedErrorCause {
  if (cause instanceof Error) {
    const code = getErrorCode(cause);
    return {
      name: cause.name,
      message: sanitizeLogString(cause.message),
      ...(code ? { code } : {}),
      ...(code && isSqlState(code) ? { sqlState: code } : {}),
      ...(getErrorField(cause, "detail")
        ? { detail: getErrorField(cause, "detail") }
        : {}),
      ...(getErrorField(cause, "constraint")
        ? { constraint: getErrorField(cause, "constraint") }
        : {}),
      ...(getErrorField(cause, "table")
        ? { table: getErrorField(cause, "table") }
        : {}),
      ...(getErrorField(cause, "column")
        ? { column: getErrorField(cause, "column") }
        : {}),
      ...(getErrorField(cause, "schema")
        ? { schema: getErrorField(cause, "schema") }
        : {}),
      ...(cause.stack ? { stack: sanitizeLogString(cause.stack) } : {}),
      ...(cause.cause ? { cause: serializeCause(cause.cause) } : {})
    };
  }

  if (typeof cause === "string") {
    return { value: sanitizeLogString(cause) };
  }

  if (cause && typeof cause === "object") {
    return {
      ...(getErrorCode(cause) ? { code: getErrorCode(cause) } : {}),
      value: "[object]"
    };
  }

  return { value: sanitizeLogString(String(cause)) };
}

function isSqlState(code: string): boolean {
  return /^[0-9A-Z]{5}$/.test(code);
}

function sanitizeLogString(value: string): string {
  return value
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-database-url]")
    .replace(/(password=)[^\s"'&]+/gi, "$1[redacted]")
    .replace(/(api[_-]?key=)[^\s"'&]+/gi, "$1[redacted]")
    .replace(/(authorization:\s*bearer\s+)[^\s"']+/gi, "$1[redacted]")
    .replace(/\nparams: [^\n]*/gi, "\nparams: [redacted]");
}

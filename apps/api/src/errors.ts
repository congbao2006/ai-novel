import { z } from "zod";
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

export class ResourceNotFoundError extends ApplicationError {
  constructor(message = "Resource was not found.") {
    super(message, "not_found", 404);
    this.name = "ResourceNotFoundError";
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

export function sendApplicationError(error: unknown, reply: {
  code(statusCode: number): { send(payload: unknown): unknown };
}): unknown {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({
      error: "validation_error",
      message: z.prettifyError(error)
    });
  }

  if (error instanceof ApplicationError) {
    return reply.code(error.statusCode).send({
      error: error.code,
      message: error.message
    });
  }

  if (error instanceof UnauthenticatedError) {
    return reply
      .code(401)
      .send({ error: "unauthenticated", message: error.message });
  }

  if (error instanceof AuthUnavailableError) {
    return reply
      .code(503)
      .send({ error: "auth_unavailable", message: error.message });
  }

  throw error;
}

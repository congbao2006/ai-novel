import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  AuthConflictError,
  AuthUnavailableError,
  AuthValidationError,
  InvalidCredentialsError,
  UnauthenticatedError
} from "./errors.js";
import { clearAuthCookie, getAuthCookie, setAuthCookie } from "./cookies.js";
import { getRequiredUser, requireUser } from "./request-context.js";

const registerSchema = z.object({
  email: z.string(),
  password: z.string(),
  displayName: z.string()
});

const loginSchema = z.object({
  email: z.string(),
  password: z.string()
});

export const registerAuthRoutes: FastifyPluginAsync = async (app) => {
  const config = app.appConfig;
  const cookieOptions = {
    cookieName: config.auth.cookieName,
    secure: config.nodeEnv === "production",
    maxAgeSeconds: config.auth.sessionTtlSeconds
  };

  app.post("/register", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const authService = app.dependencies.authService;

    if (!authService) {
      throw new AuthUnavailableError();
    }

    const input = registerSchema.parse(request.body);
    const session = await authService.register(input);

    setAuthCookie(reply, session.rawToken, cookieOptions);

    return reply.code(201).send({
      user: session.user
    });
  });

  app.post("/login", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const authService = app.dependencies.authService;

    if (!authService) {
      throw new AuthUnavailableError();
    }

    const input = loginSchema.parse(request.body);
    const session = await authService.login(input);

    setAuthCookie(reply, session.rawToken, cookieOptions);

    return {
      user: session.user
    };
  });

  app.post("/logout", { preHandler: requireUser }, async (request, reply) => {
    const authService = app.dependencies.authService;

    if (!authService) {
      throw new AuthUnavailableError();
    }

    await authService.logout(getAuthCookie(request, config.auth.cookieName));
    clearAuthCookie(reply, cookieOptions);

    return reply.code(204).send();
  });

  app.get("/me", { preHandler: requireUser }, async (request) => ({
    user: getRequiredUser(request)
  }));

  app.setErrorHandler((error, request, reply) => {
    request.log.warn(
      { errorName: error instanceof Error ? error.name : "unknown" },
      "auth route error"
    );

    if (error instanceof z.ZodError || error instanceof AuthValidationError) {
      return reply.code(400).send({
        error: "validation_error",
        message: error.message,
        requestId: request.id
      });
    }

    if (error instanceof AuthConflictError) {
      return reply.code(409).send({
        error: "conflict",
        message: error.message,
        requestId: request.id
      });
    }

    if (
      error instanceof InvalidCredentialsError ||
      error instanceof UnauthenticatedError
    ) {
      return reply
        .code(401)
        .send({
          error: "unauthenticated",
          message: error.message,
          requestId: request.id
        });
    }

    if (error instanceof AuthUnavailableError) {
      return reply
        .code(503)
        .send({
          error: "auth_unavailable",
          message: error.message,
          requestId: request.id
        });
    }

    throw error;
  });
};

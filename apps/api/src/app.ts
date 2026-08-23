import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest
} from "fastify";
import { getServerConfig, type ServerConfig } from "@ai-novel/config";
import { createAppDependencies, type AppDependencies } from "./dependencies.js";
import {
  AccessDeniedError,
  getErrorLogDetails,
  isExpectedRequestError,
  sendApplicationError
} from "./errors.js";
import { registerAiRoutes } from "./modules/ai/routes.js";
import { registerAuthoringRoutes } from "./modules/authoring/routes.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerGameplayRoutes } from "./modules/gameplay/routes.js";
import { registerHealthRoutes } from "./modules/health/routes.js";
import { registerInternalAiRoutes } from "./modules/internal-ai/routes.js";
import { registerSessionsRoutes } from "./modules/sessions/routes.js";
import { registerStoriesRoutes } from "./modules/stories/routes.js";
import { registerUsersRoutes } from "./modules/users/routes.js";

declare module "fastify" {
  interface FastifyInstance {
    dependencies: AppDependencies;
    appConfig: ServerConfig;
  }

  interface FastifyRequest {
    startedAtMs?: number;
  }
}

export type BuildAppOptions = {
  readonly dependencies?: AppDependencies;
  readonly config?: ServerConfig;
};

const corsAllowedMethods = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"];

export async function buildApp(
  options: BuildAppOptions = {}
): Promise<FastifyInstance> {
  const config = options.config ?? getServerConfig();
  const allowedOrigins = new Set(config.api.allowedOrigins);
  const app = Fastify({
    bodyLimit: config.api.bodyLimitBytes,
    genReqId(request) {
      const incoming = request.headers["x-request-id"];

      if (typeof incoming === "string" && isSafeRequestId(incoming)) {
        return incoming;
      }

      return randomUUID();
    },
    logger: {
      level: config.api.logLevel,
      redact: [
        "req.headers.cookie",
        "req.headers.authorization",
        "req.headers['x-api-key']",
        "res.headers['set-cookie']",
        "password",
        "*.password",
        "*.passwordHash",
        "*.openaiApiKey",
        "*.apiKey",
        "*.worldPrompt",
        "*.openingPrompt"
      ]
    },
    requestIdHeader: "x-request-id"
  });

  const dependencies = createAppDependencies(options.dependencies);

  app.decorate("dependencies", dependencies);
  app.decorate("appConfig", config);

  app.addHook("onRequest", async (request, reply) => {
    request.startedAtMs = Date.now();
    reply.header("x-request-id", request.id);
    setSecurityHeaders(reply, config);
    validateRequestOrigin(request, allowedOrigins);
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAtMs = request.startedAtMs ?? Date.now();
    const latencyMs = Date.now() - startedAtMs;
    const thresholdMs = request.url.includes("/turns")
      ? config.api.slowAiRequestThresholdMs
      : config.api.slowRequestThresholdMs;

    if (latencyMs > thresholdMs) {
      request.log.warn(
        {
          requestId: request.id,
          method: request.method,
          route: request.routeOptions.url,
          statusCode: reply.statusCode,
          latencyMs
        },
        "slow request"
      );
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const logDetails = getErrorLogDetails(error, {
      requestId: request.id,
      method: request.method,
      url: request.url
    });

    if (isExpectedRequestError(error)) {
      request.log.warn(logDetails, "request error");
    } else {
      request.log.error(logDetails, "unexpected request error");
    }

    return sendApplicationError(error, reply, request.id, config.nodeEnv);
  });

  await app.register(cookie);
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute"
  });

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new AccessDeniedError("Origin is not allowed."), false);
    },
    credentials: true,
    methods: corsAllowedMethods
  });

  await app.register(registerHealthRoutes);
  await app.register(registerInternalAiRoutes, { prefix: "/internal/ai" });
  await app.register(registerAuthRoutes, { prefix: "/auth" });
  await app.register(registerAuthoringRoutes, { prefix: "/author" });
  await app.register(registerStoriesRoutes, { prefix: "/stories" });
  await app.register(registerSessionsRoutes, { prefix: "/sessions" });
  await app.register(registerGameplayRoutes, { prefix: "/gameplay" });
  await app.register(registerAiRoutes, { prefix: "/ai" });
  await app.register(registerUsersRoutes, { prefix: "/users" });

  return app;
}

function isSafeRequestId(value: string): boolean {
  return /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

function validateRequestOrigin(
  request: FastifyRequest,
  allowedOrigins: ReadonlySet<string>
): void {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    return;
  }

  const origin = request.headers.origin;

  if (origin === undefined) {
    return;
  }

  if (typeof origin !== "string" || !allowedOrigins.has(origin)) {
    throw new AccessDeniedError("Request origin is not allowed.");
  }
}

function setSecurityHeaders(reply: FastifyReply, config: ServerConfig): void {
  reply.header("x-content-type-options", "nosniff");
  reply.header("referrer-policy", "no-referrer");
  reply.header("x-frame-options", "DENY");
  reply.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'");

  if (config.nodeEnv === "production") {
    reply.header(
      "strict-transport-security",
      "max-age=15552000; includeSubDomains"
    );
  }
}

import type { FastifyRequest } from "fastify";
import {
  elapsedMs,
  getPoolSnapshot,
  measureDatabaseAcquire,
  nowMs,
  type DatabaseAcquireTiming
} from "../../performance.js";
import { AuthUnavailableError, UnauthenticatedError } from "./errors.js";
import { getAuthCookie } from "./cookies.js";
import type { CurrentUser } from "./dto.js";
import type { AuthLookupTimings } from "./service.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: CurrentUser;
    authPerf?: AuthRequestPerformance;
  }
}

export type AuthRequestPerformance = AuthLookupTimings & {
  readonly tokenParseMs: number;
  readonly authTotalMs: number;
  readonly dbAcquireProbe?: DatabaseAcquireTiming;
};

export async function requireUser(
  request: FastifyRequest
): Promise<void> {
  if (request.currentUser) {
    return;
  }

  const authService = request.server.dependencies.authService;

  if (!authService) {
    throw new AuthUnavailableError();
  }

  const config = request.server.appConfig;
  const tokenParseStartedAt = nowMs();
  const token = getAuthCookie(request, config.auth.cookieName);
  const tokenParseMs = elapsedMs(tokenParseStartedAt);
  const shouldProfile = shouldProfileAuthRoute(request);
  const dbAcquireProbe = shouldProfile && token
    ? await measureDatabaseAcquire(request.server.dependencies.databasePool)
    : undefined;
  const timings: AuthLookupTimings = {};
  const startedAt = nowMs();
  const user = await authService.getCurrentUser(token, timings);
  const latencyMs = elapsedMs(startedAt);
  request.authPerf = {
    ...timings,
    tokenParseMs,
    authTotalMs: latencyMs,
    ...(dbAcquireProbe ? { dbAcquireProbe } : {})
  };

  if (latencyMs > 250) {
    request.log.warn(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        authLookupMs: latencyMs,
        tokenParseMs,
        tokenHashMs: timings.tokenHashMs,
        userSessionQueryMs: timings.userSessionQueryMs,
        touchLastUsedAtMs: timings.touchLastUsedAtMs,
        touchedSession: timings.touchedSession,
        ...(dbAcquireProbe
          ? dbAcquireProbe
          : getPoolSnapshot(request.server.dependencies.databasePool))
      },
      "auth lookup timing"
    );
  }

  request.currentUser = user;
}

export function getRequiredUser(request: FastifyRequest): CurrentUser {
  if (!request.currentUser) {
    throw new UnauthenticatedError();
  }

  return request.currentUser;
}

function shouldProfileAuthRoute(request: FastifyRequest): boolean {
  return (
    request.method === "GET" &&
    (request.url === "/auth/me" || request.url === "/sessions")
  );
}

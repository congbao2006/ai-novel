import type { FastifyRequest } from "fastify";
import { AuthUnavailableError, UnauthenticatedError } from "./errors.js";
import { getAuthCookie } from "./cookies.js";
import type { CurrentUser } from "./dto.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: CurrentUser;
  }
}

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
  const token = getAuthCookie(request, config.auth.cookieName);
  const startedAt = Date.now();
  const user = await authService.getCurrentUser(token);
  const latencyMs = Date.now() - startedAt;

  if (latencyMs > 250) {
    request.log.warn(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        authLookupMs: latencyMs
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

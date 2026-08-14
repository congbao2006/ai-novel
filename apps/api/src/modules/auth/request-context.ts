import type { FastifyRequest } from "fastify";
import { getServerConfig } from "@ai-novel/config";
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

  const config = getServerConfig();
  const token = getAuthCookie(request, config.auth.cookieName);
  const user = await authService.getCurrentUser(token);

  request.currentUser = user;
}

export function getRequiredUser(request: FastifyRequest): CurrentUser {
  if (!request.currentUser) {
    throw new UnauthenticatedError();
  }

  return request.currentUser;
}

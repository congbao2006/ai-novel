import type { FastifyReply, FastifyRequest } from "fastify";

export type AuthCookieOptions = {
  readonly cookieName: string;
  readonly secure: boolean;
  readonly sameSite: "lax" | "strict" | "none";
  readonly maxAgeSeconds: number;
};

export function getAuthCookie(
  request: FastifyRequest,
  cookieName: string
): string | undefined {
  return request.cookies[cookieName];
}

export function setAuthCookie(
  reply: FastifyReply,
  token: string,
  options: AuthCookieOptions
): void {
  reply.setCookie(options.cookieName, token, {
    httpOnly: true,
    sameSite: options.sameSite,
    secure: options.secure,
    path: "/",
    maxAge: options.maxAgeSeconds
  });
}

export function clearAuthCookie(
  reply: FastifyReply,
  options: Pick<AuthCookieOptions, "cookieName" | "secure" | "sameSite">
): void {
  reply.clearCookie(options.cookieName, {
    httpOnly: true,
    sameSite: options.sameSite,
    secure: options.secure,
    path: "/"
  });
}

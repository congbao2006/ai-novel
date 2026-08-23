import type { Repositories } from "@ai-novel/db";
import { ConflictError } from "@ai-novel/db";
import { elapsedMs, nowMs } from "../../performance.js";
import {
  AuthConflictError,
  AuthValidationError,
  InvalidCredentialsError,
  UnauthenticatedError
} from "./errors.js";
import type {
  AuthenticatedSession,
  CurrentUser,
  LoginInput,
  RegisterInput
} from "./dto.js";
import type { PasswordHasher } from "./password.js";
import { createSessionToken, hashSessionToken } from "./tokens.js";

const minPasswordLength = 8;
const sessionTouchThrottleMs = 5 * 60 * 1000;

export type AuthServiceOptions = {
  readonly repositories: Repositories;
  readonly passwordHasher: PasswordHasher;
  readonly sessionTtlSeconds: number;
};

export type AuthLookupTimings = {
  tokenHashMs?: number;
  userSessionQueryMs?: number;
  touchLastUsedAtMs?: number;
  touchedSession?: boolean;
};

export class AuthService {
  constructor(private readonly options: AuthServiceOptions) {}

  async register(input: RegisterInput): Promise<AuthenticatedSession> {
    const normalized = this.validateRegisterInput(input);
    const existing = await this.options.repositories.users.getByEmail(
      normalized.email
    );

    if (existing) {
      throw new AuthConflictError();
    }

    const passwordHash = await this.options.passwordHasher.hashPassword(
      normalized.password
    );

    try {
      const user = await this.options.repositories.users.create({
        email: normalized.email,
        displayName: normalized.displayName,
        passwordHash
      });

      return this.createSessionForUser(user);
    } catch (error) {
      if (error instanceof ConflictError) {
        throw new AuthConflictError();
      }

      throw error;
    }
  }

  async login(input: LoginInput): Promise<AuthenticatedSession> {
    const email = normalizeEmail(input.email);
    const user = await this.options.repositories.users.getByEmailForAuth(email);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordValid = await this.options.passwordHasher.verifyPassword(
      user.passwordHash,
      input.password
    );

    if (!passwordValid) {
      throw new InvalidCredentialsError();
    }

    return this.createSessionForUser({
      id: user.id,
      email: user.email,
      displayName: user.displayName
    });
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }

    await this.options.repositories.authSessions.revokeByTokenHash(
      hashSessionToken(rawToken)
    );
  }

  async getCurrentUser(
    rawToken: string | undefined,
    timings?: AuthLookupTimings
  ): Promise<CurrentUser> {
    if (!rawToken) {
      throw new UnauthenticatedError();
    }

    const now = new Date();
    const hashStartedAt = nowMs();
    const tokenHash = hashSessionToken(rawToken);
    if (timings) {
      timings.tokenHashMs = elapsedMs(hashStartedAt);
    }

    const queryStartedAt = nowMs();
    const authenticatedSession =
      await this.options.repositories.authSessions.getValidUserSessionByTokenHash(
        tokenHash,
        now
      );
    if (timings) {
      timings.userSessionQueryMs = elapsedMs(queryStartedAt);
    }

    if (!authenticatedSession) {
      throw new UnauthenticatedError();
    }

    if (
      now.getTime() - authenticatedSession.session.lastUsedAt.getTime() >
      sessionTouchThrottleMs
    ) {
      const touchStartedAt = nowMs();
      await this.options.repositories.authSessions.touchLastUsedAt(
        authenticatedSession.session.id,
        now
      );
      if (timings) {
        timings.touchLastUsedAtMs = elapsedMs(touchStartedAt);
        timings.touchedSession = true;
      }
    } else if (timings) {
      timings.touchedSession = false;
    }

    return {
      userId: authenticatedSession.user.id,
      email: authenticatedSession.user.email,
      displayName: authenticatedSession.user.displayName
    };
  }

  private async createSessionForUser(user: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
  }): Promise<AuthenticatedSession> {
    const rawToken = createSessionToken();
    const expiresAt = new Date(
      Date.now() + this.options.sessionTtlSeconds * 1000
    );

    await this.options.repositories.authSessions.create({
      userId: user.id,
      tokenHash: hashSessionToken(rawToken),
      expiresAt
    });

    return {
      rawToken,
      expiresAt,
      user: {
        userId: user.id,
        email: user.email,
        displayName: user.displayName
      }
    };
  }

  private validateRegisterInput(input: RegisterInput): RegisterInput {
    const email = normalizeEmail(input.email);
    const displayName = input.displayName.trim();

    if (!email || !email.includes("@")) {
      throw new AuthValidationError("A valid email is required.");
    }

    if (displayName.length < 2 || displayName.length > 80) {
      throw new AuthValidationError("Display name must be 2-80 characters.");
    }

    if (input.password.length < minPasswordLength) {
      throw new AuthValidationError(
        `Password must be at least ${minPasswordLength} characters.`
      );
    }

    return {
      email,
      password: input.password,
      displayName
    };
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

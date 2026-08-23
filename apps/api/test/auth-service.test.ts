import { describe, expect, it } from "vitest";
import type {
  CreateAuthSessionInput,
  CreateUserInput,
  Repositories,
  UserRecord
} from "@ai-novel/db";
import { Argon2PasswordHasher } from "../src/modules/auth/password.js";
import { AuthService } from "../src/modules/auth/service.js";
import {
  AuthConflictError,
  AuthValidationError,
  InvalidCredentialsError,
  UnauthenticatedError
} from "../src/modules/auth/errors.js";

const passwordHasher = new Argon2PasswordHasher();

function toSafeUser(user: UserRecord & { passwordHash: string }): UserRecord {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function createRepositoriesFixture(existingPasswordHash?: string): Repositories {
  const users = new Map<string, UserRecord & { passwordHash: string }>();
  let touchCount = 0;
  const sessions = new Map<
    string,
    {
      id: string;
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      revokedAt: Date | null;
      createdAt: Date;
      lastUsedAt: Date;
    }
  >();

  if (existingPasswordHash) {
    users.set("user@example.com", {
      id: "user-1",
      email: "user@example.com",
      displayName: "User One",
      passwordHash: existingPasswordHash,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  return {
    users: {
      async getById(id: string) {
        return [...users.values()].find((user) => user.id === id) ?? null;
      },
      async getByEmail(email: string) {
        const user = users.get(email);
        if (!user) {
          return null;
        }
        return toSafeUser(user);
      },
      async getByEmailForAuth(email: string) {
        return users.get(email) ?? null;
      },
      async create(input: CreateUserInput) {
        if (users.has(input.email)) {
          throw new Error("duplicate");
        }

        const user = {
          id: "user-1",
          email: input.email,
          displayName: input.displayName,
          passwordHash: input.passwordHash,
          emailVerifiedAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        users.set(input.email, user);
        return toSafeUser(user);
      }
    },
    authSessions: {
      async create(input: CreateAuthSessionInput) {
        const session = {
          id: "session-1",
          userId: input.userId,
          tokenHash: input.tokenHash,
          createdAt: new Date(),
          expiresAt: input.expiresAt,
          lastUsedAt: new Date(),
          revokedAt: null
        };
        sessions.set(input.tokenHash, session);
        return session;
      },
      async getValidSessionByTokenHash(tokenHash: string, now = new Date()) {
        const session = sessions.get(tokenHash);
        if (!session || session.revokedAt || session.expiresAt <= now) {
          return null;
        }
        return session;
      },
      async getValidUserSessionByTokenHash(tokenHash: string, now = new Date()) {
        const session = sessions.get(tokenHash);
        if (!session || session.revokedAt || session.expiresAt <= now) {
          return null;
        }
        const user = [...users.values()].find((item) => item.id === session.userId);
        return user
          ? {
              session,
              user: toSafeUser(user)
            }
          : null;
      },
      async revokeByTokenHash(tokenHash: string, now = new Date()) {
        const session = sessions.get(tokenHash);
        if (session) {
          session.revokedAt = now;
        }
      },
      async revokeAllForUser() {},
      async touchLastUsedAt() {
        touchCount += 1;
      }
    },
    testHooks: {
      getTouchCount() {
        return touchCount;
      }
    }
  } as unknown as Repositories;
}

describe("AuthService", () => {
  it("hashes and verifies passwords with Argon2id", async () => {
    const hash = await passwordHasher.hashPassword("password123");

    expect(hash).toContain("$argon2id$");
    await expect(
      passwordHasher.verifyPassword(hash, "password123")
    ).resolves.toBe(true);
    await expect(passwordHasher.verifyPassword(hash, "wrong")).resolves.toBe(false);
  });

  it("validates registration input", async () => {
    const service = new AuthService({
      repositories: createRepositoriesFixture(),
      passwordHasher,
      sessionTtlSeconds: 60
    });

    await expect(
      service.register({
        email: "bad-email",
        password: "short",
        displayName: "U"
      })
    ).rejects.toBeInstanceOf(AuthValidationError);
  });

  it("registers with normalized email and creates a session", async () => {
    const service = new AuthService({
      repositories: createRepositoriesFixture(),
      passwordHasher,
      sessionTtlSeconds: 60
    });

    const result = await service.register({
      email: " USER@Example.COM ",
      password: "password123",
      displayName: " User One "
    });

    expect(result.rawToken).toBeTruthy();
    expect(result.user).toEqual({
      userId: "user-1",
      email: "user@example.com",
      displayName: "User One"
    });
  });

  it("maps duplicate registration to AuthConflictError", async () => {
    const existingHash = await passwordHasher.hashPassword("password123");
    const service = new AuthService({
      repositories: createRepositoriesFixture(existingHash),
      passwordHasher,
      sessionTtlSeconds: 60
    });

    await expect(
      service.register({
        email: "user@example.com",
        password: "password123",
        displayName: "User One"
      })
    ).rejects.toBeInstanceOf(AuthConflictError);
  });

  it("logs in with valid credentials and rejects invalid credentials", async () => {
    const existingHash = await passwordHasher.hashPassword("password123");
    const service = new AuthService({
      repositories: createRepositoriesFixture(existingHash),
      passwordHasher,
      sessionTtlSeconds: 60
    });

    await expect(
      service.login({
        email: "USER@example.com",
        password: "password123"
      })
    ).resolves.toMatchObject({
      user: {
        userId: "user-1",
        email: "user@example.com"
      }
    });

    await expect(
      service.login({
        email: "user@example.com",
        password: "wrong-password"
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("rejects expired or revoked sessions", async () => {
    const existingHash = await passwordHasher.hashPassword("password123");
    const service = new AuthService({
      repositories: createRepositoriesFixture(existingHash),
      passwordHasher,
      sessionTtlSeconds: -1
    });

    const session = await service.login({
      email: "user@example.com",
      password: "password123"
    });

    await expect(service.getCurrentUser(session.rawToken)).rejects.toBeInstanceOf(
      UnauthenticatedError
    );
  });

  it("does not touch recently used sessions on every authenticated request", async () => {
    const existingHash = await passwordHasher.hashPassword("password123");
    const repositories = createRepositoriesFixture(existingHash);
    const service = new AuthService({
      repositories,
      passwordHasher,
      sessionTtlSeconds: 60
    });

    const session = await service.login({
      email: "user@example.com",
      password: "password123"
    });

    await expect(service.getCurrentUser(session.rawToken)).resolves.toMatchObject({
      userId: "user-1"
    });
    expect(
      (repositories as unknown as { testHooks: { getTouchCount(): number } })
        .testHooks.getTouchCount()
    ).toBe(0);
  });

  it("records safe auth lookup timing details", async () => {
    const existingHash = await passwordHasher.hashPassword("password123");
    const service = new AuthService({
      repositories: createRepositoriesFixture(existingHash),
      passwordHasher,
      sessionTtlSeconds: 60
    });

    const session = await service.login({
      email: "user@example.com",
      password: "password123"
    });
    const timings = {};

    await expect(service.getCurrentUser(session.rawToken, timings)).resolves.toMatchObject({
      userId: "user-1"
    });
    expect(timings).toMatchObject({
      touchedSession: false
    });
    expect(timings).toHaveProperty("tokenHashMs");
    expect(timings).toHaveProperty("userSessionQueryMs");
  });
});

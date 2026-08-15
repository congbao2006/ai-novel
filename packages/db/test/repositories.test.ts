import { describe, expect, it } from "vitest";
import {
  ConflictError,
  DrizzleAIUsageRepository,
  DrizzleGameStateRepository,
  DrizzleInventoryRepository,
  StateVersionConflictError,
  ValidationError,
  assertEntityRefShape,
  createRepositories,
  withTransaction,
  type DbExecutor,
  type DatabaseClient
} from "../src/index.js";

function createEmptyUpdateDb(): DbExecutor {
  return {
    update() {
      return {
        set() {
          return {
            where() {
              return {
                returning: async () => []
              };
            }
          };
        }
      };
    }
  } as unknown as DbExecutor;
}

describe("repository layer", () => {
  it("exports aggregate repositories from the factory", () => {
    const repositories = createRepositories({} as DbExecutor);

    expect(Object.keys(repositories).sort()).toEqual([
      "aiUsage",
      "authSessions",
      "gameMessages",
      "gameSessions",
      "gameStates",
      "inventory",
      "npcs",
      "quests",
      "relationships",
      "stories",
      "users",
      "worldEvents"
    ]);
  });

  it("throws StateVersionConflictError when optimistic update affects no rows", async () => {
    const repository = new DrizzleGameStateRepository(createEmptyUpdateDb());

    await expect(
      repository.updateStateWithVersion({
        sessionId: "session-1",
        expectedVersion: 7,
        location: "Bến sông"
      })
    ).rejects.toBeInstanceOf(StateVersionConflictError);
  });

  it("validates relationship entity reference shape", () => {
    expect(() => assertEntityRefShape({ type: "player" })).not.toThrow();
    expect(() => assertEntityRefShape({ type: "npc", id: "npc-1" })).not.toThrow();
    expect(() =>
      assertEntityRefShape({ type: "player", id: "not-allowed" })
    ).toThrow(ValidationError);
    expect(() => assertEntityRefShape({ type: "npc" })).toThrow(ValidationError);
  });

  it("validates inventory quantity before querying", async () => {
    const repository = new DrizzleInventoryRepository({} as DbExecutor);

    await expect(
      repository.addOrUpdateQuantity({
        sessionId: "session-1",
        ownerType: "player",
        itemKey: "torch",
        name: "Torch",
        quantity: 0,
        metadata: {}
      })
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      repository.changeQuantity({
        sessionId: "session-1",
        owner: { type: "player" },
        itemKey: "torch",
        delta: 0
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("uses a shared transaction context instead of opening repository transactions", async () => {
    const transactionClient = {} as DbExecutor;
    const db = {
      transaction: async (
        work: (tx: DbExecutor) => Promise<string>
      ): Promise<string> => work(transactionClient)
    } as unknown as DatabaseClient;

    const result = await withTransaction(db, async (context) => {
      expect(context.db).toBe(transactionClient);
      expect(context.repositories.users).toBeDefined();
      return "ok";
    });

    expect(result).toBe("ok");
  });

  it("exposes structured conflict errors", () => {
    expect(new ConflictError("conflict")).toBeInstanceOf(Error);
    expect(new StateVersionConflictError("session-1", 1).expectedVersion).toBe(1);
  });

  it("records AI usage success and failure through the repository contract", async () => {
    const inserted: unknown[] = [];
    const repository = new DrizzleAIUsageRepository({
      insert() {
        return {
          values(input: unknown) {
            inserted.push(input);
            return {
              returning: async () => [
                {
                  id: "usage-1",
                  ...(input as object)
                }
              ]
            };
          }
        };
      }
    } as unknown as DbExecutor);

    await expect(
      repository.recordSuccess({
        userId: "user-1",
        sessionId: "session-1",
        provider: "openai",
        model: "test-model",
        purpose: "gameplay_turn",
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        estimatedCostMicros: 40,
        latencyMs: 50,
        providerRequestId: "request-1",
        createdAt: new Date("2026-01-01T00:00:00Z")
      })
    ).resolves.toMatchObject({ status: "success", errorCode: null });

    await expect(
      repository.recordFailure({
        userId: "user-1",
        sessionId: "session-1",
        provider: "openai",
        model: "test-model",
        purpose: "gameplay_turn",
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        estimatedCostMicros: null,
        latencyMs: 50,
        providerRequestId: null,
        errorCode: "ai_timeout_error",
        createdAt: new Date("2026-01-01T00:00:00Z")
      })
    ).resolves.toMatchObject({
      status: "failed",
      errorCode: "ai_timeout_error"
    });

    expect(inserted).toHaveLength(2);
    expect(JSON.stringify(inserted)).not.toContain("OPENAI_API_KEY");
    expect(JSON.stringify(inserted)).not.toContain("user@example.com");
  });

  it("aggregates AI usage cost in the database query layer", async () => {
    const repository = new DrizzleAIUsageRepository({
      select() {
        return {
          from() {
            return {
              where: async () => [{ total: 1234 }]
            };
          }
        };
      }
    } as unknown as DbExecutor);

    await expect(
      repository.getUserCostSince(
        "user-1",
        new Date("2026-01-01T00:00:00Z")
      )
    ).resolves.toBe(1234);
    await expect(
      repository.getSessionCostSince(
        "session-1",
        new Date("2026-01-01T00:00:00Z")
      )
    ).resolves.toBe(1234);
  });
});

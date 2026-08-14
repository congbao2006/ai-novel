import { describe, expect, it } from "vitest";
import {
  ConflictError,
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
});

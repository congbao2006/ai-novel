import { describe, expect, it } from "vitest";
import {
  formatAbilityAttemptReason,
  formatResourceCost,
  readLatestAbilityAttempt,
  readRuntimeAbilities
} from "./play-session-ui";

describe("play session UI helpers", () => {
  it("reads owned abilities from authoritative session state", () => {
    expect(
      readRuntimeAbilities({
        abilities: {
          definitions: [
            {
              key: "shadow-step",
              name: "Ảnh Bộ",
              description: "Lướt nhanh qua một khoảng ngắn.",
              category: "movement",
              rank: 1,
              resourceCost: { statKey: "stamina", amount: 5 },
              cooldownTurns: 2
            }
          ],
          owned: [
            {
              abilityKey: "shadow-step",
              rank: 1,
              currentCooldown: 0,
              unlocked: true,
              enabled: true
            }
          ]
        }
      })
    ).toEqual([
      expect.objectContaining({
        abilityKey: "shadow-step",
        name: "Ảnh Bộ",
        category: "movement",
        description: "Lướt nhanh qua một khoảng ngắn.",
        cooldownTurns: 2,
        status: "READY"
      })
    ]);
  });

  it("represents cooldown status and resource cost", () => {
    const [ability] = readRuntimeAbilities({
      abilities: {
        definitions: [
          {
            key: "shadow-step",
            name: "Ảnh Bộ",
            description: "",
            category: "movement",
            rank: 1,
            resourceCost: { statKey: "stamina", amount: 5 },
            cooldownTurns: 2
          }
        ],
        owned: [
          {
            abilityKey: "shadow-step",
            rank: 1,
            currentCooldown: 1,
            unlocked: true,
            enabled: true
          }
        ]
      }
    });

    expect(ability?.status).toBe("COOLDOWN");
    expect(formatResourceCost(ability?.resourceCost)).toBe("5 stamina");
  });

  it("distinguishes unauthorized ability attempts", () => {
    const attempt = readLatestAbilityAttempt({
      latestAbilityAttempt: {
        turnNumber: 4,
        requestedName: "Thiên Nhãn",
        requestedKey: null,
        matchedAbilityKey: null,
        authorized: false,
        reason: "unknown_ability",
        abilityName: "Thiên Nhãn",
        abilityKey: null,
        cooldownApplied: null,
        noAbilityStateMutation: true
      }
    });

    expect(attempt).toMatchObject({
      requestedName: "Thiên Nhãn",
      authorized: false,
      reason: "unknown_ability",
      noAbilityStateMutation: true
    });
    expect(formatAbilityAttemptReason(attempt!.reason)).toBe("UNKNOWN");
  });
});

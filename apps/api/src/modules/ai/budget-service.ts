import {
  AIBudgetExceededError,
  evaluateAIBudget,
  hasEnabledBudget,
  type AIBudgetPolicy
} from "@ai-novel/ai-engine";
import type { AIUsageRepository } from "@ai-novel/db";

export type CheckAIBudgetInput = {
  readonly userId: string;
  readonly sessionId?: string;
  readonly now?: Date;
};

export class BudgetService {
  constructor(
    private readonly usageRepository: AIUsageRepository,
    private readonly policy: AIBudgetPolicy
  ) {}

  async checkBeforeAI(input: CheckAIBudgetInput): Promise<void> {
    if (!hasEnabledBudget(this.policy)) {
      return;
    }

    const now = input.now ?? new Date();
    const [userDailyCostMicros, userMonthlyCostMicros, sessionCostMicros] =
      await Promise.all([
        this.policy.userDailyBudgetMicros === undefined
          ? Promise.resolve(0)
          : this.usageRepository.getUserCostSince(
              input.userId,
              startOfUtcDay(now)
            ),
        this.policy.userMonthlyBudgetMicros === undefined
          ? Promise.resolve(0)
          : this.usageRepository.getUserCostSince(
              input.userId,
              startOfUtcMonth(now)
            ),
        this.policy.sessionBudgetMicros === undefined || !input.sessionId
          ? Promise.resolve(undefined)
          : this.usageRepository.getSessionCostSince(
              input.sessionId,
              new Date(0)
            )
      ]);
    const decision = evaluateAIBudget(this.policy, {
      userDailyCostMicros: userDailyCostMicros ?? 0,
      userMonthlyCostMicros: userMonthlyCostMicros ?? 0,
      ...(sessionCostMicros !== undefined
        ? { sessionCostMicros: sessionCostMicros ?? 0 }
        : {})
    });

    if (!decision.allowed) {
      throw new AIBudgetExceededError(
        "Bạn đã đạt giới hạn sử dụng AI hiện tại."
      );
    }
  }
}

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}

function startOfUtcMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

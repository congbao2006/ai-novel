export type AIBudgetPolicy = {
  readonly userDailyBudgetMicros?: number;
  readonly userMonthlyBudgetMicros?: number;
  readonly sessionBudgetMicros?: number;
};

export type AIBudgetUsageSnapshot = {
  readonly userDailyCostMicros: number;
  readonly userMonthlyCostMicros: number;
  readonly sessionCostMicros?: number;
};

export type AIBudgetDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly exceeded: "user_daily" | "user_monthly" | "session";
      readonly limitMicros: number;
      readonly currentCostMicros: number;
    };

export function hasEnabledBudget(policy: AIBudgetPolicy): boolean {
  return (
    policy.userDailyBudgetMicros !== undefined ||
    policy.userMonthlyBudgetMicros !== undefined ||
    policy.sessionBudgetMicros !== undefined
  );
}

export function evaluateAIBudget(
  policy: AIBudgetPolicy,
  usage: AIBudgetUsageSnapshot
): AIBudgetDecision {
  if (
    policy.userDailyBudgetMicros !== undefined &&
    usage.userDailyCostMicros >= policy.userDailyBudgetMicros
  ) {
    return {
      allowed: false,
      exceeded: "user_daily",
      limitMicros: policy.userDailyBudgetMicros,
      currentCostMicros: usage.userDailyCostMicros
    };
  }

  if (
    policy.userMonthlyBudgetMicros !== undefined &&
    usage.userMonthlyCostMicros >= policy.userMonthlyBudgetMicros
  ) {
    return {
      allowed: false,
      exceeded: "user_monthly",
      limitMicros: policy.userMonthlyBudgetMicros,
      currentCostMicros: usage.userMonthlyCostMicros
    };
  }

  if (
    policy.sessionBudgetMicros !== undefined &&
    usage.sessionCostMicros !== undefined &&
    usage.sessionCostMicros >= policy.sessionBudgetMicros
  ) {
    return {
      allowed: false,
      exceeded: "session",
      limitMicros: policy.sessionBudgetMicros,
      currentCostMicros: usage.sessionCostMicros
    };
  }

  return { allowed: true };
}

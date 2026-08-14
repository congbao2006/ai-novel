import type { LLMProviderId, ModelPolicy, ModelPolicySet } from "./types.js";

export type CreateDefaultModelPoliciesInput = {
  readonly provider: LLMProviderId;
  readonly model: string;
  readonly maxOutputTokens: number;
};

export function createDefaultModelPolicies(
  input: CreateDefaultModelPoliciesInput
): ModelPolicySet {
  return {
    defaultStoryModel: createPolicy({
      feature: "story.default",
      provider: input.provider,
      model: input.model,
      maxOutputTokens: input.maxOutputTokens
    })
  };
}

export function createPolicy(input: {
  readonly feature: string;
  readonly provider: LLMProviderId;
  readonly model: string;
  readonly maxOutputTokens: number;
}): ModelPolicy {
  return {
    feature: input.feature,
    preferredProvider: input.provider,
    preferredModel: input.model,
    allowedProviders: [input.provider],
    tokenBudget: {
      maxInputTokens: 16_000,
      maxOutputTokens: input.maxOutputTokens
    }
  };
}

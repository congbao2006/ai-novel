import type { LLMProviderId, TokenUsage } from "./types.js";

export type ModelPricing = {
  readonly inputMicrosPerMillionTokens: number;
  readonly outputMicrosPerMillionTokens: number;
};

export type ModelPricingRegistry = Readonly<
  Record<string, ModelPricing | undefined>
>;

export type CostEstimateInput = {
  readonly provider: LLMProviderId;
  readonly model: string;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly pricingRegistry?: ModelPricingRegistry;
};

export const defaultModelPricingRegistry: ModelPricingRegistry = {};

export function pricingKey(provider: LLMProviderId, model: string): string {
  return `${provider}:${model}`;
}

export function estimateGenerationCostMicros(
  input: CostEstimateInput
): number | undefined {
  if (input.inputTokens === null || input.outputTokens === null) {
    return undefined;
  }

  const pricing = (input.pricingRegistry ?? defaultModelPricingRegistry)[
    pricingKey(input.provider, input.model)
  ];

  if (!pricing) {
    return undefined;
  }

  return (
    Math.ceil(
      (input.inputTokens * pricing.inputMicrosPerMillionTokens) / 1_000_000
    ) +
    Math.ceil(
      (input.outputTokens * pricing.outputMicrosPerMillionTokens) / 1_000_000
    )
  );
}

export function withEstimatedCost(
  usage: TokenUsage,
  input: Omit<CostEstimateInput, "inputTokens" | "outputTokens">
): TokenUsage {
  const estimatedCostMicros = estimateGenerationCostMicros({
    ...input,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens
  });

  return estimatedCostMicros === undefined
    ? usage
    : {
        ...usage,
        estimatedCostMicros
      };
}

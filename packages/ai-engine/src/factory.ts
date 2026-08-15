import { AIConfigurationError, AIProviderUnavailableError } from "./errors.js";
import { AIGateway, type AIGatewayOptions } from "./gateway.js";
import { OpenAIProvider } from "./openai-provider.js";
import { createDefaultModelPolicies } from "./policy.js";
import type { ModelPricingRegistry } from "./cost.js";
import type { AIUsageLedger, LLMProvider, LLMProviderId } from "./types.js";

export type LLMProviderFactoryConfig = {
  readonly provider: LLMProviderId;
  readonly openaiApiKey?: string;
  readonly openaiModel?: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly maxOutputTokens: number;
  readonly pricingRegistry?: ModelPricingRegistry;
  readonly usageLedger?: AIUsageLedger;
  readonly logger?: AIGatewayOptions["logger"];
};

export function createLLMProvider(
  config: LLMProviderFactoryConfig
): LLMProvider | null {
  if (config.provider === "disabled") {
    return null;
  }

  if (config.provider === "openai") {
    if (!config.openaiApiKey) {
      throw new AIConfigurationError(
        "OPENAI_API_KEY is required when AI_PROVIDER=openai."
      );
    }

    return new OpenAIProvider({
      apiKey: config.openaiApiKey,
      timeoutMs: config.timeoutMs
    });
  }

  throw new AIProviderUnavailableError(config.provider);
}

export function createAIGateway(config: LLMProviderFactoryConfig): AIGateway | null {
  const provider = createLLMProvider(config);

  if (!provider) {
    return null;
  }

  if (!config.openaiModel && config.provider === "openai") {
    throw new AIConfigurationError(
      "OPENAI_MODEL is required when AI_PROVIDER=openai."
    );
  }

  const model = config.openaiModel;

  if (!model) {
    throw new AIConfigurationError("AI model is required.");
  }

  const policies = createDefaultModelPolicies({
    provider: config.provider,
    model,
    maxOutputTokens: config.maxOutputTokens
  });

  return new AIGateway({
    providers: [provider],
    defaultModelPolicy: policies.defaultStoryModel,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    ...(config.pricingRegistry ? { pricingRegistry: config.pricingRegistry } : {}),
    ...(config.usageLedger ? { usageLedger: config.usageLedger } : {}),
    ...(config.logger ? { logger: config.logger } : {})
  });
}

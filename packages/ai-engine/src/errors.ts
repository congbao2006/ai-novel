import type { LLMProviderId } from "./types.js";

export class AIError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "AIError";
  }
}

export class AIAuthenticationError extends AIError {
  constructor(message = "AI provider authentication failed.", cause?: unknown) {
    super(message, "ai_authentication_error", false, cause);
    this.name = "AIAuthenticationError";
  }
}

export class AIRateLimitError extends AIError {
  constructor(message = "AI provider rate limit exceeded.", cause?: unknown) {
    super(message, "ai_rate_limit_error", true, cause);
    this.name = "AIRateLimitError";
  }
}

export class AITimeoutError extends AIError {
  constructor(message = "AI provider request timed out.", cause?: unknown) {
    super(message, "ai_timeout_error", true, cause);
    this.name = "AITimeoutError";
  }
}

export class AIProviderError extends AIError {
  constructor(message = "AI provider request failed.", retryable = false, cause?: unknown) {
    super(message, "ai_provider_error", retryable, cause);
    this.name = "AIProviderError";
  }
}

export class AIInvalidResponseError extends AIError {
  constructor(message = "AI provider returned an invalid response.", cause?: unknown) {
    super(message, "ai_invalid_response_error", false, cause);
    this.name = "AIInvalidResponseError";
  }
}

export class AIConfigurationError extends AIError {
  constructor(message = "AI configuration is invalid.", cause?: unknown) {
    super(message, "ai_configuration_error", false, cause);
    this.name = "AIConfigurationError";
  }
}

export class AIProviderUnavailableError extends AIConfigurationError {
  constructor(providerId: LLMProviderId) {
    super(`AI provider is unavailable: ${providerId}`);
    this.name = "AIProviderUnavailableError";
  }
}

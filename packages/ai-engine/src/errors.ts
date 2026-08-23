import type { LLMProviderId } from "./types.js";

export type AIProviderDiagnosticCause = {
  readonly name?: string;
  readonly message?: string;
  readonly code?: string;
  readonly status?: number;
  readonly cause?: AIProviderDiagnosticCause;
};

export type AIProviderDiagnostics = {
  readonly provider?: string;
  readonly model?: string;
  readonly httpStatus?: number;
  readonly providerErrorType?: string;
  readonly providerErrorCode?: string;
  readonly providerErrorParam?: string | null;
  readonly providerMessage?: string;
  readonly requestId?: string | null;
  readonly cause?: AIProviderDiagnosticCause;
};

export class AIError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly cause?: unknown,
    readonly diagnostics?: AIProviderDiagnostics
  ) {
    super(message);
    this.name = "AIError";
  }
}

export class AIAuthenticationError extends AIError {
  constructor(
    message = "AI provider authentication failed.",
    cause?: unknown,
    diagnostics?: AIProviderDiagnostics
  ) {
    super(message, "ai_authentication_error", false, cause, diagnostics);
    this.name = "AIAuthenticationError";
  }
}

export class AIRateLimitError extends AIError {
  constructor(
    message = "AI provider rate limit exceeded.",
    cause?: unknown,
    diagnostics?: AIProviderDiagnostics
  ) {
    super(message, "ai_rate_limit_error", true, cause, diagnostics);
    this.name = "AIRateLimitError";
  }
}

export class AITimeoutError extends AIError {
  constructor(
    message = "AI provider request timed out.",
    cause?: unknown,
    diagnostics?: AIProviderDiagnostics
  ) {
    super(message, "ai_timeout_error", true, cause, diagnostics);
    this.name = "AITimeoutError";
  }
}

export class AIProviderError extends AIError {
  constructor(
    message = "AI provider request failed.",
    retryable = false,
    cause?: unknown,
    diagnostics?: AIProviderDiagnostics
  ) {
    super(message, "ai_provider_error", retryable, cause, diagnostics);
    this.name = "AIProviderError";
  }
}

export class AIInvalidResponseError extends AIError {
  constructor(
    message = "AI provider returned an invalid response.",
    cause?: unknown,
    diagnostics?: AIProviderDiagnostics
  ) {
    super(message, "ai_invalid_response_error", false, cause, diagnostics);
    this.name = "AIInvalidResponseError";
  }
}

export class AIConfigurationError extends AIError {
  constructor(message = "AI configuration is invalid.", cause?: unknown) {
    super(message, "ai_configuration_error", false, cause);
    this.name = "AIConfigurationError";
  }
}

export class AIBudgetExceededError extends AIError {
  constructor(message = "AI usage budget has been exceeded.", cause?: unknown) {
    super(message, "ai_budget_exceeded", false, cause);
    this.name = "AIBudgetExceededError";
  }
}

export class AIProviderUnavailableError extends AIConfigurationError {
  constructor(providerId: LLMProviderId) {
    super(`AI provider is unavailable: ${providerId}`);
    this.name = "AIProviderUnavailableError";
  }
}

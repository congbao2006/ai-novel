import type {
  AIUsageLedger,
  AIUsageLedgerRecordInput,
  AIUsagePurpose
} from "@ai-novel/ai-engine";
import type { AIUsageRepository, AIUsagePurpose as DbAIUsagePurpose } from "@ai-novel/db";

export class RepositoryAIUsageLedger implements AIUsageLedger {
  constructor(private readonly repository: AIUsageRepository) {}

  async recordUsage(input: AIUsageLedgerRecordInput): Promise<void> {
    const record = {
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      provider: input.provider,
      model: input.model,
      purpose: toDbPurpose(input.purpose),
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens: input.totalTokens,
      estimatedCostMicros: input.estimatedCostMicros ?? null,
      latencyMs: input.latencyMs,
      providerRequestId: input.providerRequestId ?? null,
      errorCode: input.errorCode ?? null,
      createdAt: input.createdAt
    };

    if (input.status === "success") {
      await this.repository.recordSuccess(record);
      return;
    }

    await this.repository.recordFailure(record);
  }
}

function toDbPurpose(purpose: AIUsagePurpose): DbAIUsagePurpose {
  if (
    purpose === "gameplay_turn" ||
    purpose === "smoke" ||
    purpose === "summary" ||
    purpose === "npc" ||
    purpose === "memory" ||
    purpose === "other"
  ) {
    return purpose;
  }

  return "other";
}

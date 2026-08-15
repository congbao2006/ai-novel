import { createHash } from "node:crypto";
import type { EmbeddingGateway } from "@ai-novel/ai-engine";
import type { Repositories, SessionMemoryRecord } from "@ai-novel/db";
import type { BudgetService } from "../ai/budget-service.js";

export type MemoryEmbeddingServiceOptions = {
  readonly provider: string;
  readonly model: string;
  readonly batchSize: number;
};

export type EmbedMemoriesInput = {
  readonly userId?: string;
  readonly sessionId?: string;
  readonly memories: readonly SessionMemoryRecord[];
};

export type EmbedMemoriesResult = {
  readonly embedded: number;
  readonly skipped: number;
  readonly failed: number;
};

export class MemoryEmbeddingService {
  constructor(
    private readonly repositories: Repositories,
    private readonly embeddingGateway: EmbeddingGateway,
    private readonly budgetService: BudgetService | undefined,
    private readonly options: MemoryEmbeddingServiceOptions
  ) {}

  async embedMemoriesBestEffort(
    input: EmbedMemoriesInput
  ): Promise<EmbedMemoriesResult> {
    try {
      return await this.embedMemories(input);
    } catch {
      return {
        embedded: 0,
        skipped: 0,
        failed: input.memories.length
      };
    }
  }

  async embedMemories(input: EmbedMemoriesInput): Promise<EmbedMemoriesResult> {
    const activeMemories = input.memories.filter((memory) => memory.active);
    const staleMemories = [];
    let skipped = input.memories.length - activeMemories.length;

    for (const memory of activeMemories) {
      const hash = hashMemoryEmbeddingText(memory);
      const existing =
        await this.repositories.semanticMemories.getEmbeddingForMemory(
          memory.id,
          this.options.provider,
          this.options.model
        );

      if (existing?.contentHash === hash) {
        skipped += 1;
        continue;
      }

      staleMemories.push({ memory, hash });
    }

    let embedded = 0;

    for (let index = 0; index < staleMemories.length; index += this.options.batchSize) {
      const batch = staleMemories.slice(index, index + this.options.batchSize);

      if (input.userId) {
        await this.budgetService?.checkBeforeAI({
          userId: input.userId,
          ...(input.sessionId ? { sessionId: input.sessionId } : {})
        });
      }

      const result = await this.embeddingGateway.embed({
        ...(input.userId ? { userId: input.userId } : {}),
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        texts: batch.map(({ memory }) => buildMemoryEmbeddingText(memory)),
        model: this.options.model,
        metadata: {
          purpose: "embedding"
        }
      });

      for (let offset = 0; offset < batch.length; offset += 1) {
        const item = batch[offset];
        const embedding = result.embeddings[offset];

        if (!item || !embedding) {
          continue;
        }

        await this.repositories.semanticMemories.upsertEmbedding({
          memoryId: item.memory.id,
          provider: result.provider,
          model: result.model,
          dimensions: embedding.length,
          embedding,
          contentHash: item.hash
        });
        embedded += 1;
      }
    }

    return {
      embedded,
      skipped,
      failed: 0
    };
  }

  async backfillMissingActiveMemories(input: {
    readonly userId?: string;
    readonly sessionId?: string;
    readonly limit: number;
  }): Promise<EmbedMemoriesResult> {
    const memories =
      await this.repositories.semanticMemories.listActiveMemoriesMissingEmbedding(
        this.options.provider,
        this.options.model,
        input.limit
      );

    return this.embedMemories({
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      memories
    });
  }
}

export function buildMemoryEmbeddingText(memory: SessionMemoryRecord): string {
  const parts = [
    `[${memory.memoryType}]`,
    memory.subjectType ? `subject:${memory.subjectType}` : "",
    memory.key ? `key:${memory.key}` : "",
    memory.content
  ].filter(Boolean);

  return parts.join(" ");
}

export function hashMemoryEmbeddingText(memory: SessionMemoryRecord): string {
  return createHash("sha256")
    .update(buildMemoryEmbeddingText(memory), "utf8")
    .digest("hex");
}

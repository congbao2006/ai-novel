import type { EmbeddingGateway } from "@ai-novel/ai-engine";
import type {
  Repositories,
  SemanticMemorySearchResult,
  SessionMemoryRecord
} from "@ai-novel/db";
import type { BudgetService } from "../ai/budget-service.js";

export type SemanticMemoryServiceOptions = {
  readonly provider: string;
  readonly model: string;
  readonly topK: number;
  readonly minScore: number;
};

export type SearchSemanticMemoriesInput = {
  readonly userId: string;
  readonly sessionId: string;
  readonly action: string;
  readonly location: string;
};

export class SemanticMemoryService {
  constructor(
    private readonly repositories: Repositories,
    private readonly embeddingGateway: EmbeddingGateway,
    private readonly budgetService: BudgetService | undefined,
    private readonly options: SemanticMemoryServiceOptions
  ) {}

  async searchRelevantMemories(
    input: SearchSemanticMemoriesInput
  ): Promise<SemanticMemorySearchResult[]> {
    await this.budgetService?.checkBeforeAI({
      userId: input.userId,
      sessionId: input.sessionId
    });

    const embedding = await this.embeddingGateway.embed({
      userId: input.userId,
      sessionId: input.sessionId,
      model: this.options.model,
      texts: [buildMemoryQuery(input)],
      metadata: {
        purpose: "embedding"
      }
    });
    const queryEmbedding = embedding.embeddings[0];

    if (!queryEmbedding) {
      return [];
    }

    return this.repositories.semanticMemories.searchSimilar({
      sessionId: input.sessionId,
      provider: embedding.provider,
      model: embedding.model,
      dimensions: queryEmbedding.length,
      queryEmbedding,
      limit: this.options.topK,
      minScore: this.options.minScore,
      activeOnly: true
    });
  }
}

export type RankedMemory = {
  readonly memory: SessionMemoryRecord;
  readonly semanticScore: number | null;
  readonly hybridScore: number;
};

export function buildMemoryQuery(input: SearchSemanticMemoriesInput): string {
  return [
    input.location ? `Location: ${input.location}` : "",
    `Player action: ${input.action}`
  ]
    .filter(Boolean)
    .join("\n");
}

export function mergeAndRankMemories(input: {
  readonly deterministic: readonly SessionMemoryRecord[];
  readonly semantic: readonly SemanticMemorySearchResult[];
  readonly limit: number;
}): RankedMemory[] {
  const byIdentity = new Map<string, RankedMemory>();
  const maxTurn = Math.max(
    1,
    ...input.deterministic.map((memory) => memory.lastConfirmedTurn ?? 0),
    ...input.semantic.map((result) => result.memory.lastConfirmedTurn ?? 0)
  );

  for (const memory of input.deterministic) {
    upsertRanked(byIdentity, {
      memory,
      semanticScore: null,
      hybridScore:
        0.75 +
        importanceScore(memory.importance) * 0.2 +
        recencyScore(memory, maxTurn) * 0.05
    });
  }

  for (const result of input.semantic) {
    const memory = result.memory;

    upsertRanked(byIdentity, {
      memory,
      semanticScore: result.semanticScore,
      hybridScore:
        result.semanticScore * 0.65 +
        importanceScore(memory.importance) * 0.25 +
        recencyScore(memory, maxTurn) * 0.1
    });
  }

  return [...byIdentity.values()]
    .sort((left, right) => {
      if (right.hybridScore !== left.hybridScore) {
        return right.hybridScore - left.hybridScore;
      }

      return right.memory.importance - left.memory.importance;
    })
    .slice(0, input.limit);
}

function upsertRanked(
  map: Map<string, RankedMemory>,
  candidate: RankedMemory
): void {
  const key = memoryIdentity(candidate.memory);
  const existing = map.get(key);

  if (!existing || candidate.hybridScore > existing.hybridScore) {
    map.set(key, candidate);
  }
}

function memoryIdentity(memory: SessionMemoryRecord): string {
  return memory.key ? `key:${memory.key}` : `id:${memory.id}`;
}

function importanceScore(importance: number): number {
  return Math.max(0, Math.min(1, (importance - 1) / 4));
}

function recencyScore(memory: SessionMemoryRecord, maxTurn: number): number {
  return Math.max(0, Math.min(1, (memory.lastConfirmedTurn ?? 0) / maxTurn));
}

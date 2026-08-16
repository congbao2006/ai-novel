import type {
  GameStateRecord,
  NpcRecord,
  Repositories,
  SessionMemoryRecord
} from "@ai-novel/db";
import {
  type GeneratedWorldEvent,
  type NPCRelationshipDeltaProposal,
  type ValidatedNPCReactionProposal
} from "@ai-novel/domain";
import type { BudgetService } from "../ai/budget-service.js";
import type { MemoryEmbeddingService } from "./memory-embedding-service.js";
import type { NPCKnowledgeBuilder } from "./npc-knowledge-builder.js";
import type { NPCParticipationSelector } from "./npc-participation-selector.js";
import type { NPCReactionEngine } from "./npc-reaction-engine.js";

export type NPCReactionResult = {
  readonly reactions: readonly PersistableNPCReaction[];
  readonly dialogueBlocks: readonly string[];
  readonly events: readonly GeneratedWorldEvent[];
};

export type PersistableNPCReaction = {
  readonly npcId: string;
  readonly statePatch: Record<string, unknown>;
  readonly relationshipDeltas: readonly NPCRelationshipDeltaProposal[];
  readonly memoryCandidates: readonly {
    readonly memoryType: "fact" | "relationship" | "event" | "player" | "world" | "npc" | "quest" | "other";
    readonly key?: string | null;
    readonly content: string;
    readonly importance: number;
  }[];
};

export class NPCReactionService {
  constructor(
    private readonly repositories: Repositories,
    private readonly selector: NPCParticipationSelector,
    private readonly knowledgeBuilder: NPCKnowledgeBuilder,
    private readonly engine: NPCReactionEngine,
    private readonly budgetService?: BudgetService,
    private readonly memoryEmbeddingService?: MemoryEmbeddingService
  ) {}

  async generateReactions(input: {
    readonly userId: string;
    readonly sessionId: string;
    readonly state: GameStateRecord;
    readonly action: string;
    readonly turnNumber: number;
  }): Promise<NPCReactionResult> {
    const allNpcs = await this.repositories.npcs.listBySession(input.sessionId);
    const selected = this.selector.select({
      npcs: allNpcs,
      action: input.action,
      location: input.state.location
    });

    if (selected.length === 0) {
      return {
        reactions: [],
        dialogueBlocks: [],
        events: []
      };
    }

    const validNpcIds = new Set(allNpcs.map((npc) => npc.id));
    const reactions: PersistableNPCReaction[] = [];
    const dialogueBlocks: string[] = [];
    const events: GeneratedWorldEvent[] = [];

    for (const npc of selected) {
      const proposal = await this.tryGenerateNpcReaction({
        ...input,
        npc,
        allNpcs,
        validNpcIds
      });

      if (!proposal) {
        continue;
      }

      reactions.push(toPersistableReaction(npc.id, proposal));

      if (proposal.dialogue) {
        dialogueBlocks.push(`${npc.name}: ${proposal.dialogue}`);
      }

      events.push(
        ...proposal.events.map((event) => ({
          ...event,
          payload: {
            ...event.payload,
            npcId: npc.id,
            source: "npc_ai"
          }
        }))
      );
    }

    return { reactions, dialogueBlocks, events };
  }

  async embedMemoriesBestEffort(input: {
    readonly userId: string;
    readonly sessionId: string;
    readonly memories: readonly SessionMemoryRecord[];
  }): Promise<void> {
    await this.memoryEmbeddingService?.embedMemoriesBestEffort(input);
  }

  private async tryGenerateNpcReaction(input: {
    readonly userId: string;
    readonly sessionId: string;
    readonly state: GameStateRecord;
    readonly action: string;
    readonly turnNumber: number;
    readonly npc: NpcRecord;
    readonly allNpcs: readonly NpcRecord[];
    readonly validNpcIds: ReadonlySet<string>;
  }): Promise<ValidatedNPCReactionProposal | null> {
    try {
      await this.budgetService?.checkBeforeAI({
        userId: input.userId,
        sessionId: input.sessionId
      });
      const context = await this.knowledgeBuilder.build(input);

      return await this.engine.react({
        userId: input.userId,
        sessionId: input.sessionId,
        context,
        validNpcIds: input.validNpcIds
      });
    } catch {
      return null;
    }
  }
}

function toPersistableReaction(
  npcId: string,
  proposal: ValidatedNPCReactionProposal
): PersistableNPCReaction {
  return {
    npcId,
    statePatch: proposal.statePatch,
    relationshipDeltas: proposal.relationshipDeltas,
    memoryCandidates: proposal.memoryCandidates.map((candidate) => ({
      memoryType: candidate.memoryType,
      key: candidate.key ?? null,
      content: candidate.content,
      importance: candidate.importance
    }))
  };
}

import type {
  GameMessageRecord,
  GameStateRecord,
  NpcRecord,
  RelationshipRecord,
  Repositories,
  SessionMemoryRecord,
  WorldEventRecord
} from "@ai-novel/db";
import type {
  MemoryContextMessage,
  MemoryContextWorldEvent,
  NPCDecisionContext,
  NPCKnowledgeFact,
  NPCRelationshipContext,
  NPCRuntimeProfile
} from "@ai-novel/domain";
import { toStateSnapshot } from "./memory-context-builder.js";
import type { SemanticMemoryService } from "./semantic-memory-service.js";

export type NPCKnowledgeBuilderOptions = {
  readonly maxMemories: number;
  readonly maxRecentMessages: number;
  readonly maxWorldEvents: number;
  readonly semanticMemoryService?: SemanticMemoryService;
};

export class NPCKnowledgeBuilder {
  constructor(
    private readonly repositories: Repositories,
    private readonly options: NPCKnowledgeBuilderOptions
  ) {}

  async build(input: {
    readonly userId: string;
    readonly sessionId: string;
    readonly npc: NpcRecord;
    readonly allNpcs: readonly NpcRecord[];
    readonly state: GameStateRecord;
    readonly action: string;
    readonly turnNumber: number;
  }): Promise<NPCDecisionContext> {
    const [relationship, deterministicMemories, semanticMemories, messages, events] =
      await Promise.all([
        this.repositories.relationships.getRelationshipEdge(
          input.sessionId,
          { type: "npc", id: input.npc.id },
          { type: "player", id: null }
        ),
        this.repositories.memories.listActiveForSession(
          input.sessionId,
          Math.max(this.options.maxMemories * 4, this.options.maxMemories)
        ),
        this.searchSemanticMemories(input),
        this.repositories.gameMessages.getRecentMessages(
          input.sessionId,
          Math.max(this.options.maxRecentMessages * 2, this.options.maxRecentMessages)
        ),
        this.repositories.worldEvents.getImportantEvents(
          input.sessionId,
          3,
          this.options.maxWorldEvents
        )
      ]);
    const memories = selectNpcMemories(
      input.npc,
      [...deterministicMemories, ...semanticMemories],
      this.options.maxMemories
    );

    return {
      npc: toRuntimeProfile(input.npc),
      currentState: pickVisibleGameState(input.state),
      relationshipWithPlayer: relationship ? toRelationshipContext(relationship) : null,
      memories: memories.map(toKnowledgeFact),
      recentMessages: messages
        .filter((message) => messageMentionsNpc(message, input.npc))
        .slice(0, this.options.maxRecentMessages)
        .reverse()
        .map(toContextMessage),
      worldEvents: selectVisibleWorldEvents(events, input.npc, input.state),
      playerAction: input.action,
      turnNumber: input.turnNumber
    };
  }

  private async searchSemanticMemories(input: {
    readonly userId: string;
    readonly sessionId: string;
    readonly npc: NpcRecord;
    readonly state: GameStateRecord;
    readonly action: string;
  }): Promise<SessionMemoryRecord[]> {
    if (!this.options.semanticMemoryService) {
      return [];
    }

    try {
      const results = await this.options.semanticMemoryService.searchRelevantMemories({
        userId: input.userId,
        sessionId: input.sessionId,
        action: `NPC ${input.npc.name}: ${input.action}`,
        location: input.state.location
      });

      return results.map((result) => result.memory);
    } catch {
      return [];
    }
  }
}

function selectNpcMemories(
  npc: NpcRecord,
  memories: readonly SessionMemoryRecord[],
  limit: number
): SessionMemoryRecord[] {
  const seen = new Set<string>();
  const filtered = memories
    .filter((memory) => memory.active)
    .filter(
      (memory) =>
        (memory.subjectType === "npc" && memory.subjectId === npc.id) ||
        memory.memoryType === "relationship" ||
        (memory.memoryType === "event" && mentions(memory.content, npc.name))
    )
    .filter((memory) => {
      const key = memory.key ? `key:${memory.key}` : `id:${memory.id}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

  return filtered
    .sort((left, right) => {
      if (right.importance !== left.importance) {
        return right.importance - left.importance;
      }

      return (right.lastConfirmedTurn ?? 0) - (left.lastConfirmedTurn ?? 0);
    })
    .slice(0, limit);
}

function pickVisibleGameState(state: GameStateRecord): NPCDecisionContext["currentState"] {
  const snapshot = toStateSnapshot(state);
  return {
    location: snapshot.location,
    worldTime: snapshot.worldTime,
    flags: {},
    stateData: {
      sceneSummary:
        typeof snapshot.stateData.aiSceneSummary === "string"
          ? snapshot.stateData.aiSceneSummary
          : null
    }
  };
}

function toRuntimeProfile(npc: NpcRecord): NPCRuntimeProfile {
  return {
    id: npc.id,
    sessionId: npc.sessionId,
    templateCharacterId: npc.templateCharacterId,
    name: npc.name,
    description: npc.description,
    personality: copyJsonObject(npc.personality),
    goals: JSON.parse(JSON.stringify(npc.goals)) as unknown[],
    secrets: copyJsonObject(npc.secrets),
    currentState: copyJsonObject(npc.currentState),
    alive: npc.alive
  };
}

function toRelationshipContext(
  relationship: RelationshipRecord
): NPCRelationshipContext {
  return {
    sourceType: relationship.sourceType,
    sourceId: relationship.sourceId,
    targetType: relationship.targetType,
    targetId: relationship.targetId,
    affinity: relationship.affinity,
    trust: relationship.trust,
    fear: relationship.fear
  };
}

function toKnowledgeFact(memory: SessionMemoryRecord): NPCKnowledgeFact {
  return {
    memoryType: memory.memoryType,
    content: memory.content,
    importance: memory.importance,
    lastConfirmedTurn: memory.lastConfirmedTurn
  };
}

function toContextMessage(message: GameMessageRecord): MemoryContextMessage {
  return {
    role: message.role,
    content: message.content,
    turnNumber: message.turnNumber
  };
}

function selectVisibleWorldEvents(
  events: readonly WorldEventRecord[],
  npc: NpcRecord,
  state: GameStateRecord
): MemoryContextWorldEvent[] {
  const npcLocation = stringFromState(npc.currentState, "location");

  return events
    .filter(
      (event) =>
        event.importance >= 4 ||
        mentions(event.description, npc.name) ||
        (npcLocation !== null && npcLocation === state.location)
    )
    .slice(0, 10)
    .map((event) => ({
      eventType: event.eventType,
      title: event.title,
      description: event.description,
      importance: event.importance,
      turnNumber: event.turnNumber
    }));
}

function messageMentionsNpc(message: GameMessageRecord, npc: NpcRecord): boolean {
  return mentions(message.content, npc.name);
}

function mentions(text: string, name: string): boolean {
  return normalize(text).includes(normalize(name));
}

function stringFromState(
  state: Record<string, unknown>,
  key: string
): string | null {
  const value = state[key];
  return typeof value === "string" ? value : null;
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function copyJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

import type { DbExecutor } from "./context.js";
import type {
  AIUsageRepository,
  AuthSessionRepository,
  FactionRelationshipRepository,
  FactionRepository,
  GameMessageRepository,
  GameSessionRepository,
  GameStateRepository,
  InventoryRepository,
  MemoryRepository,
  NPCRepository,
  QuestRepository,
  RelationshipRepository,
  SemanticMemoryRepository,
  SessionSummaryRepository,
  StoryRepository,
  UserRepository,
  WorldEventRepository,
  WorldSimulationStateRepository
} from "./contracts.js";
import {
  DrizzleAIUsageRepository,
  DrizzleFactionRelationshipRepository,
  DrizzleFactionRepository,
  DrizzleGameMessageRepository,
  DrizzleGameSessionRepository,
  DrizzleGameStateRepository,
  DrizzleAuthSessionRepository,
  DrizzleInventoryRepository,
  DrizzleMemoryRepository,
  DrizzleNPCRepository,
  DrizzleQuestRepository,
  DrizzleRelationshipRepository,
  DrizzleSemanticMemoryRepository,
  DrizzleSessionSummaryRepository,
  DrizzleStoryRepository,
  DrizzleUserRepository,
  DrizzleWorldEventRepository,
  DrizzleWorldSimulationStateRepository
} from "./implementations.js";

export type Repositories = {
  readonly users: UserRepository;
  readonly aiUsage: AIUsageRepository;
  readonly authSessions: AuthSessionRepository;
  readonly stories: StoryRepository;
  readonly gameSessions: GameSessionRepository;
  readonly gameMessages: GameMessageRepository;
  readonly gameStates: GameStateRepository;
  readonly npcs: NPCRepository;
  readonly relationships: RelationshipRepository;
  readonly inventory: InventoryRepository;
  readonly sessionSummaries: SessionSummaryRepository;
  readonly memories: MemoryRepository;
  readonly semanticMemories: SemanticMemoryRepository;
  readonly quests: QuestRepository;
  readonly worldEvents: WorldEventRepository;
  readonly factions: FactionRepository;
  readonly factionRelationships: FactionRelationshipRepository;
  readonly worldSimulationStates: WorldSimulationStateRepository;
};

export function createRepositories(db: DbExecutor): Repositories {
  return {
    users: new DrizzleUserRepository(db),
    aiUsage: new DrizzleAIUsageRepository(db),
    authSessions: new DrizzleAuthSessionRepository(db),
    stories: new DrizzleStoryRepository(db),
    gameSessions: new DrizzleGameSessionRepository(db),
    gameMessages: new DrizzleGameMessageRepository(db),
    gameStates: new DrizzleGameStateRepository(db),
    npcs: new DrizzleNPCRepository(db),
    relationships: new DrizzleRelationshipRepository(db),
    inventory: new DrizzleInventoryRepository(db),
    sessionSummaries: new DrizzleSessionSummaryRepository(db),
    memories: new DrizzleMemoryRepository(db),
    semanticMemories: new DrizzleSemanticMemoryRepository(db),
    quests: new DrizzleQuestRepository(db),
    worldEvents: new DrizzleWorldEventRepository(db),
    factions: new DrizzleFactionRepository(db),
    factionRelationships: new DrizzleFactionRelationshipRepository(db),
    worldSimulationStates: new DrizzleWorldSimulationStateRepository(db)
  };
}

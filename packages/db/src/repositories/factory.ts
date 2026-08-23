import type { DbExecutor } from "./context.js";
import type { PgPool } from "../client.js";
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
  StoryAbilityRepository,
  StoryFactionRelationshipRepository,
  StoryFactionRepository,
  StoryRepository,
  StoryVersionAbilityRepository,
  StoryVersionCharacterAbilityRepository,
  StoryVersionCharacterRepository,
  StoryVersionFactionRelationshipRepository,
  StoryVersionFactionRepository,
  StoryVersionRepository,
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
  DrizzleStoryAbilityRepository,
  DrizzleStoryFactionRelationshipRepository,
  DrizzleStoryFactionRepository,
  DrizzleStoryRepository,
  DrizzleStoryVersionAbilityRepository,
  DrizzleStoryVersionCharacterAbilityRepository,
  DrizzleStoryVersionCharacterRepository,
  DrizzleStoryVersionFactionRelationshipRepository,
  DrizzleStoryVersionFactionRepository,
  DrizzleStoryVersionRepository,
  DrizzleUserRepository,
  DrizzleWorldEventRepository,
  DrizzleWorldSimulationStateRepository
} from "./implementations.js";

export type Repositories = {
  readonly users: UserRepository;
  readonly aiUsage: AIUsageRepository;
  readonly authSessions: AuthSessionRepository;
  readonly stories: StoryRepository;
  readonly storyAbilities: StoryAbilityRepository;
  readonly storyFactions: StoryFactionRepository;
  readonly storyFactionRelationships: StoryFactionRelationshipRepository;
  readonly storyVersions: StoryVersionRepository;
  readonly storyVersionAbilities: StoryVersionAbilityRepository;
  readonly storyVersionCharacterAbilities: StoryVersionCharacterAbilityRepository;
  readonly storyVersionCharacters: StoryVersionCharacterRepository;
  readonly storyVersionFactions: StoryVersionFactionRepository;
  readonly storyVersionFactionRelationships: StoryVersionFactionRelationshipRepository;
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

export type RepositoryFactoryOptions = {
  readonly pool?: PgPool | undefined;
};

export function createRepositories(
  db: DbExecutor,
  options: RepositoryFactoryOptions = {}
): Repositories {
  return {
    users: new DrizzleUserRepository(db),
    aiUsage: new DrizzleAIUsageRepository(db),
    authSessions: new DrizzleAuthSessionRepository(db, options.pool),
    stories: new DrizzleStoryRepository(db),
    storyAbilities: new DrizzleStoryAbilityRepository(db),
    storyFactions: new DrizzleStoryFactionRepository(db),
    storyFactionRelationships: new DrizzleStoryFactionRelationshipRepository(db),
    storyVersions: new DrizzleStoryVersionRepository(db),
    storyVersionAbilities: new DrizzleStoryVersionAbilityRepository(db),
    storyVersionCharacterAbilities:
      new DrizzleStoryVersionCharacterAbilityRepository(db),
    storyVersionCharacters: new DrizzleStoryVersionCharacterRepository(db),
    storyVersionFactions: new DrizzleStoryVersionFactionRepository(db),
    storyVersionFactionRelationships:
      new DrizzleStoryVersionFactionRelationshipRepository(db),
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

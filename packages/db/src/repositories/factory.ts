import type { DbExecutor } from "./context.js";
import type {
  GameMessageRepository,
  GameSessionRepository,
  GameStateRepository,
  InventoryRepository,
  NPCRepository,
  QuestRepository,
  RelationshipRepository,
  StoryRepository,
  UserRepository,
  WorldEventRepository
} from "./contracts.js";
import {
  DrizzleGameMessageRepository,
  DrizzleGameSessionRepository,
  DrizzleGameStateRepository,
  DrizzleInventoryRepository,
  DrizzleNPCRepository,
  DrizzleQuestRepository,
  DrizzleRelationshipRepository,
  DrizzleStoryRepository,
  DrizzleUserRepository,
  DrizzleWorldEventRepository
} from "./implementations.js";

export type Repositories = {
  readonly users: UserRepository;
  readonly stories: StoryRepository;
  readonly gameSessions: GameSessionRepository;
  readonly gameMessages: GameMessageRepository;
  readonly gameStates: GameStateRepository;
  readonly npcs: NPCRepository;
  readonly relationships: RelationshipRepository;
  readonly inventory: InventoryRepository;
  readonly quests: QuestRepository;
  readonly worldEvents: WorldEventRepository;
};

export function createRepositories(db: DbExecutor): Repositories {
  return {
    users: new DrizzleUserRepository(db),
    stories: new DrizzleStoryRepository(db),
    gameSessions: new DrizzleGameSessionRepository(db),
    gameMessages: new DrizzleGameMessageRepository(db),
    gameStates: new DrizzleGameStateRepository(db),
    npcs: new DrizzleNPCRepository(db),
    relationships: new DrizzleRelationshipRepository(db),
    inventory: new DrizzleInventoryRepository(db),
    quests: new DrizzleQuestRepository(db),
    worldEvents: new DrizzleWorldEventRepository(db)
  };
}

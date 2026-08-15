import { relations, sql } from "drizzle-orm";
import {
  boolean,
  bigint,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import {
  aiUsagePurposeEnum,
  aiUsageStatusEnum,
  entityTypeEnum,
  memoryTypeEnum,
  messageRoleEnum,
  questStatusEnum,
  sessionStatusEnum
} from "./enums.js";
import { users } from "./identity.js";
import { stories, storyCharacters } from "./stories.js";

const vector = customType<{
  data: number[];
  driverData: string;
}>({
  dataType() {
    return "vector";
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    return value
      .slice(1, -1)
      .split(",")
      .filter(Boolean)
      .map((part) => Number.parseFloat(part));
  }
});

export const gameSessions = pgTable(
  "game_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, {
        onDelete: "restrict",
        onUpdate: "cascade"
      }),
    selectedCharacterId: uuid("selected_character_id").references(
      () => storyCharacters.id,
      {
        onDelete: "set null",
        onUpdate: "cascade"
      }
    ),
    title: text("title"),
    status: sessionStatusEnum("status").notNull().default("active"),
    turnCount: integer("turn_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("game_sessions_user_id_idx").on(table.userId),
    index("game_sessions_story_id_idx").on(table.storyId),
    index("game_sessions_status_idx").on(table.status),
    index("game_sessions_last_played_at_idx").on(table.lastPlayedAt),
    check("game_sessions_turn_count_non_negative", sql`${table.turnCount} >= 0`)
  ]
);

export const gameMessages = pgTable(
  "game_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    turnNumber: integer("turn_number").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("game_messages_session_turn_idx").on(
      table.sessionId,
      table.turnNumber
    ),
    check("game_messages_turn_number_non_negative", sql`${table.turnNumber} >= 0`)
  ]
);

export const gameStates = pgTable(
  "game_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    version: integer("version").notNull().default(1),
    location: text("location").notNull(),
    worldTime: text("world_time"),
    playerStats: jsonb("player_stats")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    flags: jsonb("flags").$type<Record<string, unknown>>().notNull().default({}),
    stateData: jsonb("state_data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("game_states_session_id_unique").on(table.sessionId),
    check("game_states_version_positive", sql`${table.version} > 0`)
  ]
);

export const npcs = pgTable(
  "npcs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    templateCharacterId: uuid("template_character_id").references(
      () => storyCharacters.id,
      {
        onDelete: "set null",
        onUpdate: "cascade"
      }
    ),
    name: text("name").notNull(),
    description: text("description").notNull(),
    personality: jsonb("personality")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    goals: jsonb("goals").$type<unknown[]>().notNull().default([]),
    secrets: jsonb("secrets").$type<Record<string, unknown>>().notNull().default({}),
    currentState: jsonb("current_state")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    alive: boolean("alive").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("npcs_session_id_idx").on(table.sessionId),
    index("npcs_template_character_id_idx").on(table.templateCharacterId)
  ]
);

export const relationships = pgTable(
  "relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    sourceType: entityTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id"),
    targetType: entityTypeEnum("target_type").notNull(),
    targetId: uuid("target_id"),
    affinity: integer("affinity").notNull().default(0),
    trust: integer("trust").notNull().default(0),
    fear: integer("fear").notNull().default(0),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("relationships_unique_edge_idx").on(
      table.sessionId,
      table.sourceType,
      sql`coalesce(${table.sourceId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      table.targetType,
      sql`coalesce(${table.targetId}, '00000000-0000-0000-0000-000000000000'::uuid)`
    ),
    index("relationships_session_source_idx").on(
      table.sessionId,
      table.sourceType,
      table.sourceId
    ),
    index("relationships_session_target_idx").on(
      table.sessionId,
      table.targetType,
      table.targetId
    ),
    check(
      "relationships_affinity_range",
      sql`${table.affinity} between -100 and 100`
    ),
    check("relationships_trust_range", sql`${table.trust} between -100 and 100`),
    check("relationships_fear_range", sql`${table.fear} between 0 and 100`),
    check(
      "relationships_source_identity_shape",
      sql`(${table.sourceType} = 'player' and ${table.sourceId} is null) or (${table.sourceType} = 'npc' and ${table.sourceId} is not null)`
    ),
    check(
      "relationships_target_identity_shape",
      sql`(${table.targetType} = 'player' and ${table.targetId} is null) or (${table.targetType} = 'npc' and ${table.targetId} is not null)`
    )
  ]
);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    ownerType: entityTypeEnum("owner_type").notNull(),
    ownerId: uuid("owner_id"),
    itemKey: text("item_key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    quantity: integer("quantity").notNull().default(1),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("inventory_items_session_owner_idx").on(
      table.sessionId,
      table.ownerType,
      table.ownerId
    ),
    index("inventory_items_session_item_key_idx").on(
      table.sessionId,
      table.itemKey
    ),
    check("inventory_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "inventory_items_owner_identity_shape",
      sql`(${table.ownerType} = 'player' and ${table.ownerId} is null) or (${table.ownerType} = 'npc' and ${table.ownerId} is not null)`
    )
  ]
);

export const quests = pgTable(
  "quests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    questKey: text("quest_key").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: questStatusEnum("status").notNull().default("inactive"),
    progress: jsonb("progress")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("quests_session_quest_key_unique").on(
      table.sessionId,
      table.questKey
    ),
    index("quests_session_status_idx").on(table.sessionId, table.status)
  ]
);

export const worldEvents = pgTable(
  "world_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    importance: integer("importance").notNull().default(3),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    turnNumber: integer("turn_number").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("world_events_session_turn_idx").on(
      table.sessionId,
      table.turnNumber
    ),
    index("world_events_session_importance_idx").on(
      table.sessionId,
      table.importance
    ),
    check("world_events_importance_range", sql`${table.importance} between 1 and 5`),
    check("world_events_turn_number_non_negative", sql`${table.turnNumber} >= 0`)
  ]
);

export const aiUsageRecords = pgTable(
  "ai_usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "cascade"
    }),
    sessionId: uuid("session_id").references(() => gameSessions.id, {
      onDelete: "set null",
      onUpdate: "cascade"
    }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    purpose: aiUsagePurposeEnum("purpose").notNull().default("other"),
    status: aiUsageStatusEnum("status").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    estimatedCostMicros: bigint("estimated_cost_micros", { mode: "number" }),
    latencyMs: integer("latency_ms"),
    providerRequestId: text("provider_request_id"),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("ai_usage_records_user_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
    index("ai_usage_records_session_created_at_idx").on(
      table.sessionId,
      table.createdAt
    ),
    index("ai_usage_records_provider_model_created_at_idx").on(
      table.provider,
      table.model,
      table.createdAt
    ),
    index("ai_usage_records_purpose_created_at_idx").on(
      table.purpose,
      table.createdAt
    ),
    index("ai_usage_records_status_created_at_idx").on(
      table.status,
      table.createdAt
    ),
    check(
      "ai_usage_records_input_tokens_non_negative",
      sql`${table.inputTokens} is null or ${table.inputTokens} >= 0`
    ),
    check(
      "ai_usage_records_output_tokens_non_negative",
      sql`${table.outputTokens} is null or ${table.outputTokens} >= 0`
    ),
    check(
      "ai_usage_records_total_tokens_non_negative",
      sql`${table.totalTokens} is null or ${table.totalTokens} >= 0`
    ),
    check(
      "ai_usage_records_estimated_cost_non_negative",
      sql`${table.estimatedCostMicros} is null or ${table.estimatedCostMicros} >= 0`
    ),
    check(
      "ai_usage_records_latency_non_negative",
      sql`${table.latencyMs} is null or ${table.latencyMs} >= 0`
    )
  ]
);

export const sessionSummaries = pgTable(
  "session_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    summaryText: text("summary_text").notNull(),
    summarizedThroughTurn: integer("summarized_through_turn").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("session_summaries_session_id_unique").on(table.sessionId),
    check(
      "session_summaries_summarized_turn_non_negative",
      sql`${table.summarizedThroughTurn} >= 0`
    ),
    check("session_summaries_version_positive", sql`${table.version} > 0`)
  ]
);

export const sessionMemories = pgTable(
  "session_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    memoryType: memoryTypeEnum("memory_type").notNull().default("other"),
    subjectType: text("subject_type"),
    subjectId: uuid("subject_id"),
    key: text("key"),
    content: text("content").notNull(),
    importance: integer("importance").notNull().default(3),
    firstObservedTurn: integer("first_observed_turn"),
    lastConfirmedTurn: integer("last_confirmed_turn"),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("session_memories_session_active_idx").on(table.sessionId, table.active),
    index("session_memories_session_importance_idx").on(
      table.sessionId,
      table.importance
    ),
    index("session_memories_session_memory_type_idx").on(
      table.sessionId,
      table.memoryType
    ),
    index("session_memories_session_last_confirmed_idx").on(
      table.sessionId,
      table.lastConfirmedTurn
    ),
    uniqueIndex("session_memories_session_key_unique").on(
      table.sessionId,
      table.key
    ),
    check(
      "session_memories_importance_range",
      sql`${table.importance} between 1 and 5`
    ),
    check(
      "session_memories_first_observed_non_negative",
      sql`${table.firstObservedTurn} is null or ${table.firstObservedTurn} >= 0`
    ),
    check(
      "session_memories_last_confirmed_non_negative",
      sql`${table.lastConfirmedTurn} is null or ${table.lastConfirmedTurn} >= 0`
    )
  ]
);

export const memoryEmbeddings = pgTable(
  "memory_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memoryId: uuid("memory_id")
      .notNull()
      .references(() => sessionMemories.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    dimensions: integer("dimensions").notNull(),
    embedding: vector("embedding").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("memory_embeddings_memory_provider_model_unique").on(
      table.memoryId,
      table.provider,
      table.model
    ),
    index("memory_embeddings_memory_id_idx").on(table.memoryId),
    index("memory_embeddings_provider_model_idx").on(
      table.provider,
      table.model
    ),
    check("memory_embeddings_dimensions_positive", sql`${table.dimensions} > 0`),
    check("memory_embeddings_content_hash_non_empty", sql`${table.contentHash} <> ''`)
  ]
);

export const gameSessionsRelations = relations(gameSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [gameSessions.userId],
    references: [users.id]
  }),
  story: one(stories, {
    fields: [gameSessions.storyId],
    references: [stories.id]
  }),
  selectedCharacter: one(storyCharacters, {
    fields: [gameSessions.selectedCharacterId],
    references: [storyCharacters.id]
  }),
  messages: many(gameMessages),
  state: one(gameStates),
  npcs: many(npcs),
  relationships: many(relationships),
  inventoryItems: many(inventoryItems),
  quests: many(quests),
  worldEvents: many(worldEvents),
  aiUsageRecords: many(aiUsageRecords),
  summary: one(sessionSummaries),
  memories: many(sessionMemories)
}));

export const gameMessagesRelations = relations(gameMessages, ({ one }) => ({
  session: one(gameSessions, {
    fields: [gameMessages.sessionId],
    references: [gameSessions.id]
  })
}));

export const gameStatesRelations = relations(gameStates, ({ one }) => ({
  session: one(gameSessions, {
    fields: [gameStates.sessionId],
    references: [gameSessions.id]
  })
}));

export const npcsRelations = relations(npcs, ({ one }) => ({
  session: one(gameSessions, {
    fields: [npcs.sessionId],
    references: [gameSessions.id]
  }),
  templateCharacter: one(storyCharacters, {
    fields: [npcs.templateCharacterId],
    references: [storyCharacters.id]
  })
}));

export const relationshipsRelations = relations(relationships, ({ one }) => ({
  session: one(gameSessions, {
    fields: [relationships.sessionId],
    references: [gameSessions.id]
  })
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  session: one(gameSessions, {
    fields: [inventoryItems.sessionId],
    references: [gameSessions.id]
  })
}));

export const questsRelations = relations(quests, ({ one }) => ({
  session: one(gameSessions, {
    fields: [quests.sessionId],
    references: [gameSessions.id]
  })
}));

export const worldEventsRelations = relations(worldEvents, ({ one }) => ({
  session: one(gameSessions, {
    fields: [worldEvents.sessionId],
    references: [gameSessions.id]
  })
}));

export const aiUsageRecordsRelations = relations(aiUsageRecords, ({ one }) => ({
  user: one(users, {
    fields: [aiUsageRecords.userId],
    references: [users.id]
  }),
  session: one(gameSessions, {
    fields: [aiUsageRecords.sessionId],
    references: [gameSessions.id]
  })
}));

export const sessionSummariesRelations = relations(sessionSummaries, ({ one }) => ({
  session: one(gameSessions, {
    fields: [sessionSummaries.sessionId],
    references: [gameSessions.id]
  })
}));

export const sessionMemoriesRelations = relations(sessionMemories, ({ one, many }) => ({
  session: one(gameSessions, {
    fields: [sessionMemories.sessionId],
    references: [gameSessions.id]
  }),
  embeddings: many(memoryEmbeddings)
}));

export const memoryEmbeddingsRelations = relations(memoryEmbeddings, ({ one }) => ({
  memory: one(sessionMemories, {
    fields: [memoryEmbeddings.memoryId],
    references: [sessionMemories.id]
  })
}));

export type GameSession = typeof gameSessions.$inferSelect;
export type NewGameSession = typeof gameSessions.$inferInsert;
export type GameMessage = typeof gameMessages.$inferSelect;
export type NewGameMessage = typeof gameMessages.$inferInsert;
export type GameState = typeof gameStates.$inferSelect;
export type NewGameState = typeof gameStates.$inferInsert;
export type Npc = typeof npcs.$inferSelect;
export type NewNpc = typeof npcs.$inferInsert;
export type Relationship = typeof relationships.$inferSelect;
export type NewRelationship = typeof relationships.$inferInsert;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type Quest = typeof quests.$inferSelect;
export type NewQuest = typeof quests.$inferInsert;
export type WorldEvent = typeof worldEvents.$inferSelect;
export type NewWorldEvent = typeof worldEvents.$inferInsert;
export type AIUsageRecord = typeof aiUsageRecords.$inferSelect;
export type NewAIUsageRecord = typeof aiUsageRecords.$inferInsert;
export type SessionSummary = typeof sessionSummaries.$inferSelect;
export type NewSessionSummary = typeof sessionSummaries.$inferInsert;
export type SessionMemory = typeof sessionMemories.$inferSelect;
export type NewSessionMemory = typeof sessionMemories.$inferInsert;
export type MemoryEmbedding = typeof memoryEmbeddings.$inferSelect;
export type NewMemoryEmbedding = typeof memoryEmbeddings.$inferInsert;

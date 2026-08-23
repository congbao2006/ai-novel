import {
  check,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identity.js";
import {
  factionStatusEnum,
  storyCharacterTypeEnum,
  storyStatusEnum,
  storyVersionStatusEnum
} from "./enums.js";

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull(),
    genre: text("genre").notNull(),
    status: storyStatusEnum("status").notNull().default("draft"),
    worldPrompt: text("world_prompt").notNull(),
    openingPrompt: text("opening_prompt").notNull(),
    settings: jsonb("settings")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    currentPublishedVersionId: uuid("current_published_version_id"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade"
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [index("stories_status_idx").on(table.status)]
);

export const storyVersions = pgTable(
  "story_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    versionNumber: integer("version_number").notNull(),
    status: storyVersionStatusEnum("status").notNull().default("published"),
    worldPrompt: text("world_prompt").notNull(),
    openingPrompt: text("opening_prompt").notNull(),
    settings: jsonb("settings")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade"
    }),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("story_versions_story_number_unique").on(
      table.storyId,
      table.versionNumber
    ),
    index("story_versions_story_status_idx").on(table.storyId, table.status),
    check("story_versions_number_positive", sql`${table.versionNumber} > 0`)
  ]
);

export const storyVersionCharacters = pgTable(
  "story_version_characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyVersionId: uuid("story_version_id")
      .notNull()
      .references(() => storyVersions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    sourceCharacterId: uuid("source_character_id").references(
      () => storyCharacters.id,
      {
        onDelete: "set null",
        onUpdate: "cascade"
      }
    ),
    name: text("name").notNull(),
    characterType: storyCharacterTypeEnum("character_type")
      .notNull()
      .default("playable"),
    description: text("description").notNull(),
    personality: text("personality").notNull(),
    background: text("background").notNull(),
    goals: jsonb("goals").$type<unknown[]>().notNull().default([]),
    secrets: jsonb("secrets").$type<Record<string, unknown>>().notNull().default({}),
    initialState: jsonb("initial_state")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    initialLocation: text("initial_location"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    initialStats: jsonb("initial_stats")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    index("story_version_characters_version_idx").on(table.storyVersionId),
    index("story_version_characters_version_type_idx").on(
      table.storyVersionId,
      table.characterType
    )
  ]
);

export const storyCharacters = pgTable(
  "story_characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    name: text("name").notNull(),
    characterType: storyCharacterTypeEnum("character_type")
      .notNull()
      .default("playable"),
    description: text("description").notNull(),
    personality: text("personality").notNull(),
    background: text("background").notNull(),
    goals: jsonb("goals").$type<unknown[]>().notNull().default([]),
    secrets: jsonb("secrets").$type<Record<string, unknown>>().notNull().default({}),
    initialState: jsonb("initial_state")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    initialLocation: text("initial_location"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    initialStats: jsonb("initial_stats")
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
  (table) => [index("story_characters_story_id_idx").on(table.storyId)]
);

export const storyAbilities = pgTable(
  "story_abilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    abilityKey: text("ability_key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull().default("other"),
    rank: integer("rank").notNull().default(1),
    resourceCost: jsonb("resource_cost")
      .$type<Record<string, unknown> | null>()
      .default(null),
    cooldownTurns: integer("cooldown_turns").notNull().default(0),
    tags: jsonb("tags").$type<unknown[]>().notNull().default([]),
    effects: jsonb("effects")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    requirements: jsonb("requirements")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    enabled: boolean("enabled").notNull().default(true),
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
    uniqueIndex("story_abilities_story_key_unique").on(
      table.storyId,
      table.abilityKey
    ),
    index("story_abilities_story_id_idx").on(table.storyId),
    check("story_abilities_key_non_empty", sql`${table.abilityKey} <> ''`),
    check("story_abilities_rank_positive", sql`${table.rank} > 0`),
    check(
      "story_abilities_cooldown_non_negative",
      sql`${table.cooldownTurns} >= 0`
    )
  ]
);

export const storyCharacterAbilities = pgTable(
  "story_character_abilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => storyCharacters.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    abilityId: uuid("ability_id")
      .notNull()
      .references(() => storyAbilities.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    rank: integer("rank").notNull().default(1),
    enabled: boolean("enabled").notNull().default(true),
    unlocked: boolean("unlocked").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("story_character_abilities_character_ability_unique").on(
      table.characterId,
      table.abilityId
    ),
    index("story_character_abilities_story_id_idx").on(table.storyId),
    index("story_character_abilities_character_idx").on(table.characterId),
    check("story_character_abilities_rank_positive", sql`${table.rank} > 0`)
  ]
);

export const storyFactions = pgTable(
  "story_factions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    factionKey: text("faction_key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    initialStatus: factionStatusEnum("initial_status").notNull().default("active"),
    initialInfluence: integer("initial_influence").notNull().default(50),
    resources: jsonb("resources")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    goals: jsonb("goals").$type<unknown[]>().notNull().default([]),
    state: jsonb("state")
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
    uniqueIndex("story_factions_story_key_unique").on(
      table.storyId,
      table.factionKey
    ),
    index("story_factions_story_id_idx").on(table.storyId),
    check("story_factions_key_non_empty", sql`${table.factionKey} <> ''`),
    check(
      "story_factions_initial_influence_range",
      sql`${table.initialInfluence} between 0 and 100`
    )
  ]
);

export const storyFactionRelationships = pgTable(
  "story_faction_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    sourceFactionId: uuid("source_faction_id")
      .notNull()
      .references(() => storyFactions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    targetFactionId: uuid("target_faction_id")
      .notNull()
      .references(() => storyFactions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    affinity: integer("affinity").notNull().default(0),
    tension: integer("tension").notNull().default(0),
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
    uniqueIndex("story_faction_relationships_unique_edge").on(
      table.storyId,
      table.sourceFactionId,
      table.targetFactionId
    ),
    index("story_faction_relationships_story_id_idx").on(table.storyId),
    check(
      "story_faction_relationships_affinity_range",
      sql`${table.affinity} between -100 and 100`
    ),
    check(
      "story_faction_relationships_tension_range",
      sql`${table.tension} between -100 and 100`
    ),
    check(
      "story_faction_relationships_no_self_edge",
      sql`${table.sourceFactionId} <> ${table.targetFactionId}`
    )
  ]
);

export const storyVersionAbilities = pgTable(
  "story_version_abilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyVersionId: uuid("story_version_id")
      .notNull()
      .references(() => storyVersions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    sourceAbilityId: uuid("source_ability_id").references(() => storyAbilities.id, {
      onDelete: "set null",
      onUpdate: "cascade"
    }),
    abilityKey: text("ability_key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull().default("other"),
    rank: integer("rank").notNull().default(1),
    resourceCost: jsonb("resource_cost")
      .$type<Record<string, unknown> | null>()
      .default(null),
    cooldownTurns: integer("cooldown_turns").notNull().default(0),
    tags: jsonb("tags").$type<unknown[]>().notNull().default([]),
    effects: jsonb("effects")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    requirements: jsonb("requirements")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    enabled: boolean("enabled").notNull().default(true),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("story_version_abilities_version_key_unique").on(
      table.storyVersionId,
      table.abilityKey
    ),
    index("story_version_abilities_version_idx").on(table.storyVersionId),
    check("story_version_abilities_key_non_empty", sql`${table.abilityKey} <> ''`),
    check("story_version_abilities_rank_positive", sql`${table.rank} > 0`),
    check(
      "story_version_abilities_cooldown_non_negative",
      sql`${table.cooldownTurns} >= 0`
    )
  ]
);

export const storyVersionCharacterAbilities = pgTable(
  "story_version_character_abilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyVersionId: uuid("story_version_id")
      .notNull()
      .references(() => storyVersions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    versionCharacterId: uuid("version_character_id")
      .notNull()
      .references(() => storyVersionCharacters.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    versionAbilityId: uuid("version_ability_id")
      .notNull()
      .references(() => storyVersionAbilities.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    sourceCharacterAbilityId: uuid("source_character_ability_id").references(
      () => storyCharacterAbilities.id,
      {
        onDelete: "set null",
        onUpdate: "cascade"
      }
    ),
    abilityKey: text("ability_key").notNull(),
    rank: integer("rank").notNull().default(1),
    enabled: boolean("enabled").notNull().default(true),
    unlocked: boolean("unlocked").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("story_version_character_abilities_unique").on(
      table.versionCharacterId,
      table.versionAbilityId
    ),
    index("story_version_character_abilities_version_idx").on(
      table.storyVersionId
    ),
    index("story_version_character_abilities_character_idx").on(
      table.versionCharacterId
    ),
    check(
      "story_version_character_abilities_rank_positive",
      sql`${table.rank} > 0`
    )
  ]
);

export const storyVersionFactions = pgTable(
  "story_version_factions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyVersionId: uuid("story_version_id")
      .notNull()
      .references(() => storyVersions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    sourceFactionId: uuid("source_faction_id").references(() => storyFactions.id, {
      onDelete: "set null",
      onUpdate: "cascade"
    }),
    factionKey: text("faction_key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    initialStatus: factionStatusEnum("initial_status").notNull().default("active"),
    initialInfluence: integer("initial_influence").notNull().default(50),
    resources: jsonb("resources")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    goals: jsonb("goals").$type<unknown[]>().notNull().default([]),
    state: jsonb("state")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("story_version_factions_version_key_unique").on(
      table.storyVersionId,
      table.factionKey
    ),
    index("story_version_factions_version_idx").on(table.storyVersionId),
    check("story_version_factions_key_non_empty", sql`${table.factionKey} <> ''`),
    check(
      "story_version_factions_initial_influence_range",
      sql`${table.initialInfluence} between 0 and 100`
    )
  ]
);

export const storyVersionFactionRelationships = pgTable(
  "story_version_faction_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyVersionId: uuid("story_version_id")
      .notNull()
      .references(() => storyVersions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    sourceVersionFactionId: uuid("source_version_faction_id")
      .notNull()
      .references(() => storyVersionFactions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    targetVersionFactionId: uuid("target_version_faction_id")
      .notNull()
      .references(() => storyVersionFactions.id, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    affinity: integer("affinity").notNull().default(0),
    tension: integer("tension").notNull().default(0),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("story_version_faction_relationships_unique_edge").on(
      table.storyVersionId,
      table.sourceVersionFactionId,
      table.targetVersionFactionId
    ),
    index("story_version_faction_relationships_version_idx").on(
      table.storyVersionId
    ),
    check(
      "story_version_faction_relationships_affinity_range",
      sql`${table.affinity} between -100 and 100`
    ),
    check(
      "story_version_faction_relationships_tension_range",
      sql`${table.tension} between -100 and 100`
    ),
    check(
      "story_version_faction_relationships_no_self_edge",
      sql`${table.sourceVersionFactionId} <> ${table.targetVersionFactionId}`
    )
  ]
);

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type StoryVersion = typeof storyVersions.$inferSelect;
export type NewStoryVersion = typeof storyVersions.$inferInsert;
export type StoryVersionCharacter = typeof storyVersionCharacters.$inferSelect;
export type NewStoryVersionCharacter = typeof storyVersionCharacters.$inferInsert;
export type StoryCharacter = typeof storyCharacters.$inferSelect;
export type NewStoryCharacter = typeof storyCharacters.$inferInsert;
export type StoryAbility = typeof storyAbilities.$inferSelect;
export type NewStoryAbility = typeof storyAbilities.$inferInsert;
export type StoryCharacterAbility =
  typeof storyCharacterAbilities.$inferSelect;
export type NewStoryCharacterAbility =
  typeof storyCharacterAbilities.$inferInsert;
export type StoryFaction = typeof storyFactions.$inferSelect;
export type NewStoryFaction = typeof storyFactions.$inferInsert;
export type StoryFactionRelationship =
  typeof storyFactionRelationships.$inferSelect;
export type NewStoryFactionRelationship =
  typeof storyFactionRelationships.$inferInsert;
export type StoryVersionFaction = typeof storyVersionFactions.$inferSelect;
export type NewStoryVersionFaction = typeof storyVersionFactions.$inferInsert;
export type StoryVersionAbility = typeof storyVersionAbilities.$inferSelect;
export type NewStoryVersionAbility =
  typeof storyVersionAbilities.$inferInsert;
export type StoryVersionCharacterAbility =
  typeof storyVersionCharacterAbilities.$inferSelect;
export type NewStoryVersionCharacterAbility =
  typeof storyVersionCharacterAbilities.$inferInsert;
export type StoryVersionFactionRelationship =
  typeof storyVersionFactionRelationships.$inferSelect;
export type NewStoryVersionFactionRelationship =
  typeof storyVersionFactionRelationships.$inferInsert;

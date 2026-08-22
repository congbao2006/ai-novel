import {
  check,
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
export type StoryFaction = typeof storyFactions.$inferSelect;
export type NewStoryFaction = typeof storyFactions.$inferInsert;
export type StoryFactionRelationship =
  typeof storyFactionRelationships.$inferSelect;
export type NewStoryFactionRelationship =
  typeof storyFactionRelationships.$inferInsert;
export type StoryVersionFaction = typeof storyVersionFactions.$inferSelect;
export type NewStoryVersionFaction = typeof storyVersionFactions.$inferInsert;
export type StoryVersionFactionRelationship =
  typeof storyVersionFactionRelationships.$inferSelect;
export type NewStoryVersionFactionRelationship =
  typeof storyVersionFactionRelationships.$inferInsert;

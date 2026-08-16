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
import { factionStatusEnum, storyCharacterTypeEnum, storyStatusEnum } from "./enums.js";

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

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type StoryCharacter = typeof storyCharacters.$inferSelect;
export type NewStoryCharacter = typeof storyCharacters.$inferInsert;
export type StoryFaction = typeof storyFactions.$inferSelect;
export type NewStoryFaction = typeof storyFactions.$inferInsert;
export type StoryFactionRelationship =
  typeof storyFactionRelationships.$inferSelect;
export type NewStoryFactionRelationship =
  typeof storyFactionRelationships.$inferInsert;

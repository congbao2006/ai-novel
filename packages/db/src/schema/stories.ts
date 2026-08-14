import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";
import { users } from "./identity.js";
import { storyStatusEnum } from "./enums.js";

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
    description: text("description").notNull(),
    personality: text("personality").notNull(),
    background: text("background").notNull(),
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

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type StoryCharacter = typeof storyCharacters.$inferSelect;
export type NewStoryCharacter = typeof storyCharacters.$inferInsert;

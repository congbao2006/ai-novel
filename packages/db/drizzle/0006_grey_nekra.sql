CREATE TYPE "public"."story_character_type" AS ENUM('playable', 'npc');--> statement-breakpoint
CREATE TABLE "story_faction_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"source_faction_id" uuid NOT NULL,
	"target_faction_id" uuid NOT NULL,
	"affinity" integer DEFAULT 0 NOT NULL,
	"tension" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_faction_relationships_affinity_range" CHECK ("story_faction_relationships"."affinity" between -100 and 100),
	CONSTRAINT "story_faction_relationships_tension_range" CHECK ("story_faction_relationships"."tension" between -100 and 100),
	CONSTRAINT "story_faction_relationships_no_self_edge" CHECK ("story_faction_relationships"."source_faction_id" <> "story_faction_relationships"."target_faction_id")
);
--> statement-breakpoint
CREATE TABLE "story_factions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"faction_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"initial_status" "faction_status" DEFAULT 'active' NOT NULL,
	"initial_influence" integer DEFAULT 50 NOT NULL,
	"resources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_factions_key_non_empty" CHECK ("story_factions"."faction_key" <> ''),
	CONSTRAINT "story_factions_initial_influence_range" CHECK ("story_factions"."initial_influence" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "story_characters" ADD COLUMN "character_type" "story_character_type" DEFAULT 'playable' NOT NULL;--> statement-breakpoint
ALTER TABLE "story_characters" ADD COLUMN "goals" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "story_characters" ADD COLUMN "secrets" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "story_characters" ADD COLUMN "initial_state" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "story_characters" ADD COLUMN "initial_location" text;--> statement-breakpoint
ALTER TABLE "story_characters" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "story_faction_relationships" ADD CONSTRAINT "story_faction_relationships_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_faction_relationships" ADD CONSTRAINT "story_faction_relationships_source_faction_id_story_factions_id_fk" FOREIGN KEY ("source_faction_id") REFERENCES "public"."story_factions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_faction_relationships" ADD CONSTRAINT "story_faction_relationships_target_faction_id_story_factions_id_fk" FOREIGN KEY ("target_faction_id") REFERENCES "public"."story_factions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_factions" ADD CONSTRAINT "story_factions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "story_faction_relationships_unique_edge" ON "story_faction_relationships" USING btree ("story_id","source_faction_id","target_faction_id");--> statement-breakpoint
CREATE INDEX "story_faction_relationships_story_id_idx" ON "story_faction_relationships" USING btree ("story_id");--> statement-breakpoint
CREATE UNIQUE INDEX "story_factions_story_key_unique" ON "story_factions" USING btree ("story_id","faction_key");--> statement-breakpoint
CREATE INDEX "story_factions_story_id_idx" ON "story_factions" USING btree ("story_id");
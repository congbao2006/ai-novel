CREATE TYPE "public"."story_version_status" AS ENUM('published', 'retired');--> statement-breakpoint
CREATE TABLE "story_version_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_version_id" uuid NOT NULL,
	"source_character_id" uuid,
	"name" text NOT NULL,
	"character_type" "story_character_type" DEFAULT 'playable' NOT NULL,
	"description" text NOT NULL,
	"personality" text NOT NULL,
	"background" text NOT NULL,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secrets" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"initial_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"initial_location" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"initial_stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_version_faction_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_version_id" uuid NOT NULL,
	"source_version_faction_id" uuid NOT NULL,
	"target_version_faction_id" uuid NOT NULL,
	"affinity" integer DEFAULT 0 NOT NULL,
	"tension" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_version_faction_relationships_affinity_range" CHECK ("story_version_faction_relationships"."affinity" between -100 and 100),
	CONSTRAINT "story_version_faction_relationships_tension_range" CHECK ("story_version_faction_relationships"."tension" between -100 and 100),
	CONSTRAINT "story_version_faction_relationships_no_self_edge" CHECK ("story_version_faction_relationships"."source_version_faction_id" <> "story_version_faction_relationships"."target_version_faction_id")
);
--> statement-breakpoint
CREATE TABLE "story_version_factions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_version_id" uuid NOT NULL,
	"source_faction_id" uuid,
	"faction_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"initial_status" "faction_status" DEFAULT 'active' NOT NULL,
	"initial_influence" integer DEFAULT 50 NOT NULL,
	"resources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_version_factions_key_non_empty" CHECK ("story_version_factions"."faction_key" <> ''),
	CONSTRAINT "story_version_factions_initial_influence_range" CHECK ("story_version_factions"."initial_influence" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "story_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "story_version_status" DEFAULT 'published' NOT NULL,
	"world_prompt" text NOT NULL,
	"opening_prompt" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_versions_number_positive" CHECK ("story_versions"."version_number" > 0)
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "current_published_version_id" uuid;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD COLUMN "story_version_id" uuid;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD COLUMN "selected_version_character_id" uuid;--> statement-breakpoint
ALTER TABLE "story_version_characters" ADD CONSTRAINT "story_version_characters_story_version_id_story_versions_id_fk" FOREIGN KEY ("story_version_id") REFERENCES "public"."story_versions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_version_characters" ADD CONSTRAINT "story_version_characters_source_character_id_story_characters_id_fk" FOREIGN KEY ("source_character_id") REFERENCES "public"."story_characters"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_version_faction_relationships" ADD CONSTRAINT "story_version_faction_relationships_story_version_id_story_versions_id_fk" FOREIGN KEY ("story_version_id") REFERENCES "public"."story_versions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_version_faction_relationships" ADD CONSTRAINT "story_version_faction_relationships_source_version_faction_id_story_version_factions_id_fk" FOREIGN KEY ("source_version_faction_id") REFERENCES "public"."story_version_factions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_version_faction_relationships" ADD CONSTRAINT "story_version_faction_relationships_target_version_faction_id_story_version_factions_id_fk" FOREIGN KEY ("target_version_faction_id") REFERENCES "public"."story_version_factions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_version_factions" ADD CONSTRAINT "story_version_factions_story_version_id_story_versions_id_fk" FOREIGN KEY ("story_version_id") REFERENCES "public"."story_versions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_version_factions" ADD CONSTRAINT "story_version_factions_source_faction_id_story_factions_id_fk" FOREIGN KEY ("source_faction_id") REFERENCES "public"."story_factions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_versions" ADD CONSTRAINT "story_versions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_versions" ADD CONSTRAINT "story_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "story_version_characters_version_idx" ON "story_version_characters" USING btree ("story_version_id");--> statement-breakpoint
CREATE INDEX "story_version_characters_version_type_idx" ON "story_version_characters" USING btree ("story_version_id","character_type");--> statement-breakpoint
CREATE UNIQUE INDEX "story_version_faction_relationships_unique_edge" ON "story_version_faction_relationships" USING btree ("story_version_id","source_version_faction_id","target_version_faction_id");--> statement-breakpoint
CREATE INDEX "story_version_faction_relationships_version_idx" ON "story_version_faction_relationships" USING btree ("story_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "story_version_factions_version_key_unique" ON "story_version_factions" USING btree ("story_version_id","faction_key");--> statement-breakpoint
CREATE INDEX "story_version_factions_version_idx" ON "story_version_factions" USING btree ("story_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "story_versions_story_number_unique" ON "story_versions" USING btree ("story_id","version_number");--> statement-breakpoint
CREATE INDEX "story_versions_story_status_idx" ON "story_versions" USING btree ("story_id","status");--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_story_version_id_story_versions_id_fk" FOREIGN KEY ("story_version_id") REFERENCES "public"."story_versions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_selected_version_character_id_story_version_characters_id_fk" FOREIGN KEY ("selected_version_character_id") REFERENCES "public"."story_version_characters"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "game_sessions_story_version_id_idx" ON "game_sessions" USING btree ("story_version_id");
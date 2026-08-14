CREATE TYPE "public"."entity_type" AS ENUM('player', 'npc');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('system', 'player', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."quest_status" AS ENUM('inactive', 'active', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."story_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"genre" text NOT NULL,
	"status" "story_status" DEFAULT 'draft' NOT NULL,
	"world_prompt" text NOT NULL,
	"opening_prompt" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "story_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"personality" text NOT NULL,
	"background" text NOT NULL,
	"initial_stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"turn_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_messages_turn_number_non_negative" CHECK ("game_messages"."turn_number" >= 0)
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"selected_character_id" uuid,
	"title" text,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"turn_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_played_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_sessions_turn_count_non_negative" CHECK ("game_sessions"."turn_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "game_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"location" text NOT NULL,
	"world_time" text,
	"player_stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_states_version_positive" CHECK ("game_states"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"owner_type" "entity_type" NOT NULL,
	"owner_id" uuid,
	"item_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_quantity_positive" CHECK ("inventory_items"."quantity" > 0),
	CONSTRAINT "inventory_items_owner_identity_shape" CHECK (("inventory_items"."owner_type" = 'player' and "inventory_items"."owner_id" is null) or ("inventory_items"."owner_type" = 'npc' and "inventory_items"."owner_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "npcs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"template_character_id" uuid,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"personality" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secrets" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"current_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"alive" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"quest_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "quest_status" DEFAULT 'inactive' NOT NULL,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"source_type" "entity_type" NOT NULL,
	"source_id" uuid,
	"target_type" "entity_type" NOT NULL,
	"target_id" uuid,
	"affinity" integer DEFAULT 0 NOT NULL,
	"trust" integer DEFAULT 0 NOT NULL,
	"fear" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relationships_affinity_range" CHECK ("relationships"."affinity" between -100 and 100),
	CONSTRAINT "relationships_trust_range" CHECK ("relationships"."trust" between -100 and 100),
	CONSTRAINT "relationships_fear_range" CHECK ("relationships"."fear" between 0 and 100),
	CONSTRAINT "relationships_source_identity_shape" CHECK (("relationships"."source_type" = 'player' and "relationships"."source_id" is null) or ("relationships"."source_type" = 'npc' and "relationships"."source_id" is not null)),
	CONSTRAINT "relationships_target_identity_shape" CHECK (("relationships"."target_type" = 'player' and "relationships"."target_id" is null) or ("relationships"."target_type" = 'npc' and "relationships"."target_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "world_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"importance" integer DEFAULT 3 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"turn_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "world_events_importance_range" CHECK ("world_events"."importance" between 1 and 5),
	CONSTRAINT "world_events_turn_number_non_negative" CHECK ("world_events"."turn_number" >= 0)
);
--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_characters" ADD CONSTRAINT "story_characters_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "game_messages" ADD CONSTRAINT "game_messages_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_selected_character_id_story_characters_id_fk" FOREIGN KEY ("selected_character_id") REFERENCES "public"."story_characters"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "game_states" ADD CONSTRAINT "game_states_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "npcs" ADD CONSTRAINT "npcs_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "npcs" ADD CONSTRAINT "npcs_template_character_id_story_characters_id_fk" FOREIGN KEY ("template_character_id") REFERENCES "public"."story_characters"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "world_events" ADD CONSTRAINT "world_events_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "stories_status_idx" ON "stories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "story_characters_story_id_idx" ON "story_characters" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "game_messages_session_turn_idx" ON "game_messages" USING btree ("session_id","turn_number");--> statement-breakpoint
CREATE INDEX "game_sessions_user_id_idx" ON "game_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "game_sessions_story_id_idx" ON "game_sessions" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "game_sessions_status_idx" ON "game_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "game_sessions_last_played_at_idx" ON "game_sessions" USING btree ("last_played_at");--> statement-breakpoint
CREATE UNIQUE INDEX "game_states_session_id_unique" ON "game_states" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "inventory_items_session_owner_idx" ON "inventory_items" USING btree ("session_id","owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "inventory_items_session_item_key_idx" ON "inventory_items" USING btree ("session_id","item_key");--> statement-breakpoint
CREATE INDEX "npcs_session_id_idx" ON "npcs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "npcs_template_character_id_idx" ON "npcs" USING btree ("template_character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quests_session_quest_key_unique" ON "quests" USING btree ("session_id","quest_key");--> statement-breakpoint
CREATE INDEX "quests_session_status_idx" ON "quests" USING btree ("session_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "relationships_unique_edge_idx" ON "relationships" USING btree ("session_id","source_type",coalesce("source_id", '00000000-0000-0000-0000-000000000000'::uuid),"target_type",coalesce("target_id", '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
CREATE INDEX "relationships_session_source_idx" ON "relationships" USING btree ("session_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "relationships_session_target_idx" ON "relationships" USING btree ("session_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "world_events_session_turn_idx" ON "world_events" USING btree ("session_id","turn_number");--> statement-breakpoint
CREATE INDEX "world_events_session_importance_idx" ON "world_events" USING btree ("session_id","importance");
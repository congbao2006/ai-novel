CREATE TYPE "public"."faction_status" AS ENUM('active', 'weakened', 'collapsed', 'hidden');--> statement-breakpoint
CREATE TABLE "faction_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"source_faction_id" uuid NOT NULL,
	"target_faction_id" uuid NOT NULL,
	"affinity" integer DEFAULT 0 NOT NULL,
	"tension" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faction_relationships_affinity_range" CHECK ("faction_relationships"."affinity" between -100 and 100),
	CONSTRAINT "faction_relationships_tension_range" CHECK ("faction_relationships"."tension" between -100 and 100),
	CONSTRAINT "faction_relationships_no_self_edge" CHECK ("faction_relationships"."source_faction_id" <> "faction_relationships"."target_faction_id")
);
--> statement-breakpoint
CREATE TABLE "factions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"faction_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"status" "faction_status" DEFAULT 'active' NOT NULL,
	"influence" integer DEFAULT 50 NOT NULL,
	"resources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "factions_influence_range" CHECK ("factions"."influence" between 0 and 100),
	CONSTRAINT "factions_key_non_empty" CHECK ("factions"."faction_key" <> '')
);
--> statement-breakpoint
CREATE TABLE "world_simulation_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"last_tick_turn" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "world_simulation_states_last_tick_non_negative" CHECK ("world_simulation_states"."last_tick_turn" >= 0),
	CONSTRAINT "world_simulation_states_version_positive" CHECK ("world_simulation_states"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "faction_relationships" ADD CONSTRAINT "faction_relationships_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "faction_relationships" ADD CONSTRAINT "faction_relationships_source_faction_id_factions_id_fk" FOREIGN KEY ("source_faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "faction_relationships" ADD CONSTRAINT "faction_relationships_target_faction_id_factions_id_fk" FOREIGN KEY ("target_faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "world_simulation_states" ADD CONSTRAINT "world_simulation_states_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "faction_relationships_unique_edge_idx" ON "faction_relationships" USING btree ("session_id","source_faction_id","target_faction_id");--> statement-breakpoint
CREATE INDEX "faction_relationships_session_source_idx" ON "faction_relationships" USING btree ("session_id","source_faction_id");--> statement-breakpoint
CREATE INDEX "faction_relationships_session_target_idx" ON "faction_relationships" USING btree ("session_id","target_faction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "factions_session_key_unique" ON "factions" USING btree ("session_id","faction_key");--> statement-breakpoint
CREATE INDEX "factions_session_status_idx" ON "factions" USING btree ("session_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "world_simulation_states_session_unique" ON "world_simulation_states" USING btree ("session_id");
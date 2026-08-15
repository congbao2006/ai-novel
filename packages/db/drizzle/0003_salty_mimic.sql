CREATE TYPE "public"."memory_type" AS ENUM('fact', 'relationship', 'event', 'player', 'world', 'npc', 'quest', 'other');--> statement-breakpoint
CREATE TABLE "session_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"memory_type" "memory_type" DEFAULT 'other' NOT NULL,
	"subject_type" text,
	"subject_id" uuid,
	"key" text,
	"content" text NOT NULL,
	"importance" integer DEFAULT 3 NOT NULL,
	"first_observed_turn" integer,
	"last_confirmed_turn" integer,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_memories_importance_range" CHECK ("session_memories"."importance" between 1 and 5),
	CONSTRAINT "session_memories_first_observed_non_negative" CHECK ("session_memories"."first_observed_turn" is null or "session_memories"."first_observed_turn" >= 0),
	CONSTRAINT "session_memories_last_confirmed_non_negative" CHECK ("session_memories"."last_confirmed_turn" is null or "session_memories"."last_confirmed_turn" >= 0)
);
--> statement-breakpoint
CREATE TABLE "session_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"summary_text" text NOT NULL,
	"summarized_through_turn" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_summaries_summarized_turn_non_negative" CHECK ("session_summaries"."summarized_through_turn" >= 0),
	CONSTRAINT "session_summaries_version_positive" CHECK ("session_summaries"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "session_memories" ADD CONSTRAINT "session_memories_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "session_memories_session_active_idx" ON "session_memories" USING btree ("session_id","active");--> statement-breakpoint
CREATE INDEX "session_memories_session_importance_idx" ON "session_memories" USING btree ("session_id","importance");--> statement-breakpoint
CREATE INDEX "session_memories_session_memory_type_idx" ON "session_memories" USING btree ("session_id","memory_type");--> statement-breakpoint
CREATE INDEX "session_memories_session_last_confirmed_idx" ON "session_memories" USING btree ("session_id","last_confirmed_turn");--> statement-breakpoint
CREATE UNIQUE INDEX "session_memories_session_key_unique" ON "session_memories" USING btree ("session_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "session_summaries_session_id_unique" ON "session_summaries" USING btree ("session_id");
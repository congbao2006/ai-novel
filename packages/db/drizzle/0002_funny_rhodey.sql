CREATE TYPE "public"."ai_usage_purpose" AS ENUM('gameplay_turn', 'smoke', 'summary', 'npc', 'memory', 'other');--> statement-breakpoint
CREATE TYPE "public"."ai_usage_status" AS ENUM('success', 'failed');--> statement-breakpoint
CREATE TABLE "ai_usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"purpose" "ai_usage_purpose" DEFAULT 'other' NOT NULL,
	"status" "ai_usage_status" NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"estimated_cost_micros" bigint,
	"latency_ms" integer,
	"provider_request_id" text,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_records_input_tokens_non_negative" CHECK ("ai_usage_records"."input_tokens" is null or "ai_usage_records"."input_tokens" >= 0),
	CONSTRAINT "ai_usage_records_output_tokens_non_negative" CHECK ("ai_usage_records"."output_tokens" is null or "ai_usage_records"."output_tokens" >= 0),
	CONSTRAINT "ai_usage_records_total_tokens_non_negative" CHECK ("ai_usage_records"."total_tokens" is null or "ai_usage_records"."total_tokens" >= 0),
	CONSTRAINT "ai_usage_records_estimated_cost_non_negative" CHECK ("ai_usage_records"."estimated_cost_micros" is null or "ai_usage_records"."estimated_cost_micros" >= 0),
	CONSTRAINT "ai_usage_records_latency_non_negative" CHECK ("ai_usage_records"."latency_ms" is null or "ai_usage_records"."latency_ms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ai_usage_records" ADD CONSTRAINT "ai_usage_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ai_usage_records" ADD CONSTRAINT "ai_usage_records_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "ai_usage_records_user_created_at_idx" ON "ai_usage_records" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_records_session_created_at_idx" ON "ai_usage_records" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_records_provider_model_created_at_idx" ON "ai_usage_records" USING btree ("provider","model","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_records_purpose_created_at_idx" ON "ai_usage_records" USING btree ("purpose","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_records_status_created_at_idx" ON "ai_usage_records" USING btree ("status","created_at");
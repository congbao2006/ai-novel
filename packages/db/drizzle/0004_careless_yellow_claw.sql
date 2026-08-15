CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TYPE "public"."ai_usage_purpose" ADD VALUE 'embedding' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "memory_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"dimensions" integer NOT NULL,
	"embedding" vector NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memory_embeddings_dimensions_positive" CHECK ("memory_embeddings"."dimensions" > 0),
	CONSTRAINT "memory_embeddings_content_hash_non_empty" CHECK ("memory_embeddings"."content_hash" <> '')
);
--> statement-breakpoint
ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_memory_id_session_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."session_memories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "memory_embeddings_memory_provider_model_unique" ON "memory_embeddings" USING btree ("memory_id","provider","model");--> statement-breakpoint
CREATE INDEX "memory_embeddings_memory_id_idx" ON "memory_embeddings" USING btree ("memory_id");--> statement-breakpoint
CREATE INDEX "memory_embeddings_provider_model_idx" ON "memory_embeddings" USING btree ("provider","model");

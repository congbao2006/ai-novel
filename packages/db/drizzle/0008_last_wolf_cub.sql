CREATE TABLE "story_abilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"ability_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"rank" integer DEFAULT 1 NOT NULL,
	"resource_cost" jsonb DEFAULT 'null'::jsonb,
	"cooldown_turns" integer DEFAULT 0 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"effects" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_abilities_key_non_empty" CHECK ("story_abilities"."ability_key" <> ''),
	CONSTRAINT "story_abilities_rank_positive" CHECK ("story_abilities"."rank" > 0),
	CONSTRAINT "story_abilities_cooldown_non_negative" CHECK ("story_abilities"."cooldown_turns" >= 0)
);
--> statement-breakpoint
CREATE TABLE "story_character_abilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"ability_id" uuid NOT NULL,
	"rank" integer DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"unlocked" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_character_abilities_rank_positive" CHECK ("story_character_abilities"."rank" > 0)
);
--> statement-breakpoint
CREATE TABLE "story_version_abilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_version_id" uuid NOT NULL,
	"source_ability_id" uuid,
	"ability_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"rank" integer DEFAULT 1 NOT NULL,
	"resource_cost" jsonb DEFAULT 'null'::jsonb,
	"cooldown_turns" integer DEFAULT 0 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"effects" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_version_abilities_key_non_empty" CHECK ("story_version_abilities"."ability_key" <> ''),
	CONSTRAINT "story_version_abilities_rank_positive" CHECK ("story_version_abilities"."rank" > 0),
	CONSTRAINT "story_version_abilities_cooldown_non_negative" CHECK ("story_version_abilities"."cooldown_turns" >= 0)
);
--> statement-breakpoint
CREATE TABLE "story_version_character_abilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_version_id" uuid NOT NULL,
	"version_character_id" uuid NOT NULL,
	"version_ability_id" uuid NOT NULL,
	"source_character_ability_id" uuid,
	"ability_key" text NOT NULL,
	"rank" integer DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"unlocked" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_version_character_abilities_rank_positive" CHECK ("story_version_character_abilities"."rank" > 0)
);
--> statement-breakpoint
ALTER TABLE "story_abilities" ADD CONSTRAINT "story_abilities_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_character_abilities" ADD CONSTRAINT "story_character_abilities_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_character_abilities" ADD CONSTRAINT "story_character_abilities_character_id_story_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."story_characters"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_character_abilities" ADD CONSTRAINT "story_character_abilities_ability_id_story_abilities_id_fk" FOREIGN KEY ("ability_id") REFERENCES "public"."story_abilities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_version_abilities" ADD CONSTRAINT "story_version_abilities_story_version_id_story_versions_id_fk" FOREIGN KEY ("story_version_id") REFERENCES "public"."story_versions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_version_abilities" ADD CONSTRAINT "story_version_abilities_source_ability_id_story_abilities_id_fk" FOREIGN KEY ("source_ability_id") REFERENCES "public"."story_abilities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_version_character_abilities" ADD CONSTRAINT "story_version_character_abilities_story_version_id_story_versions_id_fk" FOREIGN KEY ("story_version_id") REFERENCES "public"."story_versions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_version_character_abilities" ADD CONSTRAINT "story_version_character_abilities_version_character_id_story_version_characters_id_fk" FOREIGN KEY ("version_character_id") REFERENCES "public"."story_version_characters"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_version_character_abilities" ADD CONSTRAINT "story_version_character_abilities_version_ability_id_story_version_abilities_id_fk" FOREIGN KEY ("version_ability_id") REFERENCES "public"."story_version_abilities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "story_version_character_abilities" ADD CONSTRAINT "story_version_character_abilities_source_character_ability_id_story_character_abilities_id_fk" FOREIGN KEY ("source_character_ability_id") REFERENCES "public"."story_character_abilities"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "story_abilities_story_key_unique" ON "story_abilities" USING btree ("story_id","ability_key");--> statement-breakpoint
CREATE INDEX "story_abilities_story_id_idx" ON "story_abilities" USING btree ("story_id");--> statement-breakpoint
CREATE UNIQUE INDEX "story_character_abilities_character_ability_unique" ON "story_character_abilities" USING btree ("character_id","ability_id");--> statement-breakpoint
CREATE INDEX "story_character_abilities_story_id_idx" ON "story_character_abilities" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "story_character_abilities_character_idx" ON "story_character_abilities" USING btree ("character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "story_version_abilities_version_key_unique" ON "story_version_abilities" USING btree ("story_version_id","ability_key");--> statement-breakpoint
CREATE INDEX "story_version_abilities_version_idx" ON "story_version_abilities" USING btree ("story_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "story_version_character_abilities_unique" ON "story_version_character_abilities" USING btree ("version_character_id","version_ability_id");--> statement-breakpoint
CREATE INDEX "story_version_character_abilities_version_idx" ON "story_version_character_abilities" USING btree ("story_version_id");--> statement-breakpoint
CREATE INDEX "story_version_character_abilities_character_idx" ON "story_version_character_abilities" USING btree ("version_character_id");
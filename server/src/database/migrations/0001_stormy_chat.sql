CREATE TABLE "research_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"body" text NOT NULL,
	"is_system_default" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "matter_field_definitions" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
-- Data fix: these 8 profile fields were seeded with system_field=false before this
-- migration, which disagreed with this table's own doc comment and would have let
-- the new admin UI delete/rename them. Bring already-seeded rows in line with the
-- corrected seed data (fieldDefinitionRepository.ts) now that all 10 profile fields
-- plus the 16 AI-classified fields are meant to be protected system rows.
UPDATE "matter_field_definitions" SET "system_field" = true
WHERE "field_key" IN ('matter_name', 'client_name', 'matter_description', 'matter_status', 'matter_value', 'currency', 'start_date', 'completion_date');
CREATE TABLE "matter_dashboard_projections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid NOT NULL,
	"markdown_version_id" uuid NOT NULL,
	"markdown_hash" text NOT NULL,
	"projection_schema_version" text NOT NULL,
	"projection_json" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"generated_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matter_dashboard_projections_version_schema_key" UNIQUE("matter_id","markdown_version_id","projection_schema_version")
);
--> statement-breakpoint
ALTER TABLE "matter_knowledge_versions" ADD COLUMN "citation_registry" jsonb;--> statement-breakpoint
ALTER TABLE "matter_dashboard_projections" ADD CONSTRAINT "matter_dashboard_projections_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_dashboard_projections" ADD CONSTRAINT "matter_dashboard_projections_markdown_version_id_matter_knowledge_versions_id_fk" FOREIGN KEY ("markdown_version_id") REFERENCES "public"."matter_knowledge_versions"("id") ON DELETE cascade ON UPDATE no action;
CREATE TABLE "matter_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"field_key" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matter_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid NOT NULL,
	"field_id" text NOT NULL,
	"markdown_version_id" uuid NOT NULL,
	"taxonomy_version" text NOT NULL,
	"selected_value_id" text,
	"label" text,
	"confidence" numeric,
	"probabilities" jsonb NOT NULL,
	"classification_status" text NOT NULL,
	"model_deployment" text NOT NULL,
	"classified_at" timestamp with time zone NOT NULL,
	"classification_source" text DEFAULT 'decisions_api' NOT NULL,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matter_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_key" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"data_type" text NOT NULL,
	"allowed_values" jsonb,
	"required" boolean DEFAULT false NOT NULL,
	"editable" boolean DEFAULT true NOT NULL,
	"system_field" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matter_field_definitions_field_key_unique" UNIQUE("field_key")
);
--> statement-breakpoint
CREATE TABLE "matter_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid NOT NULL,
	"field_definition_id" uuid NOT NULL,
	"value" jsonb,
	"value_source" text NOT NULL,
	"confidence" numeric,
	"source_reference" text,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "matter_field_values_matter_field_key" UNIQUE("matter_id","field_definition_id")
);
--> statement-breakpoint
CREATE TABLE "matter_knowledge_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"source" text NOT NULL,
	"research_run_id" text,
	"status" text DEFAULT 'published' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"parent_version_id" uuid,
	"change_summary" text,
	CONSTRAINT "matter_knowledge_versions_matter_version_key" UNIQUE("matter_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "matter_research_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"matter_id" uuid,
	"research_status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"generated_markdown_version_id" uuid,
	"discovered_document_count" integer DEFAULT 0 NOT NULL,
	"reviewed_document_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"model_deployment" text
);
--> statement-breakpoint
CREATE TABLE "matters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"library_id" text,
	"library_id_key" text GENERATED ALWAYS AS (coalesce(library_id, '')) STORED,
	"workspace_name" text,
	"client_name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"current_markdown_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	CONSTRAINT "matters_tenant_library_workspace_key" UNIQUE("tenant_id","library_id_key","workspace_id")
);
--> statement-breakpoint
ALTER TABLE "matter_audit_events" ADD CONSTRAINT "matter_audit_events_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_classifications" ADD CONSTRAINT "matter_classifications_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_classifications" ADD CONSTRAINT "matter_classifications_markdown_version_id_matter_knowledge_versions_id_fk" FOREIGN KEY ("markdown_version_id") REFERENCES "public"."matter_knowledge_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_field_values" ADD CONSTRAINT "matter_field_values_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_field_values" ADD CONSTRAINT "matter_field_values_field_definition_id_matter_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."matter_field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_knowledge_versions" ADD CONSTRAINT "matter_knowledge_versions_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_research_runs" ADD CONSTRAINT "matter_research_runs_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matter_research_runs" ADD CONSTRAINT "matter_research_runs_generated_markdown_version_id_matter_knowledge_versions_id_fk" FOREIGN KEY ("generated_markdown_version_id") REFERENCES "public"."matter_knowledge_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matter_audit_events_matter_idx" ON "matter_audit_events" USING btree ("matter_id","changed_at");--> statement-breakpoint
CREATE INDEX "matter_classifications_matter_field_idx" ON "matter_classifications" USING btree ("matter_id","field_id","classified_at");--> statement-breakpoint
CREATE INDEX "matters_workspace_id_idx" ON "matters" USING btree ("workspace_id");
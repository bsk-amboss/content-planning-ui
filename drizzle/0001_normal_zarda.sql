CREATE TABLE "extracted_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"specialty_slug" text NOT NULL,
	"code" text NOT NULL,
	"category" text,
	"description" text,
	"source" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"specialty_slug" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"workflow_run_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"workflow_run_id" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"approved_by" text,
	"output_summary" jsonb,
	"draft_payload" jsonb,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "specialties" ADD COLUMN "milestones" jsonb;--> statement-breakpoint
ALTER TABLE "extracted_codes" ADD CONSTRAINT "extracted_codes_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_codes" ADD CONSTRAINT "extracted_codes_specialty_slug_specialties_slug_fk" FOREIGN KEY ("specialty_slug") REFERENCES "public"."specialties"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_specialty_slug_specialties_slug_fk" FOREIGN KEY ("specialty_slug") REFERENCES "public"."specialties"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_extracted_codes_run" ON "extracted_codes" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_extracted_codes_specialty" ON "extracted_codes" USING btree ("specialty_slug");--> statement-breakpoint
CREATE INDEX "idx_pipeline_runs_specialty" ON "pipeline_runs" USING btree ("specialty_slug");--> statement-breakpoint
CREATE INDEX "idx_pipeline_stages_run" ON "pipeline_stages" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_pipeline_stages_run_stage" ON "pipeline_stages" USING btree ("run_id","stage");
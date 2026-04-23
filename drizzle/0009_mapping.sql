ALTER TABLE "pipeline_runs" ADD COLUMN "mapping_instructions" text;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "mapping_check_ids" boolean DEFAULT true NOT NULL;

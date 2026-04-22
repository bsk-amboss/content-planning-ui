ALTER TABLE "pipeline_runs" DROP COLUMN IF EXISTS "extraction_system_prompt";--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "identify_modules_instructions" text;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "extract_codes_instructions" text;

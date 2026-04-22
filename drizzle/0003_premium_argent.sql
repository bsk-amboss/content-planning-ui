ALTER TABLE "pipeline_runs" ADD COLUMN "content_outline_urls" jsonb;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "extraction_system_prompt" text;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "milestones_system_prompt" text;--> statement-breakpoint
ALTER TABLE "specialties" DROP COLUMN "content_outline_urls";--> statement-breakpoint
ALTER TABLE "specialties" DROP COLUMN "extraction_system_prompt";--> statement-breakpoint
ALTER TABLE "specialties" DROP COLUMN "milestones_system_prompt";
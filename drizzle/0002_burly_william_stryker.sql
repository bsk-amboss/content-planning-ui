ALTER TABLE "specialties" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "specialties" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "specialties" ADD COLUMN "content_outline_urls" jsonb;--> statement-breakpoint
ALTER TABLE "specialties" ADD COLUMN "extraction_system_prompt" text;--> statement-breakpoint
ALTER TABLE "specialties" ADD COLUMN "milestones_system_prompt" text;
ALTER TABLE "specialties" ALTER COLUMN "milestones" TYPE text USING "milestones"::text;--> statement-breakpoint
ALTER TABLE "pipeline_runs" RENAME COLUMN "milestones_system_prompt" TO "milestones_instructions";

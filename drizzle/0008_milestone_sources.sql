CREATE TABLE IF NOT EXISTS "milestone_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "milestone_sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
INSERT INTO "milestone_sources" ("slug", "name") VALUES
  ('acgme', 'ACGME')
ON CONFLICT ("slug") DO NOTHING;

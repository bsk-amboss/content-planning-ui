CREATE TABLE IF NOT EXISTS "code_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "code_sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
INSERT INTO "code_sources" ("slug", "name") VALUES
  ('ab', 'American Board'),
  ('orphanet', 'Orphanet'),
  ('icd10', 'ICD10')
ON CONFLICT ("slug") DO NOTHING;

CREATE TABLE IF NOT EXISTS "amboss_articles" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "content_base" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "amboss_sections" (
  "id" text PRIMARY KEY NOT NULL,
  "article_id" text NOT NULL,
  "title" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "amboss_sections_article_id_amboss_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "amboss_articles"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_amboss_sections_article" ON "amboss_sections" USING btree ("article_id");

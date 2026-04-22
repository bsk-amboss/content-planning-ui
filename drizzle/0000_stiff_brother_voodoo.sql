CREATE TABLE "abim_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"specialty_slug" text NOT NULL,
	"abim_index" text,
	"primary_category" text,
	"secondary_category" text,
	"tertiary_category" text,
	"disease" text,
	"specialty" text,
	"code" text,
	"item" text,
	"choice" text,
	"category" text,
	"count" integer
);
--> statement-breakpoint
CREATE TABLE "article_update_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"row_index" text,
	"assigned_editor" text,
	"editor_in_the_loop_review" text,
	"new_article" boolean,
	"article_maintenance" boolean,
	"article_title" text,
	"alternate_titles" text,
	"article_progress" text,
	"article_type" text,
	"specialty_name" text,
	"article_id" text,
	"codes" jsonb,
	"literature_search_terms" text,
	"sections" text,
	"previous_article_title_suggestions" jsonb,
	"previous_consolidation_indexes" jsonb,
	"existing_amboss_coverage" text,
	"overall_importance" real,
	"justification" text,
	"is_searched" boolean,
	"llm_search_terms" text,
	"verdict" text,
	"justifcation" text,
	"is_sufficiently_covered" boolean,
	"are_all_sources_fetched" boolean,
	"specialty_slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "code_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"specialty_slug" text NOT NULL,
	"code_category" text,
	"source" text,
	"are_all_codes_run" boolean,
	"is_consolidated" boolean,
	"description" text,
	"num_codes" integer,
	"total_article_codes" integer,
	"total_section_codes" integer,
	"codes_to_ignore" text,
	"num_included_codes" integer,
	"included_article_codes" jsonb,
	"num_included_article_codes" integer,
	"excluded_article_codes" jsonb,
	"num_excluded_article_codes" integer,
	"included_section_codes" jsonb,
	"num_included_section_codes" integer,
	"excluded_section_codes" jsonb,
	"num_excluded_section_codes" integer,
	"totally_ignored_codes" jsonb,
	"num_totally_ignored_codes" integer
);
--> statement-breakpoint
CREATE TABLE "codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"specialty_slug" text NOT NULL,
	"row_index" text,
	"specialty" text,
	"source" text,
	"code" text NOT NULL,
	"category" text,
	"consolidation_category" text,
	"description" text,
	"is_in_amboss" boolean,
	"articles_where_coverage_is" jsonb,
	"notes" text,
	"gaps" text,
	"coverage_level" text,
	"depth_of_coverage" integer,
	"existing_article_updates" jsonb,
	"new_articles_needed" jsonb,
	"improvements" text,
	"metadata" jsonb,
	"full_json_output" jsonb
);
--> statement-breakpoint
CREATE TABLE "consolidated_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"specialty_slug" text NOT NULL,
	"row_index" text,
	"article_title" text,
	"article_type" text,
	"specialty_name" text,
	"category" text,
	"article_id" text,
	"num_codes" integer,
	"codes" jsonb,
	"previous_article_title_suggestions" jsonb,
	"overall_coverage" real,
	"overall_importance" real,
	"justification" text
);
--> statement-breakpoint
CREATE TABLE "consolidated_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"specialty_slug" text NOT NULL,
	"row_index" text,
	"assigned_editor" text,
	"editor_in_the_loop_review" text,
	"article_title" text,
	"article_type" text,
	"article_id" text,
	"section_name" text,
	"new_section" boolean,
	"section_update" boolean,
	"new_phrase" text,
	"specialty_name" text,
	"category" text,
	"unique_title" text,
	"unique_id" text,
	"num_codes" integer,
	"codes" jsonb,
	"previous_section_names" jsonb,
	"does_exist" boolean,
	"section_id" text,
	"overall_coverage" real,
	"overall_importance" real,
	"justification" text,
	"is_searched" boolean,
	"llm_search_terms" text,
	"verdict" text,
	"justifcation" text,
	"is_sufficiently_covered" boolean,
	"are_all_sources_fetched" boolean
);
--> statement-breakpoint
CREATE TABLE "hcup_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"specialty_slug" text NOT NULL,
	"code_category" text,
	"code_category_description" text,
	"icd10_code" text,
	"icd10_code_description" text
);
--> statement-breakpoint
CREATE TABLE "icd10_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"specialty_slug" text NOT NULL,
	"code_category" text,
	"code_category_description" text,
	"icd10_code" text,
	"icd10_code_description" text
);
--> statement-breakpoint
CREATE TABLE "new_article_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"row_index" text,
	"assigned_editor" text,
	"editor_in_the_loop_review" text,
	"new_article" boolean,
	"article_maintenance" boolean,
	"article_title" text,
	"alternate_titles" text,
	"article_progress" text,
	"article_type" text,
	"specialty_name" text,
	"article_id" text,
	"codes" jsonb,
	"literature_search_terms" text,
	"sections" text,
	"previous_article_title_suggestions" jsonb,
	"previous_consolidation_indexes" jsonb,
	"existing_amboss_coverage" text,
	"overall_importance" real,
	"justification" text,
	"is_searched" boolean,
	"llm_search_terms" text,
	"verdict" text,
	"justifcation" text,
	"is_sufficiently_covered" boolean,
	"are_all_sources_fetched" boolean,
	"specialty_slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orpha_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"specialty_slug" text NOT NULL,
	"orpha_code" text,
	"parent_orpha_code" text,
	"specific_name" text,
	"parent_category" text,
	"orpha_target_filenames_to_include" text,
	"icd10_letters_to_include" text,
	"count" integer
);
--> statement-breakpoint
CREATE TABLE "specialties" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"sheet_id" text,
	"xlsx_path" text,
	"last_seeded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "specialty_stats" (
	"specialty_slug" text PRIMARY KEY NOT NULL,
	"total_codes" integer,
	"completed_mappings" integer,
	"icd_total_items" integer,
	"icd_completed_runs" integer,
	"coverage_score_buckets" jsonb,
	"raw" jsonb,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "abim_codes" ADD CONSTRAINT "abim_codes_specialty_slug_specialties_slug_fk" FOREIGN KEY ("specialty_slug") REFERENCES "public"."specialties"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_update_suggestions" ADD CONSTRAINT "article_update_suggestions_specialty_slug_specialties_slug_fk" FOREIGN KEY ("specialty_slug") REFERENCES "public"."specialties"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_categories" ADD CONSTRAINT "code_categories_specialty_slug_specialties_slug_fk" FOREIGN KEY ("specialty_slug") REFERENCES "public"."specialties"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_specialty_slug_specialties_slug_fk" FOREIGN KEY ("specialty_slug") REFERENCES "public"."specialties"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consolidated_articles" ADD CONSTRAINT "consolidated_articles_specialty_slug_specialties_slug_fk" FOREIGN KEY ("specialty_slug") REFERENCES "public"."specialties"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consolidated_sections" ADD CONSTRAINT "consolidated_sections_specialty_slug_specialties_slug_fk" FOREIGN KEY ("specialty_slug") REFERENCES "public"."specialties"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hcup_codes" ADD CONSTRAINT "hcup_codes_specialty_slug_specialties_slug_fk" FOREIGN KEY ("specialty_slug") REFERENCES "public"."specialties"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icd10_codes" ADD CONSTRAINT "icd10_codes_specialty_slug_specialties_slug_fk" FOREIGN KEY ("specialty_slug") REFERENCES "public"."specialties"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "new_article_suggestions" ADD CONSTRAINT "new_article_suggestions_specialty_slug_specialties_slug_fk" FOREIGN KEY ("specialty_slug") REFERENCES "public"."specialties"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orpha_codes" ADD CONSTRAINT "orpha_codes_specialty_slug_specialties_slug_fk" FOREIGN KEY ("specialty_slug") REFERENCES "public"."specialties"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialty_stats" ADD CONSTRAINT "specialty_stats_specialty_slug_specialties_slug_fk" FOREIGN KEY ("specialty_slug") REFERENCES "public"."specialties"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_abim_codes_specialty" ON "abim_codes" USING btree ("specialty_slug");--> statement-breakpoint
CREATE INDEX "idx_article_update_suggestions_specialty" ON "article_update_suggestions" USING btree ("specialty_slug");--> statement-breakpoint
CREATE INDEX "idx_code_categories_specialty" ON "code_categories" USING btree ("specialty_slug");--> statement-breakpoint
CREATE INDEX "idx_codes_specialty" ON "codes" USING btree ("specialty_slug");--> statement-breakpoint
CREATE INDEX "idx_codes_specialty_code" ON "codes" USING btree ("specialty_slug","code");--> statement-breakpoint
CREATE INDEX "idx_codes_specialty_category" ON "codes" USING btree ("specialty_slug","category");--> statement-breakpoint
CREATE INDEX "idx_codes_specialty_consolidation" ON "codes" USING btree ("specialty_slug","consolidation_category");--> statement-breakpoint
CREATE INDEX "idx_consolidated_articles_specialty" ON "consolidated_articles" USING btree ("specialty_slug");--> statement-breakpoint
CREATE INDEX "idx_consolidated_sections_specialty" ON "consolidated_sections" USING btree ("specialty_slug");--> statement-breakpoint
CREATE INDEX "idx_hcup_codes_specialty" ON "hcup_codes" USING btree ("specialty_slug");--> statement-breakpoint
CREATE INDEX "idx_icd10_codes_specialty" ON "icd10_codes" USING btree ("specialty_slug");--> statement-breakpoint
CREATE INDEX "idx_new_article_suggestions_specialty" ON "new_article_suggestions" USING btree ("specialty_slug");--> statement-breakpoint
CREATE INDEX "idx_orpha_codes_specialty" ON "orpha_codes" USING btree ("specialty_slug");
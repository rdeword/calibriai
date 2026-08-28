ALTER TABLE "vacancy_analyses" ADD COLUMN IF NOT EXISTS "role_match" integer;
--> statement-breakpoint
ALTER TABLE "vacancy_analyses" ADD COLUMN IF NOT EXISTS "hh_folder" varchar(16);
--> statement-breakpoint
ALTER TABLE "vacancy_analyses" ADD COLUMN IF NOT EXISTS "hard_filters_passed" integer;
--> statement-breakpoint
ALTER TABLE "vacancy_analyses" ADD COLUMN IF NOT EXISTS "hard_filter_failures" jsonb;
--> statement-breakpoint
ALTER TABLE "vacancy_analyses" ADD COLUMN IF NOT EXISTS "criteria" jsonb;
--> statement-breakpoint
ALTER TABLE "vacancy_analyses" ADD COLUMN IF NOT EXISTS "clarifying_questions" jsonb;

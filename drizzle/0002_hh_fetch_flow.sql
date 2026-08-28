ALTER TABLE "search_settings" ADD COLUMN IF NOT EXISTS "period_days" integer NOT NULL DEFAULT 1;
ALTER TABLE "search_settings" ADD COLUMN IF NOT EXISTS "search_source" varchar(16) NOT NULL DEFAULT 'personal';
ALTER TABLE "search_settings" ADD COLUMN IF NOT EXISTS "hh_resume_id" varchar(128);
ALTER TABLE "search_settings" ADD COLUMN IF NOT EXISTS "hh_resume_title" varchar(255);

CREATE TABLE IF NOT EXISTS "hh_settings" (
  "id" serial PRIMARY KEY,
  "encrypted_cookies" text NOT NULL,
  "iv" varchar(64) NOT NULL,
  "auth_tag" varchar(64) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "search_runs" ADD COLUMN IF NOT EXISTS "run_type" varchar(16) NOT NULL DEFAULT 'fetch';

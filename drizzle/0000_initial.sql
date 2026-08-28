CREATE TYPE "vacancy_status" AS ENUM ('NEW', 'ANALYZING', 'ANALYZED', 'LIKED', 'REJECTED');
CREATE TYPE "run_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'INTERRUPTED');
CREATE TYPE "decision_type" AS ENUM ('LIKED', 'REJECTED');
CREATE TYPE "recommendation_type" AS ENUM ('high', 'medium', 'low');

CREATE TABLE "search_settings" (
  "id" serial PRIMARY KEY, "query" varchar(255) NOT NULL DEFAULT '', "area_id" integer, "salary_from" integer,
  "remote_only" integer NOT NULL DEFAULT 0, "experience" varchar(64), "limit" integer NOT NULL DEFAULT 30,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "ai_settings" (
  "id" serial PRIMARY KEY, "encrypted_api_key" text NOT NULL, "iv" varchar(64) NOT NULL, "auth_tag" varchar(64) NOT NULL,
  "model" varchar(128) NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "resumes" (
  "id" serial PRIMARY KEY, "name" varchar(128) NOT NULL, "text_content" text NOT NULL, "is_active" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "vacancies" (
  "id" serial PRIMARY KEY, "hh_id" varchar(64) NOT NULL, "url" text NOT NULL, "title" text NOT NULL, "employer" text,
  "salary" text, "area" text, "work_format" text, "description" text, "requirements" text, "responsibilities" text,
  "published_at" timestamptz, "first_fetched_at" timestamptz NOT NULL DEFAULT now(), "raw_payload" jsonb,
  "status" "vacancy_status" NOT NULL DEFAULT 'NEW', "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "vacancies_hh_id_unique" ON "vacancies" ("hh_id");
CREATE TABLE "vacancy_analyses" (
  "id" serial PRIMARY KEY, "vacancy_id" integer NOT NULL REFERENCES "vacancies"("id") ON DELETE CASCADE,
  "score" integer NOT NULL, "skills_match" integer NOT NULL, "experience_match" integer NOT NULL, "salary_match" integer NOT NULL,
  "recommendation" "recommendation_type" NOT NULL, "summary" text NOT NULL, "pros" jsonb NOT NULL, "cons" jsonb NOT NULL,
  "red_flags" jsonb NOT NULL, "reasoning" text NOT NULL, "raw_response" jsonb, "model" varchar(128) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "user_decisions" ("id" serial PRIMARY KEY, "vacancy_id" integer NOT NULL REFERENCES "vacancies"("id") ON DELETE CASCADE, "decision" "decision_type" NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "cover_letters" ("id" serial PRIMARY KEY, "vacancy_id" integer NOT NULL REFERENCES "vacancies"("id") ON DELETE CASCADE, "resume_id" integer NOT NULL REFERENCES "resumes"("id"), "content" text NOT NULL, "model" varchar(128) NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "ai_usage" ("id" serial PRIMARY KEY, "operation" varchar(32) NOT NULL, "vacancy_id" integer REFERENCES "vacancies"("id") ON DELETE SET NULL, "model" varchar(128) NOT NULL, "input_tokens" integer NOT NULL, "output_tokens" integer NOT NULL, "estimated_cost" numeric(12,6) NOT NULL DEFAULT '0', "duration_ms" integer NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "search_runs" ("id" serial PRIMARY KEY, "status" "run_status" NOT NULL DEFAULT 'PENDING', "fetched" integer NOT NULL DEFAULT 0, "new_vacancies" integer NOT NULL DEFAULT 0, "analyzed" integer NOT NULL DEFAULT 0, "failed" integer NOT NULL DEFAULT 0, "error_message" text, "started_at" timestamptz, "finished_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now());

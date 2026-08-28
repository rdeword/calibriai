CREATE TABLE IF NOT EXISTS "dismissed_vacancies" (
  "id" serial PRIMARY KEY,
  "hh_id" varchar(64) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "dismissed_vacancies_hh_id_unique" ON "dismissed_vacancies" ("hh_id");

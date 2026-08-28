ALTER TABLE "vacancy_analyses" ADD COLUMN "salary_estimate" text;
ALTER TABLE "vacancy_analyses" ADD COLUMN "salary_estimate_confidence" varchar(16);
ALTER TABLE "vacancy_analyses" ADD COLUMN "salary_estimate_reasoning" text;

import { integer, jsonb, numeric, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const vacancyStatus = pgEnum("vacancy_status", ["NEW", "ANALYZING", "ANALYZED", "LIKED", "REJECTED"]);
export const runStatus = pgEnum("run_status", ["PENDING", "RUNNING", "COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED", "INTERRUPTED"]);
export const decisionType = pgEnum("decision_type", ["LIKED", "REJECTED"]);
export const recommendationType = pgEnum("recommendation_type", ["high", "medium", "low"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const searchSettings = pgTable("search_settings", {
  id: serial("id").primaryKey(),
  query: varchar("query", { length: 255 }).notNull().default(""),
  areaId: integer("area_id"),
  salaryFrom: integer("salary_from"),
  remoteOnly: integer("remote_only").notNull().default(0),
  experience: varchar("experience", { length: 64 }),
  periodDays: integer("period_days").notNull().default(1),
  searchSource: varchar("search_source", { length: 16 }).notNull().default("personal"),
  hhResumeId: varchar("hh_resume_id", { length: 128 }),
  hhResumeTitle: varchar("hh_resume_title", { length: 255 }),
  limit: integer("limit").notNull().default(30),
  ...timestamps,
});

export const hhSettings = pgTable("hh_settings", {
  id: serial("id").primaryKey(),
  encryptedCookies: text("encrypted_cookies").notNull(),
  iv: varchar("iv", { length: 64 }).notNull(),
  authTag: varchar("auth_tag", { length: 64 }).notNull(),
  ...timestamps,
});

export const aiSettings = pgTable("ai_settings", {
  id: serial("id").primaryKey(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  iv: varchar("iv", { length: 64 }).notNull(),
  authTag: varchar("auth_tag", { length: 64 }).notNull(),
  model: varchar("model", { length: 128 }).notNull(),
  ...timestamps,
});

export const resumes = pgTable("resumes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  textContent: text("text_content").notNull(),
  isActive: integer("is_active").notNull().default(0),
  ...timestamps,
});

export const vacancies = pgTable("vacancies", {
  id: serial("id").primaryKey(),
  hhId: varchar("hh_id", { length: 64 }).notNull(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  employer: text("employer"),
  salary: text("salary"),
  area: text("area"),
  workFormat: text("work_format"),
  experience: text("experience"),
  description: text("description"),
  requirements: text("requirements"),
  responsibilities: text("responsibilities"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  firstFetchedAt: timestamp("first_fetched_at", { withTimezone: true }).defaultNow().notNull(),
  rawPayload: jsonb("raw_payload"),
  status: vacancyStatus("status").notNull().default("NEW"),
  ...timestamps,
}, (table) => [uniqueIndex("vacancies_hh_id_unique").on(table.hhId)]);

export const vacancyAnalyses = pgTable("vacancy_analyses", {
  id: serial("id").primaryKey(),
  vacancyId: integer("vacancy_id").notNull().references(() => vacancies.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  skillsMatch: integer("skills_match").notNull(),
  experienceMatch: integer("experience_match").notNull(),
  salaryMatch: integer("salary_match").notNull(),
  roleMatch: integer("role_match"),
  salaryEstimate: text("salary_estimate"),
  salaryEstimateConfidence: varchar("salary_estimate_confidence", { length: 16 }),
  salaryEstimateReasoning: text("salary_estimate_reasoning"),
  recommendation: recommendationType("recommendation").notNull(),
  hhFolder: varchar("hh_folder", { length: 16 }),
  hardFiltersPassed: integer("hard_filters_passed"),
  hardFilterFailures: jsonb("hard_filter_failures"),
  criteria: jsonb("criteria"),
  clarifyingQuestions: jsonb("clarifying_questions"),
  summary: text("summary").notNull(),
  pros: jsonb("pros").notNull(),
  cons: jsonb("cons").notNull(),
  redFlags: jsonb("red_flags").notNull(),
  reasoning: text("reasoning").notNull(),
  rawResponse: jsonb("raw_response"),
  model: varchar("model", { length: 128 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userDecisions = pgTable("user_decisions", {
  id: serial("id").primaryKey(),
  vacancyId: integer("vacancy_id").notNull().references(() => vacancies.id, { onDelete: "cascade" }),
  decision: decisionType("decision").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const coverLetters = pgTable("cover_letters", {
  id: serial("id").primaryKey(),
  vacancyId: integer("vacancy_id").notNull().references(() => vacancies.id, { onDelete: "cascade" }),
  resumeId: integer("resume_id").notNull().references(() => resumes.id),
  content: text("content").notNull(),
  model: varchar("model", { length: 128 }).notNull(),
  ...timestamps,
});

export const aiUsage = pgTable("ai_usage", {
  id: serial("id").primaryKey(),
  operation: varchar("operation", { length: 32 }).notNull(),
  vacancyId: integer("vacancy_id").references(() => vacancies.id, { onDelete: "set null" }),
  model: varchar("model", { length: 128 }).notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 6 }).notNull().default("0"),
  durationMs: integer("duration_ms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const searchRuns = pgTable("search_runs", {
  id: serial("id").primaryKey(),
  runType: varchar("run_type", { length: 16 }).notNull().default("fetch"),
  status: runStatus("status").notNull().default("PENDING"),
  fetched: integer("fetched").notNull().default(0),
  newVacancies: integer("new_vacancies").notNull().default(0),
  analyzed: integer("analyzed").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const dismissedVacancies = pgTable("dismissed_vacancies", {
  id: serial("id").primaryKey(),
  hhId: varchar("hh_id", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("dismissed_vacancies_hh_id_unique").on(table.hhId)]);

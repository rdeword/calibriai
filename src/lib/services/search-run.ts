import { experienceText, searchHhVacancies } from "@/lib/hh/client";
import { fetchPersonalVacancies, getVacancyDetails } from "@/lib/hh/session-client";
import { analyzeWithOpenAi } from "@/lib/openai/client";
import { vacancyAnalysisPrompt } from "@/lib/prompts/vacancy-analysis";
import {
  createSearchRun,
  createUsage,
  createVacancy,
  getActiveResume,
  getHhConnectionStatus,
  getSearchSettings,
  getVacancy,
  getVacancyByHhId,
  listDismissedHhIds,
  saveAnalysis,
  updateSearchRun,
} from "@/lib/db/queries";
import { db } from "@/lib/db";
import { vacancies } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

const fetchRunners = new Set<number>();
const analyzeRunners = new Set<number>();

function vacancyText(v: {
  title: string;
  employer: string | null;
  salary: string | null;
  area: string | null;
  workFormat: string | null;
  experience?: string | null;
  description: string | null;
  requirements: string | null;
  responsibilities: string | null;
}) {
  return [
    `Название: ${v.title}`,
    `Компания: ${v.employer ?? "не указана"}`,
    `Зарплата: ${v.salary ?? "не указана"}`,
    `Регион: ${v.area ?? "не указан"}`,
    `Формат: ${v.workFormat ?? "не указан"}`,
    `Опыт: ${v.experience ?? "не указан"}`,
    `Описание: ${v.description ?? ""}`,
    `Требования: ${v.requirements ?? ""}`,
    `Обязанности: ${v.responsibilities ?? ""}`,
  ].join("\n");
}

export async function reanalyzeVacancy(vacancyId: number) {
  const [vacancy, resume, settings] = await Promise.all([getVacancy(vacancyId), getActiveResume(), getSearchSettings()]);
  if (!vacancy) throw new Error("Вакансия не найдена.");
  if (!resume) throw new Error("Сначала добавьте и выберите активное резюме.");
  const response = await analyzeWithOpenAi(
    vacancyAnalysisPrompt({
      resume: resume.textContent,
      preferences: settings
        ? `Желаемая должность: ${settings.query}; зарплата от: ${settings.salaryFrom ?? "не задана"}; опыт: ${settings.experience ?? "не задан"}; только удалённо: ${settings.remoteOnly ? "да" : "нет"}`
        : "Не заданы",
      vacancy: vacancyText(vacancy),
    }),
  );
  await saveAnalysis(vacancyId, {
    score: response.analysis.score,
    skillsMatch: response.analysis.skills_match,
    experienceMatch: response.analysis.experience_match,
    salaryMatch: response.analysis.salary_match,
    roleMatch: response.analysis.role_match,
    salaryEstimate: response.analysis.salary_estimate,
    salaryEstimateConfidence: response.analysis.salary_estimate_confidence,
    salaryEstimateReasoning: response.analysis.salary_estimate_reasoning,
    recommendation: response.analysis.recommendation,
    hhFolder: response.analysis.hh_folder,
    hardFiltersPassed: response.analysis.hard_filters_passed ? 1 : 0,
    hardFilterFailures: response.analysis.hard_filter_failures,
    criteria: response.analysis.criteria,
    clarifyingQuestions: response.analysis.clarifying_questions,
    summary: response.analysis.summary,
    pros: response.analysis.pros,
    cons: response.analysis.cons,
    redFlags: response.analysis.red_flags,
    reasoning: response.analysis.reasoning,
    rawResponse: response.raw,
    model: response.model,
  });
  await createUsage({
    operation: "vacancy_analysis",
    vacancyId,
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    estimatedCost: String(response.estimatedCost ?? 0),
    durationMs: response.durationMs,
  });
}

export async function startFetchRun() {
  const settings = await getSearchSettings();
  if (!settings) throw new Error("Сначала задайте фильтры загрузки.");

  if (settings.searchSource === "personal") {
    const hh = await getHhConnectionStatus();
    if (!hh.configured) throw new Error("Для персональной выдачи сохраните куки HH.");
    if (!settings.hhResumeId) throw new Error("Выберите резюме HH для персональной выдачи.");
  }

  const run = await createSearchRun("fetch");
  void executeFetchRun(run.id);
  return run;
}

async function executeFetchRun(runId: number) {
  if (fetchRunners.has(runId)) return;
  fetchRunners.add(runId);
  try {
    await updateSearchRun(runId, { status: "RUNNING", startedAt: new Date(), analyzed: 0, failed: 0 });
    const settings = await getSearchSettings();
    if (!settings) throw new Error("Настройки загрузки не найдены.");

    const items =
      settings.searchSource === "personal"
        ? await fetchPersonalVacancies()
        : await (async () => {
            const raw = await searchHhVacancies(settings);
            const detailed = [];
            for (const item of raw) {
              try {
                detailed.push(
                  await getVacancyDetails(String(item.id), {
                    hhId: String(item.id),
                    url: item.alternate_url,
                    title: item.name,
                    employer: item.employer?.name ?? null,
                    salary: null,
                    area: item.area?.name ?? null,
                    workFormat: item.schedule?.name ?? null,
                    experience: experienceText(item.experience),
                    description: null,
                    requirements: null,
                    responsibilities: null,
                    publishedAt: item.published_at ? new Date(item.published_at) : null,
                    rawPayload: item,
                  }),
                );
              } catch {
                // skip broken vacancy
              }
            }
            return detailed;
          })();

    await updateSearchRun(runId, { fetched: items.length });

    const dismissed = await listDismissedHhIds();
    let newCount = 0;
    for (const item of items) {
      if (!item || dismissed.has(item.hhId) || (await getVacancyByHhId(item.hhId))) continue;
      await createVacancy({ ...item, status: "NEW" });
      newCount++;
      await updateSearchRun(runId, { newVacancies: newCount });
    }

    await updateSearchRun(runId, { status: "COMPLETED", finishedAt: new Date() });
  } catch (error) {
    await updateSearchRun(runId, {
      status: "FAILED",
      errorMessage: error instanceof Error ? error.message : "Неизвестная ошибка",
      finishedAt: new Date(),
    });
  } finally {
    fetchRunners.delete(runId);
  }
}

export async function startAnalysisRun(vacancyIds: number[]) {
  const resume = await getActiveResume();
  if (!resume) throw new Error("Добавьте и выберите активное резюме.");
  if (!vacancyIds.length) throw new Error("Выберите хотя бы одну вакансию для анализа.");

  const run = await createSearchRun("analyze");
  void executeAnalysisRun(run.id, vacancyIds);
  return run;
}

async function executeAnalysisRun(runId: number, vacancyIds: number[]) {
  if (analyzeRunners.has(runId)) return;
  analyzeRunners.add(runId);
  try {
    await updateSearchRun(runId, {
      status: "RUNNING",
      startedAt: new Date(),
      fetched: vacancyIds.length,
      newVacancies: vacancyIds.length,
      analyzed: 0,
      failed: 0,
    });

    let analyzed = 0;
    let failed = 0;
    for (const vacancyId of vacancyIds) {
      try {
        await db.update(vacancies).set({ status: "ANALYZING", updatedAt: new Date() }).where(eq(vacancies.id, vacancyId));
        await reanalyzeVacancy(vacancyId);
        analyzed++;
      } catch {
        failed++;
        await db.update(vacancies).set({ status: "NEW", updatedAt: new Date() }).where(eq(vacancies.id, vacancyId));
      }
      await updateSearchRun(runId, { analyzed, failed });
    }

    await updateSearchRun(runId, {
      status: failed ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      finishedAt: new Date(),
    });
  } catch (error) {
    await updateSearchRun(runId, {
      status: "FAILED",
      errorMessage: error instanceof Error ? error.message : "Неизвестная ошибка",
      finishedAt: new Date(),
    });
  } finally {
    analyzeRunners.delete(runId);
  }
}

export async function analyzeAllNewVacancies() {
  const rows = await db.select({ id: vacancies.id }).from(vacancies).where(eq(vacancies.status, "NEW"));
  return startAnalysisRun(rows.map((row) => row.id));
}

export async function analyzeSelectedVacancies(vacancyIds: number[]) {
  const rows = await db
    .select({ id: vacancies.id })
    .from(vacancies)
    .where(inArray(vacancies.id, vacancyIds));
  return startAnalysisRun(rows.map((row) => row.id));
}

/** @deprecated используйте startFetchRun */
export async function startSearchRun() {
  return startFetchRun();
}

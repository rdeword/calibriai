"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clearHhCookies, deleteNewVacancies, deleteVacancies, getVacancy, saveFetchSettings, saveHhCookies, updateVacancy } from "@/lib/db/queries";
import { diagnoseHhCookies, hhCookiesHelpText } from "@/lib/hh/cookies";
import { getVacancyDetails, listHhResumes, verifyHhSession } from "@/lib/hh/session-client";
import {
  analyzeAllNewVacancies,
  analyzeSelectedVacancies,
  startAnalysisRun,
  startFetchRun,
} from "@/lib/services/search-run";

const filtersSchema = z.object({
  searchSource: z.enum(["personal", "public"]),
  hhResumeId: z.string().optional(),
  query: z.string().max(255).optional(),
  areaId: z.string().optional(),
  salaryFrom: z.string().optional(),
  experience: z.string().optional(),
  periodDays: z.coerce.number().int().min(1).max(30),
  limit: z.coerce.number().int().min(1).max(100),
  remoteOnly: z.string().optional(),
});

function buildFiltersFormData(formData: FormData) {
  const selected = String(formData.get("hhResumeId") ?? "").trim();
  const manual = String(formData.get("hhResumeIdManual") ?? "").trim();
  if (!selected && manual) formData.set("hhResumeId", manual);
  formData.delete("hhResumeIdManual");
  return formData;
}

function parseFilters(formData: FormData) {
  const parsed = filtersSchema.parse(Object.fromEntries(formData));
  const hhResumeId = parsed.hhResumeId?.trim() || undefined;
  return {
    searchSource: parsed.searchSource,
    hhResumeId,
    hhResumeTitle: undefined as string | undefined,
    query: parsed.query?.trim() ?? "",
    areaId: parsed.areaId ? Number(parsed.areaId) : undefined,
    salaryFrom: parsed.salaryFrom ? Number(parsed.salaryFrom) : undefined,
    experience: parsed.experience || undefined,
    periodDays: parsed.periodDays,
    limit: parsed.limit,
    remoteOnly: parsed.remoteOnly === "on",
  };
}

async function persistFilters(formData: FormData) {
  const data = parseFilters(buildFiltersFormData(formData));
  if (data.searchSource === "personal" && !data.hhResumeId) {
    throw new Error("Выберите резюме HH или вставьте hash резюме из ссылки hh.ru/resume/…");
  }
  if (data.hhResumeId) {
    try {
      const resumes = await listHhResumes();
      data.hhResumeTitle = resumes.find((resume) => resume.id === data.hhResumeId)?.title;
    } catch {
      data.hhResumeTitle = data.hhResumeId.slice(0, 12) + "…";
    }
  }
  await saveFetchSettings(data);
  return data;
}

export async function saveFetchFiltersAction(formData: FormData) {
  await persistFilters(formData);
  revalidatePath("/fetch");
}

export async function saveHhCookiesAction(formData: FormData) {
  const raw = z.string().min(20).max(50_000).parse(formData.get("cookies"));
  const diagnosis = diagnoseHhCookies(raw);
  if (!diagnosis.normalized) {
    throw new Error("Вставьте строку Cookie из DevTools.");
  }
  const help = hhCookiesHelpText(diagnosis.missing);
  if (help) throw new Error(help);

  await saveHhCookies(diagnosis.normalized);
  await verifyHhSession();
  revalidatePath("/fetch");
}

export async function clearHhCookiesAction() {
  await clearHhCookies();
  revalidatePath("/fetch");
}

export async function fetchVacanciesAction(formData: FormData) {
  await persistFilters(formData);
  revalidatePath("/fetch");
  return startFetchRun();
}

export async function analyzeVacancyAction(vacancyId: number) {
  return startAnalysisRun([vacancyId]);
}

export async function analyzeSelectedAction(vacancyIds: number[]) {
  return analyzeSelectedVacancies(vacancyIds);
}

export async function analyzeAllNewAction() {
  return analyzeAllNewVacancies();
}

function revalidateAfterInboxChange() {
  revalidatePath("/fetch");
  revalidatePath("/");
}

export async function deleteInboxVacancyAction(vacancyId: number) {
  const vacancy = await getVacancy(vacancyId);
  if (!vacancy) return;
  await deleteVacancies([vacancyId]);
  revalidateAfterInboxChange();
}

export async function deleteSelectedInboxAction(vacancyIds: number[]) {
  const ids = vacancyIds.filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) throw new Error("Выберите хотя бы одну вакансию.");
  await deleteVacancies(ids);
  revalidateAfterInboxChange();
}

export async function clearInboxAction() {
  await deleteNewVacancies();
  revalidateAfterInboxChange();
}

export async function loadVacancyDescriptionAction(vacancyId: number) {
  const vacancy = await getVacancy(vacancyId);
  if (!vacancy) throw new Error("Вакансия не найдена.");

  const detailed = await getVacancyDetails(vacancy.hhId, {
    hhId: vacancy.hhId,
    url: vacancy.url,
    title: vacancy.title,
    employer: vacancy.employer,
    salary: vacancy.salary,
    area: vacancy.area,
    workFormat: vacancy.workFormat,
    experience: vacancy.experience,
    description: vacancy.description,
    requirements: vacancy.requirements,
    responsibilities: vacancy.responsibilities,
    publishedAt: vacancy.publishedAt,
    rawPayload: vacancy.rawPayload,
  });

  await updateVacancy(vacancyId, {
    description: detailed.description,
    requirements: detailed.requirements,
    responsibilities: detailed.responsibilities,
    employer: detailed.employer,
    salary: detailed.salary,
    area: detailed.area,
    workFormat: detailed.workFormat,
    experience: detailed.experience,
  });

  revalidatePath("/fetch");

  return {
    description: detailed.description,
    requirements: detailed.requirements,
    responsibilities: detailed.responsibilities,
  };
}

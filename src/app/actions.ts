"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getData } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { clearOpenAiCredentials, createCoverLetter, createResume, createUsage, deleteResume, deleteVacancy, getActiveResume, getVacancy, recordDecision, saveOpenAiCredentials, saveSearchSettings, setActiveResume } from "@/lib/db/queries";
import { createCoverLetterWithOpenAi } from "@/lib/openai/client";
import { coverLetterPrompt } from "@/lib/prompts/cover-letter";
import { importVacancy } from "@/lib/services/import-vacancy";
import { reanalyzeVacancy, startFetchRun } from "@/lib/services/search-run";

PDFParse.setWorker(getData());

export async function saveSettingsAction(formData: FormData) {
  const parsed = z.object({ query: z.string().min(1).max(255), areaId: z.string().optional(), salaryFrom: z.string().optional(), experience: z.string().optional(), limit: z.coerce.number().int().min(1).max(100), remoteOnly: z.string().optional() }).parse(Object.fromEntries(formData));
  await saveSearchSettings({ query: parsed.query, areaId: parsed.areaId ? Number(parsed.areaId) : undefined, salaryFrom: parsed.salaryFrom ? Number(parsed.salaryFrom) : undefined, experience: parsed.experience || undefined, limit: parsed.limit, remoteOnly: parsed.remoteOnly === "on", periodDays: 1, searchSource: "personal" });
  revalidatePath("/settings");
}

export async function saveOpenAiCredentialsAction(formData: FormData) {
  const parsed = z.object({ apiKey: z.string().min(12).max(512), model: z.string().min(1).max(128) }).parse(Object.fromEntries(formData));
  await saveOpenAiCredentials(parsed.apiKey.trim(), parsed.model.trim());
  revalidatePath("/settings");
}

export async function clearOpenAiCredentialsAction() {
  await clearOpenAiCredentials();
  revalidatePath("/settings");
}

export async function createResumeAction(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Выберите PDF-файл с резюме.");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Резюме должно быть в формате PDF.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Размер PDF не должен превышать 10 МБ.");

  const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });
  let textContent: string;
  try {
    const result = await parser.getText();
    textContent = result.text.replace(/\0/g, "").replace(/[ \t]+\n/g, "\n").trim();
  } finally {
    await parser.destroy();
  }
  if (textContent.length < 30) throw new Error("Не удалось извлечь текст из PDF. Возможно, документ состоит из сканов.");

  const name = file.name.replace(/\.pdf$/i, "").trim().slice(0, 128) || "Резюме";
  await createResume(name, textContent);
  revalidatePath("/resumes");
}

export async function setActiveResumeAction(formData: FormData) {
  await setActiveResume(z.coerce.number().int().positive().parse(formData.get("id")));
  revalidatePath("/resumes");
}

export async function deleteResumeAction(formData: FormData) {
  await deleteResume(z.coerce.number().int().positive().parse(formData.get("id")));
  revalidatePath("/resumes");
}

export async function startSearchRunAction() {
  return startFetchRun();
}

export async function importVacancyAction(formData: FormData) {
  const parsed = z.object({
    title: z.string().trim().min(2).max(500),
    employer: z.string().trim().max(500).optional(),
    url: z.string().trim().max(2000).refine((value) => !value || URL.canParse(value), "Некорректная ссылка"),
    description: z.string().trim().min(30).max(100_000),
    analyzeImmediately: z.string().optional(),
  }).parse(Object.fromEntries(formData));

  await importVacancy({
    title: parsed.title,
    employer: parsed.employer,
    url: parsed.url,
    description: parsed.description,
    source: "manual",
    analyzeImmediately: parsed.analyzeImmediately === "on",
  });
  revalidatePath("/");
  revalidatePath("/fetch");
  redirect(parsed.analyzeImmediately === "on" ? "/" : "/fetch");
}

export async function recordDecisionAction(formData: FormData) {
  const vacancyId = z.coerce.number().int().positive().parse(formData.get("vacancyId"));
  const decision = z.enum(["LIKED", "REJECTED"]).parse(formData.get("decision"));
  await recordDecision(vacancyId, decision);
  revalidatePath("/");
  revalidatePath("/history");
}

export async function deleteVacancyAction(formData: FormData) {
  await deleteVacancy(z.coerce.number().int().positive().parse(formData.get("vacancyId")));
  revalidatePath("/");
  revalidatePath("/history");
}

export async function reanalyzeVacancyAction(formData: FormData) {
  await reanalyzeVacancy(z.coerce.number().int().positive().parse(formData.get("vacancyId")));
  revalidatePath("/");
  revalidatePath("/history");
}

export async function generateCoverLetterAction(formData: FormData) {
  const vacancyId = z.coerce.number().int().positive().parse(formData.get("vacancyId"));
  const [vacancy, resume] = await Promise.all([getVacancy(vacancyId), getActiveResume()]);
  if (!vacancy || !resume) throw new Error("Не найдена вакансия или активное резюме.");
  const vacancyText = `${vacancy.title}\n${vacancy.employer ?? ""}\n${vacancy.description ?? ""}\n${vacancy.requirements ?? ""}`;
  const generated = await createCoverLetterWithOpenAi(coverLetterPrompt(resume.textContent, vacancyText));
  const letter = await createCoverLetter({ vacancyId, resumeId: resume.id, content: generated.content, model: generated.model });
  await createUsage({ operation: "cover_letter", vacancyId, model: generated.model, inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, estimatedCost: String(generated.estimatedCost ?? 0), durationMs: generated.durationMs });
  revalidatePath("/history");
  return { id: letter.id, content: letter.content };
}

import { randomUUID } from "node:crypto";
import { createVacancy } from "@/lib/db/queries";
import { reanalyzeVacancy } from "@/lib/services/search-run";

export type ImportVacancyInput = {
  title: string;
  employer?: string | null;
  url?: string | null;
  salary?: string | null;
  area?: string | null;
  workFormat?: string | null;
  description: string;
  source?: "manual" | "extension";
  analyzeImmediately?: boolean;
};

export async function importVacancy(input: ImportVacancyInput) {
  const vacancy = await createVacancy({
    hhId: `${input.source === "extension" ? "ext" : "manual"}:${randomUUID()}`,
    url: input.url || "",
    title: input.title,
    employer: input.employer || null,
    salary: input.salary || null,
    area: input.area || null,
    workFormat: input.workFormat || null,
    description: input.description,
    rawPayload: { source: input.source ?? "manual" },
    status: "NEW",
  });
  if (input.analyzeImmediately) await reanalyzeVacancy(vacancy.id);
  return vacancy;
}

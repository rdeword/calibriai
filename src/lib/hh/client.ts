const HH_API = "https://api.hh.ru";

type HhSalary = { from: number | null; to: number | null; currency: string } | null;
type HhVacancy = {
  id: string; alternate_url: string; name: string; employer?: { name: string }; salary: HhSalary;
  area?: { name: string }; published_at?: string; description?: string;
  snippet?: { requirement?: string; responsibility?: string }; schedule?: { name: string };
  experience?: { id?: string; name?: string } | null;
};

export type NormalizedVacancy = {
  hhId: string; url: string; title: string; employer: string | null; salary: string | null; area: string | null;
  workFormat: string | null; experience: string | null; description: string | null; requirements: string | null; responsibilities: string | null;
  publishedAt: Date | null; rawPayload: unknown;
};

const EXPERIENCE_LABELS: Record<string, string> = {
  noExperience: "Нет опыта",
  between1And3: "От 1 года до 3 лет",
  between3And6: "От 3 до 6 лет",
  moreThan6: "Более 6 лет",
};

export function experienceText(value?: { id?: string; name?: string } | string | null) {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return EXPERIENCE_LABELS[trimmed] ?? trimmed;
  }
  return value.name?.trim() || (value.id ? EXPERIENCE_LABELS[value.id] ?? value.id : null) || null;
}

function salaryText(salary: HhSalary) {
  if (!salary) return null;
  const range = [salary.from ? `от ${salary.from}` : null, salary.to ? `до ${salary.to}` : null].filter(Boolean).join(" ");
  return `${range} ${salary.currency}`.trim();
}

function stripHtml(value?: string) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || null;
}

function normalize(vacancy: HhVacancy): NormalizedVacancy {
  return {
    hhId: vacancy.id, url: vacancy.alternate_url, title: vacancy.name, employer: vacancy.employer?.name ?? null,
    salary: salaryText(vacancy.salary), area: vacancy.area?.name ?? null, workFormat: vacancy.schedule?.name ?? null,
    experience: experienceText(vacancy.experience),
    description: stripHtml(vacancy.description), requirements: stripHtml(vacancy.snippet?.requirement),
    responsibilities: stripHtml(vacancy.snippet?.responsibility),
    publishedAt: vacancy.published_at ? new Date(vacancy.published_at) : null, rawPayload: vacancy,
  };
}

async function hhFetch<T>(path: string, params?: URLSearchParams): Promise<T> {
  const response = await fetch(`${HH_API}${path}${params ? `?${params}` : ""}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept-Language": "ru-RU,ru;q=0.9",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HH API вернул ${response.status}.`);
  return response.json() as Promise<T>;
}

function dateFrom(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export async function searchHhVacancies(settings: {
  query: string;
  areaId?: number | null;
  salaryFrom?: number | null;
  remoteOnly: number;
  experience?: string | null;
  periodDays?: number | null;
  limit: number;
}) {
  const params = new URLSearchParams({
    text: settings.query || "",
    per_page: String(Math.min(settings.limit, 100)),
    page: "0",
    order_by: "publication_time",
  });
  if (settings.areaId) params.set("area", String(settings.areaId));
  if (settings.salaryFrom) params.set("salary", String(settings.salaryFrom));
  if (settings.remoteOnly) {
    params.set("schedule", "remote");
    params.set("work_format", "REMOTE");
  }
  if (settings.experience) params.set("experience", settings.experience);
  if (settings.periodDays) params.set("date_from", dateFrom(settings.periodDays));
  const result = await hhFetch<{ items: HhVacancy[] }>("/vacancies", params);
  return result.items;
}

export async function getHhVacancy(id: string) {
  return normalize(await hhFetch<HhVacancy>(`/vacancies/${id}`));
}

type HhAreaNode = { id: string; name: string; areas?: HhAreaNode[] };

export type HhAreaOption = { id: string; name: string; label: string };

const POPULAR_AREA_IDS = ["113", "1", "2"];

function flattenAreas(nodes: HhAreaNode[], parents: string[] = []): HhAreaOption[] {
  const result: HhAreaOption[] = [];
  for (const node of nodes) {
    const path = [...parents, node.name];
    result.push({
      id: node.id,
      name: node.name,
      label: path.length > 1 ? `${node.name} · ${path.slice(0, -1).join(" · ")}` : node.name,
    });
    if (node.areas?.length) result.push(...flattenAreas(node.areas, path));
  }
  return result;
}

export async function listHhAreas(): Promise<HhAreaOption[]> {
  const response = await fetch(`${HH_API}/areas`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept-Language": "ru-RU,ru;q=0.9",
    },
    next: { revalidate: 86_400 },
  });
  if (!response.ok) throw new Error(`HH API вернул ${response.status} для /areas.`);

  const tree = (await response.json()) as HhAreaNode[];
  const flattened = flattenAreas(tree);
  const popular = POPULAR_AREA_IDS.map((id) => flattened.find((area) => area.id === id)).filter(
    (area): area is HhAreaOption => Boolean(area),
  );
  const rest = flattened
    .filter((area) => !POPULAR_AREA_IDS.includes(area.id))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return [...popular, ...rest];
}

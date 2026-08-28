import { getHhCookies, getSearchSettings } from "@/lib/db/queries";
import { experienceText, getHhVacancy, type NormalizedVacancy } from "@/lib/hh/client";

const HH_API = "https://api.hh.ru";
const HH_WEB = "https://hh.ru";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const HH_FETCH_HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
};

type HhListItem = {
  id: string;
  name?: string;
  title?: string;
  alternate_url?: string;
  employer?: { name?: string };
  salary?: { from?: number | null; to?: number | null; currency?: string } | null;
  area?: { name?: string };
  schedule?: { id?: string; name?: string };
  work_format?: { id?: string; name?: string } | Array<{ id?: string; name?: string }>;
  experience?: { id?: string; name?: string } | null;
  snippet?: { requirement?: string; responsibility?: string };
  published_at?: string;
};

type WebSearchVacancy = {
  vacancyId?: number | string;
  id?: number | string;
  name?: string;
  company?: { name?: string };
  area?: { name?: string };
  links?: Record<string, string>;
  compensation?: { from?: number | null; to?: number | null; currencyCode?: string; noCompensation?: unknown };
  "@workSchedule"?: string;
  workSchedule?: string;
  experience?: { id?: string; name?: string } | string | null;
  workExperience?: { id?: string; name?: string } | string | null;
};

export type HhResumeOption = { id: string; title: string };

function stripHtml(value?: string) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || null;
}

function salaryText(salary: HhListItem["salary"]) {
  if (!salary) return null;
  const range = [salary.from ? `от ${salary.from}` : null, salary.to ? `до ${salary.to}` : null].filter(Boolean).join(" ");
  return `${range} ${salary.currency ?? ""}`.trim() || null;
}

function workFormatText(item: HhListItem) {
  if (Array.isArray(item.work_format)) {
    return item.work_format.map((f) => f.name).filter(Boolean).join(" · ") || null;
  }
  return item.work_format?.name ?? item.schedule?.name ?? null;
}

function isRemoteLike(value: string | null | undefined) {
  if (!value) return false;
  return /удал|remote|дистанц|из дома|home office/i.test(value);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractSsrString(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length) {
    const first = value[0];
    if (typeof first === "object" && first) {
      const record = first as Record<string, unknown>;
      return String(record.string ?? record.text ?? record.name ?? record.title ?? "");
    }
    return String(first);
  }
  if (typeof value === "object" && value) {
    const record = value as Record<string, unknown>;
    return String(record.string ?? record.text ?? record.value ?? record.name ?? record.title ?? "");
  }
  return "";
}

function parseLuxSsr(html: string) {
  const match = html.match(/<template[^>]*id="HH-Lux-InitialState"[^>]*>([\s\S]*?)<\/template>/i);
  if (!match) return null;
  let raw = match[1].trim();
  if (raw.includes("&")) raw = decodeHtmlEntities(raw);
  return JSON.parse(raw) as Record<string, unknown>;
}

function isLoginPage(html: string) {
  if (!html) return true;
  return (
    html.includes('"/account/login"') ||
    html.includes("hh.ru/account/login") ||
    html.includes('"accountLogin"') ||
    html.includes("Войти в аккаунт")
  );
}

export async function verifyHhSession() {
  const response = await hhWebSessionFetch("/applicant/resumes", undefined, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8");
  const html = await response.text();
  if (isLoginPage(html)) {
    throw new Error(
      "Сессия HH не принята. Скопируйте полный заголовок Cookie из DevTools → Network → любой запрос к hh.ru → Request Headers → Cookie.",
    );
  }
  const ssr = parseLuxSsr(html);
  if (!ssr?.applicantResumes && !ssr?.account) {
    throw new Error("HH ответил, но сессия не распознана. Обновите куки из браузера, где вы уже залогинены.");
  }
  return { ok: true as const };
}

function parseEmbeddedJson<T>(html: string, marker: string): T | null {
  const index = html.indexOf(marker);
  if (index === -1) return null;
  const slice = html.slice(index + marker.length);
  const start = slice.indexOf("[");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < slice.length; i++) {
    const char = slice[i];
    if (char === "[") depth++;
    if (char === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(slice.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function parseResumeRecords(payload: unknown): HhResumeOption[] {
  const root = payload as Record<string, unknown>;

  let items: Array<Record<string, unknown>> = [];
  if (Array.isArray(root?.applicantResumes)) {
    items = root.applicantResumes as Array<Record<string, unknown>>;
  } else if (Array.isArray(root?.items)) {
    items = root.items as Array<Record<string, unknown>>;
  } else if (Array.isArray(root?.resumes)) {
    items = root.resumes as Array<Record<string, unknown>>;
  } else if (Array.isArray(payload)) {
    items = payload as Array<Record<string, unknown>>;
  } else if (root?.resumes && typeof root.resumes === "object") {
    items = Object.entries(root.resumes as Record<string, Record<string, unknown>>).map(([key, value]) => ({
      ...value,
      hash: value.hash ?? key,
    }));
  }

  return items
    .map((item) => {
      const attrs = (item._attributes as Record<string, unknown> | undefined) ?? {};
      const hash = String(attrs.hash ?? item.hash ?? "").trim();
      if (!hash) return null;

      const title =
        extractSsrString(item.title) ||
        extractSsrString(item.profession) ||
        extractSsrString(item.specialization) ||
        extractSsrString(item.desiredProfession) ||
        extractSsrString(item.name) ||
        extractSsrString(item.position) ||
        `Резюме ${hash.slice(0, 12)}…`;

      return { id: hash, title };
    })
    .filter((item): item is HhResumeOption => Boolean(item));
}

async function hhSessionFetch<T>(path: string, params?: URLSearchParams): Promise<T> {
  const cookies = await getHhCookies();
  if (!cookies) throw new Error("Сначала сохраните куки HH в настройках загрузки.");

  const response = await fetch(`${HH_API}${path}${params ? `?${params}` : ""}`, {
    headers: {
      Cookie: cookies,
      ...HH_FETCH_HEADERS,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 403 || response.status === 401) {
    throw new Error("Сессия HH недействительна. Обновите куки в настройках загрузки.");
  }
  if (!response.ok) {
    throw new Error(`HH вернул ${response.status} для ${path}.`);
  }
  return response.json() as Promise<T>;
}

async function hhWebSessionFetch(path: string, params?: URLSearchParams, accept = "application/json, text/html;q=0.9") {
  const cookies = await getHhCookies();
  if (!cookies) throw new Error("Сначала сохраните куки HH в настройках загрузки.");

  const response = await fetch(`${HH_WEB}${path}${params ? `?${params}` : ""}`, {
    headers: {
      Cookie: cookies,
      ...HH_FETCH_HEADERS,
      Accept: accept,
      Referer: `${HH_WEB}/`,
    },
    cache: "no-store",
    redirect: "follow",
  });

  if (response.status === 403 || response.status === 401) {
    throw new Error("Сессия HH недействительна. Обновите куки в настройках загрузки.");
  }
  if (!response.ok) {
    throw new Error(`HH вернул ${response.status} для ${path}.`);
  }

  return response;
}

async function fetchResumesFromShards() {
  const response = await hhWebSessionFetch("/shards/applicant/resumes");
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return parseResumeRecords(await response.json());
  }
  return parseResumeRecords(parseLuxSsr(await response.text()));
}

async function fetchResumesFromApplicantPage() {
  const response = await hhWebSessionFetch("/applicant/resumes", undefined, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8");
  const html = await response.text();
  if (isLoginPage(html)) {
    throw new Error("Куки HH недействительны или истекли. Скопируйте их заново из браузера, где вы залогинены на hh.ru.");
  }
  const ssr = parseLuxSsr(html);
  if (!ssr) throw new Error("Не удалось прочитать список резюме со страницы HH.");
  return parseResumeRecords(ssr);
}

export async function listHhResumes(): Promise<HhResumeOption[]> {
  const attempts = [fetchResumesFromApplicantPage, fetchResumesFromShards];
  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      const resumes = await attempt();
      if (resumes.length) {
        const unique = new Map<string, HhResumeOption>();
        for (const resume of resumes) unique.set(resume.id, resume);
        return [...unique.values()];
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Не удалось загрузить резюме HH.");
    }
  }

  if (lastError) throw lastError;
  throw new Error("HH не вернул резюме. Проверьте, что в аккаунте есть опубликованные резюме, или вставьте hash резюме вручную.");
}

function buildSearchParams(settings: NonNullable<Awaited<ReturnType<typeof getSearchSettings>>>, resumeId?: string | null) {
  const params = new URLSearchParams({
    per_page: String(Math.min(settings.limit, 100)),
    page: "0",
    order_by: "publication_time",
  });

  if (resumeId) params.set("resume", resumeId);
  if (settings.query) params.set("text", settings.query);
  if (settings.areaId) params.set("area", String(settings.areaId));
  if (settings.salaryFrom) params.set("salary", String(settings.salaryFrom));
  if (settings.experience) params.set("experience", settings.experience);
  if (settings.periodDays) params.set("search_period", String(settings.periodDays));
  if (settings.remoteOnly) {
    params.set("schedule", "remote");
    params.set("work_format", "REMOTE");
  }

  return params;
}

function webCompensationText(compensation?: WebSearchVacancy["compensation"]) {
  if (!compensation || compensation.noCompensation) return null;
  const range = [
    compensation.from ? `от ${compensation.from}` : null,
    compensation.to ? `до ${compensation.to}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const currency = compensation.currencyCode === "RUR" ? "руб." : compensation.currencyCode ?? "";
  return `${range} ${currency}`.trim() || null;
}

function normalizeWebSearchVacancy(item: WebSearchVacancy): HhListItem {
  const id = String(item.vacancyId ?? item.id ?? "");
  const desktopLink = item.links?.desktop ?? item.links?.mobile ?? "";
  return {
    id,
    name: item.name,
    alternate_url: desktopLink || (id ? `https://hh.ru/vacancy/${id}` : undefined),
    employer: item.company?.name ? { name: item.company.name } : undefined,
    area: item.area?.name ? { name: item.area.name } : undefined,
    schedule: item["@workSchedule"] || item.workSchedule ? { name: item["@workSchedule"] ?? item.workSchedule } : undefined,
    experience: (() => {
      const value = item.experience ?? item.workExperience;
      if (!value) return null;
      return typeof value === "string" ? { name: value } : value;
    })(),
    salary: item.compensation
      ? {
          from: item.compensation.from ?? null,
          to: item.compensation.to ?? null,
          currency: item.compensation.currencyCode ?? "RUR",
        }
      : null,
  };
}

async function searchPersonalVacancyIds(settings: NonNullable<Awaited<ReturnType<typeof getSearchSettings>>>) {
  const resumeId = settings.hhResumeId;
  if (!resumeId) throw new Error("Выберите резюме HH для персональной выдачи.");

  const params = buildSearchParams(settings, resumeId);
  const response = await hhWebSessionFetch("/search/vacancy", params, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8");
  const html = await response.text();
  if (isLoginPage(html)) {
    throw new Error(
      "Поиск HH вернул страницу входа. Обновите куки: DevTools → Network → запрос applicant или search → Request Headers → Cookie (вся строка целиком).",
    );
  }

  const ssr = parseLuxSsr(html);
  const ssrVacancies = (ssr?.vacancySearchResult as { vacancies?: WebSearchVacancy[] } | undefined)?.vacancies;
  const embeddedVacancies = parseEmbeddedJson<WebSearchVacancy[]>(html, ',"vacancies":');
  const rawItems = ssrVacancies?.length ? ssrVacancies : embeddedVacancies ?? [];

  const items = rawItems.map(normalizeWebSearchVacancy).filter((item) => item.id);
  if (items.length) return items;

  try {
    const apiItems = await hhSessionFetch<{ items?: HhListItem[] }>(`/resumes/${resumeId}/similar_vacancies`, buildSearchParams(settings));
    if (apiItems.items?.length) return apiItems.items;
  } catch {
    // fallback below
  }

  try {
    const apiItems = await hhSessionFetch<{ items?: HhListItem[] }>("/vacancies", buildSearchParams(settings, resumeId));
    if (apiItems.items?.length) return apiItems.items;
  } catch {
    // no-op
  }

  throw new Error("Не удалось получить персональную выдачу HH. Проверьте куки, hash резюме и фильтры.");
}

function normalizeListItem(item: HhListItem): NormalizedVacancy {
  const workFormat = workFormatText(item);
  return {
    hhId: String(item.id),
    url: item.alternate_url ?? `https://hh.ru/vacancy/${item.id}`,
    title: item.name ?? item.title ?? "Вакансия",
    employer: item.employer?.name ?? null,
    salary: salaryText(item.salary),
    area: item.area?.name ?? null,
    workFormat,
    experience: experienceText(item.experience),
    description: null,
    requirements: stripHtml(item.snippet?.requirement),
    responsibilities: stripHtml(item.snippet?.responsibility),
    publishedAt: item.published_at ? new Date(item.published_at) : null,
    rawPayload: item,
  };
}

type ApiVacancyDetail = {
  id: string;
  name: string;
  alternate_url?: string;
  description?: string;
  employer?: { name?: string };
  area?: { name?: string };
  salary?: HhListItem["salary"];
  schedule?: { name?: string };
  experience?: { id?: string; name?: string } | null;
  snippet?: { requirement?: string; responsibility?: string };
  published_at?: string;
};

function normalizeApiVacancy(vacancy: ApiVacancyDetail): NormalizedVacancy {
  return {
    hhId: String(vacancy.id),
    url: vacancy.alternate_url ?? `https://hh.ru/vacancy/${vacancy.id}`,
    title: vacancy.name,
    employer: vacancy.employer?.name ?? null,
    salary: salaryText(vacancy.salary),
    area: vacancy.area?.name ?? null,
    workFormat: vacancy.schedule?.name ?? null,
    experience: experienceText(vacancy.experience),
    description: stripHtml(vacancy.description),
    requirements: stripHtml(vacancy.snippet?.requirement),
    responsibilities: stripHtml(vacancy.snippet?.responsibility),
    publishedAt: vacancy.published_at ? new Date(vacancy.published_at) : null,
    rawPayload: vacancy,
  };
}

function normalizeVacancyView(hhId: string, view: Record<string, unknown>): NormalizedVacancy {
  const company = view.company as { name?: string } | undefined;
  const employer = view.employer as { name?: string } | undefined;
  const area = view.area as { name?: string } | undefined;
  const compensation = view.compensation as WebSearchVacancy["compensation"] | undefined;
  const snippet = view.snippet as { requirement?: string; responsibility?: string } | undefined;
  const descriptionRaw =
    (typeof view.description === "string" && view.description) ||
    (typeof view.brandedDescription === "string" && view.brandedDescription) ||
    null;
  const experience =
    experienceText(view.experience as { id?: string; name?: string } | string | null | undefined) ||
    experienceText(view.workExperience as { id?: string; name?: string } | string | null | undefined) ||
    extractSsrString(view.experience) ||
    extractSsrString(view.workExperience) ||
    null;

  return {
    hhId,
    url: typeof view.alternate_url === "string" ? view.alternate_url : `https://hh.ru/vacancy/${hhId}`,
    title: extractSsrString(view.name) || extractSsrString(view.title) || "Вакансия",
    employer: company?.name ?? employer?.name ?? null,
    salary: webCompensationText(compensation),
    area: area?.name ?? null,
    workFormat: extractSsrString(view["@workSchedule"]) || extractSsrString(view.workSchedule) || null,
    experience: experience || null,
    description: stripHtml(descriptionRaw ?? undefined),
    requirements: stripHtml(snippet?.requirement),
    responsibilities: stripHtml(snippet?.responsibility),
    publishedAt: null,
    rawPayload: view,
  };
}

function mergeVacancy(seed: NormalizedVacancy, detailed: NormalizedVacancy): NormalizedVacancy {
  return {
    ...seed,
    ...detailed,
    title: detailed.title || seed.title,
    employer: detailed.employer ?? seed.employer,
    salary: detailed.salary ?? seed.salary,
    area: detailed.area ?? seed.area,
    workFormat: detailed.workFormat ?? seed.workFormat,
    experience: detailed.experience ?? seed.experience,
    description: detailed.description ?? seed.description,
    requirements: detailed.requirements ?? seed.requirements,
    responsibilities: detailed.responsibilities ?? seed.responsibilities,
    url: detailed.url || seed.url,
    publishedAt: detailed.publishedAt ?? seed.publishedAt,
    rawPayload: detailed.rawPayload ?? seed.rawPayload,
  };
}

function hasVacancyText(vacancy: NormalizedVacancy) {
  return Boolean(vacancy.description || vacancy.requirements || vacancy.responsibilities);
}

async function getHhVacancyFromSessionApi(hhId: string) {
  return normalizeApiVacancy(await hhSessionFetch<ApiVacancyDetail>(`/vacancies/${hhId}`));
}

async function getHhVacancyFromWebPage(hhId: string) {
  const response = await hhWebSessionFetch(
    `/vacancy/${hhId}`,
    undefined,
    "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  );
  const html = await response.text();
  if (isLoginPage(html)) {
    throw new Error("HH вернул страницу входа при загрузке вакансии.");
  }

  const ssr = parseLuxSsr(html);
  const view = ssr?.vacancyView;
  if (view && typeof view === "object") {
    return normalizeVacancyView(hhId, view as Record<string, unknown>);
  }

  throw new Error("Не удалось прочитать описание со страницы вакансии HH.");
}

export async function getVacancyDetails(hhId: string, seed?: NormalizedVacancy) {
  const cookies = await getHhCookies();
  const attempts: Array<() => Promise<NormalizedVacancy>> = [];

  if (cookies) {
    attempts.push(() => getHhVacancyFromSessionApi(hhId));
    attempts.push(() => getHhVacancyFromWebPage(hhId));
  }
  attempts.push(() => getHhVacancy(hhId));

  let merged = seed ?? null;
  for (const attempt of attempts) {
    try {
      const detailed = await attempt();
      merged = merged ? mergeVacancy(merged, detailed) : detailed;
      if (hasVacancyText(merged)) return merged;
    } catch {
      // try next source
    }
  }

  if (merged) return merged;
  throw new Error(`Не удалось загрузить описание вакансии ${hhId}.`);
}

export async function fetchPersonalVacancies() {
  const settings = await getSearchSettings();
  if (!settings) throw new Error("Сначала задайте фильтры загрузки.");

  const list = await searchPersonalVacancyIds(settings);
  let normalized = list.map(normalizeListItem);

  if (settings.remoteOnly) {
    normalized = normalized.filter((item) => isRemoteLike(item.workFormat ?? ""));
  }

  const detailed: NormalizedVacancy[] = [];
  for (const item of normalized.slice(0, settings.limit)) {
    try {
      detailed.push(await getVacancyDetails(item.hhId, item));
    } catch {
      detailed.push(item);
    }
  }

  return detailed;
}

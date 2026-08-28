import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { db } from "./index";
import { aiSettings, aiUsage, coverLetters, dismissedVacancies, hhSettings, resumes, searchRuns, searchSettings, userDecisions, vacancies, vacancyAnalyses } from "./schema";

export async function getSearchSettings() {
  return (await db.select().from(searchSettings).orderBy(desc(searchSettings.updatedAt)).limit(1))[0] ?? null;
}

export async function saveSearchSettings(input: {
  query: string;
  areaId?: number;
  salaryFrom?: number;
  remoteOnly: boolean;
  experience?: string;
  periodDays: number;
  searchSource: "personal" | "public";
  hhResumeId?: string;
  hhResumeTitle?: string;
  limit: number;
}) {
  const current = await getSearchSettings();
  const values = {
    ...input,
    remoteOnly: input.remoteOnly ? 1 : 0,
    query: input.query || "",
    updatedAt: new Date(),
  };
  if (current) return (await db.update(searchSettings).set(values).where(eq(searchSettings.id, current.id)).returning())[0];
  return (await db.insert(searchSettings).values(values).returning())[0];
}

export async function saveHhCookies(cookies: string) {
  const encrypted = encryptSecret(cookies);
  const current = (await db.select().from(hhSettings).limit(1))[0];
  const values = {
    encryptedCookies: encrypted.encryptedApiKey,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    updatedAt: new Date(),
  };
  if (current) await db.update(hhSettings).set(values).where(eq(hhSettings.id, current.id));
  else await db.insert(hhSettings).values(values);
}

export async function getHhCookies() {
  const stored = (await db.select().from(hhSettings).limit(1))[0];
  if (!stored) return null;
  return decryptSecret({ encryptedApiKey: stored.encryptedCookies, iv: stored.iv, authTag: stored.authTag });
}

export async function getHhConnectionStatus() {
  const stored = (await db.select().from(hhSettings).limit(1))[0];
  return stored ? { configured: true } : { configured: false };
}

export async function clearHhCookies() {
  await db.delete(hhSettings);
}

export async function saveFetchSettings(input: Parameters<typeof saveSearchSettings>[0]) {
  return saveSearchSettings(input);
}

export async function saveOpenAiCredentials(apiKey: string, model: string) {
  const encrypted = encryptSecret(apiKey);
  const current = (await db.select().from(aiSettings).limit(1))[0];
  const values = { ...encrypted, model, updatedAt: new Date() };
  if (current) await db.update(aiSettings).set(values).where(eq(aiSettings.id, current.id));
  else await db.insert(aiSettings).values(values);
}

export async function getOpenAiCredentials() {
  const stored = (await db.select().from(aiSettings).limit(1))[0];
  if (!stored) return null;
  return { apiKey: decryptSecret(stored), model: stored.model };
}

export async function getOpenAiConnectionStatus() {
  const stored = (await db.select().from(aiSettings).limit(1))[0];
  return stored ? { configured: true, model: stored.model, keyHint: maskSecret(decryptSecret(stored)) } : { configured: false };
}

export async function clearOpenAiCredentials() {
  await db.delete(aiSettings);
}

export async function listResumes() {
  return db.select().from(resumes).orderBy(desc(resumes.isActive), desc(resumes.updatedAt));
}

export async function getActiveResume() {
  return (await db.select().from(resumes).where(eq(resumes.isActive, 1)).limit(1))[0] ?? null;
}

export async function createResume(name: string, textContent: string) {
  const hasActive = await getActiveResume();
  return (await db.insert(resumes).values({ name, textContent, isActive: hasActive ? 0 : 1 }).returning())[0];
}

export async function setActiveResume(id: number) {
  await db.transaction(async (tx) => {
    await tx.update(resumes).set({ isActive: 0, updatedAt: new Date() });
    await tx.update(resumes).set({ isActive: 1, updatedAt: new Date() }).where(eq(resumes.id, id));
  });
}

export async function deleteResume(id: number) {
  await db.delete(resumes).where(eq(resumes.id, id));
}

export async function getVacancyByHhId(hhId: string) {
  return (await db.select().from(vacancies).where(eq(vacancies.hhId, hhId)).limit(1))[0] ?? null;
}

export async function isVacancyDismissed(hhId: string) {
  const row = (await db.select({ id: dismissedVacancies.id }).from(dismissedVacancies).where(eq(dismissedVacancies.hhId, hhId)).limit(1))[0];
  return Boolean(row);
}

export async function listDismissedHhIds() {
  const rows = await db.select({ hhId: dismissedVacancies.hhId }).from(dismissedVacancies);
  return new Set(rows.map((row) => row.hhId));
}

async function rememberDismissedHhIds(hhIds: string[]) {
  const unique = [...new Set(hhIds.filter(Boolean))];
  if (!unique.length) return;
  await db
    .insert(dismissedVacancies)
    .values(unique.map((hhId) => ({ hhId })))
    .onConflictDoNothing({ target: dismissedVacancies.hhId });
}

export async function createVacancy(values: typeof vacancies.$inferInsert) {
  return (await db.insert(vacancies).values(values).returning())[0];
}

export async function getVacancy(id: number) {
  return (await db.select().from(vacancies).where(eq(vacancies.id, id)).limit(1))[0] ?? null;
}

export async function updateVacancy(id: number, values: Partial<typeof vacancies.$inferInsert>) {
  await db.update(vacancies).set({ ...values, updatedAt: new Date() }).where(eq(vacancies.id, id));
}

export async function deleteVacancy(id: number) {
  await deleteVacancies([id]);
}

export async function deleteVacancies(ids: number[]) {
  if (!ids.length) return 0;
  const rows = await db.select({ id: vacancies.id, hhId: vacancies.hhId }).from(vacancies).where(inArray(vacancies.id, ids));
  if (!rows.length) return 0;
  await rememberDismissedHhIds(rows.map((row) => row.hhId));
  const deleted = await db.delete(vacancies).where(inArray(vacancies.id, rows.map((row) => row.id))).returning({ id: vacancies.id });
  return deleted.length;
}

export async function deleteNewVacancies() {
  const rows = await db.select({ id: vacancies.id, hhId: vacancies.hhId }).from(vacancies).where(eq(vacancies.status, "NEW"));
  if (!rows.length) return 0;
  await rememberDismissedHhIds(rows.map((row) => row.hhId));
  const deleted = await db.delete(vacancies).where(inArray(vacancies.id, rows.map((row) => row.id))).returning({ id: vacancies.id });
  return deleted.length;
}

export async function getLatestAnalysis(vacancyId: number) {
  return (await db.select().from(vacancyAnalyses).where(eq(vacancyAnalyses.vacancyId, vacancyId)).orderBy(desc(vacancyAnalyses.createdAt)).limit(1))[0] ?? null;
}

export async function listActionableVacancies() {
  const items = await db.select().from(vacancies).where(inArray(vacancies.status, ["ANALYZED"])).orderBy(desc(vacancies.firstFetchedAt));
  return Promise.all(items.map(async (vacancy) => ({ vacancy, analysis: await getLatestAnalysis(vacancy.id) })));
}

export async function recordDecision(vacancyId: number, decision: "LIKED" | "REJECTED") {
  await db.transaction(async (tx) => {
    await tx.insert(userDecisions).values({ vacancyId, decision });
    await tx.update(vacancies).set({ status: decision, updatedAt: new Date() }).where(eq(vacancies.id, vacancyId));
  });
}

export async function listHistory(status: "ANALYZED" | "LIKED" | "REJECTED") {
  return db.select().from(vacancies).where(eq(vacancies.status, status)).orderBy(desc(vacancies.updatedAt));
}

export async function listCoverLetterVacancyIds(vacancyIds: number[]) {
  if (!vacancyIds.length) return new Set<number>();
  const rows = await db
    .select({ vacancyId: coverLetters.vacancyId })
    .from(coverLetters)
    .where(inArray(coverLetters.vacancyId, vacancyIds));
  return new Set(rows.map((row) => row.vacancyId));
}

export async function listHistoryItems(status: "ANALYZED" | "LIKED" | "REJECTED") {
  const vacancies = await listHistory(status);
  const coverLetterIds = await listCoverLetterVacancyIds(vacancies.map((vacancy) => vacancy.id));
  const items = await Promise.all(
    vacancies.map(async (vacancy) => ({
      vacancy,
      analysis: await getLatestAnalysis(vacancy.id),
      hasCoverLetter: coverLetterIds.has(vacancy.id),
    })),
  );
  return items;
}

export async function listNewVacancies() {
  return db.select().from(vacancies).where(eq(vacancies.status, "NEW")).orderBy(desc(vacancies.firstFetchedAt));
}

export async function createSearchRun(runType: "fetch" | "analyze" = "fetch") {
  return (await db.insert(searchRuns).values({ status: "PENDING", runType }).returning())[0];
}

export async function getSearchRun(id: number) {
  return (await db.select().from(searchRuns).where(eq(searchRuns.id, id)).limit(1))[0] ?? null;
}

export async function updateSearchRun(id: number, values: Partial<typeof searchRuns.$inferInsert>) {
  await db.update(searchRuns).set(values).where(eq(searchRuns.id, id));
}

export async function saveAnalysis(vacancyId: number, analysis: Omit<typeof vacancyAnalyses.$inferInsert, "vacancyId">) {
  await db.transaction(async (tx) => {
    await tx.insert(vacancyAnalyses).values({ vacancyId, ...analysis });
    await tx.update(vacancies).set({ status: "ANALYZED", updatedAt: new Date() }).where(and(eq(vacancies.id, vacancyId), inArray(vacancies.status, ["NEW", "ANALYZING", "ANALYZED"])));
  });
}

export async function createUsage(values: typeof aiUsage.$inferInsert) {
  await db.insert(aiUsage).values(values);
}

export async function getUsageSummary() {
  const rows = await db.select({
    requests: sql<number>`count(*)::int`,
    input: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)::int`,
    output: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)::int`,
    cost: sql<string>`coalesce(sum(${aiUsage.estimatedCost}), 0)`,
  }).from(aiUsage);
  return rows[0];
}

export async function createCoverLetter(values: typeof coverLetters.$inferInsert) {
  return (await db.insert(coverLetters).values(values).returning())[0];
}

export async function getLatestCoverLetter(vacancyId: number) {
  return (await db.select().from(coverLetters).where(eq(coverLetters.vacancyId, vacancyId)).orderBy(desc(coverLetters.updatedAt)).limit(1))[0] ?? null;
}

export async function getJobSearchStats() {
  const [resumeStats] = await db.select({
    total: sql<number>`count(*)::int`,
    active: sql<number>`coalesce(sum(case when ${resumes.isActive} = 1 then 1 else 0 end), 0)::int`,
  }).from(resumes);

  const vacancyRows = await db.select({
    status: vacancies.status,
    count: sql<number>`count(*)::int`,
  }).from(vacancies).groupBy(vacancies.status);

  const vacancyByStatus = Object.fromEntries(vacancyRows.map((row) => [row.status, row.count])) as Record<string, number>;
  const vacancyTotal = vacancyRows.reduce((sum, row) => sum + row.count, 0);

  const [decisionStats] = await db.select({
    liked: sql<number>`coalesce(sum(case when ${userDecisions.decision} = 'LIKED' then 1 else 0 end), 0)::int`,
    rejected: sql<number>`coalesce(sum(case when ${userDecisions.decision} = 'REJECTED' then 1 else 0 end), 0)::int`,
    total: sql<number>`count(*)::int`,
  }).from(userDecisions);

  const [analysisStats] = await db.select({
    total: sql<number>`count(*)::int`,
    avgScore: sql<string>`coalesce(round(avg(${vacancyAnalyses.score})::numeric, 1), 0)`,
    high: sql<number>`coalesce(sum(case when ${vacancyAnalyses.recommendation} = 'high' then 1 else 0 end), 0)::int`,
    medium: sql<number>`coalesce(sum(case when ${vacancyAnalyses.recommendation} = 'medium' then 1 else 0 end), 0)::int`,
    low: sql<number>`coalesce(sum(case when ${vacancyAnalyses.recommendation} = 'low' then 1 else 0 end), 0)::int`,
  }).from(vacancyAnalyses);

  const [letterStats] = await db.select({
    total: sql<number>`count(*)::int`,
  }).from(coverLetters);

  const [runStats] = await db.select({
    total: sql<number>`count(*)::int`,
    fetched: sql<number>`coalesce(sum(${searchRuns.fetched}), 0)::int`,
    newVacancies: sql<number>`coalesce(sum(${searchRuns.newVacancies}), 0)::int`,
    analyzed: sql<number>`coalesce(sum(${searchRuns.analyzed}), 0)::int`,
    failed: sql<number>`coalesce(sum(${searchRuns.failed}), 0)::int`,
  }).from(searchRuns);

  const usage = await getUsageSummary();
  const settings = await getSearchSettings();
  const activeResume = await getActiveResume();

  const liked = vacancyByStatus.LIKED ?? 0;
  const rejected = vacancyByStatus.REJECTED ?? 0;
  const queue = (vacancyByStatus.ANALYZED ?? 0) + (vacancyByStatus.NEW ?? 0) + (vacancyByStatus.ANALYZING ?? 0);
  const decided = liked + rejected;
  const likeRate = decided > 0 ? Math.round((liked / decided) * 100) : 0;

  return {
    resumes: {
      total: resumeStats?.total ?? 0,
      active: resumeStats?.active ?? 0,
      activeName: activeResume?.name ?? null,
    },
    vacancies: {
      total: vacancyTotal,
      new: vacancyByStatus.NEW ?? 0,
      analyzing: vacancyByStatus.ANALYZING ?? 0,
      analyzed: vacancyByStatus.ANALYZED ?? 0,
      liked,
      rejected,
      queue,
    },
    decisions: {
      liked: decisionStats?.liked ?? liked,
      rejected: decisionStats?.rejected ?? rejected,
      total: decisionStats?.total ?? decided,
      likeRate,
    },
    analysis: {
      total: analysisStats?.total ?? 0,
      avgScore: Number(analysisStats?.avgScore ?? 0),
      high: analysisStats?.high ?? 0,
      medium: analysisStats?.medium ?? 0,
      low: analysisStats?.low ?? 0,
    },
    coverLetters: {
      total: letterStats?.total ?? 0,
    },
    runs: {
      total: runStats?.total ?? 0,
      fetched: runStats?.fetched ?? 0,
      newVacancies: runStats?.newVacancies ?? 0,
      analyzed: runStats?.analyzed ?? 0,
      failed: runStats?.failed ?? 0,
    },
    usage: {
      requests: usage?.requests ?? 0,
      tokens: (usage?.input ?? 0) + (usage?.output ?? 0),
      cost: Number(usage?.cost ?? 0),
    },
    search: {
      query: settings?.query || null,
      salaryFrom: settings?.salaryFrom ?? null,
      remoteOnly: settings?.remoteOnly === 1,
    },
  };
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  analyzeAllNewAction,
  analyzeSelectedAction,
  analyzeVacancyAction,
  clearInboxAction,
  deleteInboxVacancyAction,
  deleteSelectedInboxAction,
  fetchVacanciesAction,
  loadVacancyDescriptionAction,
  saveFetchFiltersAction,
} from "@/app/fetch/actions";
import { AreaSelect } from "@/components/fetch/area-select";

type Run = {
  id: number;
  status: string;
  runType?: string;
  fetched: number;
  newVacancies: number;
  analyzed: number;
  failed: number;
  errorMessage?: string | null;
};

type InboxVacancy = {
  id: number;
  title: string;
  employer: string | null;
  salary: string | null;
  area: string | null;
  workFormat: string | null;
  experience: string | null;
  description: string | null;
  requirements: string | null;
  responsibilities: string | null;
  url: string;
  firstFetchedAt: Date;
};

type HhResume = { id: string; title: string };
type HhArea = { id: string; name: string; label: string };

export function FetchWorkspace({
  settings,
  hhConfigured,
  hhResumes,
  hhResumesError,
  areas,
  inbox,
}: {
  settings: {
    query: string;
    areaId: number | null;
    salaryFrom: number | null;
    remoteOnly: number;
    experience: string | null;
    periodDays: number;
    searchSource: string;
    hhResumeId: string | null;
    hhResumeTitle: string | null;
    limit: number;
  } | null;
  hhConfigured: boolean;
  hhResumes: HhResume[];
  hhResumesError: string | null;
  areas: HhArea[];
  inbox: InboxVacancy[];
}) {
  const [run, setRun] = useState<Run | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loadingDescriptionId, setLoadingDescriptionId] = useState<number | null>(null);
  const [descriptionOverrides, setDescriptionOverrides] = useState<
    Record<number, { description: string | null; requirements: string | null; responsibilities: string | null }>
  >({});
  const [descriptionErrors, setDescriptionErrors] = useState<Record<number, string>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!run || ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"].includes(run.status)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/search-runs/${run.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const updated = (await response.json()) as Run;
      setRun(updated);
      if (["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"].includes(updated.status)) router.refresh();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [router, run]);

  function toggle(id: number) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll() {
    setSelected((current) => (current.length === inbox.length ? [] : inbox.map((item) => item.id)));
  }

  function vacancyDescription(vacancy: InboxVacancy) {
    return descriptionOverrides[vacancy.id] ?? {
      description: vacancy.description,
      requirements: vacancy.requirements,
      responsibilities: vacancy.responsibilities,
    };
  }

  function hasDescription(vacancy: InboxVacancy) {
    const text = vacancyDescription(vacancy);
    return Boolean(text.description || text.requirements || text.responsibilities);
  }

  function openDescription(vacancy: InboxVacancy) {
    if (expanded === vacancy.id) {
      setExpanded(null);
      return;
    }

    setExpanded(vacancy.id);
    if (hasDescription(vacancy)) return;

    setLoadingDescriptionId(vacancy.id);
    setDescriptionErrors((current) => {
      const next = { ...current };
      delete next[vacancy.id];
      return next;
    });

    startTransition(async () => {
      try {
        const loaded = await loadVacancyDescriptionAction(vacancy.id);
        setDescriptionOverrides((current) => ({ ...current, [vacancy.id]: loaded }));
      } catch (error) {
        setDescriptionErrors((current) => ({
          ...current,
          [vacancy.id]: error instanceof Error ? error.message : "Не удалось загрузить описание.",
        }));
      } finally {
        setLoadingDescriptionId(null);
      }
    });
  }

  const isRunning = run ? !["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"].includes(run.status) : false;
  const progressTotal = run?.runType === "analyze" ? run.newVacancies : run?.newVacancies ?? 0;
  const progressDone = (run?.analyzed ?? 0) + (run?.failed ?? 0);
  const progress = progressTotal ? Math.round((progressDone / progressTotal) * 100) : 0;

  function buildClientFormData(form: HTMLFormElement) {
    const formData = new FormData(form);
    const selected = String(formData.get("hhResumeId") ?? "").trim();
    const manual = String(formData.get("hhResumeIdManual") ?? "").trim();
    if (!selected && manual) formData.set("hhResumeId", manual);
    formData.delete("hhResumeIdManual");
    return formData;
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Фильтры перед загрузкой</h2>
        <p className="muted" style={{ margin: 0 }}>
          Сначала задайте параметры как на HH, затем загрузите вакансии. AI-анализ запускается отдельно — точечно или для всех.
        </p>
        <form
          id="fetch-filters-form"
          action={saveFetchFiltersAction}
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const formData = buildClientFormData(event.currentTarget);
              await saveFetchFiltersAction(formData);
              router.refresh();
            });
          }}
        >
          <label className="label">
            Источник
            <select className="select" name="searchSource" defaultValue={settings?.searchSource ?? "personal"}>
              <option value="personal">Подходящие по резюме HH</option>
              <option value="public">Публичный поиск HH</option>
            </select>
          </label>
          <label className="label">
            Резюме HH
            <select className="select" name="hhResumeId" defaultValue={settings?.hhResumeId ?? ""}>
              <option value="">Выберите резюме</option>
              {hhResumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.title}
                </option>
              ))}
            </select>
          </label>
          {!hhResumes.length && (
            <label className="label">
              Hash резюме вручную
              <input
                className="input"
                name="hhResumeIdManual"
                defaultValue={settings?.hhResumeId && !hhResumes.some((resume) => resume.id === settings.hhResumeId) ? settings.hhResumeId : ""}
                placeholder="Из URL: hh.ru/resume/abc123…"
              />
              <span className="muted">Откройте резюме на HH — hash это часть ссылки после /resume/</span>
            </label>
          )}
          {hhResumesError && (
            <p className="muted" style={{ color: "#b91c1c", margin: 0 }}>
              {hhResumesError}
            </p>
          )}
          {hhConfigured && !hhResumes.length && !hhResumesError && (
            <p className="muted" style={{ margin: 0 }}>
              Список пуст. Обновите страницу после сохранения кук или вставьте hash резюме вручную.
            </p>
          )}
          {!hhConfigured && <p className="muted">Для персональной выдачи сохраните куки HH выше и обновите страницу.</p>}
          <label className="label">
            Ключевые слова
            <input className="input" name="query" defaultValue={settings?.query ?? ""} placeholder="Необязательно для персональной выдачи" />
          </label>
          <AreaSelect areas={areas} value={settings?.areaId ? String(settings.areaId) : ""} />
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "start" }}>
            <label className="label">
              Зарплата от
              <input className="input" name="salaryFrom" type="number" defaultValue={settings?.salaryFrom ?? ""} />
            </label>
            <label className="label">
              Период
              <select className="select" name="periodDays" defaultValue={String(settings?.periodDays ?? 1)}>
                <option value="1">За сутки</option>
                <option value="3">За 3 дня</option>
                <option value="7">За неделю</option>
                <option value="30">За месяц</option>
              </select>
            </label>
            <label className="label">
              Лимит
              <input className="input" name="limit" type="number" min="1" max="100" defaultValue={settings?.limit ?? 30} />
            </label>
          </div>
          <label className="label">
            Опыт
            <select className="select" name="experience" defaultValue={settings?.experience ?? ""}>
              <option value="">Не важен</option>
              <option value="noExperience">Нет опыта</option>
              <option value="between1And3">1–3 года</option>
              <option value="between3And6">3–6 лет</option>
              <option value="moreThan6">Более 6 лет</option>
            </select>
          </label>
          <label>
            <input name="remoteOnly" type="checkbox" defaultChecked={settings?.remoteOnly === 1} /> Только удалёнка
          </label>
          <button className="button secondary" type="submit" disabled={pending}>
            Сохранить фильтры
          </button>
        </form>
        <p className="muted" style={{ margin: 0 }}>
          «Загрузить вакансии» автоматически сохранит текущие фильтры, включая выбранное резюме.
        </p>
        <button
          className="button"
          type="button"
          disabled={pending || isRunning}
          onClick={() =>
            startTransition(async () => {
              try {
                const form = document.getElementById("fetch-filters-form") as HTMLFormElement | null;
                if (!form) throw new Error("Форма фильтров не найдена.");
                setRun((await fetchVacanciesAction(buildClientFormData(form))) as Run);
              } catch (error) {
                setRun({
                  id: 0,
                  status: "FAILED",
                  fetched: 0,
                  newVacancies: 0,
                  analyzed: 0,
                  failed: 0,
                  errorMessage: error instanceof Error ? error.message : "Не удалось загрузить вакансии.",
                });
              }
            })
          }
        >
          {pending || isRunning ? "Загружаем…" : "Загрузить вакансии (без AI)"}
        </button>
        {run && (
          <div className="card stack">
            <strong>{run.status === "FAILED" ? "Операция не выполнена" : run.runType === "analyze" ? "AI-анализ" : "Загрузка"}</strong>
            {run.status !== "FAILED" && run.runType === "fetch" && (
              <span>
                Получено: {run.fetched} · Новых: {run.newVacancies}
              </span>
            )}
            {run.status !== "FAILED" && run.runType === "analyze" && (
              <>
                <progress value={progress} max={100} style={{ width: "100%" }} />
                <span>
                  {progressDone} / {progressTotal} · {progress}%{run.failed ? ` · ошибок: ${run.failed}` : ""}
                </span>
              </>
            )}
            {run.errorMessage && <span style={{ color: "#b91c1c" }}>{run.errorMessage}</span>}
          </div>
        )}
      </section>

      <section className="panel stack">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Входящие ({inbox.length})</h2>
          <div className="nav">
            <button className="button secondary" type="button" onClick={toggleAll} disabled={!inbox.length}>
              {selected.length === inbox.length ? "Снять выделение" : "Выбрать все"}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={!selected.length || isRunning}
              onClick={() =>
                startTransition(async () => {
                  setRun((await analyzeSelectedAction(selected)) as Run);
                  setSelected([]);
                })
              }
            >
              Анализировать выбранные
            </button>
            <button
              className="button"
              type="button"
              disabled={!inbox.length || isRunning}
              onClick={() =>
                startTransition(async () => {
                  setRun((await analyzeAllNewAction()) as Run);
                  setSelected([]);
                })
              }
            >
              Анализировать все
            </button>
            <button
              className="button danger"
              type="button"
              disabled={!selected.length || isRunning}
              onClick={() =>
                startTransition(async () => {
                  await deleteSelectedInboxAction(selected);
                  setSelected([]);
                  setExpanded(null);
                  router.refresh();
                })
              }
            >
              Удалить выбранные
            </button>
            <button
              className="button danger"
              type="button"
              disabled={!inbox.length || isRunning}
              onClick={() => {
                if (!window.confirm(`Удалить все входящие вакансии (${inbox.length})?`)) return;
                startTransition(async () => {
                  await clearInboxAction();
                  setSelected([]);
                  setExpanded(null);
                  router.refresh();
                });
              }}
            >
              Очистить входящие
            </button>
          </div>
        </div>
        {!inbox.length ? (
          <p className="muted">После загрузки вакансии появятся здесь. AI не запускается автоматически.</p>
        ) : (
          <div className="stack">
            {inbox.map((vacancy) => {
              const text = vacancyDescription(vacancy);
              const isExpanded = expanded === vacancy.id;
              const isLoadingDescription = loadingDescriptionId === vacancy.id;

              return (
              <div key={vacancy.id} className="resume-list-item stack" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
                <label style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <input type="checkbox" checked={selected.includes(vacancy.id)} onChange={() => toggle(vacancy.id)} />
                  <span className="stack" style={{ gap: 4 }}>
                    <strong>{vacancy.title}</strong>
                    <span className="muted">
                      {vacancy.employer ?? "Компания не указана"} · {vacancy.salary ?? "Зарплата не указана"} · {vacancy.workFormat ?? "Формат не указан"}
                      {vacancy.experience ? ` · ${vacancy.experience}` : ""}
                    </span>
                    <span className="muted">{vacancy.area ?? "Регион не указан"}</span>
                    <span className="muted">{new Date(vacancy.firstFetchedAt).toLocaleString("ru-RU")}</span>
                  </span>
                </label>
                <div className="nav">
                  <button className="button secondary" type="button" onClick={() => openDescription(vacancy)} disabled={isLoadingDescription}>
                    {isLoadingDescription ? "Загружаем…" : isExpanded ? "Скрыть описание" : "Показать описание"}
                  </button>
                  <a className="button secondary" href={vacancy.url} target="_blank" rel="noreferrer">
                    Открыть HH
                  </a>
                  <button
                    className="button"
                    type="button"
                    disabled={isRunning}
                    onClick={() =>
                      startTransition(async () => {
                        setRun((await analyzeVacancyAction(vacancy.id)) as Run);
                      })
                    }
                  >
                    Анализировать
                  </button>
                  <button
                    className="button danger"
                    type="button"
                    disabled={isRunning}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteInboxVacancyAction(vacancy.id);
                        setSelected((current) => current.filter((id) => id !== vacancy.id));
                        if (expanded === vacancy.id) setExpanded(null);
                        router.refresh();
                      })
                    }
                  >
                    Удалить
                  </button>
                </div>
                {isExpanded && (
                  <div className="card stack" style={{ gap: 10 }}>
                    {text.description && (
                      <div className="stack" style={{ gap: 4 }}>
                        <strong>Описание</strong>
                        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{text.description}</p>
                      </div>
                    )}
                    {text.requirements && (
                      <div className="stack" style={{ gap: 4 }}>
                        <strong>Требования</strong>
                        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{text.requirements}</p>
                      </div>
                    )}
                    {text.responsibilities && (
                      <div className="stack" style={{ gap: 4 }}>
                        <strong>Обязанности</strong>
                        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{text.responsibilities}</p>
                      </div>
                    )}
                    {!hasDescription(vacancy) && !isLoadingDescription && (
                      <p className="muted" style={{ margin: 0 }}>
                        {descriptionErrors[vacancy.id] ?? "HH не отдал текст по этой вакансии."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

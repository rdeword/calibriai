"use client";

import { useMemo, useState } from "react";
import { deleteVacancyAction } from "@/app/actions";
import { scoreColor } from "@/lib/score-color";
import { VacancyCard } from "./vacancy-card";

type HistoryItem = {
  vacancy: {
    id: number;
    title: string;
    employer: string | null;
    salary: string | null;
    area: string | null;
    workFormat: string | null;
    experience?: string | null;
    url: string;
    updatedAt: Date | string;
  };
  analysis: {
    score: number;
    summary: string;
    pros: unknown;
    cons: unknown;
    redFlags: unknown;
    reasoning: string;
    salaryEstimate: string | null;
    salaryEstimateConfidence: string | null;
    salaryEstimateReasoning: string | null;
    hhFolder?: string | null;
    hardFiltersPassed?: number | null;
    hardFilterFailures?: unknown;
    criteria?: unknown;
    clarifyingQuestions?: unknown;
    skillsMatch?: number | null;
    experienceMatch?: number | null;
    salaryMatch?: number | null;
    roleMatch?: number | null;
    recommendation?: string | null;
  } | null;
  hasCoverLetter?: boolean;
};

type DateFilter = "all" | "today" | "earlier";

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function folderShort(folder?: string | null, recommendation?: string | null) {
  const value = folder || (recommendation === "high" ? "fit" : recommendation === "medium" ? "maybe" : recommendation === "low" ? "not_now" : null);
  if (value === "fit") return { text: "Подходит", className: "hh-folder hh-folder-fit" };
  if (value === "maybe") return { text: "Можно", className: "hh-folder hh-folder-maybe" };
  if (value === "not_now") return { text: "Не сейчас", className: "hh-folder hh-folder-not-now" };
  return null;
}

function dayLabel(date: Date, today: Date, yesterday: Date) {
  const key = dayKey(date);
  if (key === dayKey(today)) return "Сегодня";
  if (key === dayKey(yesterday)) return "Вчера";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function HistoryVacancyList({
  items,
  canDecide = false,
  canGenerateLetter = false,
  showDateFilter = false,
}: {
  items: HistoryItem[];
  canDecide?: boolean;
  canGenerateLetter?: boolean;
  showDateFilter?: boolean;
}) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const grouped = useMemo(() => {
    const today = startOfDay(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const filtered = items.filter((item) => {
      const updated = startOfDay(toDate(item.vacancy.updatedAt));
      const isToday = dayKey(updated) === dayKey(today);
      if (dateFilter === "today") return isToday;
      if (dateFilter === "earlier") return !isToday;
      return true;
    });

    const map = new Map<string, { label: string; items: HistoryItem[] }>();
    for (const item of filtered) {
      const updated = toDate(item.vacancy.updatedAt);
      const key = dayKey(updated);
      if (!map.has(key)) {
        map.set(key, { label: dayLabel(updated, today, yesterday), items: [] });
      }
      map.get(key)!.items.push(item);
    }

    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([, group]) => group);
  }, [dateFilter, items]);

  if (!items.length) return <div className="empty-state muted">Пока нет вакансий в этом разделе.</div>;

  return (
    <div className="stack" style={{ gap: 12 }}>
      {showDateFilter && (
        <div className="history-date-filters">
          <button className={`button secondary${dateFilter === "all" ? " is-active" : ""}`} type="button" onClick={() => setDateFilter("all")}>
            Все
          </button>
          <button className={`button secondary${dateFilter === "today" ? " is-active" : ""}`} type="button" onClick={() => setDateFilter("today")}>
            Сегодня
          </button>
          <button className={`button secondary${dateFilter === "earlier" ? " is-active" : ""}`} type="button" onClick={() => setDateFilter("earlier")}>
            Другие даты
          </button>
        </div>
      )}

      {!grouped.length ? (
        <div className="empty-state muted">
          {dateFilter === "today" ? "За сегодня в этом разделе пока пусто." : "Нет вакансий за выбранный период."}
        </div>
      ) : (
        grouped.map((group) => (
          <section key={group.label} className="stack" style={{ gap: 8 }}>
            {showDateFilter && <h3 className="history-day-label">{group.label}</h3>}
            <div className="history-list">
              {group.items.map(({ vacancy, analysis, hasCoverLetter }) => {
                const folder = analysis ? folderShort(analysis.hhFolder, analysis.recommendation) : null;
                return (
                <div className="history-row" key={vacancy.id}>
                  <details className="history-item">
                    <summary>
                      <span>
                        <strong>{vacancy.title}</strong>
                        <small>
                          {vacancy.employer ?? "Компания не указана"} · {toDate(vacancy.updatedAt).toLocaleDateString("ru-RU")}
                          {hasCoverLetter ? " · письмо есть" : ""}
                        </small>
                      </span>
                      <span className="history-meta">
                        {hasCoverLetter && <span className="history-letter-badge">Письмо</span>}
                        {folder && <span className={folder.className}>{folder.text}</span>}
                        {analysis && (
                          <span className="history-score" style={{ color: scoreColor(analysis.score) }}>
                            {analysis.score}
                          </span>
                        )}
                      </span>
                    </summary>
                    <div className="history-expanded">
                      <VacancyCard vacancy={vacancy} analysis={analysis} history canDecide={canDecide} canGenerateLetter={canGenerateLetter} />
                    </div>
                  </details>
                  <form action={deleteVacancyAction} className="history-delete">
                    <input type="hidden" name="vacancyId" value={vacancy.id} />
                    <button className="button danger" type="submit" title="Удалить вакансию">
                      Удалить
                    </button>
                  </form>
                </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

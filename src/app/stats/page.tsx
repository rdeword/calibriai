import Link from "next/link";
import { getJobSearchStats } from "@/lib/db/queries";

function StatCard({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className="stats-card">
      <strong>{value}</strong>
      <p className="muted">{label}</p>
      {hint ? <span className="muted">{hint}</span> : null}
    </div>
  );
}

export default async function StatsPage() {
  const stats = await getJobSearchStats();

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <p className="section-kicker">pulse</p>
        <h1 className="page-title">Статистика</h1>
        <p className="muted" style={{ margin: "8px 0 0", maxWidth: 640 }}>
          Сводка по резюме, решениям и воронке поиска. Сюда же сведены AI-оценка и сопроводительные письма.
        </p>
      </div>

      <section className="stack">
        <h2 className="stats-section-title">Резюме и решения</h2>
        <div className="stats-grid">
          <StatCard value={stats.resumes.total} label="Резюме добавлено" hint={stats.resumes.activeName ? `Активное: ${stats.resumes.activeName}` : "Активное не выбрано"} />
          <StatCard value={stats.vacancies.liked} label="Одобрено" hint="статус LIKED" />
          <StatCard value={stats.vacancies.rejected} label="Отклонено" hint="статус REJECTED" />
          <StatCard value={`${stats.decisions.likeRate}%`} label="Доля одобрений" hint={`из ${stats.decisions.total} решений`} />
        </div>
      </section>

      <section className="stack">
        <h2 className="stats-section-title">Воронка вакансий</h2>
        <div className="stats-grid">
          <StatCard value={stats.vacancies.total} label="Всего вакансий" />
          <StatCard value={stats.vacancies.queue} label="В очереди" hint="NEW + ANALYZING + ANALYZED" />
          <StatCard value={stats.vacancies.analyzed} label="Готовы к просмотру" />
          <StatCard value={stats.vacancies.new + stats.vacancies.analyzing} label="Ещё без решения AI" hint={`NEW: ${stats.vacancies.new} · ANALYZING: ${stats.vacancies.analyzing}`} />
        </div>
      </section>

      <section className="stack">
        <h2 className="stats-section-title">AI-оценка</h2>
        <div className="stats-grid">
          <StatCard value={stats.analysis.total} label="Анализов" />
          <StatCard value={stats.analysis.avgScore || "—"} label="Средний score" />
          <StatCard value={stats.analysis.high} label="Рекомендуется" hint="high" />
          <StatCard value={stats.analysis.medium + stats.analysis.low} label="Слабее / среднее" hint={`medium: ${stats.analysis.medium} · low: ${stats.analysis.low}`} />
        </div>
      </section>

      <section className="stack">
        <h2 className="stats-section-title">Поиск и активность</h2>
        <div className="stats-grid">
          <StatCard value={stats.coverLetters.total} label="Сопроводительных" />
          <StatCard value={stats.runs.total} label="Запусков поиска" hint={`новых: ${stats.runs.newVacancies}`} />
          <StatCard value={stats.runs.fetched} label="Получено с HH" hint={`ошибок анализа: ${stats.runs.failed}`} />
          <StatCard value={stats.usage.requests} label="AI-запросов" hint={stats.usage.cost > 0 ? `~$${stats.usage.cost.toFixed(4)}` : `${stats.usage.tokens} токенов`} />
        </div>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Текущие настройки поиска</h2>
        {stats.search.query ? (
          <p style={{ margin: 0 }}>
            Запрос: <strong>{stats.search.query}</strong>
            {stats.search.salaryFrom ? ` · зарплата от ${stats.search.salaryFrom.toLocaleString("ru-RU")}` : ""}
            {stats.search.remoteOnly ? " · только удалёнка" : ""}
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Параметры поиска ещё не сохранены.</p>
        )}
        <div className="nav">
          <Link className="button secondary" href="/history">История</Link>
          <Link className="button secondary" href="/resumes">Резюме</Link>
          <Link className="button secondary" href="/usage">AI usage</Link>
          <Link className="button" href="/">К вакансиям</Link>
        </div>
      </section>
    </div>
  );
}

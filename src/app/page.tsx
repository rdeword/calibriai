import Link from "next/link";
import { HistoryVacancyList } from "@/components/vacancy/history-vacancy-list";
import { listActionableVacancies } from "@/lib/db/queries";

export default async function HomePage() {
  const vacancies = await listActionableVacancies();
  const recommended = vacancies.filter(({ analysis }) => analysis?.recommendation === "high").length;
  return <div className="stack" style={{ gap: 28 }}>
    <section className="hero">
      <div className="hero-copy">
        <p className="section-kicker">side channel · hh-adjacent</p>
        <h1 className="page-title">Разбор вакансий без официального API</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 560, fontSize: 17, lineHeight: 1.45 }}>
          Похоже на привычный поиск работы, только сбоку: кидаете вакансию, AI сравнивает с резюме и говорит, стоит ли связываться.
        </p>
      </div>
      <div className="stat-strip">
        <div><strong>{vacancies.length}</strong><p className="muted">к просмотру</p></div>
        <div><strong>{recommended}</strong><p className="muted">рекомендуется</p></div>
        <div><strong>{vacancies.length - recommended}</strong><p className="muted">остальные</p></div>
      </div>
      <div className="hero-actions">
        <Link className="button" href="/import">Добавить вакансию</Link>
        <Link className="button secondary" href="#vacancies">Смотреть очередь</Link>
      </div>
    </section>

    <section id="vacancies" className="stack">
      <div>
        <p className="section-kicker">очередь</p>
        <h2 className="page-title" style={{ fontSize: 28 }}>Вакансии</h2>
      </div>
      {vacancies.length
        ? <HistoryVacancyList items={vacancies} canDecide />
        : <div className="empty-state stack">
          <strong>Пока пусто</strong>
          <p className="muted" style={{ margin: 0 }}>Добавьте резюме и ключ OpenAI, затем импортируйте первую вакансию вручную или через расширение.</p>
        </div>}
    </section>
  </div>;
}

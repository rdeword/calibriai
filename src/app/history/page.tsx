import { HistoryVacancyList } from "@/components/vacancy/history-vacancy-list";
import { listHistoryItems } from "@/lib/db/queries";

async function HistoryGroup({ status, title }: { status: "ANALYZED" | "LIKED" | "REJECTED"; title: string }) {
  const items = await listHistoryItems(status);
  return (
    <section className="stack">
      <h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2>
      <HistoryVacancyList items={items} canDecide={status === "ANALYZED"} canGenerateLetter={status === "LIKED"} showDateFilter />
    </section>
  );
}

export default async function HistoryPage() {
  return (
    <div className="stack" style={{ gap: 28 }}>
      <div>
        <p className="section-kicker">archive</p>
        <h1 className="page-title">История вакансий</h1>
        <p className="muted" style={{ margin: "8px 0 0", maxWidth: 640 }}>
          Сортировка по дате добавления в список. У вакансий с сопроводительным письмом есть отметка «Письмо».
        </p>
      </div>
      <HistoryGroup status="ANALYZED" title="Без решения" />
      <HistoryGroup status="LIKED" title="Понравились" />
      <HistoryGroup status="REJECTED" title="Отклонённые" />
    </div>
  );
}

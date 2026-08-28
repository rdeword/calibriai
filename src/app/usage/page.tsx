import { getUsageSummary } from "@/lib/db/queries";

export default async function UsagePage() {
  const usage = await getUsageSummary();
  const total = (usage.input ?? 0) + (usage.output ?? 0);
  const configuredCost = Number(usage.cost ?? 0);
  return <div className="stack" style={{ gap: 20 }}>
    <div>
      <p className="section-kicker">meter</p>
      <h1 className="page-title">AI usage</h1>
    </div>
    <section className="stat-strip">
      <div><strong>{usage.requests ?? 0}</strong><p className="muted">запросов</p></div>
      <div>
        <strong>{total}</strong>
        <p className="muted">токенов</p>
        <span className="muted">вход: {usage.input ?? 0} · выход: {usage.output ?? 0}</span>
      </div>
      <div>
        <strong>{configuredCost > 0 ? `$${configuredCost.toFixed(4)}` : "—"}</strong>
        <p className="muted">стоимость</p>
      </div>
    </section>
    <p className="muted">Стоимость считается только для моделей, цены которых указаны в конфигурации.</p>
  </div>;
}

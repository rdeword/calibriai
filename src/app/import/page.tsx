import { importVacancyAction } from "@/app/actions";

export default function ImportVacancyPage() {
  return <div className="stack" style={{ maxWidth: 800, margin: "0 auto", gap: 20 }}>
    <div>
      <p className="section-kicker">import channel</p>
      <h1 className="page-title">Добавить вакансию</h1>
      <p className="muted" style={{ maxWidth: 620 }}>Скопируйте текст из браузера или отправьте страницу через локальное расширение из папки <code>extension</code>. Ссылка нужна только чтобы потом вернуться к оригиналу.</p>
    </div>
    <section className="panel stack">
      <form action={importVacancyAction} className="stack">
        <label className="label">
          Название
          <input className="input" name="title" required minLength={2} placeholder="Senior Backend Developer" />
        </label>
        <label className="label">
          Компания
          <input className="input" name="employer" placeholder="Название компании" />
        </label>
        <label className="label">
          Ссылка на оригинал
          <input className="input" name="url" type="url" placeholder="https://hh.ru/vacancy/…" />
        </label>
        <label className="label">
          Текст вакансии
          <textarea className="textarea" name="description" required minLength={30} style={{ minHeight: 360 }} placeholder="Вставьте описание, требования, обязанности, условия и зарплату…" />
        </label>
        <label>
          <input name="analyzeImmediately" type="checkbox" /> Сразу отправить в AI
        </label>
        <button className="button" type="submit">Добавить вакансию</button>
      </form>
    </section>
  </div>;
}

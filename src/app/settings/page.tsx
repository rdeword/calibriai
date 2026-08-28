import { clearOpenAiCredentialsAction, saveOpenAiCredentialsAction, saveSettingsAction } from "@/app/actions";
import { getOpenAiConnectionStatus, getSearchSettings } from "@/lib/db/queries";

export default async function SettingsPage() {
  const [settings, openAi] = await Promise.all([getSearchSettings(), getOpenAiConnectionStatus()]);
  return <div className="stack" style={{ gap: 20 }}>
    <div>
      <p className="section-kicker">config</p>
      <h1 className="page-title">Настройки</h1>
    </div>
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Критерии оценки</h2>
        <form action={saveSettingsAction} className="stack">
          <label className="label">Желаемая должность<input className="input" name="query" required defaultValue={settings?.query ?? ""} placeholder="Например, системный аналитик" /></label>
          <label className="label">Зарплата от<input className="input" name="salaryFrom" type="number" defaultValue={settings?.salaryFrom ?? ""} /></label>
          <label className="label">Опыт<select className="select" name="experience" defaultValue={settings?.experience ?? ""}><option value="">Не важен</option><option value="noExperience">Нет опыта</option><option value="between1And3">1–3 года</option><option value="between3And6">3–6 лет</option><option value="moreThan6">Более 6 лет</option></select></label>
          <input name="areaId" type="hidden" value={settings?.areaId ?? ""} />
          <input name="limit" type="hidden" value={settings?.limit ?? 30} />
          <label><input name="remoteOnly" type="checkbox" defaultChecked={settings?.remoteOnly === 1} /> Только удалённая работа</label>
          <button className="button">Сохранить критерии</button>
        </form>
      </section>
      <section className="panel stack">
        <h2 style={{ margin: 0 }}>OpenAI</h2>
        {openAi.configured ? <div className="stack"><p>Ключ настроен: <code>{openAi.keyHint}</code></p><p className="muted">Модель: {openAi.model}</p><form action={clearOpenAiCredentialsAction}><button className="button danger">Удалить ключ</button></form></div> : <p className="muted">Ключ ещё не настроен.</p>}
        <form action={saveOpenAiCredentialsAction} className="stack">
          <label className="label">API-ключ<input className="input" name="apiKey" type="password" autoComplete="new-password" required placeholder="sk-…" /></label>
          <label className="label">Модель<input className="input" name="model" required defaultValue={openAi.configured ? openAi.model : process.env.OPENAI_MODEL ?? "gpt-5.5"} /></label>
          <p className="muted">Ключ шифруется перед сохранением и не возвращается в браузер.</p>
          <button className="button">{openAi.configured ? "Заменить ключ" : "Сохранить ключ"}</button>
        </form>
      </section>
    </div>
  </div>;
}

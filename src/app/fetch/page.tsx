import { FetchWorkspace } from "@/components/fetch/fetch-workspace";
import { HhCookiesForm } from "@/components/fetch/hh-cookies-form";
import { clearHhCookiesAction } from "@/app/fetch/actions";
import { getHhConnectionStatus, getSearchSettings, listNewVacancies } from "@/lib/db/queries";
import { listHhAreas } from "@/lib/hh/client";
import { listHhResumes } from "@/lib/hh/session-client";

export default async function FetchPage() {
  const [settings, hh, inbox] = await Promise.all([getSearchSettings(), getHhConnectionStatus(), listNewVacancies()]);
  let hhResumes: Array<{ id: string; title: string }> = [];
  let hhResumesError: string | null = null;
  let areas: Awaited<ReturnType<typeof listHhAreas>> = [];
  try {
    areas = await listHhAreas();
  } catch {
    areas = [
      { id: "113", name: "Россия", label: "Россия" },
      { id: "1", name: "Москва", label: "Москва · Россия" },
      { id: "2", name: "Санкт-Петербург", label: "Санкт-Петербург · Россия" },
    ];
  }
  if (hh.configured) {
    try {
      hhResumes = await listHhResumes();
      if (!hhResumes.length) {
        hhResumesError = "HH не вернул резюме. Убедитесь, что в аккаунте есть опубликованные резюме, или вставьте hash резюме вручную.";
      }
    } catch (error) {
      hhResumesError = error instanceof Error ? error.message : "Не удалось загрузить резюме HH.";
    }
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <p className="section-kicker">hh feed</p>
        <h1 className="page-title">Загрузка вакансий</h1>
        <p className="muted" style={{ margin: "8px 0 0", maxWidth: 720 }}>
          Задайте фильтры, загрузите вакансии без AI, затем отправьте в анализ одну, несколько или все сразу.
        </p>
      </div>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Сессия HH</h2>
        <p className="muted" style={{ margin: 0 }}>
          Нужна полная строка Cookie из DevTools. Calibri проверит её сразу при сохранении.
        </p>
        {hh.configured ? (
          <form action={clearHhCookiesAction}>
            <button className="button danger">Удалить куки HH</button>
          </form>
        ) : (
          <p className="muted">Куки ещё не сохранены.</p>
        )}
        <HhCookiesForm configured={hh.configured} />
      </section>

      <FetchWorkspace
        settings={
          settings
            ? {
                query: settings.query,
                areaId: settings.areaId ?? null,
                salaryFrom: settings.salaryFrom ?? null,
                remoteOnly: settings.remoteOnly,
                experience: settings.experience ?? null,
                periodDays: settings.periodDays ?? 1,
                searchSource: settings.searchSource ?? "personal",
                hhResumeId: settings.hhResumeId ?? null,
                hhResumeTitle: settings.hhResumeTitle ?? null,
                limit: settings.limit,
              }
            : null
        }
        hhConfigured={hh.configured}
        hhResumes={hhResumes}
        hhResumesError={hhResumesError}
        areas={areas}
        inbox={inbox.map((vacancy) => ({
          ...vacancy,
          area: vacancy.area ?? null,
          workFormat: vacancy.workFormat ?? null,
          experience: vacancy.experience ?? null,
          description: vacancy.description ?? null,
          requirements: vacancy.requirements ?? null,
          responsibilities: vacancy.responsibilities ?? null,
        }))}
      />
    </div>
  );
}

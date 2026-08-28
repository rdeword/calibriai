"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startSearchRunAction } from "@/app/actions";

type Run = { id: number; status: string; fetched: number; newVacancies: number; analyzed: number; failed: number; errorMessage?: string | null };

export function SearchRunner() {
  const [run, setRun] = useState<Run | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!run || ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"].includes(run.status)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/search-runs/${run.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const updated = await response.json() as Run;
      setRun(updated);
      if (["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"].includes(updated.status)) router.refresh();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [router, run]);

  function runSearch() {
    startTransition(async () => {
      try { setRun(await startSearchRunAction() as Run); }
      catch (error) { setRun({ id: 0, status: "FAILED", fetched: 0, newVacancies: 0, analyzed: 0, failed: 0, errorMessage: error instanceof Error ? error.message : "Не удалось начать поиск." }); }
    });
  }

  const total = run?.newVacancies ?? 0;
  const progress = total ? Math.round(((run?.analyzed ?? 0) + (run?.failed ?? 0)) / total * 100) : 0;
  return <div className="stack">
    <button className="button" disabled={pending || (run ? !["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"].includes(run.status) : false)} onClick={runSearch}>
      {pending ? "Запускаем…" : "Обновить вакансии"}
    </button>
    {run && <div className="card stack">
      <strong>{run.status === "FAILED" ? "Поиск не выполнен" : "Анализ вакансий"}</strong>
      {run.status !== "FAILED" && <><span>Получено: {run.fetched} · Новых: {run.newVacancies}</span><progress value={progress} max={100} style={{ width: "100%" }} /><span>{run.analyzed + run.failed} / {total} · {progress}%{run.failed ? ` · ошибок: ${run.failed}` : ""}</span></>}
      {run.errorMessage && <span style={{ color: "#b91c1c" }}>{run.errorMessage}</span>}
    </div>}
  </div>;
}

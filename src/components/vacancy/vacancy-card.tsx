import { reanalyzeVacancyAction, recordDecisionAction } from "@/app/actions";
import { scoreColor } from "@/lib/score-color";
import { LetterGenerator } from "./letter-generator";

type Criterion = {
  requirement?: string;
  importance?: string;
  status?: string;
  evidence?: string;
  impact?: string;
};

type CardProps = {
  vacancy: { id: number; title: string; employer: string | null; salary: string | null; area: string | null; workFormat: string | null; url: string };
  analysis: {
    score: number;
    summary: string;
    pros: unknown;
    cons: unknown;
    redFlags: unknown;
    reasoning: string;
    salaryEstimate?: string | null;
    salaryEstimateConfidence?: string | null;
    salaryEstimateReasoning?: string | null;
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
  history?: boolean;
  canDecide?: boolean;
  canGenerateLetter?: boolean;
};

function items(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function criteriaList(value: unknown): Criterion[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Criterion => !!item && typeof item === "object");
}

function confidence(value?: string | null) {
  return value === "high" ? "высокая" : value === "medium" ? "средняя" : "низкая";
}

function folderLabel(folder?: string | null, recommendation?: string | null) {
  const value = folder || (recommendation === "high" ? "fit" : recommendation === "medium" ? "maybe" : recommendation === "low" ? "not_now" : null);
  if (value === "fit") return { text: "Подходит", className: "hh-folder hh-folder-fit" };
  if (value === "maybe") return { text: "Можно рассмотреть", className: "hh-folder hh-folder-maybe" };
  if (value === "not_now") return { text: "Не сейчас", className: "hh-folder hh-folder-not-now" };
  return null;
}

function statusLabel(status?: string) {
  if (status === "met") return "есть";
  if (status === "partial") return "частично";
  if (status === "missing") return "нет";
  if (status === "unknown") return "неясно";
  return status ?? "";
}

function statusClass(status?: string) {
  if (status === "met") return "criterion-met";
  if (status === "partial") return "criterion-partial";
  if (status === "missing") return "criterion-missing";
  return "criterion-unknown";
}

export function VacancyCard({ vacancy, analysis, history = false, canDecide = false, canGenerateLetter = false }: CardProps) {
  const folder = analysis ? folderLabel(analysis.hhFolder, analysis.recommendation) : null;
  const failures = analysis ? items(analysis.hardFilterFailures) : [];
  const criteria = analysis ? criteriaList(analysis.criteria) : [];
  const questions = analysis ? items(analysis.clarifyingQuestions) : [];

  return <article className="panel stack">
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, letterSpacing: "-0.02em" }}>{vacancy.title}</h2>
        <p className="vacancy-meta" style={{ margin: "8px 0 0" }}>{vacancy.employer ?? "Компания не указана"} · {vacancy.area ?? "Регион не указан"}</p>
      </div>
      {analysis && (
        <div className="analysis-score-block">
          {folder && <span className={folder.className}>{folder.text}</span>}
          <span className="score" style={{ color: scoreColor(analysis.score) }}>{analysis.score}</span>
        </div>
      )}
    </div>
    <span className="vacancy-meta">{vacancy.salary ?? "Зарплата не указана"} · {vacancy.workFormat ?? "Формат не указан"}</span>
    {analysis ? <div className="stack">
      <p style={{ margin: 0, lineHeight: 1.5 }}>{analysis.summary}</p>

      {(analysis.skillsMatch != null || analysis.experienceMatch != null || analysis.salaryMatch != null || analysis.roleMatch != null) && (
        <div className="match-strip">
          {analysis.roleMatch != null && <span>Роль {analysis.roleMatch}</span>}
          {analysis.skillsMatch != null && <span>Навыки {analysis.skillsMatch}</span>}
          {analysis.experienceMatch != null && <span>Опыт {analysis.experienceMatch}</span>}
          {analysis.salaryMatch != null && <span>Зарплата {analysis.salaryMatch}</span>}
        </div>
      )}

      {analysis.hardFiltersPassed != null && (
        <div className={analysis.hardFiltersPassed ? "hard-pass" : "hard-fail"}>
          <strong>{analysis.hardFiltersPassed ? "Hard-фильтры: пройдены" : "Hard-фильтры: не пройдены"}</strong>
          {failures.length > 0 && <ul className="list">{failures.map((item) => <li key={item}>{item}</li>)}</ul>}
        </div>
      )}

      {criteria.length > 0 && (
        <div>
          <strong>Критерии портрета</strong>
          <ul className="criteria-list">
            {criteria.map((item, index) => (
              <li key={`${item.requirement ?? "c"}-${index}`} className={statusClass(item.status)}>
                <div className="criteria-head">
                  <span>{item.requirement}</span>
                  <span className="criteria-meta">
                    {item.importance === "must" ? "must" : "nice"} · {statusLabel(item.status)}
                  </span>
                </div>
                {item.evidence && <small>{item.evidence}</small>}
                {item.impact && <small className="criteria-impact">{item.impact}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.salaryEstimate && <div className="salary-estimate">
        <strong>Оценка зарплаты: {analysis.salaryEstimate}</strong>
        <span>Уверенность: {confidence(analysis.salaryEstimateConfidence)}</span>
        {analysis.salaryEstimateReasoning && <small>{analysis.salaryEstimateReasoning}</small>}
      </div>}
      <div><strong>Сильные стороны</strong><ul className="list">{items(analysis.pros).map((item) => <li key={item}>{item}</li>)}</ul></div>
      <div><strong>Сомнения</strong><ul className="list">{items(analysis.cons).map((item) => <li key={item}>{item}</li>)}</ul></div>
      <div><strong>Красные флаги</strong>{items(analysis.redFlags).length ? <ul className="list">{items(analysis.redFlags).map((item) => <li key={item}>{item}</li>)}</ul> : <span className="muted"> Красных флагов не обнаружено.</span>}</div>
      {questions.length > 0 && (
        <div>
          <strong>Что уточнил бы ИИ HH</strong>
          <ul className="list">{questions.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}
      {analysis.reasoning && <p className="muted" style={{ margin: 0, lineHeight: 1.45 }}>{analysis.reasoning}</p>}
    </div> : <p className="muted">AI-анализ пока отсутствует.</p>}
    <div className="nav">
      {(!history || canDecide) && <>
        <form action={recordDecisionAction}><input type="hidden" name="vacancyId" value={vacancy.id} /><input type="hidden" name="decision" value="REJECTED" /><button className="button danger">Отклонить</button></form>
        <form action={recordDecisionAction}><input type="hidden" name="vacancyId" value={vacancy.id} /><input type="hidden" name="decision" value="LIKED" /><button className="button success">Откликнуться</button></form>
      </>}
      {vacancy.url && <a className="button secondary" href={vacancy.url} target="_blank" rel="noreferrer">Открыть оригинал</a>}
      <form action={reanalyzeVacancyAction}><input type="hidden" name="vacancyId" value={vacancy.id} /><button className="button secondary">Переанализировать</button></form>
    </div>
    {history && canGenerateLetter && <LetterGenerator vacancyId={vacancy.id} />}
  </article>;
}

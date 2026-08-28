"use client";

import { useState } from "react";
import { createResumeAction, deleteResumeAction, setActiveResumeAction } from "@/app/actions";

type Resume = {
  id: number;
  name: string;
  textContent: string;
  isActive: number;
};

function formatBlocks(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function looksLikeHeading(line: string) {
  const trimmed = line.trim();
  return (
    trimmed.length <= 60 &&
    (/^[А-ЯA-Z0-9][А-ЯA-Z0-9\s/–—-]{1,58}$/.test(trimmed) ||
      /^(опыт|образование|навыки|skills|experience|education|проекты|о себе|контакты|достижения|ключевые)/i.test(trimmed))
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "Р";
}

function ResumeViewer({ resume, onHide }: { resume: Resume; onHide: () => void }) {
  const blocks = formatBlocks(resume.textContent);

  return (
    <div className="hh-resume stack">
      <div className="hh-resume-toolbar">
        <button type="button" className="button secondary" onClick={onHide}>
          Скрыть
        </button>
        {resume.isActive !== 1 && (
          <form action={setActiveResumeAction}>
            <input type="hidden" name="id" value={resume.id} />
            <button className="button secondary">Сделать активным</button>
          </form>
        )}
      </div>

      <article className="hh-resume-sheet">
        <header className="hh-resume-header">
          <div className="hh-resume-avatar" aria-hidden>
            {initials(resume.name)}
          </div>
          <div className="hh-resume-header-main">
            <p className="hh-resume-eyebrow">Резюме</p>
            <h2 className="hh-resume-title">{resume.name}</h2>
            <div className="hh-resume-meta">
              {resume.isActive === 1 ? (
                <span className="hh-resume-badge">Активное</span>
              ) : (
                <span className="hh-resume-meta-item">Неактивное</span>
              )}
              <span className="hh-resume-meta-item">
                {resume.textContent.length.toLocaleString("ru-RU")} символов
              </span>
            </div>
          </div>
        </header>

        <div className="hh-resume-body">
          {blocks.map((block, index) => {
            const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
            const [first, ...rest] = lines;

            if (first && looksLikeHeading(first) && rest.length) {
              return (
                <section key={`${resume.id}-${index}`} className="hh-resume-section">
                  <h3>{first}</h3>
                  <div className="hh-resume-section-content">
                    {rest.map((line, lineIndex) => (
                      <p key={`${resume.id}-${index}-${lineIndex}`}>{line}</p>
                    ))}
                  </div>
                </section>
              );
            }

            return (
              <section key={`${resume.id}-${index}`} className="hh-resume-section">
                <div className="hh-resume-section-content">
                  {lines.map((line, lineIndex) => (
                    <p key={`${resume.id}-${index}-${lineIndex}`}>{line}</p>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </article>
    </div>
  );
}

export function ResumesWorkspace({ resumes }: { resumes: Resume[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const openResume = resumes.find((item) => item.id === openId) ?? null;

  return (
    <div className="grid resumes-layout">
      <section className="panel stack resumes-main">
        {openResume ? (
          <ResumeViewer resume={openResume} onHide={() => setOpenId(null)} />
        ) : (
          <>
            <h2 style={{ margin: 0 }}>Загрузить PDF</h2>
            <p className="muted">Нужен PDF с текстовым слоем до 10 МБ. Название берётся из файла.</p>
            <form action={createResumeAction} className="stack">
              <label className="label">
                PDF-файл
                <input className="input" name="file" type="file" accept="application/pdf,.pdf" required />
              </label>
              <button className="button">Загрузить резюме</button>
            </form>
          </>
        )}
      </section>

      <aside className="panel stack resumes-sidebar">
        <h2 style={{ margin: 0 }}>Мои резюме</h2>
        {!resumes.length ? (
          <p className="muted">Резюме пока нет.</p>
        ) : (
          <div className="stack">
            {resumes.map((resume) => {
              const selected = resume.id === openId;
              return (
                <div key={resume.id} className={`resume-list-item stack${selected ? " is-selected" : ""}`}>
                  <button
                    type="button"
                    className="resume-list-open"
                    onClick={() => setOpenId(resume.id)}
                    aria-pressed={selected}
                  >
                    <span className="resume-list-open-title">
                      <strong>{resume.name}</strong>
                      {resume.isActive === 1 && <span className="tag">Активное</span>}
                    </span>
                    <span className="muted">
                      {resume.textContent.slice(0, 90)}
                      {resume.textContent.length > 90 ? "…" : ""}
                    </span>
                    <span className="resume-list-hint">{selected ? "Открыто слева" : "Открыть просмотр"}</span>
                  </button>
                  <div className="nav">
                    {resume.isActive !== 1 && (
                      <form action={setActiveResumeAction}>
                        <input type="hidden" name="id" value={resume.id} />
                        <button className="button secondary">Сделать активным</button>
                      </form>
                    )}
                    <form action={deleteResumeAction}>
                      <input type="hidden" name="id" value={resume.id} />
                      <button className="button danger">Удалить</button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}

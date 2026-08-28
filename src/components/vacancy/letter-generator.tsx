"use client";

import { useState, useTransition } from "react";
import { generateCoverLetterAction } from "@/app/actions";

export function LetterGenerator({ vacancyId }: { vacancyId: number }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      setError("");
      setCopied(false);
      try {
        const formData = new FormData();
        formData.set("vacancyId", String(vacancyId));
        const letter = await generateCoverLetterAction(formData);
        setContent(letter.content);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось сгенерировать письмо.");
      }
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
  }

  return <div className="stack">
    <button type="button" className="button" onClick={generate} disabled={pending}>{pending ? "Генерируем…" : content ? "Перегенерировать" : "Сгенерировать письмо"}</button>
    {error && <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>}
    {content && <>
      <textarea className="textarea" value={content} onChange={(event) => setContent(event.target.value)} aria-label="Сопроводительное письмо" />
      <button type="button" className="button secondary" onClick={copy}>{copied ? "Скопировано" : "Копировать"}</button>
    </>}
  </div>;
}

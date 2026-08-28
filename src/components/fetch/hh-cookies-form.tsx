"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveHhCookiesAction } from "@/app/fetch/actions";

export function HhCookiesForm({ configured }: { configured: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="stack">
      <details className="card stack" open={!configured}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Как правильно скопировать куки</summary>
        <ol className="muted" style={{ margin: 0, paddingLeft: 20 }}>
          <li>Откройте <strong>hh.ru</strong> и войдите в аккаунт соискателя.</li>
          <li>DevTools → <strong>Network</strong> (Сеть) → включите <strong>Disable cache</strong>.</li>
          <li>Обновите страницу (F5).</li>
          <li>Кликните запрос <strong>applicant</strong> или <strong>vacancy_response</strong> к домену hh.ru.</li>
          <li>Справа: <strong>Headers</strong> → <strong>Request Headers</strong> → строка <strong>Cookie</strong>.</li>
          <li>Скопируйте <strong>только значение</strong> (без слова Cookie:) — длинная строка через <code>;</code>.</li>
        </ol>
        <p className="muted" style={{ margin: 0 }}>
          Не используйте <code>document.cookie</code> в консоли — там нет HttpOnly-кук вроде <code>hhtoken</code>, без них сессия не работает.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          В строке должны быть минимум: <code>hhtoken</code>, <code>hhuid</code>, <code>_xsrf</code>.
        </p>
      </details>

      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setSuccess(null);
          startTransition(async () => {
            try {
              const formData = new FormData(event.currentTarget);
              await saveHhCookiesAction(formData);
              setSuccess("Куки сохранены и проверены — сессия HH принята.");
              router.refresh();
            } catch (submitError) {
              setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить куки HH.");
            }
          });
        }}
      >
        <label className="label">
          Cookie
          <textarea
            className="textarea"
            name="cookies"
            required
            placeholder="hhtoken=…; hhuid=…; _xsrf=…; …"
            style={{ minHeight: 120 }}
          />
        </label>
        {error && (
          <p className="muted" style={{ color: "#b91c1c", margin: 0 }}>
            {error}
          </p>
        )}
        {success && (
          <p className="muted" style={{ color: "#047857", margin: 0 }}>
            {success}
          </p>
        )}
        <button className="button secondary" type="submit" disabled={pending}>
          {pending ? "Проверяем…" : configured ? "Обновить и проверить куки" : "Сохранить и проверить куки"}
        </button>
      </form>
    </div>
  );
}

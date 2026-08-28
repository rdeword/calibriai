const IMPORTANT_COOKIES = ["hhtoken", "hhuid", "_xsrf"] as const;

export function normalizeHhCookies(raw: string) {
  let value = raw.trim();
  if (!value) return "";

  if (value.toLowerCase().startsWith("cookie:")) {
    value = value.slice("cookie:".length).trim();
  }

  if (value.includes("\t") && /\.hh\.ru/i.test(value)) {
    value = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .flatMap((line) => {
        const parts = line.split("\t");
        if (parts.length < 7) return [];
        const domain = parts[0];
        const name = parts[5];
        const cookieValue = parts[6];
        if (!/\.hh\.ru$/i.test(domain) || !name || !cookieValue) return [];
        return [`${name}=${cookieValue}`];
      })
      .join("; ");
  } else {
    value = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.replace(/^Cookie:\s*/i, ""))
      .join("; ");
  }

  const pairs = new Map<string, string>();
  for (const part of value.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    const cookieValue = trimmed.slice(eq + 1).trim();
    if (!name) continue;
    pairs.set(name, cookieValue);
  }

  return [...pairs.entries()].map(([name, cookieValue]) => `${name}=${cookieValue}`).join("; ");
}

export function diagnoseHhCookies(raw: string) {
  const normalized = normalizeHhCookies(raw);
  const names = new Set(
    normalized
      .split(";")
      .map((part) => part.trim().split("=")[0]?.trim().toLowerCase())
      .filter(Boolean),
  );

  const missing = IMPORTANT_COOKIES.filter((name) => !names.has(name));
  const present = IMPORTANT_COOKIES.filter((name) => names.has(name));

  return {
    normalized,
    missing,
    present,
    looksValid: normalized.length >= 20 && missing.length === 0,
  };
}

export function hhCookiesHelpText(missing: string[]) {
  if (!missing.length) return null;
  return `Не хватает важных кук: ${missing.join(", ")}. Скорее всего вы скопировали не весь заголовок Cookie — document.cookie их не покажет.`;
}

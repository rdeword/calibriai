(() => {
  const NOISE_SELECTORS = [
    "header",
    "nav",
    "footer",
    "[data-qa='mainmenu']",
    "[data-qa='search-input']",
    "[data-qa='account']",
    "[data-qa='login']",
    ".supernova-navi",
    ".supernova-footer",
    ".bloko-modal",
    "[role='dialog']",
    "script",
    "style",
    "noscript",
    "iframe",
  ];

  const TITLE_SELECTORS = [
    "[data-qa='vacancy-title']",
    "[data-qa='vacancy-name']",
    "h1[data-qa='bloko-header-1']",
    "h1.bloko-header-section-1",
    "[data-qa='title'] h1",
    "main h1",
    "h1",
  ];

  const EMPLOYER_SELECTORS = [
    "[data-qa='vacancy-company-name'] a",
    "[data-qa='vacancy-company-name']",
    "[data-qa='vacancy-company-title']",
    ".vacancy-company-name",
  ];

  const SALARY_SELECTORS = [
    "[data-qa='vacancy-salary']",
    "[data-qa='vacancy-salary-compensation-type-net']",
    "[data-qa='vacancy-salary-compensation-type-gross']",
    "[data-qa='vacancy-compensation']",
    ".vacancy-salary",
  ];

  const AREA_SELECTORS = [
    "[data-qa='vacancy-view-location']",
    "[data-qa='vacancy-view-raw-address']",
    "[data-qa='vacancy-view-location-label']",
  ];

  const DESCRIPTION_SELECTORS = [
    "[data-qa='vacancy-description']",
    "[data-qa='vacancy-view-description']",
    ".vacancy-description",
    "[data-qa='vacancy-branded-description']",
    "[data-qa='vacancy-response-letter-toggle']",
    "div[data-qa*='vacancy-description']",
    "[class*='vacancy-description']",
    "article",
    "main",
  ];

  const ROOT_SELECTORS = [
    "[data-qa='vacancy-response']",
    "[data-qa='vacancy-view']",
    "[data-qa='applicant-vacancy-details']",
    ".vacancy-page",
    "[data-qa='vacancy-branded']",
    "#HH-React-Root main",
    "main",
  ];

  function clean(value) {
    return (value || "").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function text(el) {
    return clean(el?.innerText || el?.textContent || "");
  }

  function queryAll(selectors, root = document) {
    const nodes = [];
    for (const selector of selectors) {
      try {
        nodes.push(...root.querySelectorAll(selector));
      } catch {
        // ignore invalid selectors
      }
    }
    return nodes;
  }

  function longestText(selectors, root = document) {
    let best = "";
    for (const el of queryAll(selectors, root)) {
      const value = text(el);
      if (value.length > best.length) best = value;
    }
    return best;
  }

  function firstMeaningful(selectors, root = document, minLength = 2) {
    for (const el of queryAll(selectors, root)) {
      const value = text(el);
      if (value.length >= minLength) return value;
    }
    return "";
  }

  function expandCollapsed(root) {
    const buttons = root.querySelectorAll("button, a, [role='button']");
    for (const button of buttons) {
      const label = clean(button.innerText || button.getAttribute("aria-label") || "");
      if (/показать\s+(полностью|ещё|еще|больше)|развернуть|читать\s+далее/i.test(label)) {
        try {
          button.click();
        } catch {
          // ignore
        }
      }
    }
  }

  function vacancyRoot() {
    let best = null;
    let bestScore = 0;
    for (const el of queryAll(ROOT_SELECTORS)) {
      const value = text(el);
      const score = value.length + (el.querySelector("[data-qa*='vacancy-description'], .vacancy-description, h1") ? 5000 : 0);
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
    return best || document.body;
  }

  function stripNoise(root) {
    const clone = root.cloneNode(true);
    for (const selector of NOISE_SELECTORS) {
      for (const el of clone.querySelectorAll(selector)) el.remove();
    }
    for (const el of clone.querySelectorAll("*")) {
      const qa = el.getAttribute("data-qa") || "";
      const cls = el.className?.toString?.() || "";
      if (/navi|footer|header|menu|modal|snackbar|banner|advert|promo|sidebar-menu/i.test(`${qa} ${cls}`)) {
        el.remove();
      }
    }
    return clone;
  }

  function collectSections(root) {
    const chunks = [];
    const seen = new Set();

    for (const el of queryAll(DESCRIPTION_SELECTORS, root)) {
      const value = text(el);
      if (value.length < 80) continue;
      const key = value.slice(0, 120);
      if (seen.has(key)) continue;
      seen.add(key);
      chunks.push(value);
    }

    if (!chunks.length) {
      const stripped = stripNoise(root);
      const fallback = text(stripped);
      if (fallback.length >= 80) chunks.push(fallback);
    }

    chunks.sort((a, b) => b.length - a.length);
    return chunks[0] || "";
  }

  const WORK_FORMAT_SELECTORS = [
    "[data-qa='work-formats-text']",
    "[data-qa='vacancy-view-employment-mode']",
    "[data-qa='common-employment-text']",
    "[data-qa='work-schedule-by-days-text']",
    "[data-qa='working-hours-text']",
    "[data-qa='vacancy-view-work-schedule']",
  ];

  const WORK_FORMAT_PLACEHOLDER = /^(какой\s+формат\s+работы\??|формат\s+работы|график\s+работы|тип\s+занятости|занятость|не\s+указан[оа]?)$/i;

  function isWorkFormatPlaceholder(value) {
    const normalized = clean(value);
    if (!normalized || normalized.length > 80) return true;
    return WORK_FORMAT_PLACEHOLDER.test(normalized);
  }

  function collectWorkFormatValues(root) {
    const values = [];
    const seen = new Set();

    for (const el of queryAll(WORK_FORMAT_SELECTORS, root)) {
      const value = text(el);
      if (!value || isWorkFormatPlaceholder(value)) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(value);
    }

    return values;
  }

  function extractWorkFormat(root) {
    const fromRoot = collectWorkFormatValues(root);
    if (fromRoot.length) return fromRoot.join(" · ");

    const fromDocument = collectWorkFormatValues(document);
    if (fromDocument.length) return fromDocument.join(" · ");

    return "";
  }

  function extractVacancy() {
    const root = vacancyRoot();
    expandCollapsed(document);
    expandCollapsed(root);

    const title =
      firstMeaningful(TITLE_SELECTORS, root) ||
      firstMeaningful(TITLE_SELECTORS, document) ||
      clean(document.title.replace(/\s*[—–-]\s*.*$/, ""));

    const employer =
      firstMeaningful(EMPLOYER_SELECTORS, root) ||
      firstMeaningful(EMPLOYER_SELECTORS, document);

    const salary =
      firstMeaningful(SALARY_SELECTORS, root) ||
      firstMeaningful(SALARY_SELECTORS, document);

    const area =
      firstMeaningful(AREA_SELECTORS, root) ||
      firstMeaningful(AREA_SELECTORS, document);

    const workFormat = extractWorkFormat(root);

    let description = collectSections(root);
    if (description.length < 200) {
      const whole = collectSections(document.body);
      if (whole.length > description.length) description = whole;
    }

    if (description.length < 80) {
      throw new Error("Не удалось найти текст вакансии. Откройте полную страницу вакансии и прокрутите описание вниз.");
    }

    const parts = [
      title && `Название: ${title}`,
      employer && `Компания: ${employer}`,
      salary && `Зарплата: ${salary}`,
      area && `Локация: ${area}`,
      workFormat && `Формат: ${workFormat}`,
      `\n${description}`,
    ].filter(Boolean);

    return {
      title: title || "Вакансия без названия",
      employer: employer || null,
      url: location.href.split("?")[0],
      salary: salary || null,
      area: area || null,
      workFormat: workFormat || null,
      description: parts.join("\n").trim().slice(0, 100_000),
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "EXTRACT_VACANCY") return;
    try {
      sendResponse({ ok: true, vacancy: extractVacancy() });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Не удалось прочитать страницу." });
    }
    return true;
  });
})();

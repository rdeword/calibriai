const appUrlInput = document.getElementById("appUrl");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const sendButton = document.getElementById("send");
const openApp = document.getElementById("openApp");

let vacancy = null;

function setStatus(message, kind) {
  status.hidden = !message;
  status.textContent = message || "";
  status.className = `status ${kind || ""}`.trim();
}

function normalizeBase(url) {
  return url.replace(/\/$/, "") || "http://localhost:3000";
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(["appUrl"]);
  const appUrl = stored.appUrl || "http://localhost:3000";
  appUrlInput.value = appUrl;
  openApp.href = appUrl;
}

async function extractFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error("Не удалось определить активную вкладку.");
  if (!/https:\/\/([^.]+\.)?hh\.ru\//i.test(tab.url)) {
    throw new Error("Откройте страницу вакансии на hh.ru.");
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_VACANCY" });
    if (!response?.ok) throw new Error(response?.error || "Не удалось прочитать страницу.");
    return response.vacancy;
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_VACANCY" });
    if (!response?.ok) throw new Error(response?.error || "Не удалось прочитать страницу.");
    return response.vacancy;
  }
}

async function refreshPreview() {
  try {
    vacancy = await extractFromActiveTab();
    preview.textContent = [
      vacancy.title,
      vacancy.employer || "Компания не найдена",
      vacancy.salary || "Зарплата не указана",
      `Символов текста: ${vacancy.description.length}`,
      `${vacancy.description.slice(0, 400)}${vacancy.description.length > 400 ? "…" : ""}`,
    ].join("\n");
    setStatus("", "");
  } catch (error) {
    vacancy = null;
    preview.textContent = error instanceof Error ? error.message : "Не удалось подготовить вакансию.";
    setStatus(preview.textContent, "err");
  }
}

appUrlInput.addEventListener("change", async () => {
  const appUrl = normalizeBase(appUrlInput.value.trim());
  appUrlInput.value = appUrl;
  openApp.href = appUrl;
  await chrome.storage.local.set({ appUrl });
});

sendButton.addEventListener("click", async () => {
  sendButton.disabled = true;
  setStatus("Отправляем и запускаем анализ…", "");
  try {
    if (!vacancy) vacancy = await extractFromActiveTab();
    const appUrl = normalizeBase(appUrlInput.value.trim());
    await chrome.storage.local.set({ appUrl });
    openApp.href = appUrl;

    const response = await fetch(`${appUrl}/api/import-vacancy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vacancy),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Ошибка ${response.status}`);

    setStatus(`Готово: «${payload.title}». Откройте главную или историю.`, "ok");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Не удалось отправить вакансию.", "err");
  } finally {
    sendButton.disabled = false;
  }
});

loadSettings().then(refreshPreview);

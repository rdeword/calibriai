# CalibriAI

Персональный AI-рекрутер для одного пользователя: принимает текст вакансии, оценивает его относительно выбранного резюме и помогает подготовить сопроводительное письмо.

## Стек

Next.js, TypeScript, Tailwind CSS, PostgreSQL, Drizzle ORM, OpenAI API и Docker Compose.

## Быстрый запуск

1. Установите Git, Node.js 22+ и Docker Desktop.
2. Клонируйте репозиторий и перейдите в его папку:
   ```bash
   git clone https://github.com/rdeword/calibriai.git
   cd calibriai
   ```
3. Скопируйте `.env.example` в `.env`.
4. Сгенерируйте ключ шифрования: `openssl rand -base64 32` и укажите его в `APP_ENCRYPTION_KEY`.
5. Запустите PostgreSQL: `docker compose up -d postgres`.
6. Установите зависимости: `npm install`.
7. Примените миграции: `npm run db:migrate`.
8. Запустите приложение: `npm run dev`.

Откройте `http://localhost:3000`. В `/settings` задайте критерии оценки и OpenAI API-ключ. Вакансии можно добавлять вручную в `/import` или через локальное расширение из папки `extension` (Яндекс.Браузер / Chrome). Ключ передаётся только в Server Action, шифруется AES-256-GCM в PostgreSQL и после сохранения не возвращается в браузер.

### Запуск целиком через Docker

После создания `.env` выполните:

```bash
docker compose up --build
```

Приложение будет доступно по адресу `http://localhost:3000`. Код и миграции хранятся в репозитории, но локальная база PostgreSQL, резюме, история вакансий, cookies HH и API-ключи в GitHub не загружаются. На новом компьютере приложение начнёт с чистой базы.

### Расширение браузера

1. `npm run dev`
2. Откройте `browser://extensions` → включите режим разработчика → «Загрузить распакованное расширение» → выберите папку `extension`.
3. Откройте вакансию на hh.ru и нажмите иконку CalibriAI → «Отправить в CalibriAI».

## Переменные окружения

- `DATABASE_URL` — строка подключения PostgreSQL.
- `OPENAI_MODEL` — модель по умолчанию для пустой формы настройки.
- `APP_ENCRYPTION_KEY` — base64 32-байтный ключ для шифрования API-ключа OpenAI.

## Команды

- `npm run dev` — локальная разработка.
- `npm run build` — production build.
- `npm run lint` — ESLint.
- `npm run db:generate` — создать миграцию Drizzle.
- `npm run db:migrate` — применить миграции.

## MVP

Поддерживаются критерии оценки, текстовые резюме с активным вариантом, ручной импорт вакансий, AI-анализ с JSON-валидацией, карточки Like/Reject, история, переанализ, usage и генерация редактируемого письма для понравившейся вакансии.

Dockerfile собирает production-образ, а `docker compose up --build` поднимает PostgreSQL, применяет миграции отдельным одноразовым контейнером и запускает приложение.

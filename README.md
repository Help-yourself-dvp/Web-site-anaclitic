# Forum Knowledge Base

Локальный инструмент для аккуратного сбора новых сообщений из открытой пользователем темы форума, подготовки пакета для **ручной** вставки в онлайн-ИИ и хранения полученных сводок в локальной базе знаний.

Подробная русская инструкция находится в [README.ru.md](README.ru.md). История изменений — в [CHANGELOG.md](CHANGELOG.md). Описание исходной задачи и ограничений — в [PROJECT (web site analitic).md](PROJECT%20(web%20site%20analitic).md).

## Быстрый старт без программирования

1. Откройте ветку проекта на GitHub.
2. Нажмите `Code → Download ZIP` и распакуйте архив.
3. В Chrome/Edge откройте страницу расширений, включите «Режим разработчика».
4. Нажмите «Загрузить распакованное расширение» и выберите папку `extension/dist`.

Готовая папка `extension/dist` уже включена в репозиторий. Node.js и команды сборки обычному пользователю не нужны.

Для разработки или пересборки исходников:

```bash
npm install
npm run build
```

Companion-сервис необязателен. Для него:

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r companion/requirements.txt
python -m companion
```

Откройте `http://127.0.0.1:8765` и при необходимости укажите этот адрес в настройках расширения.

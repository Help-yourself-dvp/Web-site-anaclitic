import { strToU8, zipSync } from 'fflate';
import type { BackgroundRequest, BackgroundResponse, ExtensionState } from './core/messages';
import type { CollectionResult } from './core/types';
import { parseTopicId } from './core/utils';

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Не найден элемент ${selector}`);
  return element;
};

const currentUrl = $('#currentUrl');
const sourceSelect = $('#sourceSelect') as HTMLSelectElement;
const openSourceButton = $('#openSourceButton') as HTMLButtonElement;
const sourceInfo = $('#sourceInfo');
const automaticInfo = $('#automaticInfo');
const mediaInfo = $('#mediaInfo');
const resetButton = $('#resetButton') as HTMLButtonElement;
const adapterBadge = $('#adapterBadge');
const checkpointBadge = $('#checkpointBadge');
const postCount = $('#postCount');
const status = $('#status');
const diagnostics = $('#diagnostics');
const recentPosts = $('#recentPosts');
const savedReports = $('#savedReports');
const storageInfo = $('#storageInfo');
const storageFooter = $('#storageFooter');
const versionInfo = $('#versionInfo');
const pagesInput = $('#pagesInput') as HTMLInputElement;
const promptPreview = $('#promptPreview') as HTMLTextAreaElement;
const packageStatus = $('#packageStatus');
const formatCheckboxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="singleFormat"]'));
const splitPackageButton = $('#splitPackageButton') as HTMLButtonElement;
const copyButton = $('#copyButton') as HTMLButtonElement;
const aiResponse = $('#aiResponse') as HTMLTextAreaElement;
const responseFile = $('#responseFile') as HTMLInputElement;
const importResult = $('#importResult');
const localSearch = $('#localSearch') as HTMLInputElement;
const localSearchButton = $('#localSearchButton') as HTMLButtonElement;
const localSearchResult = $('#localSearchResult');
const diagnosticStatus = $('#diagnosticStatus');
const diagnosticPreview = $('#diagnosticPreview') as HTMLTextAreaElement;
const actionButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('button:not(#refreshButton):not(#settingsButton)'),
);

let activeUrl = '';
let currentState: ExtensionState | null = null;
let busy = false;

async function send(request: BackgroundRequest): Promise<BackgroundResponse> {
  return chrome.runtime.sendMessage<BackgroundResponse>(request);
}

function setStatus(message: string, kind: 'neutral' | 'success' | 'warning' | 'error' = 'neutral'): void {
  status.textContent = message;
  status.className = `status ${kind}`;
}

function renderSourceSelect(state: ExtensionState): void {
  sourceSelect.replaceChildren();
  if (state.sources.length === 0) {
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Пока нет сохранённых тем';
    sourceSelect.append(empty);
    sourceSelect.disabled = true;
    openSourceButton.disabled = true;
    return;
  }
  for (const source of state.sources) {
    const option = document.createElement('option');
    option.value = source.source_id;
    option.textContent = source.title || source.topic_url;
    sourceSelect.append(option);
  }
  if (state.currentSource) sourceSelect.value = state.currentSource.source_id;
  sourceSelect.disabled = false;
  openSourceButton.disabled = !sourceSelect.value;
}

function renderState(state: ExtensionState): void {
  currentState = state;
  renderSourceSelect(state);
  const imageModeLabels: Record<ExtensionState['settings']['imageMode'], string> = {
    links: 'Картинки: не скачиваются, сохраняются только найденные URL.',
    all: 'Картинки: собираются URL всех изображений.',
    keywords: 'Картинки: собираются URL рядом с указанными словами.',
    manual: 'Картинки: собираются только у выделенного сообщения.',
  };
  resetButton.disabled = !state.currentSource;
  pagesInput.value = String(state.settings.maxPages);
  if (state.currentSource) {
    adapterBadge.textContent = state.currentSource.adapter_name;
    adapterBadge.className = 'badge';
    sourceInfo.textContent = `${state.currentSource.title} · сохранено постов: ${state.recentPostCount}`;
    const backgroundItem = state.backgroundCheck?.items.find(
      (item) => item.source_id === state.currentSource?.source_id,
    );
    automaticInfo.textContent = state.currentSource.pending_scan_page_url
      ? 'Предыдущая проверка не дошла до старой точки. Следующая проверка продолжит этот диапазон сама.'
      : backgroundItem?.status === 'new-likely'
        ? `Фоновая проверка заметила возможные новые сообщения: ${backgroundItem.message}`
        : backgroundItem?.status === 'blocked'
          ? `Фоновая проверка остановлена: ${backgroundItem.message}`
          : state.hasCheckpoint
            ? 'В следующий раз расширение само найдёт последнюю страницу этой темы. Открыть именно старую страницу вручную не понадобится.'
            : 'Сначала запомните место или загрузите несколько последних страниц.';
    mediaInfo.textContent = imageModeLabels[state.settings.imageMode];
    checkpointBadge.textContent = state.hasCheckpoint ? 'точка отсчёта сохранена' : 'точка отсчёта не создана';
    checkpointBadge.className = `badge ${state.hasCheckpoint ? '' : 'neutral'}`;
  } else {
    adapterBadge.textContent = 'источник ещё не сохранён';
    adapterBadge.className = 'badge neutral';
    sourceInfo.textContent = 'После первого действия источник появится здесь.';
    automaticInfo.textContent = 'Откройте нужную тему. Другие страницы сайта расширение не будет собирать.';
    mediaInfo.textContent = imageModeLabels[state.settings.imageMode];
    checkpointBadge.textContent = 'точка отсчёта не создана';
    checkpointBadge.className = 'badge neutral';
  }
  postCount.textContent = state.lastRunAt
    ? `последний запуск: ${new Date(state.lastRunAt).toLocaleString()}`
    : 'нет запуска';
  recentPosts.replaceChildren();
  for (const post of state.recentPosts) {
    const item = document.createElement('div');
    item.className = 'recent-post';
    const meta = document.createElement('div');
    meta.className = 'post-meta';
    meta.textContent = `${post.author} · ${post.posted_at || 'дата неизвестна'}`;
    const link = document.createElement('a');
    link.href = post.canonical_post_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = post.body_text.slice(0, 150) + (post.body_text.length > 150 ? '…' : '');
    item.append(meta, link);
    recentPosts.append(item);
  }
  renderSavedReports(state.recentReports);
}

function renderSavedReports(reports: ExtensionState['recentReports']): void {
  savedReports.replaceChildren();
  if (reports.length === 0) {
    savedReports.textContent = 'Пока нет сохранённых ответов ИИ.';
    return;
  }
  for (const report of reports) {
    const item = document.createElement('div');
    item.className = 'saved-report';
    const title = document.createElement('strong');
    title.textContent = report.structured_facts.title || 'Сводка без названия';
    const meta = document.createElement('div');
    meta.className = 'post-meta';
    meta.textContent = `${new Date(report.created_at).toLocaleString()} · Q&A: ${report.qa_entries.length}`;
    const summary = document.createElement('p');
    summary.textContent = report.parsed_summary.slice(0, 500);
    const details = document.createElement('details');
    const caption = document.createElement('summary');
    caption.textContent = 'Открыть полный ответ ИИ';
    const fullText = document.createElement('pre');
    fullText.textContent = report.raw_ai_response;
    details.append(caption, fullText);
    item.append(title, meta, summary, details);
    savedReports.append(item);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

async function refreshStorageInfo(): Promise<void> {
  if (!navigator.storage?.estimate) {
    const message = 'Данные хранятся на диске браузера, а не постоянно в оперативной памяти.';
    storageInfo.textContent = message;
    storageFooter.textContent = 'Размер базы: доступен в поддерживаемом браузере';
    return;
  }
  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage || 0;
  const quota = estimate.quota || 0;
  const message = quota
    ? `Занято примерно ${formatBytes(usage)} из ${formatBytes(quota)}. Картинки занимают больше места.`
    : `Занято примерно ${formatBytes(usage)} на диске браузера.`;
  storageInfo.textContent = `${message} Это место на диске, а не постоянная оперативная память.`;
  storageFooter.textContent = `База: ${formatBytes(usage)}`;
}

function renderDiagnostics(items: string[]): void {
  diagnostics.replaceChildren();
  for (const text of items.slice(-30)) {
    const item = document.createElement('li');
    item.textContent = text;
    diagnostics.append(item);
  }
}

async function openSelectedSource(): Promise<void> {
  if (!sourceSelect.value) return;
  const response = await send({ type: 'open-source', sourceId: sourceSelect.value });
  if (!response.ok) setStatus(response.error, 'error');
}

async function refresh(): Promise<void> {
  const response = await send({ type: 'get-state', url: activeUrl });
  if (!response.ok) {
    setStatus(response.error, 'error');
    return;
  }
  if ('state' in response) renderState(response.state);
  else setStatus('Сервис расширения вернул неожиданный ответ.', 'error');
  void refreshStorageInfo().catch(() => undefined);
}

async function withBusy<T>(action: () => Promise<T>): Promise<T | undefined> {
  if (busy) return undefined;
  busy = true;
  actionButtons.forEach((button) => {
    button.disabled = true;
  });
  try {
    return await action();
  } finally {
    busy = false;
    actionButtons.forEach((button) => {
      button.disabled = false;
    });
  }
}

function renderCollection(result: CollectionResult): void {
  renderDiagnostics(result.diagnostics);
  if (result.protection_message) {
    setStatus(result.protection_message, 'warning');
  } else if (!result.ok) {
    setStatus('Сбор остановлен: разметка не распознана или произошла ошибка.', 'error');
  } else if (result.mode === 'checkpoint') {
    setStatus('Checkpoint создан. Старые сообщения не импортированы.', 'success');
  } else if (result.stop_reason === 'checkpoint-not-found' && result.resume_url && result.posts.length > 0) {
    setStatus(
      `Сохранена только часть диапазона: ${result.posts.length} новых сообщений. Нажмите «Проверить новые сообщения» ещё раз — продолжение начнётся автоматически.`,
      'warning',
    );
  } else if (result.stop_reason === 'checkpoint-not-found') {
    setStatus(
      'Точка отсчёта не найдена в заданном лимите страниц. Расширение ничего не отметило как проверенное.',
      'warning',
    );
  } else {
    setStatus(`Готово: сохранено новых сообщений ${result.posts.length}.`, 'success');
  }
}

async function downloadDiagnostic(): Promise<void> {
  await withBusy(async () => {
    diagnosticStatus.textContent = 'Собираю структуру текущей страницы…';
    const response = await send({ type: 'run-diagnostic', url: activeUrl });
    if (!response.ok) {
      diagnosticStatus.textContent = response.error;
      setStatus(response.error, 'error');
      return;
    }
    if (!('diagnostic' in response)) {
      diagnosticStatus.textContent = 'Расширение вернуло неожиданный ответ.';
      return;
    }
    diagnosticPreview.value = response.diagnostic.markdown;
    downloadText('diagnostic.md', response.diagnostic.markdown, 'text/markdown;charset=utf-8');
    downloadText('diagnostic.json', response.diagnostic.json, 'application/json;charset=utf-8');
    diagnosticStatus.textContent =
      'Готово: скачаны fkb-diagnostic.md и fkb-diagnostic.json. Пришлите их мне или вставьте содержимое.';
    setStatus('Диагностический лог скачан.', 'success');
  });
}

async function cleanCurrentSource(): Promise<void> {
  if (!activeUrl || !confirm('Удалить только явно неправильные записи меню? Точка отсчёта останется.')) return;
  await withBusy(async () => {
    const response = await send({ type: 'clean-service-posts', url: activeUrl });
    if (!response.ok) {
      setStatus(response.error, 'error');
      return;
    }
    setStatus('message' in response ? response.message : 'Неправильные записи обработаны.', 'success');
    await refresh();
  });
}

async function resetCurrentSource(): Promise<void> {
  if (!activeUrl || !confirm('Удалить сохранённые посты и точку отсчёта этой темы? Отчёты ИИ останутся.')) return;
  await withBusy(async () => {
    const response = await send({ type: 'reset-source', url: activeUrl });
    if (!response.ok) {
      setStatus(response.error, 'error');
      return;
    }
    setStatus('Данные темы удалены. Теперь можно заново создать точку отсчёта или импортировать историю.', 'success');
    await refresh();
  });
}

async function collect(mode: 'checkpoint' | 'history' | 'new'): Promise<void> {
  await withBusy(async () => {
    setStatus(mode === 'new' ? 'Идёт поиск checkpoint и новых страниц…' : 'Идёт разбор страницы…', 'neutral');
    const response = await send({ type: 'collect', mode, url: activeUrl, maxPages: Number(pagesInput.value) });
    if (!response.ok) {
      setStatus(response.error, 'error');
      renderDiagnostics(response.details || []);
      return;
    }
    if ('collection' in response) renderCollection(response.collection);
    else setStatus('Сервис расширения вернул неожиданный ответ.', 'error');
    await refresh();
  });
}

async function createPackage(mode: 'single' | 'split'): Promise<void> {
  await withBusy(async () => {
    setStatus(mode === 'single' ? 'Формирую единый файл для ИИ…' : 'Разделяю большой пакет на части…', 'neutral');
    const response = await send({ type: 'create-package', mode });
    if (!response.ok) {
      packageStatus.textContent = response.error;
      setStatus(response.error, 'warning');
      return;
    }

    if (mode === 'single') {
      if (!('singlePacket' in response)) {
        setStatus('Расширение вернуло неожиданный ответ.', 'error');
        return;
      }
      const selectedFormats = formatCheckboxes
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value as 'md' | 'json' | 'txt');
      if (selectedFormats.length === 0) {
        setStatus('Выберите хотя бы один формат файла.', 'warning');
        return;
      }
      const packet = response.singlePacket;
      const files: Record<'md' | 'json' | 'txt', [string, string, string]> = {
        md: ['ai-full.md', packet.markdown, 'text/markdown;charset=utf-8'],
        json: ['ai-full.json', packet.json, 'application/json;charset=utf-8'],
        txt: ['ai-full.txt', packet.text, 'text/plain;charset=utf-8'],
      };
      promptPreview.value = packet.markdown;
      copyButton.textContent = 'Копировать весь prompt';
      packageStatus.textContent = `${selectedFormats.length} единый файл(а) готовы: ${packet.post_count} новых постов и ${packet.context_count} связанных старых.`;
      for (const format of selectedFormats) {
        const file = files[format];
        downloadText(file[0], file[1], file[2]);
      }
      setStatus('Единый файл готов. В нём уже есть промпт и инструкция по формату ответа.', 'success');
      return;
    }

    if (!('packet' in response)) {
      setStatus('Расширение вернуло неожиданный ответ.', 'error');
      return;
    }
    const chunks = response.packet.chunks;
    const firstChunk = chunks[0];
    if (!firstChunk) {
      setStatus('Пакет не содержит частей для анализа.', 'error');
      return;
    }
    copyButton.textContent = chunks.length === 1 ? 'Копировать весь prompt' : 'Копировать первую часть';
    promptPreview.value =
      chunks.length === 1
        ? firstChunk.prompt_md
        : `Пакет разделён на ${chunks.length} частей. Ниже показана часть 1. Отправляйте ИИ каждый скачанный prompt отдельно.\n\n${firstChunk.prompt_md}`;
    packageStatus.textContent = `${response.packet.total_post_count} новых постов разделены на ${chunks.length} частей; prompts и ZIP скачиваются ниже.`;
    const files: Array<[string, string, string]> = [];
    for (const chunk of chunks) {
      const number = String(chunk.part_number).padStart(2, '0');
      const total = String(chunk.part_count).padStart(2, '0');
      files.push(
        [`prompt-${number}-of-${total}.md`, chunk.prompt_md, 'text/markdown;charset=utf-8'],
        [`posts-${number}-of-${total}.json`, chunk.posts_json, 'application/json;charset=utf-8'],
        [`context-posts-${number}-of-${total}.json`, chunk.context_posts_json, 'application/json;charset=utf-8'],
        [`links-${number}-of-${total}.json`, chunk.links_json, 'application/json;charset=utf-8'],
        [`manifest-${number}-of-${total}.json`, chunk.manifest_json, 'application/json;charset=utf-8'],
      );
      downloadText(`prompt-${number}-of-${total}.md`, chunk.prompt_md, 'text/markdown;charset=utf-8');
    }
    files.push(['combine-prompt.md', response.packet.combine_prompt_md, 'text/markdown;charset=utf-8']);
    files.push(['full-posts.txt', response.packet.full_text, 'text/plain;charset=utf-8']);
    downloadText('combine-prompt.md', response.packet.combine_prompt_md, 'text/markdown;charset=utf-8');
    downloadText('full-posts.txt', response.packet.full_text, 'text/plain;charset=utf-8');
    const archive = zipSync(Object.fromEntries(files.map(([name, contents]) => [name, strToU8(contents)])));
    downloadBytes('package.zip', archive, 'application/zip');
    setStatus(
      chunks.length === 1
        ? 'Пакет готов. Можно использовать prompt из первой части или выбрать единый файл.'
        : 'Пакет готов. Отправьте ИИ prompts по очереди, затем вставьте ответы в combine-prompt.md и попросите ИИ сделать итоговую сводку.',
      'success',
    );
  });
}

function downloadText(name: string, contents: string, type: string): void {
  downloadBytes(name, new TextEncoder().encode(contents), type);
}

function downloadBytes(name: string, bytes: Uint8Array, type: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `fkb-${name}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportLocal(): Promise<void> {
  await withBusy(async () => {
    setStatus('Экспортирую локальные данные…', 'neutral');
    const response = await send({ type: 'export-local' });
    if (!response.ok) {
      setStatus(response.error, 'error');
      return;
    }
    if (!('exportData' in response)) {
      setStatus('Сервис расширения вернул неожиданный ответ.', 'error');
      return;
    }
    downloadText('local-export.json', response.exportData.json, 'application/json;charset=utf-8');
    downloadText('local-export.md', response.exportData.markdown, 'text/markdown;charset=utf-8');
    setStatus('Локальная база экспортирована в JSON и Markdown.', 'success');
  });
}

async function searchLocal(): Promise<void> {
  const query = localSearch.value.trim();
  const response = await send({ type: 'search-local', query });
  if (!response.ok) {
    localSearchResult.textContent = response.error;
    return;
  }
  if (!('search' in response)) {
    localSearchResult.textContent = 'Сервис расширения вернул неожиданный ответ.';
    return;
  }
  const { posts, reports, qa } = response.search;
  localSearchResult.replaceChildren();
  const summary = document.createElement('p');
  summary.textContent = `Найдено постов: ${posts.length}; Q&A: ${qa.length}; сводок: ${reports.length}.`;
  localSearchResult.append(summary);
  for (const post of posts.slice(0, 8)) {
    const item = document.createElement('div');
    item.className = 'recent-post';
    const link = document.createElement('a');
    link.href = post.canonical_post_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `${post.author}: ${post.body_text.slice(0, 160)}`;
    item.append(link);
    localSearchResult.append(item);
  }
  for (const entry of qa.slice(0, 8)) {
    const item = document.createElement('div');
    item.className = 'recent-post';
    item.textContent = `Q&A [${entry.status}]: ${entry.question} — ${entry.short_answer}`;
    localSearchResult.append(item);
  }
  for (const report of reports.slice(0, 5)) {
    const item = document.createElement('div');
    item.className = 'recent-post';
    item.textContent = `Сводка: ${report.parsed_summary.slice(0, 180)}`;
    localSearchResult.append(item);
  }
}

async function importResponse(): Promise<void> {
  const raw = aiResponse.value.trim();
  if (!raw) {
    setStatus('Вставьте ответ ИИ или выберите файл.', 'warning');
    return;
  }
  await withBusy(async () => {
    const sourceId = currentState?.currentSource?.source_id;
    const topicId = currentState?.currentSource ? parseTopicId(currentState.currentSource.topic_url) : undefined;
    const request: BackgroundRequest = { type: 'import-ai', raw };
    if (sourceId) request.sourceId = sourceId;
    if (topicId) request.topicId = topicId;
    const response = await send(request);
    if (!response.ok) {
      setStatus(response.error, 'error');
      return;
    }
    if (!('importResult' in response)) {
      setStatus('Сервис расширения вернул неожиданный ответ.', 'error');
      return;
    }
    const result = response.importResult;
    importResult.replaceChildren();
    const summary = document.createElement('p');
    summary.textContent = result.valid_json
      ? result.repaired_json
        ? `JSON сохранён после автоматического заполнения пропущенных полей. Q&A-карточек: ${result.report.qa_entries.length}.`
        : `Валидный JSON сохранён. Q&A-карточек: ${result.report.qa_entries.length}.`
      : `Сохранена Markdown-сводка. Распознано Q&A: ${result.report.qa_entries.length}.`;
    importResult.append(summary);
    if (result.warnings.length || result.unrecognized_qa.length) {
      const list = document.createElement('ul');
      [...result.warnings, ...result.unrecognized_qa.map((item) => `Q&A не распознана: ${item}`)].forEach((warning) => {
        const item = document.createElement('li');
        item.textContent = warning;
        list.append(item);
      });
      importResult.append(list);
    }
    setStatus('Ответ ИИ сохранён локально.', result.valid_json ? 'success' : 'warning');
    await refresh();
    const reportsPanel = savedReports.closest('details') as HTMLDetailsElement | null;
    if (reportsPanel) reportsPanel.open = true;
  });
}

responseFile.addEventListener('change', () => {
  const file = responseFile.files?.[0];
  if (!file) return;
  void file.text().then((text) => {
    aiResponse.value = text;
  });
});
$('#cleanButton').addEventListener('click', () => void cleanCurrentSource());
$('#diagnosticButton').addEventListener('click', () => void downloadDiagnostic());
$('#resetButton').addEventListener('click', () => void resetCurrentSource());
$('#checkpointButton').addEventListener('click', () => void collect('checkpoint'));
$('#historyButton').addEventListener('click', () => void collect('history'));
$('#collectButton').addEventListener('click', () => void collect('new'));
$('#packageButton').addEventListener('click', () => void createPackage('single'));
splitPackageButton.addEventListener('click', () => void createPackage('split'));
$('#exportButton').addEventListener('click', () => void exportLocal());
localSearchButton.addEventListener('click', () => void searchLocal());
localSearch.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') void searchLocal();
});
$('#importButton').addEventListener('click', () => void importResponse());
$('#refreshButton').addEventListener('click', () => void refresh());
$('#settingsButton').addEventListener('click', () => void send({ type: 'open-options' }));
$('#settingsTextButton').addEventListener('click', () => void send({ type: 'open-options' }));
sourceSelect.addEventListener('change', () => {
  openSourceButton.disabled = !sourceSelect.value;
});
openSourceButton.addEventListener('click', () => void openSelectedSource());
$('#copyButton').addEventListener('click', async () => {
  if (!promptPreview.value) return;
  await navigator.clipboard.writeText(promptPreview.value);
  packageStatus.textContent = 'prompt скопирован в буфер обмена.';
});

void (async () => {
  try {
    versionInfo.textContent = `Версия ${chrome.runtime.getManifest().version}`;
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeUrl = tabs[0]?.url || '';
    currentUrl.textContent = activeUrl || 'Не удалось определить URL активной вкладки.';
    copyButton.disabled = !activeUrl;
    await refresh();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
})();

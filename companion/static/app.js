const $ = (selector) => document.querySelector(selector);

function text(value, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function safeLink(url, label) {
  try {
    const parsed = new URL(url, location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return document.createTextNode(label || url);
    const link = document.createElement('a');
    link.href = parsed.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label || parsed.href;
    return link;
  } catch {
    return document.createTextNode(label || url);
  }
}

function item(className = 'list-item') {
  const node = document.createElement('div');
  node.className = className;
  return node;
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function renderStats(data) {
  const stats = $('#stats');
  stats.replaceChildren();
  const values = [
    ['sources', data.sources?.length || 0, 'источников'],
    ['posts', data.posts?.length || 0, 'постов в выдаче'],
    ['reports', data.reports?.length || 0, 'последних сводок'],
  ];
  for (const [, value, label] of values) {
    const node = document.createElement('div');
    node.className = 'stat';
    const strong = document.createElement('strong');
    strong.textContent = String(value);
    const span = document.createElement('span');
    span.textContent = label;
    node.append(strong, span);
    stats.append(node);
  }
}

function renderSources(sources) {
  const root = $('#sources');
  root.replaceChildren();
  if (!sources.length) { root.textContent = 'Пока нет источников. Запустите сбор из расширения.'; return; }
  for (const source of sources) {
    const node = item();
    const strong = document.createElement('strong');
    strong.append(safeLink(source.topic_url, text(source.title, source.source_id)));
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${source.adapter_name} · checkpoint: ${source.last_checkpoint_post_id || 'нет'}${source.last_checked_at ? ` · ${new Date(source.last_checked_at).toLocaleString()}` : ''}`;
    node.append(strong, meta);
    root.append(node);
  }
}

function renderReports(reports) {
  const root = $('#reports');
  root.replaceChildren();
  if (!reports.length) { root.textContent = 'Пока нет импортированных сводок.'; return; }
  for (const report of reports) {
    const node = item();
    const strong = document.createElement('strong');
    strong.textContent = text(report.structured_facts?.title, report.report_id);
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${new Date(report.created_at).toLocaleString()} · Q&A: ${(report.qa_entries || []).length}`;
    const summary = document.createElement('div');
    summary.textContent = text(report.parsed_summary);
    node.append(strong, meta, summary);
    root.append(node);
  }
}

function renderSearch(data) {
  const root = $('#searchResults');
  root.replaceChildren();
  const groups = [
    ['Посты', data.posts || [], (entry) => [text(entry.author), entry.body_text, entry.canonical_post_url]],
    ['Q&A', data.qa || [], (entry) => [entry.question, `${entry.short_answer}\n${entry.status}`, (entry.source_post_urls || [])[0]]],
    ['Сводки', data.reports || [], (entry) => [text(entry.structured_facts?.title, entry.report_id), entry.parsed_summary, null]],
  ];
  let found = false;
  for (const [title, entries, fields] of groups) {
    if (!entries.length) continue;
    found = true;
    const group = document.createElement('div');
    group.className = 'result-group';
    const heading = document.createElement('h3');
    heading.textContent = title;
    group.append(heading);
    for (const entry of entries) {
      const node = item('result-item');
      const [headingText, body, url] = fields(entry);
      const strong = document.createElement('strong');
      strong.textContent = text(headingText);
      const paragraph = document.createElement('p');
      paragraph.textContent = text(body);
      node.append(strong, paragraph);
      if (url) node.append(document.createTextNode(' '), safeLink(url, 'источник'));
      group.append(node);
    }
    root.append(group);
  }
  if (!found) root.textContent = 'Ничего не найдено.';
}

async function load() {
  const [health, sources, posts, reports] = await Promise.all([
    getJson('/api/health'), getJson('/api/sources'), getJson('/api/posts?limit=1000'), getJson('/api/reports?limit=50'),
  ]);
  $('#health').textContent = health.fts5 ? '● сервис работает · FTS5' : '● сервис работает · LIKE-поиск';
  renderStats({ sources: sources.sources, posts: posts.posts, reports: reports.reports });
  renderSources(sources.sources);
  renderReports(reports.reports);
}

async function search() {
  const query = $('#search').value.trim();
  try { renderSearch(await getJson(`/api/search?q=${encodeURIComponent(query)}`)); }
  catch (error) { $('#searchResults').textContent = `Ошибка поиска: ${error.message}`; }
}

$('#searchButton').addEventListener('click', () => void search());
$('#search').addEventListener('keydown', (event) => { if (event.key === 'Enter') void search(); });
$('#refresh').addEventListener('click', () => void load().catch((error) => { $('#health').textContent = `Ошибка: ${error.message}`; }));
$('#importButton').addEventListener('click', async () => {
  const status = $('#importStatus');
  const raw = $('#rawResponse').value.trim();
  if (!raw) { status.textContent = 'Сначала вставьте ответ.'; return; }
  try {
    const result = await getJson('/api/reports/import', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ raw, source_id: $('#importSource').value.trim() || 'manual-import', topic_id: $('#importTopic').value.trim() || 'unknown-topic' }) });
    status.textContent = result.valid_json ? `Сохранён валидный JSON; Q&A: ${result.report.qa_entries.length}.` : `Сохранён Markdown; Q&A: ${result.report.qa_entries.length}. Предупреждений: ${result.warnings.length}.`;
    await load();
  } catch (error) { status.textContent = `Ошибка импорта: ${error.message}`; }
});

void load().catch((error) => { $('#health').textContent = `Сервис не готов: ${error.message}`; });

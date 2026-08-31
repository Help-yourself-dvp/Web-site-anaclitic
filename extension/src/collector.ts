import { adapterByName } from './adapters';
import { checkpointMatches, deduplicatePosts } from './core/collection';
import { parseTopicId, sleep, clampInteger, normalizeUrl, normalizeWhitespace } from './core/utils';
import type { CollectorMessage, CollectorOptions } from './core/messages';
import type { CollectedPage, CollectionResult, ForumPost, SourceRecord } from './core/types';

interface ProtectedPage {
  protected: boolean;
  message: string | null;
}

function protectionFromHtml(url: string, status: number, html: string): ProtectedPage {
  if (status === 403)
    return { protected: true, message: 'Сайт вернул 403 Forbidden. Сбор остановлен, обход защиты не выполняется.' };
  if (status === 429)
    return { protected: true, message: 'Сайт вернул 429 Too Many Requests. Увеличьте интервал и попробуйте позже.' };
  if (status >= 400) return { protected: true, message: `Сайт вернул HTTP ${status}. Сбор остановлен.` };

  let title = '';
  try {
    title = new DOMParser().parseFromString(html, 'text/html').title.toLocaleLowerCase();
  } catch {
    // The document parser below will produce a useful diagnostic if parsing fails.
  }
  const sample = `${title}\n${html.slice(0, 120000).toLocaleLowerCase()}`;
  if (/cf-chl-|challenge-platform|g-recaptcha|hcaptcha|turnstile/.test(sample)) {
    return { protected: true, message: 'Обнаружена CAPTCHA или страница проверки браузера. Сбор остановлен.' };
  }
  const parsedUrl = new URL(url);
  const isLoginUrl =
    /(^|[\s>/])(login|signin|auth)([\s</?]|$)/i.test(parsedUrl.pathname) ||
    /^(auth|login|signin)$/i.test(parsedUrl.searchParams.get('act') || '');
  if (isLoginUrl || /<title>[^<]*(login|вход|авторизац)/i.test(sample)) {
    return { protected: true, message: 'Открыта страница входа. Сбор остановлен; автоматический вход не выполняется.' };
  }
  return { protected: false, message: null };
}

function protectionFromDocument(document: Document, url: string): ProtectedPage {
  const html = document.documentElement?.outerHTML || '';
  return protectionFromHtml(url, 200, html);
}

function samePageUrl(first: string, second: string): boolean {
  try {
    const a = new URL(first);
    const b = new URL(second);
    a.hash = '';
    b.hash = '';
    return a.href === b.href;
  } catch {
    return false;
  }
}

function createPage(
  parsed: {
    title: string;
    posts: ForumPost[];
    previousUrl: string | null;
    lastUrl: string | null;
    diagnostics: string[];
  },
  url: string,
): CollectedPage {
  return {
    url,
    title: parsed.title,
    posts: parsed.posts,
    previous_url: parsed.previousUrl,
    last_url: parsed.lastUrl,
    diagnostics: parsed.diagnostics,
  };
}

function encodingFromResponse(response: Response, bytes: ArrayBuffer): string {
  const contentType = response.headers.get('content-type') || '';
  const headerEncoding = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]?.toLowerCase();
  // The old 4PDA forum declares this charset in page variables, while some
  // responses omit it from the HTTP header. Decode a short ASCII-compatible
  // prefix as CP1251 so those variables can be read safely.
  const prefix = new TextDecoder('windows-1251').decode(bytes.slice(0, 20_000));
  const pageEncoding = prefix.match(/(?:charset|ipb_var_charset)\s*[=:]\s*["']?([\w-]+)/i)?.[1]?.toLowerCase();
  if (pageEncoding === 'windows-1251' || pageEncoding === 'cp1251') return 'windows-1251';
  if (pageEncoding === 'koi8-r') return 'koi8-r';
  if (headerEncoding === 'windows-1251' || headerEncoding === 'cp1251') return 'windows-1251';
  if (headerEncoding === 'koi8-r') return 'koi8-r';
  try {
    if (/4pda\.(to|ru)$/i.test(new URL(response.url || '').hostname)) return 'windows-1251';
  } catch {
    // Fall back to UTF-8 for an unusual response URL.
  }
  return headerEncoding || 'utf-8';
}

async function fetchDocument(url: string): Promise<{ document: Document; url: string; protection: ProtectedPage }> {
  const response = await fetch(url, { credentials: 'include', redirect: 'follow' });
  const bytes = await response.arrayBuffer();
  let html: string;
  try {
    html = new TextDecoder(encodingFromResponse(response, bytes)).decode(bytes);
  } catch {
    html = new TextDecoder('utf-8').decode(bytes);
  }
  const protection = protectionFromHtml(response.url || url, response.status, html);
  if (protection.protected) {
    return {
      document: new DOMParser().parseFromString('<html></html>', 'text/html'),
      url: response.url || url,
      protection,
    };
  }
  return {
    document: new DOMParser().parseFromString(html, 'text/html'),
    url: response.url || url,
    protection,
  };
}

const DIAGNOSTIC_SELECTORS = [
  '.postwrapper',
  '.post_wrap',
  '.post',
  'article.post',
  '[data-post-id]',
  '[data-entry-id]',
  'div.postcolor[id^="post-"]',
  '[id^="entry"]',
  '[id^="post-"]',
  '[id^="post_"]',
  '.postcontent',
  '.post_content',
  '.post_content_text',
  '.post_body',
  '.postname',
  '.normalname',
  '.post_author',
  '.postdate',
  '.post_date',
  '.postdetails',
  '.mem-title',
  '.post-block',
  '.block-body',
  '.block-title',
  '.spoil',
  '.spoilbody',
  'blockquote',
];

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}\n… [обрезано]`;
}

function diagnosticHtml(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('script, style, noscript, iframe').forEach((node) => node.remove());
  return truncate(clone.outerHTML, 6000);
}

function diagnosticClassName(element: Element): string {
  const classes = Array.from(element.classList).slice(0, 8).join('.');
  return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}${element.id ? `#${element.id}` : ''}`;
}

function makeDiagnosticReport(adapterName: string): { json: string; markdown: string } {
  const protection = protectionFromDocument(document, location.href);
  const selectorCounts = Object.fromEntries(
    DIAGNOSTIC_SELECTORS.map((selector) => {
      try {
        return [selector, document.querySelectorAll(selector).length];
      } catch {
        return [selector, -1];
      }
    }),
  );
  const classCounts = new Map<string, number>();
  for (const element of Array.from(document.querySelectorAll<HTMLElement>('[class]'))) {
    for (const className of Array.from(element.classList)) {
      if (/post|comment|message|entry|forum|content|author|user|date|spoil|quote/i.test(className)) {
        classCounts.set(className, (classCounts.get(className) || 0) + 1);
      }
    }
  }
  const relevantNodes = Array.from(
    document.querySelectorAll<HTMLElement>('[class], [id], [data-post-id], [data-entry-id]'),
  )
    .filter((element) =>
      /post|comment|message|entry|forum|content|author|user|date|spoil|quote/i.test(
        `${element.className} ${element.id}`,
      ),
    )
    .filter((element) => (element.textContent || '').trim().length > 20)
    .slice(0, 25);
  const linkSamples = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .filter((anchor) => /findpost|showtopic|#entry|#post/i.test(anchor.href))
    .slice(0, 30)
    .map((anchor) => ({
      text: normalizeWhitespace(anchor.textContent || ''),
      href: anchor.href,
      className: anchor.className,
    }));
  const samples: Record<string, string[]> = {};
  for (const selector of DIAGNOSTIC_SELECTORS) {
    const elements = Array.from(document.querySelectorAll(selector)).slice(0, 3);
    if (elements.length) samples[selector] = elements.map(diagnosticHtml);
  }
  const report = {
    diagnostic_version: '1.0',
    generated_at: new Date().toISOString(),
    url: location.href,
    title: document.title,
    ready_state: document.readyState,
    adapter: adapterName,
    protection,
    body_text_preview: truncate(normalizeWhitespace(document.body?.textContent || ''), 2000),
    selector_counts: selectorCounts,
    relevant_class_counts: Object.fromEntries([...classCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100)),
    relevant_nodes: relevantNodes.map((element) => ({
      descriptor: diagnosticClassName(element),
      text_preview: truncate(normalizeWhitespace(element.textContent || ''), 300),
    })),
    link_samples: linkSamples,
    html_samples: samples,
    relevant_html_samples: relevantNodes.slice(0, 10).map(diagnosticHtml),
  };
  const json = JSON.stringify(report, null, 2);
  const markdown = [
    '# Forum Knowledge Base — диагностический лог',
    '',
    '> Внимание: фрагменты HTML могут содержать текст открытой страницы. Перед отправкой удалите личные данные, если они там есть.',
    '',
    `- URL: ${report.url}`,
    `- Заголовок: ${report.title}`,
    `- Адаптер: ${report.adapter}`,
    `- Состояние документа: ${report.ready_state}`,
    `- Проверка защиты: ${protection.protected ? protection.message : 'не обнаружена'}`,
    '',
    '## Количество элементов по селекторам',
    ...Object.entries(selectorCounts).map(([selector, count]) => `- ${selector}: ${count}`),
    '',
    '## Часто встречающиеся классы',
    ...Object.entries(report.relevant_class_counts).map(([className, count]) => `- ${className}: ${count}`),
    '',
    '## Ссылки на посты/темы',
    '```json',
    JSON.stringify(linkSamples, null, 2),
    '```',
    '',
    '## Примеры HTML по известным селекторам',
    ...Object.entries(samples).flatMap(([selector, html]) => [
      `### ${selector}`,
      '```html',
      ...html.map((sample) => sample.replace(/```/g, '` ` `')),
      '```',
    ]),
    '',
    '## Примеры релевантных HTML-блоков',
    '```html',
    ...report.relevant_html_samples.map((sample) => sample.replace(/```/g, '` ` `')),
    '```',
    '',
    '## JSON',
    'Полная машиночитаемая версия находится в соседнем файле `.json`.',
  ].join('\n');
  return { json, markdown };
}

async function runCollector(options: CollectorOptions): Promise<CollectionResult> {
  const source: SourceRecord = options.source;
  const adapter = adapterByName(source.adapter_name);
  const maxPages = clampInteger(options.maxPages, 1, 50, source.configuration.maxPages);
  const delayMs = clampInteger(options.delayMs, 0, 30_000, source.configuration.delayMs);
  const pages: CollectedPage[] = [];
  const diagnostics: string[] = [`Адаптер: ${adapter.label}.`, `Лимит страниц: ${maxPages}.`];
  const initialProtection = protectionFromDocument(document, location.href);
  if (initialProtection.protected) {
    return {
      ok: false,
      mode: options.mode,
      source,
      pages,
      posts: [],
      stop_reason: 'protection-detected',
      checkpoint_found: false,
      diagnostics,
      protection_message: initialProtection.message,
    };
  }

  let currentDocument = document;
  let currentUrl = location.href;
  const visited = new Set<string>();
  let checkpointFound = options.mode !== 'new';
  let stopReason: CollectionResult['stop_reason'] = options.mode === 'history' ? 'history-limit' : 'no-previous-page';
  let protectionMessage: string | null = null;
  let setupFailed = false;
  const checkpointPageUrl = options.checkpointPageUrl ? normalizeUrl(options.checkpointPageUrl, location.href) : null;

  // A topic's last page changes as new replies arrive. For a new-message run
  // we reopen the saved checkpoint page; for history import we use the page the
  // user opened as a starting point. In both cases the "last page" link lets us
  // find page 700 without making the user calculate its number manually.
  const shouldFindLatest = options.mode === 'history' || (options.mode === 'new' && options.startPageUrl);
  if (shouldFindLatest) {
    try {
      if (options.mode === 'new' && options.startPageUrl) {
        const savedUrl = normalizeUrl(options.startPageUrl, location.href);
        if (savedUrl && savedUrl !== currentUrl) {
          const saved = await fetchDocument(savedUrl);
          if (saved.protection.protected) {
            setupFailed = true;
            protectionMessage = saved.protection.message;
            stopReason = 'protection-detected';
          } else {
            currentDocument = saved.document;
            currentUrl = saved.url;
            diagnostics.push('Взята сохранённая страница точки отсчёта.');
          }
        }
      }
      if (!setupFailed) {
        const probe = adapter.parse(currentDocument, currentUrl, {
          sourceId: source.source_id,
          topicId: parseTopicId(source.topic_url),
          imageMode: source.configuration.imageMode,
          imageKeywords: source.configuration.imageKeywords,
          manualSelection: null,
        });
        const lastUrl = normalizeUrl(probe.lastUrl || '', currentUrl);
        if (lastUrl && lastUrl !== currentUrl) {
          const latest = await fetchDocument(lastUrl);
          if (latest.protection.protected) {
            setupFailed = true;
            protectionMessage = latest.protection.message;
            stopReason = 'protection-detected';
          } else {
            currentDocument = latest.document;
            currentUrl = latest.url;
            diagnostics.push('Найдена и открыта последняя доступная страница темы автоматически.');
          }
        }
      }
    } catch (error) {
      setupFailed = true;
      stopReason = 'error';
      diagnostics.push(
        `Не удалось автоматически найти последнюю страницу: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  for (let pageIndex = 0; !setupFailed && pageIndex < maxPages; pageIndex += 1) {
    if (pageIndex > 0) await sleep(delayMs);
    if (visited.has(currentUrl)) {
      diagnostics.push('Повторная ссылка на уже просмотренную страницу; остановка для безопасности.');
      stopReason = 'error';
      break;
    }
    visited.add(currentUrl);

    const parsed = adapter.parse(currentDocument, currentUrl, {
      sourceId: source.source_id,
      topicId: parseTopicId(source.topic_url),
      imageMode: source.configuration.imageMode,
      imageKeywords: source.configuration.imageKeywords,
      manualSelection: pageIndex === 0 ? window.getSelection() : null,
    });
    const page = createPage(parsed, currentUrl);
    pages.push(page);
    diagnostics.push(...parsed.diagnostics.map((item) => `Страница ${pageIndex + 1}: ${item}`));

    if (page.posts.length === 0 && pageIndex === 0) {
      diagnostics.push('На открытой странице сообщения не найдены. Проверьте адаптер или разметку сайта.');
      stopReason = 'unexpected-markup';
      break;
    }

    if (
      options.mode === 'new' &&
      page.posts.some((post) =>
        checkpointMatches(post, options.checkpointKey, options.checkpointUrl, options.knownKeys),
      )
    ) {
      checkpointFound = true;
      stopReason = 'checkpoint-found';
      break;
    }
    if (options.mode === 'new' && checkpointPageUrl && samePageUrl(currentUrl, checkpointPageUrl)) {
      checkpointFound = true;
      stopReason = 'checkpoint-found';
      diagnostics.push('Достигнута сохранённая страница точки отсчёта.');
      break;
    }
    if (options.mode === 'checkpoint') {
      checkpointFound = true;
      stopReason = 'checkpoint-found';
      break;
    }

    const previousUrl = normalizeUrl(page.previous_url || '', currentUrl);
    if (!previousUrl) {
      stopReason = options.mode === 'new' && !checkpointFound ? 'checkpoint-not-found' : 'no-previous-page';
      break;
    }

    try {
      const fetched = await fetchDocument(previousUrl);
      if (fetched.protection.protected) {
        protectionMessage = fetched.protection.message;
        stopReason = 'protection-detected';
        break;
      }
      currentDocument = fetched.document;
      currentUrl = fetched.url;
    } catch (error) {
      diagnostics.push(
        `Не удалось загрузить предыдущую страницу: ${error instanceof Error ? error.message : String(error)}`,
      );
      stopReason = 'error';
      break;
    }
  }

  if (options.mode === 'new' && !checkpointFound && stopReason === 'history-limit') {
    stopReason = 'checkpoint-not-found';
  }
  if (options.mode === 'new' && !checkpointFound && pages.length >= maxPages) {
    diagnostics.push(
      'Checkpoint не найден в пределах лимита страниц. Новые посты не будут зафиксированы как проверенные.',
    );
    stopReason = 'checkpoint-not-found';
  }

  const posts = deduplicatePosts(pages.flatMap((page) => page.posts));
  return {
    ok: stopReason !== 'protection-detected' && stopReason !== 'unexpected-markup' && stopReason !== 'error',
    mode: options.mode,
    source,
    pages,
    posts,
    stop_reason: stopReason,
    checkpoint_found: checkpointFound,
    diagnostics,
    protection_message: protectionMessage,
  };
}

const loadedFlag = '__fkbCollectorLoaded';
type CollectorWindow = Window & { [loadedFlag]?: boolean };
const collectorWindow = window as CollectorWindow;

if (!collectorWindow[loadedFlag]) {
  collectorWindow[loadedFlag] = true;
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const request = message as Partial<CollectorMessage>;
    if (request.type === 'run-diagnostic') {
      sendResponse(makeDiagnosticReport(request.adapterName || 'unknown'));
      return false;
    }
    if (request.type !== 'run-collector' || !request.options) return false;
    runCollector(request.options)
      .then((result) => sendResponse(result))
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          mode: request.options?.mode || 'new',
          source: request.options?.source,
          pages: [],
          posts: [],
          stop_reason: 'error',
          checkpoint_found: false,
          diagnostics: [error instanceof Error ? error.message : String(error)],
          protection_message: null,
        });
      });
    return true;
  });
}

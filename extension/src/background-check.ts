import type { BackgroundCheckState, BackgroundProbeItem, SourceRecord } from './core/types';
import { nowIso, parseTopicId, sleep } from './core/utils';

const BACKGROUND_CHECK_KEY = 'fkb-background-check';

function probeOffset(url: string): number | null {
  try {
    const parsed = new URL(url);
    const fullOffset = parsed.searchParams.get('st');
    if (fullOffset !== null) {
      const value = Number.parseInt(fullOffset, 10);
      return Number.isFinite(value) ? value : null;
    }
    const lofiOffset = parsed.search.match(/[?&]t\d+-(\d+)\.html(?:&|$)/i)?.[1];
    if (lofiOffset) {
      const value = Number.parseInt(lofiOffset, 10);
      return Number.isFinite(value) ? value : null;
    }
    return 0;
  } catch {
    return null;
  }
}

function sameTopic(sourceUrl: string, candidateUrl: string): boolean {
  try {
    const source = new URL(sourceUrl);
    const candidate = new URL(candidateUrl);
    return source.origin === candidate.origin && parseTopicId(sourceUrl) === parseTopicId(candidateUrl);
  } catch {
    return false;
  }
}

function lastPageUrl(html: string, pageUrl: string): string | null {
  const currentOffset = probeOffset(pageUrl);
  if (currentOffset === null) return null;
  const links: Array<{ url: string; offset: number; label: string }> = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const rawUrl = match[1]?.replace(/&amp;/g, '&');
    if (!rawUrl) continue;
    try {
      const url = new URL(rawUrl, pageUrl).href;
      const offset = probeOffset(url);
      if (!sameTopic(pageUrl, url) || offset === null || offset <= currentOffset) continue;
      const label = (match[2] || '')
        .replace(/<[^>]+>/g, ' ')
        .trim()
        .toLocaleLowerCase();
      links.push({ url, offset, label });
    } catch {
      // Ignore malformed navigation links.
    }
  }
  if (links.length === 0) return null;
  const labelled = links.filter((link) => /послед|last|конец|»/.test(link.label));
  return (labelled.sort((a, b) => b.offset - a.offset)[0] || links.sort((a, b) => b.offset - a.offset)[0])?.url || null;
}

function looksProtected(response: Response, html: string): string | null {
  if (response.status === 403) return 'Сайт вернул 403; фоновая проверка остановлена.';
  if (response.status === 429) return 'Сайт вернул 429; фоновая проверка остановлена.';
  if (response.status >= 400) return `Сайт вернул HTTP ${response.status}; фоновая проверка остановлена.`;
  const sample = html.slice(0, 120_000).toLocaleLowerCase();
  if (/cf-chl-|challenge-platform|g-recaptcha|hcaptcha|turnstile/.test(sample))
    return 'Обнаружена CAPTCHA или проверка браузера.';
  return null;
}

function decodeResponse(response: Response, bytes: ArrayBuffer): string {
  const prefix = new TextDecoder('windows-1251').decode(bytes.slice(0, 20_000));
  const declared =
    prefix.match(/(?:charset|ipb_var_charset)\s*[=:]\s*["']?([\w-]+)/i)?.[1]?.toLowerCase() ||
    response.headers
      .get('content-type')
      ?.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]
      ?.toLowerCase() ||
    '';
  const encoding = declared === 'utf-8' ? 'utf-8' : declared === 'koi8-r' ? 'koi8-r' : 'windows-1251';
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

async function fetchDecoded(url: string): Promise<{ response: Response; html: string }> {
  const response = await fetch(url, { credentials: 'include', redirect: 'follow' });
  const bytes = await response.arrayBuffer();
  return { response, html: decodeResponse(response, bytes) };
}

async function probeSource(source: SourceRecord): Promise<BackgroundProbeItem> {
  const checkedAt = nowIso();
  if (!source.enabled || source.adapter_name !== '4pda') {
    return {
      source_id: source.source_id,
      title: source.title,
      status: 'not-configured',
      message: 'Автопроверка включена только для 4PDA; для этого источника используйте страницу вручную.',
      checked_at: checkedAt,
    };
  }
  const startUrl = source.last_checkpoint_page_url || source.topic_url;
  try {
    const first = await fetchDecoded(startUrl);
    const blocked = looksProtected(first.response, first.html);
    if (blocked) {
      return {
        source_id: source.source_id,
        title: source.title,
        status: 'blocked',
        message: blocked,
        checked_at: checkedAt,
      };
    }
    const lastUrl = lastPageUrl(first.html, first.response.url || startUrl);
    let latestUrl = first.response.url || startUrl;
    let latestHtml = first.html;
    if (lastUrl) {
      const last = await fetchDecoded(lastUrl);
      const lastBlocked = looksProtected(last.response, last.html);
      if (lastBlocked) {
        return {
          source_id: source.source_id,
          title: source.title,
          status: 'blocked',
          message: lastBlocked,
          checked_at: checkedAt,
        };
      }
      latestUrl = last.response.url || lastUrl;
      latestHtml = last.html;
    }
    const checkpointOffset = probeOffset(startUrl) || 0;
    const latestOffset = probeOffset(latestUrl) || 0;
    const checkpointId = Number.parseInt(source.last_checkpoint_post_id || '', 10);
    const postIds = [...latestHtml.matchAll(/id=["']post-(\d+)["']/gi)]
      .map((match) => Number.parseInt(match[1] || '', 10))
      .filter(Number.isFinite);
    const latestPostId = postIds.length ? Math.max(...postIds) : null;
    const hasNewPage = latestOffset > checkpointOffset;
    const hasNewPost = Number.isFinite(checkpointId) && latestPostId !== null && latestPostId > checkpointId;
    return {
      source_id: source.source_id,
      title: source.title,
      status: hasNewPage || hasNewPost ? 'new-likely' : 'no-change',
      message:
        hasNewPage || hasNewPost
          ? 'Вероятно появились новые сообщения. Откройте тему и запустите обычную проверку.'
          : 'Новых страниц или постов не обнаружено.',
      checked_at: checkedAt,
    };
  } catch (error) {
    return {
      source_id: source.source_id,
      title: source.title,
      status: 'error',
      message: `Не удалось проверить источник: ${error instanceof Error ? error.message : String(error)}`,
      checked_at: checkedAt,
    };
  }
}

export async function readBackgroundCheck(): Promise<BackgroundCheckState | null> {
  const stored = await chrome.storage.local.get(BACKGROUND_CHECK_KEY);
  const value = stored[BACKGROUND_CHECK_KEY] as Partial<BackgroundCheckState> | undefined;
  if (!value || typeof value.checked_at !== 'string' || !Array.isArray(value.items)) return null;
  return value as BackgroundCheckState;
}

async function setBadge(items: BackgroundProbeItem[]): Promise<void> {
  const hasNew = items.some((item) => item.status === 'new-likely');
  const hasBlocked = items.some((item) => item.status === 'blocked');
  const hasError = items.some((item) => item.status === 'error');
  const text = hasNew ? '+' : hasBlocked ? '!' : hasError ? '?' : '';
  await chrome.action.setBadgeText({ text });
  if (text)
    await chrome.action.setBadgeBackgroundColor({ color: hasNew ? '#147d53' : hasBlocked ? '#b42318' : '#a25b00' });
}

export async function runBackgroundCheck(
  sources: SourceRecord[],
  enabled: boolean,
): Promise<BackgroundCheckState | null> {
  if (!enabled || sources.length === 0) {
    await chrome.action.setBadgeText({ text: '' });
    return null;
  }
  const items: BackgroundProbeItem[] = [];
  for (const source of sources) {
    if (items.length > 0) await sleep(1500);
    items.push(await probeSource(source));
  }
  const state: BackgroundCheckState = { checked_at: nowIso(), items };
  await chrome.storage.local.set({ [BACKGROUND_CHECK_KEY]: state });
  await setBadge(items);
  return state;
}

export async function clearBackgroundSource(sourceId: string): Promise<void> {
  const current = await readBackgroundCheck();
  if (!current) return;
  const items = current.items.filter((item) => item.source_id !== sourceId);
  const next = { ...current, items };
  await chrome.storage.local.set({ [BACKGROUND_CHECK_KEY]: next });
  await setBadge(items);
}

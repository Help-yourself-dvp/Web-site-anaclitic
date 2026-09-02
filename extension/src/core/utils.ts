export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix = 'id'): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}_${uuid}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeWhitespace(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\r ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeUrl(value: string, baseUrl: string): string | null {
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = url.hash.replace(/^#(post|entry)[-_]?/i, '#');
    return url.href;
  } catch {
    return null;
  }
}

export function safeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function parseTopicId(url: string): string {
  try {
    const parsed = new URL(url);
    const showtopic = parsed.searchParams.get('showtopic');
    if (showtopic) return showtopic;
    const lofiTopic = parsed.search.match(/[?&]t(\d+)(?:-\d+)?\.html/i)?.[1];
    if (lofiTopic) return lofiTopic;
    const pathPart = parsed.pathname.split('/').filter(Boolean).pop();
    return pathPart || 'unknown-topic';
  } catch {
    return 'unknown-topic';
  }
}

export function sourceKey(sourceId: string, postId: string | null, fingerprint: string): string {
  return `${sourceId}:${postId || fingerprint}`;
}

export function postKey(post: { source_id: string; post_id: string | null; fingerprint: string }): string {
  return sourceKey(post.source_id, post.post_id, post.fingerprint);
}

/** A deterministic local fingerprint; it is not intended as a cryptographic hash. */
export function stableFingerprint(parts: string[]): string {
  let hash = 2166136261;
  const value = parts.join('\u001f');
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function sortPostsChronologically<T extends { posted_at: string | null; post_id?: string | null }>(
  posts: T[],
): T[] {
  return posts
    .map((post, index) => ({ post, index }))
    .sort((a, b) => {
      const aTime = a.post.posted_at ? Date.parse(a.post.posted_at) : Number.NaN;
      const bTime = b.post.posted_at ? Date.parse(b.post.posted_at) : Number.NaN;
      if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
        return aTime - bTime;
      }
      if (Number.isFinite(aTime) !== Number.isFinite(bTime)) return Number.isFinite(aTime) ? -1 : 1;
      // Both dates are missing: forum post ids grow over time, so they are a
      // better order than the page-walk order (which is newest page first).
      const aId = Number.parseInt(a.post.post_id || '', 10);
      const bId = Number.parseInt(b.post.post_id || '', 10);
      if (Number.isFinite(aId) && Number.isFinite(bId) && aId !== bId) return aId - bId;
      return a.index - b.index;
    })
    .map(({ post }) => post);
}

const MONTH_BY_NAME: Record<string, number> = {
  янв: 1,
  фев: 2,
  мар: 3,
  апр: 4,
  май: 5,
  мая: 5,
  июн: 6,
  июл: 7,
  авг: 8,
  сен: 9,
  окт: 10,
  ноя: 11,
  дек: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/**
 * First date-like fragment in a text. Exported so the DOM adapter can pick the
 * post date out of a table row that also contains other numbers.
 */
export const FORUM_DATE_PATTERN =
  /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}(?:\s*(?:,|г\.?)?\s*\d{1,2}:\d{2}(?::\d{2})?)?|\b\d{1,2}\s+[а-яa-z]{3,10}\.?\s+\d{4}(?:\s*(?:,|г\.?)?\s*\d{1,2}:\d{2}(?::\d{2})?)?|(?:^|[^\wа-яё])(?:сегодня|вчера|today|yesterday)\s*(?:,|\s)\s*\d{1,2}:\d{2}|\b\d{1,2}:\d{2}\b/gi;

export function firstDateLikeText(text: string): string {
  const matches = text.match(FORUM_DATE_PATTERN) || [];
  // A post stamp always has a time. Dates without one are usually something
  // else in the same table row, for example «Регистрация: 01.01.24».
  const withTime = matches.find((item) => /\d{1,2}:\d{2}/.test(item));
  return (withTime || matches[0] || '').trim();
}

function localDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date | null {
  const date = new Date(year, month - 1, day, hour, minute, second);
  // Reject impossible dates such as 31.02 that Date would silently roll over.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function expandYear(value: string): number {
  if (value.length === 4) return Number.parseInt(value, 10);
  const short = Number.parseInt(value, 10);
  return short >= 80 ? 1900 + short : 2000 + short;
}

/**
 * Parses dates the way forums print them, in the user's local time.
 *
 * `Date.parse` must not be used for `DD.MM.YY, HH:MM`: V8 reads `02.09.26`
 * as 9 February and returns NaN for `31.08.26`. That silently moved September
 * posts into January/August and froze the reported period.
 */
export function parseForumDate(raw: string, reference: Date = new Date()): Date | null {
  const text = raw
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?\s*(Z|[+-]\d{2}:?\d{2})?/.exec(text);
  if (iso) {
    const [, year = '1970', month = '1', day = '1', hour = '00', minute = '00', second = '00', zone] = iso;
    if (zone) {
      const parsed = Date.parse(text);
      return Number.isFinite(parsed) ? new Date(parsed) : null;
    }
    return localDate(
      Number.parseInt(year, 10),
      Number.parseInt(month, 10),
      Number.parseInt(day, 10),
      Number.parseInt(hour, 10),
      Number.parseInt(minute, 10),
      Number.parseInt(second, 10),
    );
  }

  const numeric = /\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?:\s*(?:,|г\.?)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(
    text,
  );
  if (numeric) {
    let day = Number.parseInt(numeric[1] || '0', 10);
    let month = Number.parseInt(numeric[2] || '0', 10);
    const year = expandYear(numeric[3] || '1970');
    // Most forums are day-first, but accept month-first when the day is impossible.
    if (month > 12 && day <= 12) [day, month] = [month, day];
    const hour = Number.parseInt(numeric[4] || '0', 10);
    const minute = Number.parseInt(numeric[5] || '0', 10);
    const second = Number.parseInt(numeric[6] || '0', 10);
    const date = localDate(year, month, day, hour, minute, second);
    if (date) return date;
  }

  const named = /\b(\d{1,2})\s+([а-яa-z]{3,10})\.?\s+(\d{4})(?:\s*(?:,|г\.?)?\s*(\d{1,2}):(\d{2}))?/i.exec(text);
  if (named) {
    const month = MONTH_BY_NAME[named[2]?.slice(0, 3).toLowerCase() || ''];
    if (month) {
      const date = localDate(
        Number.parseInt(named[3] || '1970', 10),
        month,
        Number.parseInt(named[1] || '0', 10),
        Number.parseInt(named[4] || '0', 10),
        Number.parseInt(named[5] || '0', 10),
        0,
      );
      if (date) return date;
    }
  }

  const relative = /(?:^|[^\wа-яё])(сегодня|вчера|today|yesterday)\s*(?:,|\s)\s*(\d{1,2}):(\d{2})/i.exec(text);
  if (relative) {
    const shift = /вчера|yesterday/i.test(relative[1] || '') ? -1 : 0;
    const base = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() + shift);
    return localDate(
      base.getFullYear(),
      base.getMonth() + 1,
      base.getDate(),
      Number.parseInt(relative[2] || '0', 10),
      Number.parseInt(relative[3] || '0', 10),
      0,
    );
  }

  const timeOnly = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (timeOnly) {
    return localDate(
      reference.getFullYear(),
      reference.getMonth() + 1,
      reference.getDate(),
      Number.parseInt(timeOnly[1] || '0', 10),
      Number.parseInt(timeOnly[2] || '0', 10),
      0,
    );
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function isSameOriginHttp(url: string, baseUrl: string): boolean {
  try {
    const a = new URL(url);
    const b = new URL(baseUrl);
    return (a.protocol === 'http:' || a.protocol === 'https:') && a.origin === b.origin;
  } catch {
    return false;
  }
}

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

export function sortPostsChronologically<T extends { posted_at: string | null }>(posts: T[]): T[] {
  return posts
    .map((post, index) => ({ post, index }))
    .sort((a, b) => {
      const aTime = a.post.posted_at ? Date.parse(a.post.posted_at) : Number.NaN;
      const bTime = b.post.posted_at ? Date.parse(b.post.posted_at) : Number.NaN;
      if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
        return aTime - bTime;
      }
      if (Number.isFinite(aTime) !== Number.isFinite(bTime)) return Number.isFinite(aTime) ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ post }) => post);
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

import type { ImageMode, ForumPost, LinkRecord, Quote } from '../core/types';
import {
  firstDateLikeText,
  normalizeUrl,
  normalizeWhitespace,
  nowIso,
  parseForumDate,
  stableFingerprint,
  uniqueStrings,
} from '../core/utils';
import type { ParseOptions } from './types';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

export function queryFirst(root: ParentNode, selectors: string[]): Element | null {
  for (const selector of selectors) {
    const found = root.querySelector(selector);
    if (found) return found;
  }
  return null;
}

export function elementText(root: ParentNode | null, selectors: string[]): string {
  if (!root) return '';
  return normalizeWhitespace(queryFirst(root, selectors)?.textContent || '');
}

export function titleFromDocument(document: Document): string {
  return normalizeWhitespace(document.title || '') || 'Без названия';
}

export function parsePostedAt(root: ParentNode, selectors: string[]): string | null {
  const element = queryFirst(root, selectors);
  const elementTextValue = element
    ? normalizeWhitespace(element.getAttribute('datetime') || element.textContent || '')
    : '';
  const rootText = normalizeWhitespace(root.textContent || '');
  // The post stamp is printed right after the «Сообщение #N» permalink and
  // before the body, so the first stamp in the row is the one we need. The last
  // one can be an «отредактировано …» mark from inside the message.
  const raw = elementTextValue || firstDateLikeText(rootText);
  if (!raw) return null;
  const parsed = parseForumDate(raw);
  return parsed ? parsed.toISOString() : raw;
}

export function extractQuotes(root: Element, baseUrl: string): Quote[] {
  const quotes: Quote[] = [];
  for (const quote of Array.from(
    root.querySelectorAll('.quote, .blockquote, blockquote, .post_quote, [class*="quote"]'),
  )) {
    const text = normalizeWhitespace(quote.textContent || '');
    if (!text) continue;
    const author = normalizeWhitespace(
      quote.getAttribute('data-author') ||
        queryFirst(quote, ['.quote_author', '.quote-header', '.author', 'cite'])?.textContent ||
        '',
    );
    const sourceLink = Array.from(quote.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .map((anchor) => normalizeUrl(anchor.href, baseUrl))
      .find((url) => Boolean(url && /findpost|#(?:entry|post)?[-_]?\d+/i.test(url)));
    quotes.push({ author: author || null, text, source_post_url: sourceLink || null });
  }
  return quotes;
}

function removeNoise(root: Element): void {
  root
    .querySelectorAll(
      'script, style, noscript, template, iframe, .quote, .blockquote, blockquote, .post_quote, .signature, .post_signature, .edit, .post-edit, .post_meta, .post-info, .post_author, .post_author_data',
    )
    .forEach((node) => node.remove());
}

export function extractBody(root: Element, bodySelectors: string[]): string {
  const body = queryFirst(root, bodySelectors);
  const clone = (body || root).cloneNode(true) as Element;
  removeNoise(clone);
  return normalizeWhitespace(clone.textContent || '');
}

export function extractLinks(root: Element, baseUrl: string): LinkRecord[] {
  const result: LinkRecord[] = [];
  for (const anchor of Array.from(root.querySelectorAll('a[href]'))) {
    const url = normalizeUrl(anchor.getAttribute('href') || '', baseUrl);
    if (!url) continue;
    const text = normalizeWhitespace(anchor.textContent || '') || url;
    if (!result.some((item) => item.url === url)) result.push({ url, text });
  }
  return result;
}

export function extractReplyLinks(root: Element, baseUrl: string): string[] {
  const result: string[] = [];
  for (const anchor of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const url = normalizeUrl(anchor.getAttribute('href') || '', baseUrl);
    if (!url || !/findpost|view=findpost|#(?:entry|post)?[-_]?\d+/i.test(url)) continue;
    if (!result.includes(url)) result.push(url);
  }
  return result;
}

function imageIsNearKeywords(root: Element, nearbyText: string, keywords: string[]): boolean {
  if (keywords.length === 0) return false;
  const scope = normalizeWhitespace(`${root.textContent || ''} ${nearbyText}`).toLocaleLowerCase();
  return keywords.some((keyword) => keyword.trim() && scope.includes(keyword.trim().toLocaleLowerCase()));
}

export function extractImageUrls(
  root: Element,
  baseUrl: string,
  mode: ImageMode,
  keywords: string[],
  manualSelection?: Selection | null,
): string[] {
  if (mode === 'links') return [];
  if (mode === 'manual' && (!manualSelection || !root.contains(manualSelection.anchorNode))) return [];
  const images: string[] = [];
  for (const image of Array.from(root.querySelectorAll('img'))) {
    if (image.closest('.avatar, .user_avatar, .post_author, .emoji, .smilie, .reaction')) continue;
    if (mode === 'keywords' && !imageIsNearKeywords(root, image.alt || '', keywords)) continue;
    const raw =
      image.getAttribute('data-src') || image.getAttribute('data-original') || image.getAttribute('src') || '';
    const url = normalizeUrl(raw, baseUrl);
    if (!url || !HTTP_PROTOCOLS.has(new URL(url).protocol)) continue;
    if (!images.includes(url)) images.push(url);
  }
  // 4PDA can keep a screenshot as the href of a thumbnail and create the
  // actual img element only after the spoiler is opened. The href is still a
  // useful, direct image URL, so collect it when the user opted into images.
  for (const anchor of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const url = normalizeUrl(anchor.getAttribute('href') || '', baseUrl);
    if (!url || (!/\.(avif|bmp|gif|jpe?g|png|webp)(?:$|[?#])/i.test(url) && !/\/forum\/dl\/post\//i.test(url)))
      continue;
    if (mode === 'keywords' && !imageIsNearKeywords(root, anchor.textContent || '', keywords)) continue;
    if (!images.includes(url)) images.push(url);
  }
  return images;
}

export interface PostElementConfig {
  postSelectors: string[];
  idSelectors: string[];
  permalinkSelectors: string[];
  authorSelectors: string[];
  dateSelectors: string[];
  bodySelectors: string[];
}

export function findPostElements(document: Document, selectors: string[]): Element[] {
  const candidates: Element[] = [];
  for (const selector of selectors) {
    for (const element of Array.from(document.querySelectorAll(selector))) {
      // Keep the first, most specific match. A later broad selector such as
      // [id^="post-"] must not replace the real body with its parent table cell.
      if (candidates.some((existing) => existing.contains(element) || element.contains(existing))) continue;
      candidates.push(element);
    }
  }
  return candidates;
}

export function extractPost(
  element: Element,
  pageUrl: string,
  options: ParseOptions,
  config: PostElementConfig,
  metadataRoot: Element = element,
  authorRoot: Element | null = null,
  dateRoot: ParentNode | null = null,
): ForumPost | null {
  const bodyRoot = queryFirst(element, config.bodySelectors) || element;
  const bodyText = extractBody(element, config.bodySelectors);
  if (bodyText.length < 2) return null;

  const ownId =
    element.getAttribute('data-post-id') ||
    element.getAttribute('data-entry-id') ||
    element.getAttribute('id') ||
    element.getAttribute('name') ||
    '';
  const idElement = ownId
    ? element
    : queryFirst(metadataRoot, config.idSelectors) || queryFirst(element, config.idSelectors) || element;
  const idRaw =
    idElement.getAttribute('data-post-id') ||
    idElement.getAttribute('data-entry-id') ||
    idElement.getAttribute('id') ||
    idElement.getAttribute('name') ||
    '';
  const idMatch = idRaw.match(/(?:post|entry|comment)[-_]?(\d+)/i) || idRaw.match(/^(\d{3,})$/);
  const permalinkElement =
    queryFirst(metadataRoot, config.permalinkSelectors) || queryFirst(element, config.permalinkSelectors);
  const permalinkUrl = normalizeUrl(permalinkElement?.getAttribute('href') || '', pageUrl);
  let postId = idMatch?.[1] || idRaw.match(/^post[_-](.+)$/i)?.[1] || null;
  if (!postId && permalinkUrl) {
    try {
      const parsedPermalink = new URL(permalinkUrl);
      postId =
        parsedPermalink.searchParams.get('p') || parsedPermalink.hash.match(/(?:entry|post)[-_]?(\d+)/i)?.[1] || null;
    } catch {
      // The normalized URL is already safe to use as a fallback identity.
    }
  }
  let fallbackPostUrl = pageUrl.split('#')[0] || pageUrl;
  if (postId) {
    try {
      const parsedPageUrl = new URL(pageUrl);
      if (parsedPageUrl.searchParams.get('showtopic')) {
        parsedPageUrl.hash = '';
        parsedPageUrl.searchParams.delete('st');
        parsedPageUrl.searchParams.set('view', 'findpost');
        parsedPageUrl.searchParams.set('p', postId);
        fallbackPostUrl = parsedPageUrl.href;
      } else {
        fallbackPostUrl = `${fallbackPostUrl}#entry${postId}`;
      }
    } catch {
      fallbackPostUrl = `${fallbackPostUrl}#entry${postId}`;
    }
  }
  const canonicalPostUrl = permalinkUrl || fallbackPostUrl;
  const author =
    elementText(authorRoot || metadataRoot, config.authorSelectors) ||
    elementText(metadataRoot, config.authorSelectors) ||
    elementText(element, config.authorSelectors) ||
    'Неизвестный автор';
  const postedAt = parsePostedAt(dateRoot || metadataRoot, config.dateSelectors);
  const quotes = extractQuotes(bodyRoot, pageUrl);
  const links = extractLinks(bodyRoot, pageUrl);
  const replyToUrls = extractReplyLinks(bodyRoot, pageUrl);
  const imageUrls = extractImageUrls(
    bodyRoot,
    pageUrl,
    options.imageMode,
    options.imageKeywords,
    options.manualSelection,
  );
  const fingerprint = stableFingerprint([options.sourceId, options.topicId, author, postedAt || '', bodyText]);
  const contentHash = stableFingerprint([bodyText, ...links.map((link) => link.url), ...replyToUrls, ...imageUrls]);

  return {
    source_id: options.sourceId,
    topic_id: options.topicId,
    post_id: postId,
    canonical_post_url: canonicalPostUrl,
    fingerprint,
    author,
    posted_at: postedAt,
    page_url: pageUrl,
    body_text: bodyText,
    quotes,
    links,
    reply_to_urls: uniqueStrings(replyToUrls),
    image_urls: uniqueStrings(imageUrls),
    local_image_paths: [],
    collected_at: nowIso(),
    content_hash: contentHash,
  };
}

export function pageTitle(document: Document): string {
  return titleFromDocument(document);
}

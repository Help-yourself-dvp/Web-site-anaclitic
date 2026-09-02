import type { ForumAdapter, ParseOptions, ParsedDocument } from './types';
import { extractPost, findPostElements, pageTitle, queryFirst, type PostElementConfig } from './dom';
import { normalizeWhitespace } from '../core/utils';
import { findLastPageUrl, findPreviousPageUrl } from './pagination';

const FOURPDA_POST_CONFIG: PostElementConfig = {
  postSelectors: [
    '.postwrapper',
    '.post_wrap',
    '[data-post-id]',
    '[data-entry-id]',
    'div.postcolor[id^="post-"]',
    'article.post',
    '.post',
    '[id^="entry"]',
    '[id^="post-"]',
    '[id^="post_"]',
  ],
  idSelectors: [
    '[data-post-id]',
    '[data-entry-id]',
    '[id^="post-"]',
    '[id^="post_"]',
    '[id^="entry"]',
    '[name^="entry"]',
  ],
  permalinkSelectors: [
    'a.post_num',
    'a.post-number',
    'a.permalink',
    'a[href*="#entry"]',
    'a[href*="#post"]',
    'a[href*="view=findpost"]',
    'a[href*="showtopic"][href*="#"]',
  ],
  authorSelectors: [
    '.post_author_name',
    '.post_author-name',
    '.post_author a[href*="showuser"]',
    '.post_author .nickname',
    '.post_author',
    '.postname',
    '.normalname',
    '.nickname',
    '.username',
    '[class*="username"]',
    '[itemprop="author"]',
  ],
  dateSelectors: [
    'time[datetime]',
    '[itemprop="datePublished"]',
    '.post_date',
    '.post-date',
    '.post_header .date',
    '.post_footer .date',
    '.postdate',
    '[class*="post_date"]',
    '[class*="postdate"]',
  ],
  bodySelectors: [
    '.post_content_text',
    '.post_content',
    '.postcontent',
    '.post-content',
    '.entry-content',
    '.post_body',
  ],
};

function isLikelyPost(element: Element): boolean {
  if (element.matches('div.postcolor[id^="post-"]')) return true;
  const hasBody = Boolean(queryFirst(element, FOURPDA_POST_CONFIG.bodySelectors));
  if (!hasBody) return false;
  const hasPermalink = Boolean(
    queryFirst(element, [
      'a.post_num',
      'a.post-number',
      'a.permalink',
      'a[href*="view=findpost"]',
      'a[href*="findpost"]',
    ]),
  );
  const hasDate = Boolean(queryFirst(element, FOURPDA_POST_CONFIG.dateSelectors));
  const hasAuthor = Boolean(queryFirst(element, FOURPDA_POST_CONFIG.authorSelectors));
  return hasPermalink || (hasDate && hasAuthor);
}

export class FourPdaAdapter implements ForumAdapter {
  readonly name = '4pda';
  readonly label = '4PDA';

  canHandle(url: string): boolean {
    try {
      return /(^|\.)4pda\.(to|ru)$/i.test(new URL(url).hostname);
    } catch {
      return false;
    }
  }

  parse(document: Document, url: string, options: ParseOptions): ParsedDocument {
    const candidates = findPostElements(document, FOURPDA_POST_CONFIG.postSelectors);
    const elements = candidates.filter(isLikelyPost);
    const posts = elements
      .map((element) => {
        const mainCell = element.closest('td[id^="post-main-"], td[id*="post-main-"]');
        const metadataRoot = mainCell?.parentElement || element.closest('tr') || element;
        const rawId = element.getAttribute('data-post-id') || element.getAttribute('data-entry-id') || element.id || '';
        const postId = rawId.match(/(?:post|entry)[-_]?(\d+)/i)?.[1] || null;
        const authorRoot = postId ? document.getElementById(`post-member-${postId}`) : null;
        return extractPost(element, url, options, FOURPDA_POST_CONFIG, metadataRoot, authorRoot, mainCell);
      })
      .filter((post): post is NonNullable<typeof post> => Boolean(post));
    const diagnostics: string[] = [];
    if (elements.length === 0) {
      diagnostics.push('Разметка 4PDA не распознана: блоки постов не найдены.');
    }
    if (candidates.length > elements.length) {
      diagnostics.push(
        `4PDA: отброшено ${candidates.length - elements.length} блоков без признаков сообщения (меню/служебная разметка).`,
      );
    }
    if (posts.length < elements.length) {
      diagnostics.push(`4PDA: из ${elements.length} блоков извлечено ${posts.length} сообщений.`);
    }
    const undatedPosts = posts.filter((post) => !post.posted_at);
    if (undatedPosts.length > 0) {
      // Без этой строки причина «Дата: не распознана» в файле для ИИ не видна.
      const sample = normalizeWhitespace(elements[0]?.textContent || '').slice(0, 160);
      diagnostics.push(
        `4PDA: у ${undatedPosts.length} сообщений не найдена дата. Начало первого блока страницы: «${sample}».`,
      );
    }
    return {
      title: pageTitle(document),
      posts,
      previousUrl: findPreviousPageUrl(document, url),
      lastUrl: findLastPageUrl(document, url),
      diagnostics,
    };
  }

  findPreviousUrl(document: Document, url: string): string | null {
    return findPreviousPageUrl(document, url);
  }
}

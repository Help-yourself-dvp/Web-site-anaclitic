import { parseTopicId } from '../core/utils';
import type { ForumAdapter, ParseOptions, ParsedDocument } from './types';
import { extractPost, findPostElements, pageTitle, type PostElementConfig } from './dom';
import { findLastPageUrl, findPreviousPageUrl } from './pagination';

const GENERIC_POST_CONFIG: PostElementConfig = {
  postSelectors: [
    '[data-post-id]',
    '[data-comment-id]',
    'article[class*="post"]',
    '.post',
    '.comment',
    '[id^="post-"]',
    '[id^="comment-"]',
  ],
  idSelectors: ['[data-post-id]', '[data-comment-id]', '[id]', '[name]'],
  permalinkSelectors: ['a.permalink', 'a.post_permalink', 'a[href*="#"]', 'a[rel="bookmark"]'],
  authorSelectors: [
    '[itemprop="author"]',
    '.author',
    '.username',
    '.user-name',
    '.post_author_name',
    '[class*="author"] a',
  ],
  dateSelectors: [
    'time[datetime]',
    '[itemprop="datePublished"]',
    '.post_date',
    '.post-date',
    '.date',
    '[class*="date"]',
  ],
  bodySelectors: [
    '[itemprop="text"]',
    '.post_content',
    '.post-content',
    '.entry-content',
    '.comment-content',
    '.content',
  ],
};

export class GenericForumAdapter implements ForumAdapter {
  readonly name = 'generic-forum';
  readonly label = 'Generic forum (эвристика)';

  canHandle(url: string): boolean {
    return !/4pda\./i.test(url);
  }

  parse(document: Document, url: string, options: ParseOptions): ParsedDocument {
    const elements = findPostElements(document, GENERIC_POST_CONFIG.postSelectors);
    const posts = elements
      .map((element) => extractPost(element, url, options, GENERIC_POST_CONFIG))
      .filter((post): post is NonNullable<typeof post> => Boolean(post));
    const diagnostics: string[] = [];
    if (elements.length === 0) {
      diagnostics.push('Эвристика generic-forum не нашла повторяющиеся блоки сообщений.');
    }
    if (posts.length < elements.length) {
      diagnostics.push(`Из ${elements.length} найденных блоков удалось извлечь ${posts.length} сообщений.`);
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

export class GenericArticleAdapter implements ForumAdapter {
  readonly name = 'generic-article';
  readonly label = 'Generic article (одна статья)';

  canHandle(url: string): boolean {
    return !/4pda\./i.test(url);
  }

  parse(document: Document, url: string, options: ParseOptions): ParsedDocument {
    const main = document.querySelector('article, main, [role="main"], .article, .post-content');
    const diagnostics: string[] = [];
    if (!main) diagnostics.push('Не найден основной блок статьи (article/main).');
    const post = main ? extractPost(main, url, options, { ...GENERIC_POST_CONFIG, postSelectors: [] }) : null;
    return {
      title: pageTitle(document),
      posts: post ? [post] : [],
      previousUrl: null,
      lastUrl: null,
      diagnostics,
    };
  }

  findPreviousUrl(): string | null {
    return null;
  }
}

export function genericTopicId(url: string): string {
  return parseTopicId(url);
}

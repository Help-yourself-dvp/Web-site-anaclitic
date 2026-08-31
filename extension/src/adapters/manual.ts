import { parseTopicId } from '../core/utils';
import { extractPost, pageTitle } from './dom';
import type { ForumAdapter, ParseOptions, ParsedDocument } from './types';

/**
 * Adapter for a page whose markup is unknown. The user selects text on the page;
 * the selected fragment is stored as one message. It never follows pagination.
 */
export class ManualSelectionAdapter implements ForumAdapter {
  readonly name = 'manual-selection';
  readonly label = 'Manual selection (выделенный текст)';

  canHandle(): boolean {
    return true;
  }

  parse(document: Document, url: string, options: ParseOptions): ParsedDocument {
    const selection = options.manualSelection || window.getSelection();
    const text = selection?.toString().trim() || '';
    const diagnostics: string[] = [];
    if (!text) diagnostics.push('Выделите текст сообщения на странице перед ручным сбором.');
    const container = document.createElement('article');
    container.textContent = text;
    const post = text
      ? extractPost(container, url, options, {
          postSelectors: [],
          idSelectors: [],
          permalinkSelectors: [],
          authorSelectors: [],
          dateSelectors: [],
          bodySelectors: [],
        })
      : null;
    return {
      title: pageTitle(document),
      posts: post ? [post] : [],
      previousUrl: null,
      lastUrl: null,
      diagnostics: [`Ручной режим: источник ${options.sourceId}, тема ${parseTopicId(url)}.`, ...diagnostics],
    };
  }

  findPreviousUrl(): string | null {
    return null;
  }
}

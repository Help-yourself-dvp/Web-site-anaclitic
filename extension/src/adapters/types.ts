import type { ImageMode, ForumPost } from '../core/types';

export interface ParseOptions {
  sourceId: string;
  topicId: string;
  imageMode: ImageMode;
  imageKeywords: string[];
  manualSelection?: Selection | null;
}

export interface ParsedDocument {
  title: string;
  posts: ForumPost[];
  previousUrl: string | null;
  lastUrl: string | null;
  diagnostics: string[];
}

export interface ForumAdapter {
  readonly name: string;
  readonly label: string;
  canHandle(url: string): boolean;
  parse(document: Document, url: string, options: ParseOptions): ParsedDocument;
  findPreviousUrl(document: Document, url: string): string | null;
}

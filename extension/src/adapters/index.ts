import { parseTopicId, stableFingerprint } from '../core/utils';
import type { AdapterName, SourceRecord } from '../core/types';
import { FourPdaAdapter } from './fourpda';
import { GenericArticleAdapter, GenericForumAdapter } from './generic';
import { ManualSelectionAdapter } from './manual';
import type { ForumAdapter } from './types';

export const fourPdaAdapter = new FourPdaAdapter();
export const genericForumAdapter = new GenericForumAdapter();
export const genericArticleAdapter = new GenericArticleAdapter();
export const manualSelectionAdapter = new ManualSelectionAdapter();

export function adapterByName(name: string | null | undefined): ForumAdapter {
  if (name === fourPdaAdapter.name) return fourPdaAdapter;
  if (name === genericArticleAdapter.name) return genericArticleAdapter;
  if (name === manualSelectionAdapter.name) return manualSelectionAdapter;
  return genericForumAdapter;
}

export function adapterForUrl(url: string, override: AdapterName = 'auto'): ForumAdapter {
  if (override !== 'auto') return adapterByName(override);
  if (fourPdaAdapter.canHandle(url)) return fourPdaAdapter;
  return genericForumAdapter;
}

export function topicUrlFor(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    if (/\/lofiversion\/index\.php$/i.test(parsed.pathname)) {
      const topicId = parseTopicId(url);
      if (topicId !== 'unknown-topic') {
        parsed.search = `?t${topicId}.html=`;
        return parsed.href;
      }
    }
    parsed.searchParams.delete('st');
    parsed.searchParams.delete('view');
    parsed.searchParams.delete('p');
    parsed.searchParams.delete('pid');
    return parsed.href;
  } catch {
    return url.split('#')[0] || url;
  }
}

export function sourceForUrl(url: string, title = 'Без названия', adapterOverride: AdapterName = 'auto'): SourceRecord {
  const adapter = adapterForUrl(url, adapterOverride);
  const topicUrl = topicUrlFor(url);
  const parsed = new URL(url);
  const is4Pda = adapter.name === '4pda';
  const topicId = is4Pda
    ? parsed.searchParams.get('showtopic') || parseTopicId(url) || stableFingerprint([topicUrl])
    : stableFingerprint([topicUrl]);
  const sourceId = is4Pda ? `4pda:${topicId}` : `generic:${parsed.hostname}:${topicId}`;
  return {
    source_id: sourceId,
    source_name: is4Pda ? '4PDA' : parsed.hostname,
    base_url: parsed.origin,
    topic_url: topicUrl,
    title: title || topicUrl,
    adapter_name: adapter.name,
    last_checkpoint_post_id: null,
    last_checkpoint_url: null,
    last_checkpoint_page_url: null,
    recent_known_ids: [],
    last_checked_at: null,
    configuration: {
      maxPages: 50,
      delayMs: 1200,
      imageMode: 'links',
      imageKeywords: [],
      downloadImages: false,
    },
    enabled: true,
  };
}

export type { ForumAdapter } from './types';

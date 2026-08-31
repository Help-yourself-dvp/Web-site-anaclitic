export type ImageMode = 'links' | 'all' | 'keywords' | 'manual';
export type AdapterName = 'auto' | '4pda' | 'generic-forum' | 'generic-article' | 'manual-selection';

export type QaStatus = 'confirmed' | 'probable' | 'unconfirmed' | 'outdated' | 'conflicting';

export interface SourceConfiguration {
  maxPages: number;
  delayMs: number;
  imageMode: ImageMode;
  imageKeywords: string[];
  downloadImages: boolean;
}

export const DEFAULT_SOURCE_CONFIGURATION: SourceConfiguration = {
  maxPages: 50,
  delayMs: 1200,
  imageMode: 'links',
  imageKeywords: [],
  downloadImages: false,
};

export interface SourceRecord {
  source_id: string;
  source_name: string;
  base_url: string;
  topic_url: string;
  title: string;
  adapter_name: string;
  last_checkpoint_post_id: string | null;
  last_checkpoint_url: string | null;
  last_checkpoint_page_url: string | null;
  recent_known_ids: string[];
  pending_scan_page_url: string | null;
  pending_scan_checkpoint_key: string | null;
  pending_scan_checkpoint_post_id: string | null;
  pending_scan_checkpoint_url: string | null;
  pending_scan_checkpoint_page_url: string | null;
  pending_scan_post_keys: string[];
  last_checked_at: string | null;
  configuration: SourceConfiguration;
  enabled: boolean;
}

export interface Quote {
  author: string | null;
  text: string;
  source_post_url: string | null;
}

export interface LinkRecord {
  url: string;
  text: string;
}

export interface ForumPost {
  source_id: string;
  topic_id: string;
  post_id: string | null;
  canonical_post_url: string;
  fingerprint: string;
  author: string;
  posted_at: string | null;
  page_url: string;
  body_text: string;
  quotes: Quote[];
  links: LinkRecord[];
  reply_to_urls: string[];
  image_urls: string[];
  local_image_paths: string[];
  collected_at: string;
  content_hash: string;
}

export interface CollectedPage {
  url: string;
  title: string;
  posts: ForumPost[];
  previous_url: string | null;
  last_url: string | null;
  diagnostics: string[];
}

export type CollectionStopReason =
  | 'checkpoint-found'
  | 'history-limit'
  | 'no-previous-page'
  | 'checkpoint-not-found'
  | 'protection-detected'
  | 'unexpected-markup'
  | 'error';

export interface CollectionResult {
  ok: boolean;
  mode: 'checkpoint' | 'history' | 'new';
  source: SourceRecord;
  pages: CollectedPage[];
  posts: ForumPost[];
  stop_reason: CollectionStopReason;
  checkpoint_found: boolean;
  resume_url: string | null;
  diagnostics: string[];
  protection_message: string | null;
}

export interface CollectionRun {
  run_id: string;
  source_id: string;
  post_keys: string[];
  post_count: number;
  from_posted_at: string | null;
  to_posted_at: string | null;
  created_at: string;
  stop_reason: CollectionStopReason;
}

export interface AiPacket {
  prompt_md: string;
  posts_json: string;
  context_posts_json: string;
  links_json: string;
  manifest_json: string;
  posts: ForumPost[];
  context_posts: ForumPost[];
  created_at: string;
}

export interface AiPacketChunk extends AiPacket {
  packet_id: string;
  part_number: number;
  part_count: number;
}

export interface AiPacketBundle {
  packet_id: string;
  part_count: number;
  total_post_count: number;
  combine_prompt_md: string;
  full_text: string;
  chunks: AiPacketChunk[];
}

export interface AiQaEntry {
  question: string;
  short_answer: string;
  detailed_answer: string;
  status: QaStatus;
  tags: string[];
  device_topic: string;
  source_post_urls: string[];
  external_urls: string[];
  first_seen_at: string | null;
  updated_at: string | null;
  confidence_note: string;
  related_report_id?: string;
}

export interface AiSectionItem {
  title: string;
  details: string;
  status: string;
  source_post_urls: string[];
  external_urls: string[];
}

export interface AiResponsePayload {
  schema_version: '1.0';
  report: {
    title: string;
    period: {
      from: string | null;
      to: string | null;
    };
    overview: string;
    important_news: AiSectionItem[];
    confirmed_decisions: AiSectionItem[];
    bugs_and_problems: AiSectionItem[];
    rumors: AiSectionItem[];
    links: Array<{
      url: string;
      annotation: string;
      source_post_urls: string[];
    }>;
    things_to_check: string[];
    qa: AiQaEntry[];
    conflicts: string[];
  };
  markdown_summary: string;
}

export interface ReportRecord {
  report_id: string;
  source_id: string;
  topic_id: string;
  period_from: string | null;
  period_to: string | null;
  raw_ai_response: string;
  parsed_summary: string;
  structured_facts: AiResponsePayload['report'];
  qa_entries: AiQaEntry[];
  created_at: string;
}

export interface ImportResult {
  report: ReportRecord;
  valid_json: boolean;
  warnings: string[];
  unrecognized_qa: string[];
}

export interface StoredRun {
  run: CollectionRun;
}

export interface ExtensionSettings {
  companionUrl: string;
  adapterName: AdapterName;
  maxPages: number;
  delayMs: number;
  imageMode: ImageMode;
  imageKeywords: string[];
  downloadImages: boolean;
}

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  companionUrl: 'http://127.0.0.1:8765',
  adapterName: 'auto',
  maxPages: 50,
  delayMs: 1200,
  imageMode: 'links',
  imageKeywords: [],
  downloadImages: false,
};

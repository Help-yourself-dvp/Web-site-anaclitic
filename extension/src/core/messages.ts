import type {
  AiQaEntry,
  CollectionResult,
  ExtensionSettings,
  ForumPost,
  ImportResult,
  ReportRecord,
  SourceRecord,
} from './types';

export type BackgroundRequest =
  | { type: 'get-state'; url: string }
  | { type: 'collect'; mode: 'checkpoint' | 'history' | 'new'; url: string; maxPages?: number }
  | { type: 'create-package' }
  | { type: 'export-local' }
  | { type: 'reset-source'; url: string }
  | { type: 'clean-service-posts'; url: string }
  | { type: 'search-local'; query: string }
  | { type: 'run-diagnostic'; url: string }
  | { type: 'import-ai'; raw: string; sourceId?: string; topicId?: string }
  | { type: 'get-settings' }
  | { type: 'save-settings'; settings: ExtensionSettings }
  | { type: 'test-companion' }
  | { type: 'open-options' };

export interface PacketChunkResponse {
  packet_id: string;
  part_number: number;
  part_count: number;
  prompt_md: string;
  posts_json: string;
  context_posts_json: string;
  links_json: string;
  manifest_json: string;
  post_count: number;
  context_count: number;
}

export interface PacketResponse {
  packet_id: string;
  part_count: number;
  total_post_count: number;
  combine_prompt_md: string;
  full_text: string;
  chunks: PacketChunkResponse[];
}

export interface ExtensionState {
  currentSource: SourceRecord | null;
  recentPosts: ForumPost[];
  recentPostCount: number;
  recentReports: ReportRecord[];
  lastRunAt: string | null;
  hasCheckpoint: boolean;
  settings: ExtensionSettings;
}

export type BackgroundResponse =
  | { ok: true; state: ExtensionState }
  | { ok: true; collection: CollectionResult }
  | { ok: true; packet: PacketResponse }
  | { ok: true; exportData: { json: string; markdown: string } }
  | { ok: true; diagnostic: { json: string; markdown: string } }
  | { ok: true; search: { posts: ForumPost[]; reports: ReportRecord[]; qa: AiQaEntry[] } }
  | { ok: true; importResult: ImportResult }
  | { ok: true; settings: ExtensionSettings }
  | { ok: true; message: string }
  | { ok: false; error: string; details?: string[] };

export interface CollectorOptions {
  mode: 'checkpoint' | 'history' | 'new';
  source: SourceRecord;
  maxPages: number;
  delayMs: number;
  checkpointKey: string | null;
  checkpointUrl: string | null;
  checkpointPageUrl: string | null;
  startPageUrl: string | null;
  knownKeys: string[];
}

export interface CollectorRequest {
  type: 'run-collector';
  options: CollectorOptions;
}

export interface CollectorDiagnosticRequest {
  type: 'run-diagnostic';
  adapterName: string;
}

export type CollectorMessage = CollectorRequest | CollectorDiagnosticRequest;

import type { AiQaEntry, CollectionRun, ForumPost, ReportRecord, SourceRecord } from './types';
import { makeId, postKey } from './utils';

const DB_NAME = 'forum-knowledge-base';
const DB_VERSION = 1;

type StoredPost = ForumPost & { storage_key: string };
type StoredRun = CollectionRun & { storage_key: string };
type StoredQa = {
  storage_key: string;
  report_id: string;
  source_id: string;
  question: string;
  text: string;
  data: unknown;
};

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
  });
}

function deleteByIndex(store: IDBObjectStore, indexName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = store.index(indexName).openCursor(IDBKeyRange.only(key));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error('IndexedDB cursor failed'));
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sources')) db.createObjectStore('sources', { keyPath: 'source_id' });
      if (!db.objectStoreNames.contains('posts')) {
        const store = db.createObjectStore('posts', { keyPath: 'storage_key' });
        store.createIndex('source_id', 'source_id', { unique: false });
        store.createIndex('posted_at', 'posted_at', { unique: false });
      }
      if (!db.objectStoreNames.contains('runs')) {
        const store = db.createObjectStore('runs', { keyPath: 'storage_key' });
        store.createIndex('source_id', 'source_id', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
      if (!db.objectStoreNames.contains('reports')) {
        const store = db.createObjectStore('reports', { keyPath: 'report_id' });
        store.createIndex('source_id', 'source_id', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
      if (!db.objectStoreNames.contains('qa')) {
        const store = db.createObjectStore('qa', { keyPath: 'storage_key' });
        store.createIndex('source_id', 'source_id', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB'));
  });
}

export async function getSource(sourceId: string): Promise<SourceRecord | null> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('sources', 'readonly');
    return (await requestResult(tx.objectStore('sources').get(sourceId))) || null;
  } finally {
    db.close();
  }
}

export async function getAllSources(): Promise<SourceRecord[]> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('sources', 'readonly');
    return await requestResult(tx.objectStore('sources').getAll());
  } finally {
    db.close();
  }
}

export async function putSource(source: SourceRecord): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('sources', 'readwrite');
    tx.objectStore('sources').put(source);
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export async function deletePostsByKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const db = await openDatabase();
  try {
    const tx = db.transaction('posts', 'readwrite');
    const store = tx.objectStore('posts');
    keys.forEach((key) => store.delete(key));
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export async function resetSource(sourceId: string): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['sources', 'posts', 'runs'], 'readwrite');
    tx.objectStore('sources').delete(sourceId);
    await Promise.all([
      deleteByIndex(tx.objectStore('posts'), 'source_id', sourceId),
      deleteByIndex(tx.objectStore('runs'), 'source_id', sourceId),
    ]);
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export async function putPosts(posts: ForumPost[]): Promise<number> {
  if (posts.length === 0) return 0;
  const db = await openDatabase();
  try {
    const tx = db.transaction('posts', 'readwrite');
    const store = tx.objectStore('posts');
    for (const post of posts) store.put({ ...post, storage_key: postKey(post) } satisfies StoredPost);
    await transactionDone(tx);
    return posts.length;
  } finally {
    db.close();
  }
}

export async function getPosts(sourceId?: string): Promise<ForumPost[]> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('posts', 'readonly');
    const store = tx.objectStore('posts');
    const values = sourceId
      ? await requestResult(store.index('source_id').getAll(sourceId))
      : await requestResult(store.getAll());
    return (values as StoredPost[]).map(({ storage_key: _storageKey, ...post }) => post);
  } finally {
    db.close();
  }
}

export async function getPostCount(sourceId?: string): Promise<number> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('posts', 'readonly');
    const store = tx.objectStore('posts');
    return sourceId
      ? await requestResult(store.index('source_id').count(sourceId))
      : await requestResult(store.count());
  } finally {
    db.close();
  }
}

export async function putRun(run: CollectionRun): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('runs', 'readwrite');
    tx.objectStore('runs').put({ ...run, storage_key: `${run.source_id}:${run.run_id}` } satisfies StoredRun);
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export async function getLatestRun(sourceId?: string): Promise<CollectionRun | null> {
  const runs = await getRuns(sourceId);
  return runs[0] || null;
}

export async function getRuns(sourceId?: string): Promise<CollectionRun[]> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('runs', 'readonly');
    const store = tx.objectStore('runs');
    const values = sourceId
      ? await requestResult(store.index('source_id').getAll(sourceId))
      : await requestResult(store.getAll());
    return (values as StoredRun[])
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ storage_key: _storageKey, ...run }) => run);
  } finally {
    db.close();
  }
}

export async function putReport(report: ReportRecord): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(['reports', 'qa'], 'readwrite');
    tx.objectStore('reports').put(report);
    const qaStore = tx.objectStore('qa');
    report.qa_entries.forEach((entry, index) => {
      const text = `${entry.question}\n${entry.short_answer}\n${entry.detailed_answer}`;
      const qa: StoredQa = {
        storage_key: `${report.report_id}:${index}`,
        report_id: report.report_id,
        source_id: report.source_id,
        question: entry.question,
        text,
        data: entry,
      };
      qaStore.put(qa);
    });
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export async function getQa(sourceId?: string): Promise<AiQaEntry[]> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('qa', 'readonly');
    const store = tx.objectStore('qa');
    const values = sourceId
      ? await requestResult(store.index('source_id').getAll(sourceId))
      : await requestResult(store.getAll());
    return (values as StoredQa[])
      .sort((a, b) => a.storage_key.localeCompare(b.storage_key))
      .map((entry) => entry.data as AiQaEntry);
  } finally {
    db.close();
  }
}

export async function getReports(sourceId?: string): Promise<ReportRecord[]> {
  const db = await openDatabase();
  try {
    const tx = db.transaction('reports', 'readonly');
    const store = tx.objectStore('reports');
    const values = sourceId
      ? await requestResult(store.index('source_id').getAll(sourceId))
      : await requestResult(store.getAll());
    return (values as ReportRecord[]).sort((a, b) => b.created_at.localeCompare(a.created_at));
  } finally {
    db.close();
  }
}

export async function searchLocal(
  query: string,
): Promise<{ posts: ForumPost[]; reports: ReportRecord[]; qa: AiQaEntry[] }> {
  const normalized = query.trim().toLocaleLowerCase();
  const [posts, reports, qa] = await Promise.all([getPosts(), getReports(), getQa()]);
  if (!normalized)
    return { posts: posts.slice(-30).reverse(), reports: reports.slice(0, 10), qa: qa.slice(-20).reverse() };
  return {
    posts: posts
      .filter((post) =>
        `${post.author}\n${post.body_text}\n${post.links.map((link) => link.url).join(' ')}`
          .toLocaleLowerCase()
          .includes(normalized),
      )
      .slice(0, 50),
    reports: reports
      .filter((report) =>
        `${report.parsed_summary}\n${report.raw_ai_response}`.toLocaleLowerCase().includes(normalized),
      )
      .slice(0, 20),
    qa: qa
      .filter((entry) =>
        `${entry.question}\n${entry.short_answer}\n${entry.detailed_answer}`.toLocaleLowerCase().includes(normalized),
      )
      .slice(0, 20),
  };
}

export function newRun(
  sourceId: string,
  postKeys: string[],
  posts: ForumPost[],
  stopReason: CollectionRun['stop_reason'],
): CollectionRun {
  const dates = posts
    .map((post) => post.posted_at)
    .filter((date): date is string => Boolean(date))
    .sort();
  return {
    run_id: makeId('run'),
    source_id: sourceId,
    post_keys: postKeys,
    post_count: posts.length,
    from_posted_at: dates[0] || null,
    to_posted_at: dates[dates.length - 1] || null,
    created_at: new Date().toISOString(),
    stop_reason: stopReason,
  };
}

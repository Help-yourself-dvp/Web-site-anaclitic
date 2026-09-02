import { sourceForUrl } from './adapters';
import { clearBackgroundSource, readBackgroundCheck, runBackgroundCheck } from './background-check';
import {
  clearAllData,
  deleteReport,
  getAllSources,
  getLatestRun,
  deletePostsByKeys,
  getPosts,
  getReports,
  getQa,
  getLocalDataSize,
  getRuns,
  getSource,
  newRun,
  searchLocal,
  putPosts,
  putReport,
  putRun,
  putSource,
  resetSource,
} from './core/db';
import { latestPost, likelyServicePost, mergeKnownKeys, replyContextPosts, unknownPosts } from './core/collection';
import { createAiPacketBundle, createSingleAiPacket } from './core/prompt';
import { importAiResponse } from './core/importer';
import { getSettings, saveSettings } from './core/settings';
import type {
  BackgroundRequest,
  BackgroundResponse,
  CollectorRequest,
  ExtensionState,
  PacketResponse,
} from './core/messages';
import type { CollectionResult, ForumPost, SourceRecord } from './core/types';
import { normalizeUrl, nowIso, parseTopicId, postKey, sortPostsChronologically } from './core/utils';

async function activeTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (typeof tab?.id !== 'number' || !tab.url)
    throw new Error('Не удалось определить активную вкладку. Сначала откройте тему форума.');
  if (!/^https?:\/\//i.test(tab.url)) throw new Error('Активная вкладка не является обычной веб-страницей.');
  return tab;
}

function withSettings(source: SourceRecord, settings: Awaited<ReturnType<typeof getSettings>>): SourceRecord {
  return {
    ...source,
    configuration: {
      ...source.configuration,
      maxPages: settings.maxPages,
      delayMs: settings.delayMs,
      imageMode: settings.imageMode,
      imageKeywords: settings.imageKeywords,
      downloadImages: settings.downloadImages,
    },
  };
}

async function sourceForActiveUrl(
  url: string,
  title?: string,
  adapterOverride: Awaited<ReturnType<typeof getSettings>>['adapterName'] = 'auto',
): Promise<SourceRecord> {
  const detected = sourceForUrl(url, title || 'Без названия', adapterOverride);
  const stored = await getSource(detected.source_id);
  if (stored) return stored;
  return detected;
}

async function injectAndCollect(tabId: number, options: CollectorRequest['options']): Promise<CollectionResult> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['collector.js'] });
  const result = await chrome.tabs.sendMessage(tabId, { type: 'run-collector', options });
  if (!result || typeof result !== 'object') throw new Error('Адаптер не вернул результат сбора.');
  return result as CollectionResult;
}

function updateCheckpoint(source: SourceRecord, post: ForumPost): SourceRecord {
  return {
    ...source,
    last_checkpoint_post_id: post.post_id || post.fingerprint,
    last_checkpoint_url: post.canonical_post_url,
    last_checkpoint_page_url: post.page_url,
    last_checked_at: nowIso(),
  };
}

async function downloadImages(
  posts: ForumPost[],
  source: SourceRecord,
): Promise<{ posts: ForumPost[]; warnings: string[] }> {
  if (!source.configuration.downloadImages) return { posts, warnings: [] };
  const warnings: string[] = [];
  const safeSource = source.source_id.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
  let downloaded = 0;
  const result: ForumPost[] = [];
  for (const post of posts) {
    const localPaths: string[] = [];
    for (const [index, imageUrl] of post.image_urls.entries()) {
      if (downloaded >= 100) {
        warnings.push('Достигнут лимит 100 изображений за запуск. Остальные URL сохранены без скачивания.');
        break;
      }
      try {
        const parsed = new URL(imageUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) continue;
        const extension = (parsed.pathname.match(/\\.(avif|bmp|gif|jpe?g|png|webp)$/i)?.[1] || 'img').toLowerCase();
        const filename = `Forum Knowledge Base/images/${safeSource}/${post.fingerprint}-${index}.${extension}`;
        await chrome.downloads.download({ url: imageUrl, filename, saveAs: false, conflictAction: 'uniquify' });
        localPaths.push(filename);
        downloaded += 1;
      } catch (error) {
        warnings.push(
          `Не удалось скачать изображение ${imageUrl}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    result.push({ ...post, local_image_paths: localPaths });
  }
  if (downloaded > 0) warnings.unshift(`Изображений отправлено в загрузки браузера: ${downloaded}.`);
  return { posts: result, warnings };
}

async function syncCompanion(path: string, body: unknown): Promise<string | null> {
  const settings = await getSettings();
  const base = settings.companionUrl.trim().replace(/\/$/, '');
  if (!base) return null;
  try {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return `Companion ответил HTTP ${response.status}.`;
    return null;
  } catch (error) {
    return `Companion недоступен: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function makeState(url: string): Promise<ExtensionState> {
  const [settings, sources, backgroundCheck, localDataSize] = await Promise.all([
    getSettings(),
    getAllSources(),
    readBackgroundCheck(),
    getLocalDataSize(),
  ]);
  if (!/^https?:\/\//i.test(url)) {
    return {
      currentSource: null,
      sources,
      recentPosts: [],
      recentPostCount: 0,
      localDataSize,
      recentReports: [],
      backgroundCheck,
      lastRunAt: null,
      hasCheckpoint: false,
      settings,
    };
  }
  const detected = sourceForUrl(url, 'Без названия', settings.adapterName);
  const currentSource = await getSource(detected.source_id);
  const source = currentSource ? withSettings(currentSource, settings) : null;
  const [storedPosts, recentReports, latestRun] = await Promise.all([
    source ? getPosts(source.source_id) : Promise.resolve([]),
    source ? getReports(source.source_id) : getReports(),
    source ? getLatestRun(source.source_id) : Promise.resolve(null),
  ]);
  const posts = sortPostsChronologically(storedPosts);
  return {
    currentSource: source,
    sources,
    recentPosts: posts.slice(-8).reverse(),
    recentPostCount: posts.length,
    localDataSize,
    recentReports: recentReports.slice(0, 5),
    backgroundCheck,
    lastRunAt: latestRun?.created_at || null,
    hasCheckpoint: Boolean(source?.last_checkpoint_post_id || source?.last_checkpoint_url),
    settings,
  };
}

async function collect(request: Extract<BackgroundRequest, { type: 'collect' }>): Promise<BackgroundResponse> {
  const tab = await activeTab();
  const settings = await getSettings();
  const existing = await sourceForActiveUrl(tab.url || request.url, tab.title, settings.adapterName);
  const source = withSettings(existing, settings);
  await putSource(source);

  if (request.mode === 'new' && !source.last_checkpoint_post_id && !source.last_checkpoint_url) {
    return {
      ok: false,
      error: 'Checkpoint ещё не создан. Сначала выберите «Создать checkpoint» или импортируйте историю.',
    };
  }

  const storedPosts = await getPosts(source.source_id);
  const checkpointPost = source.last_checkpoint_post_id
    ? storedPosts.find((post) => (post.post_id || post.fingerprint) === source.last_checkpoint_post_id)
    : null;
  const checkpointPageUrl = source.last_checkpoint_page_url || checkpointPost?.page_url || null;
  const resumePageUrl = source.pending_scan_page_url || null;
  const pendingPostKeys = source.pending_scan_post_keys || [];
  const knownKeys = source.recent_known_ids.slice(-1000);
  const checkpointKey = source.last_checkpoint_post_id ? `${source.source_id}:${source.last_checkpoint_post_id}` : null;
  const collectorOptions: CollectorRequest['options'] = {
    mode: request.mode,
    source,
    maxPages: request.maxPages || source.configuration.maxPages,
    delayMs: source.configuration.delayMs,
    checkpointKey,
    checkpointUrl: source.last_checkpoint_url,
    checkpointPageUrl: checkpointPageUrl || null,
    fromOpenPage: request.fromOpenPage === true,
    startPageUrl: resumePageUrl || checkpointPageUrl || source.last_checkpoint_url || null,
    resumePageUrl,
    knownKeys,
  };

  let result: CollectionResult;
  try {
    result = await injectAndCollect(tab.id!, collectorOptions);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      details: ['Убедитесь, что вкладка открыта на обычной странице и расширению разрешён доступ к ней.'],
    };
  }

  if (request.mode === 'checkpoint') {
    const checkpoint = latestPost(result.posts);
    if (checkpoint) {
      const updated = updateCheckpoint(source, checkpoint);
      updated.pending_scan_page_url = null;
      updated.pending_scan_checkpoint_key = null;
      updated.pending_scan_checkpoint_post_id = null;
      updated.pending_scan_checkpoint_url = null;
      updated.pending_scan_checkpoint_page_url = null;
      updated.pending_scan_post_keys = [];
      updated.recent_known_ids = [postKey(checkpoint)];
      await putSource(updated);
      await clearBackgroundSource(updated.source_id);
      result.source = updated;
      result.posts = [];
      result.diagnostics.push(
        `Checkpoint создан на посте ${checkpoint.post_id || checkpoint.fingerprint}. История не импортирована.`,
      );
      const firstPage = result.pages[0];
      const newerUrl = firstPage ? normalizeUrl(firstPage.last_url || '', firstPage.url) : null;
      if (firstPage && newerUrl && newerUrl !== firstPage.url) {
        result.diagnostics.push(
          `Внимание: у темы есть более новая страница (${newerUrl}). Checkpoint создан на открытой странице, поэтому самые новые сообщения ещё не учтены. Нажмите «Проверить новые сообщения».`,
        );
      }
    }
    return { ok: true, collection: result };
  }

  const partialNewRun = request.mode === 'new' && !result.checkpoint_found && Boolean(result.resume_url);
  const canPersist = result.ok && (request.mode === 'history' || result.checkpoint_found || partialNewRun);
  if (!canPersist) {
    result.posts = [];
    return { ok: true, collection: result };
  }

  const newPosts = unknownPosts(result.posts, storedPosts);
  const imageResult = await downloadImages(newPosts, source);
  const postsToSave = imageResult.posts;
  result.diagnostics.push(...imageResult.warnings);
  if (postsToSave.length > 0) await putPosts(postsToSave);

  let updatedSource = source;
  const segmentKeys = postsToSave.map((post) => postKey(post));
  if (partialNewRun) {
    updatedSource.pending_scan_page_url = result.resume_url;
    updatedSource.pending_scan_post_keys = Array.from(new Set([...pendingPostKeys, ...segmentKeys]));
    if (!updatedSource.pending_scan_checkpoint_key) {
      const segmentNewest = latestPost(postsToSave);
      if (segmentNewest) {
        updatedSource.pending_scan_checkpoint_key = postKey(segmentNewest);
        updatedSource.pending_scan_checkpoint_post_id = segmentNewest.post_id || segmentNewest.fingerprint;
        updatedSource.pending_scan_checkpoint_url = segmentNewest.canonical_post_url;
        updatedSource.pending_scan_checkpoint_page_url = segmentNewest.page_url;
      }
    }
    result.diagnostics.push('Этот запуск обработал только часть диапазона. Следующий запуск продолжит автоматически.');
  } else if (request.mode === 'new') {
    const pendingKey = source.pending_scan_checkpoint_key;
    const allKnownAfterSave = [...storedPosts, ...postsToSave];
    const pendingCandidate = pendingKey ? allKnownAfterSave.find((post) => postKey(post) === pendingKey) || null : null;
    const checkpointCandidate = pendingCandidate || latestPost(postsToSave);
    if (checkpointCandidate) updatedSource = updateCheckpoint(updatedSource, checkpointCandidate);
    updatedSource.pending_scan_page_url = null;
    updatedSource.pending_scan_checkpoint_key = null;
    updatedSource.pending_scan_checkpoint_post_id = null;
    updatedSource.pending_scan_checkpoint_url = null;
    updatedSource.pending_scan_checkpoint_page_url = null;
    updatedSource.pending_scan_post_keys = [];
  } else {
    const checkpointCandidate = latestPost(result.posts);
    if (checkpointCandidate) updatedSource = updateCheckpoint(updatedSource, checkpointCandidate);
    updatedSource.pending_scan_page_url = null;
    updatedSource.pending_scan_checkpoint_key = null;
    updatedSource.pending_scan_checkpoint_post_id = null;
    updatedSource.pending_scan_checkpoint_url = null;
    updatedSource.pending_scan_checkpoint_page_url = null;
    updatedSource.pending_scan_post_keys = [];
  }
  updatedSource.recent_known_ids = mergeKnownKeys(updatedSource.recent_known_ids, result.posts, 1000);
  updatedSource.last_checked_at = nowIso();
  await putSource(updatedSource);
  await clearBackgroundSource(updatedSource.source_id);

  const runKeys = partialNewRun ? segmentKeys : [...pendingPostKeys, ...segmentKeys];
  const allKnownAfterSave = [...storedPosts, ...postsToSave];
  const runPosts = allKnownAfterSave.filter((post) => runKeys.includes(postKey(post)));
  const run = newRun(updatedSource.source_id, Array.from(new Set(runKeys)), runPosts, result.stop_reason);
  await putRun(run);
  const companionWarning = await syncCompanion('/api/sync', {
    source: updatedSource,
    posts: postsToSave,
    run,
  });
  if (companionWarning) result.diagnostics.push(companionWarning);
  result.source = updatedSource;
  result.posts = postsToSave;
  result.diagnostics.push(`Новых сообщений сохранено: ${postsToSave.length}. Повторения отброшены.`);
  return { ok: true, collection: result };
}

async function packet(mode: 'single' | 'split'): Promise<BackgroundResponse> {
  const run = await getLatestRun();
  if (!run || run.post_keys.length === 0) {
    return {
      ok: false,
      error: 'Нет сообщений последнего сбора. Сначала выполните сбор новых сообщений или импорт истории.',
    };
  }
  const posts = await getPosts(run.source_id);
  const byKey = new Set(run.post_keys);
  const selected = posts.filter((post) => byKey.has(postKey(post)));
  if (selected.length === 0) return { ok: false, error: 'Последний запуск не содержит сохранённых сообщений.' };
  const contextPosts = replyContextPosts(selected, posts);
  if (mode === 'single') {
    const single = createSingleAiPacket(selected, contextPosts);
    return { ok: true, singlePacket: single };
  }
  const bundle = createAiPacketBundle(selected, contextPosts);
  const packet: PacketResponse = {
    packet_id: bundle.packet_id,
    part_count: bundle.part_count,
    total_post_count: bundle.total_post_count,
    combine_prompt_md: bundle.combine_prompt_md,
    full_text: bundle.full_text,
    chunks: bundle.chunks.map((chunk) => ({
      packet_id: chunk.packet_id,
      part_number: chunk.part_number,
      part_count: chunk.part_count,
      prompt_md: chunk.prompt_md,
      posts_json: chunk.posts_json,
      context_posts_json: chunk.context_posts_json,
      links_json: chunk.links_json,
      manifest_json: chunk.manifest_json,
      post_count: chunk.posts.length,
      context_count: chunk.context_posts.length,
    })),
  };
  return { ok: true, packet };
}

async function clearAllLocalData(): Promise<BackgroundResponse> {
  await clearAllData();
  await runBackgroundCheck([], false);
  const companionWarning = await syncCompanion('/api/clear-all', {});
  return {
    ok: true,
    message: companionWarning
      ? `Все данные расширения удалены. ${companionWarning}`
      : 'Все посты, отчёты, Q&A и точки отсчёта удалены.',
  };
}

async function resetActiveSource(url: string): Promise<BackgroundResponse> {
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Сначала откройте страницу этой темы.' };
  const settings = await getSettings();
  const detected = sourceForUrl(url, 'Без названия', settings.adapterName);
  const source = await getSource(detected.source_id);
  if (!source) return { ok: false, error: 'Для этой темы пока нет сохранённых данных.' };
  await resetSource(source.source_id);
  await clearBackgroundSource(source.source_id);
  const companionWarning = await syncCompanion('/api/reset', { source_id: source.source_id });
  return {
    ok: true,
    message: companionWarning
      ? `Данные расширения удалены. ${companionWarning}`
      : 'Все данные этой темы, включая посты, отчёты и Q&A, удалены.',
  };
}

async function runDiagnostic(url: string): Promise<BackgroundResponse> {
  const tab = await activeTab();
  const settings = await getSettings();
  const pageUrl = tab.url || url;
  const source = sourceForUrl(pageUrl, tab.title, settings.adapterName);
  await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ['collector.js'] });
  const result = await chrome.tabs.sendMessage(tab.id!, {
    type: 'run-diagnostic',
    adapterName: source.adapter_name,
  });
  if (!result || typeof result !== 'object' || !('markdown' in result) || !('json' in result)) {
    throw new Error('Не удалось получить диагностический лог со страницы.');
  }
  return { ok: true, diagnostic: result as { markdown: string; json: string } };
}

async function cleanServicePosts(url: string): Promise<BackgroundResponse> {
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Сначала откройте страницу этой темы.' };
  const settings = await getSettings();
  const detected = sourceForUrl(url, 'Без названия', settings.adapterName);
  const source = await getSource(detected.source_id);
  if (!source) return { ok: false, error: 'Для этой темы пока нет сохранённых данных.' };
  const posts = await getPosts(source.source_id);
  const badPosts = posts.filter(likelyServicePost);
  const badKeys = badPosts.map((post) => postKey(post));
  await deletePostsByKeys(badKeys);
  if (badKeys.length > 0) {
    source.recent_known_ids = source.recent_known_ids.filter((key) => !badKeys.includes(key));
    await putSource(source);
  }
  await clearBackgroundSource(source.source_id);
  const companionWarning = await syncCompanion('/api/clean', { source_id: source.source_id, post_keys: badKeys });
  return {
    ok: true,
    message: companionWarning
      ? `Удалено служебных записей в расширении: ${badKeys.length}. ${companionWarning}`
      : `Удалено служебных записей: ${badKeys.length}. Точка отсчёта сохранена.`,
  };
}

async function openSavedSource(sourceId: string): Promise<BackgroundResponse> {
  const source = await getSource(sourceId);
  if (!source) return { ok: false, error: 'Выбранная тема не найдена в локальной базе.' };
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (typeof tab?.id !== 'number') return { ok: false, error: 'Не удалось найти вкладку для открытия темы.' };
  await chrome.tabs.update(tab.id, { url: source.topic_url });
  return { ok: true, message: 'Открываю выбранную тему.' };
}

async function exportLocal(): Promise<BackgroundResponse> {
  const [sources, posts, reports, qa, runs] = await Promise.all([
    getAllSources(),
    getPosts(),
    getReports(),
    getQa(),
    getRuns(),
  ]);
  const payload = {
    format: 'forum-knowledge-base-export',
    format_version: '1.0',
    exported_at: nowIso(),
    note: 'Резервная копия данных для восстановления и архива. Для анализа ИИ используйте отдельную кнопку единого AI-файла.',
    sources,
    posts,
    reports,
    qa,
    runs,
  };
  const lines = ['# Forum Knowledge Base — локальный экспорт', '', `Создано: ${payload.exported_at}`, ''];
  for (const source of sources) {
    lines.push(`## ${source.title}`, `Источник: ${source.topic_url}`, `Адаптер: ${source.adapter_name}`, '');
    const sourcePosts = sortPostsChronologically(posts.filter((post) => post.source_id === source.source_id));
    for (const post of sourcePosts) {
      lines.push(
        `### ${post.author} — ${post.posted_at || 'дата неизвестна'}`,
        `[Открыть пост](${post.canonical_post_url})`,
        '',
        post.body_text,
        '',
      );
    }
  }
  if (reports.length) {
    lines.push('## Импортированные сводки', '');
    for (const report of reports) {
      lines.push(
        `### ${report.structured_facts.title || report.report_id}`,
        `Дата: ${report.created_at}`,
        '',
        report.parsed_summary,
        '',
      );
    }
  }
  if (qa.length) {
    lines.push('## Q&A', '');
    for (const entry of qa) {
      lines.push(
        `### ${entry.question}`,
        `Статус: ${entry.status}`,
        '',
        entry.detailed_answer || entry.short_answer,
        '',
      );
    }
  }
  return {
    ok: true,
    exportData: { json: JSON.stringify(payload, null, 2), markdown: lines.join('\n') },
  };
}

async function importResponse(request: Extract<BackgroundRequest, { type: 'import-ai' }>): Promise<BackgroundResponse> {
  let sourceId = request.sourceId || '';
  let topicId = request.topicId || '';
  if (!sourceId || !topicId) {
    try {
      const tab = await activeTab();
      const settings = await getSettings();
      const source = await sourceForActiveUrl(tab.url || '', tab.title, settings.adapterName);
      sourceId ||= source.source_id;
      topicId ||= parseTopicId(source.topic_url);
    } catch {
      // A report can be imported without an active forum tab.
    }
  }
  const result = importAiResponse(request.raw, sourceId, topicId);
  const storedReports = sourceId ? await getReports(sourceId) : [];
  const duplicate = storedReports.find((item) => item.raw_ai_response.trim() === request.raw.trim());
  if (duplicate) {
    result.duplicate = true;
    result.warnings.push(
      `Такой ответ уже сохранён ${new Date(duplicate.created_at).toLocaleString()}. Вторая копия не создавалась.`,
    );
    return { ok: true, importResult: result };
  }
  await putReport(result.report);
  const companionWarning = await syncCompanion('/api/reports', { report: result.report });
  if (companionWarning) result.warnings.push(companionWarning);
  return { ok: true, importResult: result };
}

async function runStartupProbe(): Promise<void> {
  try {
    const [settings, sources] = await Promise.all([getSettings(), getAllSources()]);
    await runBackgroundCheck(sources, settings.backgroundCheckEnabled);
  } catch {
    // A startup probe must never make the extension unavailable.
  }
}

async function handle(request: BackgroundRequest): Promise<BackgroundResponse> {
  switch (request.type) {
    case 'get-settings':
      return { ok: true, settings: await getSettings() };
    case 'save-settings': {
      const settings = await saveSettings(request.settings);
      void runStartupProbe();
      return { ok: true, settings };
    }
    case 'get-state':
      return { ok: true, state: await makeState(request.url) };
    case 'collect':
      return collect(request);
    case 'create-package':
      return packet(request.mode);
    case 'export-local':
      return exportLocal();
    case 'reset-source':
      return resetActiveSource(request.url);
    case 'clear-all-data':
      return clearAllLocalData();
    case 'clean-service-posts':
      return cleanServicePosts(request.url);
    case 'run-diagnostic':
      return runDiagnostic(request.url);
    case 'search-local':
      return { ok: true, search: await searchLocal(request.query) };
    case 'delete-report':
      await deleteReport(request.reportId);
      return { ok: true, message: 'Выжимка удалена.' };
    case 'import-ai':
      return importResponse(request);
    case 'test-companion': {
      const settings = await getSettings();
      if (!settings.companionUrl) return { ok: false, error: 'Адрес companion не задан.' };
      try {
        const response = await fetch(`${settings.companionUrl.replace(/\/$/, '')}/api/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return { ok: false, error: `Companion вернул HTTP ${response.status}.` };
        return { ok: true, message: 'Companion отвечает.' };
      } catch (error) {
        return {
          ok: false,
          error: `Не удалось подключиться: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
    case 'open-options':
      await chrome.runtime.openOptionsPage();
      return { ok: true, message: 'Открыты настройки.' };
    case 'open-source':
      return openSavedSource(request.sourceId);
    default:
      return { ok: false, error: 'Неизвестная команда.' };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void getSettings();
});

chrome.runtime.onStartup.addListener(() => {
  void runStartupProbe();
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  void handle(message as BackgroundRequest)
    .then((response) => sendResponse(response))
    .catch((error: unknown) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      } satisfies BackgroundResponse),
    );
  return true;
});

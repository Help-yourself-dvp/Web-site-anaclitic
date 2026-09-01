import { replyContextPosts } from './collection';
import type { AiPacket, AiPacketBundle, AiPacketChunk, ForumPost } from './types';
import { makeId, nowIso, sortPostsChronologically, uniqueStrings } from './utils';

interface PromptMeta {
  packetId?: string;
  partNumber?: number;
  partCount?: number;
}

function postBlock(post: ForumPost, index: number, label: string): string {
  const links = post.links.length ? post.links.map((link) => `- ${link.text}: ${link.url}`).join('\n') : '- нет';
  const images = post.image_urls.length ? post.image_urls.map((url) => `- ${url}`).join('\n') : '- нет';
  const quotes = post.quotes.length
    ? post.quotes
        .map(
          (quote) =>
            `- ${quote.author ? `${quote.author}: ` : ''}${quote.text}${quote.source_post_url ? ` (источник цитаты: ${quote.source_post_url})` : ''}`,
        )
        .join('\n')
    : '- нет';
  const replies = post.reply_to_urls.length ? post.reply_to_urls.map((url) => `- ${url}`).join('\n') : '- нет';
  return [
    `### ${label} ${index}`,
    `- Автор: ${post.author}`,
    `- Дата: ${post.posted_at || 'не распознана'}`,
    `- Исходная страница: ${post.page_url}`,
    `- Пост: ${post.canonical_post_url}`,
    '',
    'Текст:',
    post.body_text,
    '',
    'Цитаты (не считать новыми фактами без проверки):',
    quotes,
    '',
    'Ссылки из сообщения:',
    links,
    '',
    'Ссылки на сообщения, на которые может отвечать этот пост:',
    replies,
    '',
    'Изображения из сообщения (URL; анализировать только если пользователь приложил файл или URL доступен):',
    images,
  ].join('\n');
}

export function buildPrompt(
  postsInput: ForumPost[],
  contextPostsInput: ForumPost[] = [],
  meta: PromptMeta = {},
): string {
  const posts = sortPostsChronologically(postsInput);
  const contextPosts = sortPostsChronologically(contextPostsInput);
  const source = posts[0] || contextPosts[0];
  const from = posts.find((post) => post.posted_at)?.posted_at || 'неизвестно';
  const to = [...posts].reverse().find((post) => post.posted_at)?.posted_at || 'неизвестно';
  const urls = uniqueStrings(posts.map((post) => post.canonical_post_url));
  const contextUrls = new Set(contextPosts.map((post) => post.canonical_post_url));
  const unresolvedReplies = uniqueStrings(
    posts.flatMap((post) => post.reply_to_urls).filter((url) => !contextUrls.has(url)),
  );
  const responseSchema = `{
  "schema_version": "1.0",
  "report": {
    "title": "строка",
    "period": {"from": "ISO или null", "to": "ISO или null"},
    "overview": "краткая выжимка",
    "important_news": [{"title": "", "details": "", "status": "confirmed|probable|unconfirmed|conflicting", "source_post_urls": [], "external_urls": []}],
    "confirmed_decisions": [],
    "bugs_and_problems": [],
    "rumors": [],
    "links": [{"url": "", "annotation": "", "source_post_urls": []}],
    "things_to_check": [],
    "qa": [{"question": "", "short_answer": "", "detailed_answer": "", "status": "confirmed|probable|unconfirmed|outdated|conflicting", "tags": [], "device_topic": "", "source_post_urls": [], "external_urls": [], "first_seen_at": null, "updated_at": null, "confidence_note": ""}],
    "conflicts": []
  },
  "markdown_summary": "полная читаемая сводка для человека: важные изменения, решения, проблемы, слухи, ссылки, проверки и Q&A"
}`;
  const partHeader = meta.partCount
    ? [
        `## Это часть ${meta.partNumber || 1} из ${meta.partCount} одного пакета`,
        `Идентификатор пакета: ${meta.packetId || 'неизвестен'}`,
        'Анализируй эту часть отдельно, но не называй её полной сводкой всей темы.',
        '',
      ]
    : [];

  return [
    '# Анализ новых сообщений форума',
    '',
    ...partHeader,
    'Ты анализируешь только приведённые ниже первичные материалы. Не выдумывай отсутствующие факты и не выдавай мнение пользователя за подтверждение.',
    'Считай цитаты, пересказы и предположения отдельными от фактов. Отмечай противоречия и степень уверенности.',
    '',
    '## Задача',
    '1. Дай короткую выжимку без воды и выдели только новые факты или изменения внутри этого пакета.',
    '2. Раздели результат на: важные новости; подтверждённые решения; баги и проблемы; неподтверждённые слухи; ссылки с краткими аннотациями; что стоит проверить пользователю; Q&A-карточки.',
    '3. Для каждого значимого утверждения укажи один или несколько точных URL исходных постов. Если источника нет, так и напиши.',
    '4. Ясно различай подтверждено, вероятно, неподтверждено, устарело и противоречит друг другу.',
    '5. Не открывай, не выполняй и не считай безопасными внешние файлы только потому, что на них есть ссылка. Ссылки лишь аннотируй.',
    '6. Сообщение может быть ответом на цитату или другой пост. Используй поля «Цитаты» и «Ссылки на сообщения», свяжи ответ с исходным постом, не повторяй цитату как новую информацию. Если исходник не приложен — укажи, что контекст неполный.',
    '',
    '## Формат ответа — обязателен',
    'Сначала выведи один валидный JSON без пояснений строго по схеме ниже. Затем после отдельной строки `---MARKDOWN---` выведи полную читаемую Markdown-сводку для человека. Markdown не должен быть одной короткой фразой: повтори в нём важные изменения, решения, проблемы, слухи, ссылки, проверки и Q&A. Все массивы должны присутствовать, даже если они пустые. Не добавляй в JSON поля с догадками без пометки статуса.',
    'Схема (эквивалентная строгая JSON Schema):',
    '```json',
    responseSchema,
    '```',
    '',
    '## Метаданные пакета',
    `Источник: ${source?.source_id || 'неизвестен'}`,
    `Период новых сообщений: ${from} — ${to}`,
    `Количество новых сообщений: ${posts.length}`,
    `Количество контекстных старых сообщений: ${contextPosts.length}`,
    `URL новых постов в пакете: ${urls.length}`,
    '',
    '## Новые сообщения — именно их изменения нужно анализировать',
    posts.length
      ? posts.map((post, index) => postBlock(post, index, 'Новое сообщение')).join('\n\n')
      : 'Новых сообщений в пакете нет.',
    '',
    '## Контекстные старые сообщения — не считать новыми',
    contextPosts.length
      ? contextPosts.map((post, index) => postBlock(post, index, 'Контекстное сообщение')).join('\n\n')
      : 'Подходящие исходные сообщения уже не найдены в локальной базе. Не делайте вид, что ссылки на них проверены.',
    '',
    '## Ссылки на исходные сообщения, для которых контекст не найден локально',
    unresolvedReplies.length ? unresolvedReplies.map((url) => `- ${url}`).join('\n') : '- нет',
  ].join('\n');
}

function createManifest(posts: ForumPost[], contextPosts: ForumPost[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify(
    {
      format: 'forum-knowledge-base-packet',
      format_version: '1.0',
      created_at: nowIso(),
      post_count: posts.length,
      context_post_count: contextPosts.length,
      image_count: posts.reduce((total, post) => total + post.image_urls.length, 0),
      note: 'Изображения представлены URL. Автоматическая отправка файлов во внешний ИИ не выполняется.',
      ...extra,
    },
    null,
    2,
  );
}

export interface SingleAiPacket {
  markdown: string;
  json: string;
  text: string;
  post_count: number;
  context_count: number;
}

export function createSingleAiPacket(postsInput: ForumPost[], contextPostsInput: ForumPost[] = []): SingleAiPacket {
  const packet = createAiPacket(postsInput, contextPostsInput);
  const links = JSON.parse(packet.links_json) as unknown;
  const json = JSON.stringify(
    {
      format: 'forum-knowledge-base-single-ai-file',
      format_version: '1.0',
      instructions: packet.prompt_md,
      posts: packet.posts,
      context_posts: packet.context_posts,
      links,
      note: 'Поле instructions содержит полный промпт. Этот файл предназначен для загрузки в ИИ, а не для восстановления базы.',
    },
    null,
    2,
  );
  return {
    markdown: packet.prompt_md,
    json,
    text: packet.prompt_md,
    post_count: packet.posts.length,
    context_count: packet.context_posts.length,
  };
}

export function createAiPacket(postsInput: ForumPost[], contextPostsInput: ForumPost[] = []): AiPacket {
  const posts = sortPostsChronologically(postsInput);
  const contextPosts = sortPostsChronologically(contextPostsInput).filter(
    (context) => !posts.some((post) => post.canonical_post_url === context.canonical_post_url),
  );
  const links = posts.flatMap((post) => [
    ...post.links.map((link) => ({
      ...link,
      link_type: 'link',
      post_url: post.canonical_post_url,
      source_id: post.source_id,
    })),
    ...post.reply_to_urls.map((url) => ({
      url,
      text: 'Ссылка на сообщение, на которое может отвечать пост',
      link_type: 'reply',
      post_url: post.canonical_post_url,
      source_id: post.source_id,
    })),
  ]);
  return {
    prompt_md: buildPrompt(posts, contextPosts),
    posts_json: JSON.stringify(posts, null, 2),
    context_posts_json: JSON.stringify(contextPosts, null, 2),
    links_json: JSON.stringify(links, null, 2),
    manifest_json: createManifest(posts, contextPosts),
    posts,
    context_posts: contextPosts,
    created_at: nowIso(),
  };
}

function splitPosts(posts: ForumPost[], maxChars: number): ForumPost[][] {
  const chunks: ForumPost[][] = [];
  let current: ForumPost[] = [];
  let currentSize = 0;
  for (const post of sortPostsChronologically(posts)) {
    const estimatedSize = JSON.stringify(post).length + 1200;
    if (current.length > 0 && currentSize + estimatedSize > maxChars) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(post);
    currentSize += estimatedSize;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function buildCombinePrompt(packetId: string, partCount: number): string {
  return [
    '# Итоговая выжимка из частей одного пакета',
    '',
    `Идентификатор пакета: ${packetId}`,
    `Ожидаемое количество частей: ${partCount}`,
    '',
    'Ниже будут вставлены промежуточные ответы ИИ по всем частям. Объедини их в один итоговый отчёт.',
    'Удали повторы, сохрани только подтверждённые ссылками факты, отметь противоречия и не придумывай информацию.',
    'Сначала выведи валидный JSON строго схемы 1.0 из prompt частей, затем строку ---MARKDOWN--- и удобную Markdown-сводку.',
    'Если какая-то часть не вставлена, укажи это в overview или conflicts, а не делай вид, что анализ полон.',
    '',
    '## Промежуточные ответы',
    ...Array.from({ length: partCount }, (_, index) => [
      `### Ответ части ${index + 1} из ${partCount}`,
      '[Вставьте сюда полный ответ ИИ для этой части]',
      '',
    ]).flat(),
  ].join('\n');
}

export function buildPlainText(postsInput: ForumPost[], contextPostsInput: ForumPost[] = []): string {
  const posts = sortPostsChronologically(postsInput);
  const contextPosts = sortPostsChronologically(contextPostsInput);
  const plainPost = (post: ForumPost, index: number, label: string) =>
    [
      `${label} ${index + 1}`,
      `Автор: ${post.author}`,
      `Дата: ${post.posted_at || 'не распознана'}`,
      `Пост: ${post.canonical_post_url}`,
      `Исходная страница: ${post.page_url}`,
      `Ответ на: ${post.reply_to_urls.join(', ') || 'нет данных'}`,
      `Изображения: ${post.image_urls.join(', ') || 'нет'}`,
      '',
      post.body_text,
      '',
    ].join('\n');
  return [
    'Forum Knowledge Base — полный текст сообщений',
    '',
    'Новые сообщения:',
    ...posts.map((post, index) => plainPost(post, index, 'Новое сообщение')),
    'Контекстные сообщения:',
    ...contextPosts.map((post, index) => plainPost(post, index, 'Контекстное сообщение')),
  ].join('\n');
}

export function createAiPacketBundle(
  postsInput: ForumPost[],
  contextPostsInput: ForumPost[] = [],
  maxChars = 30_000,
  packetId = makeId('packet'),
): AiPacketBundle {
  const groups = splitPosts(postsInput, Math.max(10_000, maxChars));
  const partCount = Math.max(1, groups.length);
  const chunks: AiPacketChunk[] = groups.map((group, index) => {
    const context = replyContextPosts(group, contextPostsInput);
    const base = createAiPacket(group, context);
    const createdAt = nowIso();
    return {
      ...base,
      packet_id: packetId,
      part_number: index + 1,
      part_count: partCount,
      prompt_md: buildPrompt(group, context, { packetId, partNumber: index + 1, partCount }),
      manifest_json: createManifest(base.posts, base.context_posts, {
        packet_id: packetId,
        part_number: index + 1,
        part_count: partCount,
      }),
      created_at: createdAt,
    };
  });
  return {
    packet_id: packetId,
    part_count: partCount,
    total_post_count: postsInput.length,
    combine_prompt_md: buildCombinePrompt(packetId, partCount),
    full_text: buildPlainText(postsInput, contextPostsInput),
    chunks,
  };
}

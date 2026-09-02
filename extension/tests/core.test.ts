import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { fourPdaAdapter } from '../src/adapters';
import { findLastPageUrl, findPreviousPageUrl } from '../src/adapters/pagination';
import {
  checkpointMatches,
  deduplicatePosts,
  likelyServicePost,
  mergeKnownKeys,
  replyContextPosts,
  unknownPosts,
} from '../src/core/collection';
import { cleanUrlValue, importAiResponse, validateAiResponse } from '../src/core/importer';
import { createAiPacket, createAiPacketBundle, createSingleAiPacket } from '../src/core/prompt';
import { renderSavedReports } from '../src/core/report-view';
import type { ForumPost, ReportRecord } from '../src/core/types';
import { firstDateLikeText, parseForumDate, postKey, sortPostsChronologically } from '../src/core/utils';

function post(id: string, body: string, postedAt = `2026-08-26T00:${id.padStart(2, '0')}:00.000Z`): ForumPost {
  return {
    source_id: '4pda:1108618',
    topic_id: '1108618',
    post_id: id,
    canonical_post_url: `https://4pda.to/forum/index.php?showtopic=1108618#entry${id}`,
    fingerprint: `fingerprint-${id}`,
    author: `user-${id}`,
    posted_at: postedAt,
    page_url: 'https://4pda.to/forum/index.php?showtopic=1108618&st=13260',
    body_text: body,
    quotes: [],
    links: [{ url: `https://example.test/${id}`, text: 'ссылка' }],
    reply_to_urls: [],
    image_urls: id === '3' ? ['https://example.test/image.png'] : [],
    local_image_paths: [],
    collected_at: '2026-08-26T00:00:00.000Z',
    content_hash: `hash-${id}`,
  };
}

describe('адаптер 4PDA', () => {
  it('распознаёт реальную старую разметку postcolor и не путает ячейку автора с текстом поста', () => {
    const { document } = parseHTML(`
      <div id="post-member-123"><span class="normalname">Иван</span></div>
      <table><tr>
        <td class="post2"><span class="normalname"><a href="?showuser=1">Иван</a></span><span class="postdetails">Регистрация: 01.01.24</span></td>
        <td class="post2" id="post-main-123"><div class="postcolor" id="post-123">Настоящий текст сообщения</div><a href="?showtopic=1108618&view=findpost&p=123">#1</a> 13.08.26, 10:03</td>
      </tr></table>
    `);
    const result = fourPdaAdapter.parse(
      document as unknown as Document,
      'https://4pda.to/forum/index.php?showtopic=1108618&st=13260',
      {
        sourceId: '4pda:1108618',
        topicId: '1108618',
        imageMode: 'links',
        imageKeywords: [],
        manualSelection: null,
      },
    );
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]?.post_id).toBe('123');
    expect(result.posts[0]?.author).toBe('Иван');
    expect(result.posts[0]?.body_text).toBe('Настоящий текст сообщения');
    expect(result.posts[0]?.canonical_post_url).toContain('p=123');
  });

  it('отбрасывает служебное меню и извлекает посты, ссылки, картинки и переходы', () => {
    const { document } = parseHTML(`
      <html><head><title>Тестовая тема</title></head><body>
        <div class="post"><div class="post_body">Пользователь Мои ответы Настройки</div></div>
        <a href="?showtopic=1108618&st=13240" title="Предыдущая страница">&lt;</a>
        <a href="?showtopic=1108618&st=13520" title="На последнюю страницу">»</a>
        <div class="postwrapper">
          <div class="postname">Иван</div><div class="postdate">13.08.26, 10:03</div>
          <div class="postcontent"><div class="spoil"><div class="spoilbody">Внутри спойлера</div></div>
            <a href="?act=findpost&pid=10">Перейти к сообщению</a>
            <a href="/forum/dl/post/11/screenshot.png">Открыть картинку</a>
            <img data-src="/image.png" alt="скриншот" />
          </div>
        </div>
      </body></html>
    `);
    const result = fourPdaAdapter.parse(
      document as unknown as Document,
      'https://4pda.to/forum/index.php?showtopic=1108618&st=13260',
      {
        sourceId: '4pda:1108618',
        topicId: '1108618',
        imageMode: 'all',
        imageKeywords: [],
        manualSelection: null,
      },
    );
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]?.author).toBe('Иван');
    expect(result.posts[0]?.body_text).toContain('Внутри спойлера');
    expect(result.posts[0]?.reply_to_urls[0]).toContain('act=findpost');
    expect(result.posts[0]?.image_urls).toEqual([
      'https://4pda.to/image.png',
      'https://4pda.to/forum/dl/post/11/screenshot.png',
    ]);
    expect(result.previousUrl).toContain('st=13240');
    expect(result.lastUrl).toContain('st=13520');
  });
});

describe('дедупликация и checkpoint', () => {
  it('оставляет первое появление одного post key', () => {
    const first = post('1', 'первый текст');
    const duplicate = { ...first, body_text: 'повторно встретился на пограничной странице' };
    expect(deduplicatePosts([first, duplicate, post('2', 'второй')])).toEqual([first, post('2', 'второй')]);
  });

  it('отделяет неизвестные сообщения от уже сохранённых', () => {
    const oldPost = post('1', 'старый');
    const newPost = post('2', 'новый');
    expect(unknownPosts([oldPost, newPost, newPost], [oldPost])).toEqual([newPost]);
  });

  it('находит checkpoint по ключу, URL или недавнему known key', () => {
    const current = post('42', 'checkpoint');
    expect(checkpointMatches(current, postKey(current), null)).toBe(true);
    expect(checkpointMatches(current, null, current.canonical_post_url)).toBe(true);
    expect(checkpointMatches(current, null, null, [postKey(current)])).toBe(true);
    expect(checkpointMatches(current, 'other', 'https://example.test/post')).toBe(false);
  });

  it('ограничивает recent known ids и сохраняет порядок', () => {
    const posts = Array.from({ length: 4 }, (_, index) => post(String(index + 1), `текст ${index + 1}`));
    const keys = mergeKnownKeys(['old-key'], posts, 3);
    expect(keys).toEqual([postKey(posts[1]!), postKey(posts[2]!), postKey(posts[3]!)]);
  });

  it('добавляет в пакет сохранённый родительский пост по ссылке pid', () => {
    const parent = post('10', 'исходное сообщение');
    const reply = { ...post('11', 'ответ'), reply_to_urls: ['https://4pda.to/forum/index.php?act=findpost&pid=10'] };
    expect(replyContextPosts([reply], [parent])).toEqual([parent]);
  });

  it('помечает старое меню и битую кодировку для очистки, но не обычный пост', () => {
    expect(likelyServicePost({ ...post('20', 'Пользователь Мои ответы Настройки'), author: 'Неизвестный автор' })).toBe(
      true,
    );
    expect(likelyServicePost({ ...post('21', '�������� MagicOS') })).toBe(true);
    expect(likelyServicePost(post('22', 'Обычный русский текст'))).toBe(false);
  });
});

describe('AI packet', () => {
  it('содержит структурированные посты, ссылки и обязательные инструкции', () => {
    const packet = createAiPacket([
      post('3', 'новее', '2026-08-26T03:00:00.000Z'),
      post('1', 'старше', '2026-08-26T01:00:00.000Z'),
    ]);
    expect(packet.posts.map((item) => item.post_id)).toEqual(['1', '3']);
    expect(packet.posts_json).toContain('новее');
    expect(packet.links_json).toContain('example.test/3');
    expect(packet.prompt_md).toContain('важные новости');
    expect(packet.prompt_md).toContain('только приведённые ниже первичные материалы');
    expect(packet.prompt_md).toContain('---MARKDOWN---');
  });

  it('помечает родительский пост как контекст, а не как новую новость', () => {
    const parent = post('10', 'старое исходное сообщение');
    const reply = { ...post('11', 'новый ответ'), reply_to_urls: [parent.canonical_post_url] };
    const packet = createAiPacket([reply], [parent]);
    expect(packet.context_posts).toEqual([parent]);
    expect(packet.prompt_md).toContain('Контекстное сообщение');
    expect(packet.prompt_md).toContain('не считать новыми');
  });

  it('создаёт единый файл с инструкцией и структурированными постами', () => {
    const packet = createSingleAiPacket([post('1', 'текст')]);
    expect(packet.markdown).toContain('Формат ответа');
    expect(packet.json).toContain('"instructions"');
    expect(packet.json).toContain('текст');
    expect(packet.text).toContain('Текст:');
  });

  it('разбивает большой пакет на части и создаёт prompt для объединения', () => {
    const posts = Array.from({ length: 3 }, (_, index) => post(String(index + 1), 'текст '.repeat(1500)));
    const bundle = createAiPacketBundle(posts, [], 10_000, 'packet_test');
    expect(bundle.part_count).toBe(3);
    expect(bundle.chunks[0]?.prompt_md).toContain('часть 1 из 3');
    expect(bundle.combine_prompt_md).toContain('Ответ части 3 из 3');
    expect(bundle.full_text).toContain('Новые сообщения:');
  });
});

describe('импорт ответа AI', () => {
  const valid = {
    schema_version: '1.0',
    report: {
      title: 'Изменения за неделю',
      period: { from: null, to: '2026-08-26T00:00:00.000Z' },
      overview: 'Короткая сводка.',
      important_news: [],
      confirmed_decisions: [],
      bugs_and_problems: [],
      rumors: [],
      links: [],
      things_to_check: ['Проверить обновление'],
      qa: [
        {
          question: 'Есть ли проблема?',
          short_answer: 'Да',
          detailed_answer: 'Подробно',
          status: 'confirmed',
          tags: ['bug'],
          device_topic: 'device',
          source_post_urls: ['https://4pda.to/post/1'],
          external_urls: [],
          first_seen_at: null,
          updated_at: null,
          confidence_note: 'Есть пост-источник',
        },
      ],
      conflicts: [],
    },
    markdown_summary: '## Выжимка\nДа.',
  } as const;

  it('строго валидирует ожидаемый JSON и сохраняет Q&A', () => {
    expect(validateAiResponse(valid).valid).toBe(true);
    expect(validateAiResponse({ ...valid, extra: true }).valid).toBe(false);
    const result = importAiResponse(`${JSON.stringify(valid)}\n---MARKDOWN---\n## Выжимка`, '4pda:1108618', '1108618');
    expect(result.valid_json).toBe(true);
    expect(result.report.qa_entries).toHaveLength(1);
    expect(result.report.qa_entries[0]?.related_report_id).toBe(result.report.report_id);
  });

  it('принимает JSON с пропущенными необязательными полями и сохраняет отдельную Markdown-сводку', () => {
    const incomplete = JSON.parse(
      JSON.stringify({
        ...valid,
        markdown_summary: undefined,
        report: {
          ...valid.report,
          conflicts: undefined,
          confirmed_decisions: [{ title: 'Решение', details: 'Описание', source_post_urls: [] }],
        },
      }),
    ) as Record<string, unknown>;
    const result = importAiResponse(
      `${JSON.stringify(incomplete)}\n---MARKDOWN---\n## Важные изменения\nПодробно.`,
      'source',
      'topic',
    );
    expect(result.valid_json).toBe(true);
    expect(result.repaired_json).toBe(true);
    expect(result.report.parsed_summary).toContain('Важные изменения');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('исправляет null и одиночную строку в полях, где нужны статус и массив ссылок', () => {
    const incomplete = {
      ...valid,
      report: {
        ...valid.report,
        conflicts: null,
        confirmed_decisions: [
          { title: 'Решение', details: 'Описание', status: null, source_post_urls: [], external_urls: null },
        ],
        bugs_and_problems: [
          { title: 'Проблема', details: 'Описание', status: 'probable', external_urls: 'https://example.test' },
        ],
      },
    };
    const result = importAiResponse(
      `${JSON.stringify(incomplete)}\n---MARKDOWN---\n## Сводка\nВсе изменения перечислены.`,
      'source',
      'topic',
    );
    expect(result.valid_json).toBe(true);
    expect(result.repaired_json).toBe(true);
    expect(result.report.structured_facts.conflicts).toEqual([]);
    expect(result.report.structured_facts.confirmed_decisions[0]?.external_urls).toEqual([]);
    expect(result.report.parsed_summary).toContain('Все изменения перечислены');
  });

  it('невалидный JSON сохраняет обычную Markdown-сводку и предупреждение', () => {
    const result = importAiResponse(
      '## Q&A\nВопрос: Как исправить?\nОтвет: Перезапустить устройство.',
      'source',
      'topic',
    );
    expect(result.valid_json).toBe(false);
    expect(result.report.parsed_summary).toContain('Как исправить');
    expect(result.report.qa_entries).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('сообщает о нераспознанной карточке', () => {
    const result = importAiResponse('## Q&A\n### Неясный вопрос\nТекста ответа нет.', 'source', 'topic');
    expect(result.unrecognized_qa.length).toBeGreaterThan(0);
  });
});

describe('импорт ответа ИИ в том виде, в котором его реально возвращают модели', () => {
  // Усечённая копия ответа пользователя от 2026-09-02: списки короче,
  // но форма полей ровно та же (conflicts-объекты, ссылки в Markdown, сводка внутри JSON).
  const realAnswer = readFileSync(fileURLToPath(new URL('./fixtures/ai-answer-2026-09.json', import.meta.url)), 'utf8');

  it('принимает conflicts-объекты, ссылки в Markdown-обёртке и сводку внутри JSON', () => {
    const result = importAiResponse(realAnswer, '4pda:1108618', '1108618');
    expect(result.valid_json).toBe(true);
    expect(result.repaired_json).toBe(true);
    expect(result.report.structured_facts.conflicts).toHaveLength(2);
    expect(result.report.structured_facts.conflicts[0]).toContain('Был ли отозван патч 193?');
    expect(result.report.structured_facts.important_news[0]?.source_post_urls).toEqual([
      'https://4pda.to/forum/index.php?showtopic=1108618&st=13260',
      'https://4pda.to/forum/index.php?showtopic=1108618&st=13280',
    ]);
    expect(result.report.structured_facts.links[0]?.url).toBe('https://f-droid.org/packages/net.typeblog.shelter/');
    expect(result.report.qa_entries).toHaveLength(1);
    expect(result.report.qa_entries[0]?.status).toBe('confirmed');
    // Читаемая сводка берётся из markdown_summary, а не из сырого JSON.
    expect(result.report.parsed_summary).toContain('## Сводка по новым сообщениям');
    // В исходном ответе было «Q&amp;A» — экранирование должно быть снято.
    expect(result.report.parsed_summary).toContain('Q&A-карточки');
    expect(result.report.parsed_summary).not.toContain('schema_version');
  });

  it('очищает URL от Markdown-обёртки, угловых скобок, HTML-экранирования и текста вокруг', () => {
    expect(cleanUrlValue('[https://4pda.to/forum/index.php?showtopic=1&amp;st=2](https://4pda.to/x)')).toBe(
      'https://4pda.to/x',
    );
    expect(cleanUrlValue('<https://4pda.to/y>')).toBe('https://4pda.to/y');
    expect(cleanUrlValue('Смотрите https://4pda.to/z.')).toBe('https://4pda.to/z');
    expect(cleanUrlValue('https://4pda.to/forum/index.php?showtopic=1&amp;st=20')).toBe(
      'https://4pda.to/forum/index.php?showtopic=1&st=20',
    );
    expect(cleanUrlValue('https://4pda.to/plain')).toBe('https://4pda.to/plain');
  });

  it('приводит статусы словами к значениям схемы', () => {
    const payload = JSON.parse(realAnswer) as { report: { qa: Array<{ status: string }> } };
    payload.report.qa[0]!.status = 'Не подтверждено.';
    const result = importAiResponse(JSON.stringify(payload), 'source', 'topic');
    expect(result.valid_json).toBe(true);
    expect(result.report.qa_entries[0]?.status).toBe('unconfirmed');
  });

  it('лишние поля вне схемы не ломают структурированный импорт', () => {
    const payload = JSON.parse(realAnswer) as Record<string, unknown>;
    payload.generated_by = 'some-model';
    (payload.report as Record<string, unknown>).risk_level = 'low';
    const result = importAiResponse(JSON.stringify(payload), 'source', 'topic');
    expect(result.valid_json).toBe(true);
    expect(result.report.structured_facts.qa).toHaveLength(1);
    expect(result.warnings.join(' ')).toContain('Поля вне схемы');
  });

  it('даже при отказе JSON сохраняет читаемую сводку из markdown_summary, а не сырой JSON', () => {
    const payload = JSON.parse(realAnswer) as Record<string, unknown>;
    payload.schema_version = '2.0';
    payload.report = 'сломано';
    const result = importAiResponse(JSON.stringify(payload), 'source', 'topic');
    expect(result.valid_json).toBe(false);
    expect(result.report.parsed_summary).toContain('## Сводка по новым сообщениям');
    expect(result.report.parsed_summary).not.toContain('"schema_version"');
  });

  it('промпт содержит заполненный шаблон ответа и запрет частых ошибок формата', () => {
    const packet = createAiPacket([post('1', 'текст')]);
    expect(packet.prompt_md).toContain('Шаблон ответа');
    expect(packet.prompt_md).toContain('массив СТРОК');
    expect(packet.prompt_md).toContain('"conflicts": [');
    expect(packet.prompt_md).toContain('без HTML-экранирования');
    expect(packet.prompt_md).toContain('markdown_summary');
    expect(packet.prompt_md).toContain('---MARKDOWN---');
  });
});

describe('даты сообщений форума', () => {
  // Локальные компоненты, чтобы тест не зависел от часового пояса машины.
  const local = (raw: string): string => {
    const date = parseForumDate(raw, new Date(2026, 8, 2, 12, 0));
    if (!date) return 'null';
    return [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()].join('-');
  };

  it('читает русскую дату как день.месяц.год, а не месяц.день.год', () => {
    // Раньше здесь работал Date.parse: «02.09.26» превращалось в 9 февраля,
    // «08.09.26» — в 9 августа, а «31.08.26» вообще не распознавалось.
    expect(local('02.09.26, 09:30')).toBe('2026-9-2-9-30');
    expect(local('08.09.26, 12:00')).toBe('2026-9-8-12-0');
    expect(local('10.07.25, 11:09')).toBe('2025-7-10-11-9');
    expect(local('31.08.26, 23:52')).toBe('2026-8-31-23-52');
    expect(local('13.08.26, 10:03')).toBe('2026-8-13-10-3');
    expect(local('2026-09-02T09:30:00')).toBe('2026-9-2-9-30');
    expect(local('Сегодня, 09:30')).toBe('2026-9-2-9-30');
    expect(local('Вчера, 23:10')).toBe('2026-9-1-23-10');
    expect(local('2 сентября 2026, 09:30')).toBe('2026-9-2-9-30');
    expect(local('мусор без даты')).toBe('null');
  });

  it('берёт дату сообщения, а не дату регистрации или правки', () => {
    expect(
      firstDateLikeText(
        'Иван Регистрация: 01.01.24 Сообщений: 12 Сообщение #12345 31.08.26, 23:52 текст отредактировано 01.09.26, 10:00',
      ),
    ).toBe('31.08.26, 23:52');
  });

  it('сентябрьский пост 4PDA сохраняется сентябрём, а не февралём', () => {
    const { document } = parseHTML(`
      <table><tr>
        <td class="post2"><span class="normalname"><a href="?showuser=1">Иван</a></span><span class="postdetails">Регистрация: 01.01.24</span></td>
        <td class="post2" id="post-main-999"><div class="postcolor" id="post-999">Новое сообщение от 2 сентября</div>
          <a href="?showtopic=1108618&view=findpost&p=999">#999</a> 02.09.26, 09:30</td>
      </tr></table>`);
    const result = fourPdaAdapter.parse(
      document as unknown as Document,
      'https://4pda.to/forum/index.php?showtopic=1108618&st=13620',
      { sourceId: '4pda:1108618', topicId: '1108618', imageMode: 'links', imageKeywords: [], manualSelection: null },
    );
    const postedAt = result.posts[0]?.posted_at || '';
    const date = new Date(postedAt);
    expect(Number.isFinite(date.getTime())).toBe(true);
    expect(date.getMonth() + 1).toBe(9);
    expect(date.getDate()).toBe(2);
  });

  it('период в промпте заканчивается самым новым сообщением, а не августом', () => {
    const august = { ...post('1', 'старое'), posted_at: new Date(2026, 7, 31, 23, 52).toISOString() };
    const september = { ...post('2', 'новое'), posted_at: new Date(2026, 8, 2, 9, 30).toISOString() };
    const packet = createAiPacket([august, september]);
    const line = packet.prompt_md.split('\n').find((item) => item.startsWith('Период новых сообщений'));
    expect(line).toContain(september.posted_at as string);
    expect(line?.endsWith(`— ${september.posted_at}`)).toBe(true);
    expect(packet.prompt_md).toContain('Цель отчёта — не количество пунктов');
  });

  it('сообщения без даты сортируются по номеру поста, а не по порядку обхода страниц', () => {
    const undatedNew = { ...post('900', 'новое без даты'), posted_at: null };
    const undatedOld = { ...post('800', 'старое без даты'), posted_at: null };
    expect(sortPostsChronologically([undatedNew, undatedOld]).map((item) => item.post_id)).toEqual(['800', '900']);
  });
});

describe('показ сохранённой выжимки в popup', () => {
  const imported = importAiResponse(
    readFileSync(fileURLToPath(new URL('./fixtures/ai-answer-2026-09.json', import.meta.url)), 'utf8'),
    '4pda:1108618',
    '1108618',
  );
  const longReport: ReportRecord = {
    ...imported.report,
    parsed_summary: `## Сводка\n${'длинная строка сводки\n'.repeat(80)}`,
  };

  const render = (report: ReportRecord) => {
    const { document } = parseHTML('<div id="reports"></div>');
    const container = document.getElementById('reports') as unknown as HTMLElement;
    renderSavedReports(container, [report]);
    return { container, text: container.textContent || '' };
  };

  it('показывает сводку целиком, а не первые 500 символов', () => {
    const { container, text } = render(longReport);
    expect(longReport.parsed_summary.length).toBeGreaterThan(500);
    expect(text).toContain('длинная строка сводки');
    expect(text).toContain(longReport.parsed_summary.trim().slice(-20));
    expect(container.querySelector('.report-summary')?.textContent).toBe(longReport.parsed_summary);
  });

  it('показывает разделы, карточки Q&A и кликабельные источники', () => {
    const { container, text } = render(imported.report);
    expect(text).toContain('Важные новости: 1');
    expect(text).toContain('Вопросы и ответы: 1');
    expect(text).toContain('Как отключить быструю зарядку (100 Вт) на время?');
    expect(text).toContain('Карточек Q&A: 1');
    expect(text).toContain('Период:');
    const links = Array.from(container.querySelectorAll('a')).map((anchor) => anchor.getAttribute('href'));
    expect(links).toContain('https://4pda.to/forum/index.php?showtopic=1108618&st=13260');
    expect(links).toContain('https://f-droid.org/packages/net.typeblog.shelter/');
  });

  it('без отчётов показывает понятную подсказку', () => {
    const { document } = parseHTML('<div id="reports"></div>');
    const container = document.getElementById('reports') as unknown as HTMLElement;
    renderSavedReports(container, []);
    expect(container.textContent).toBe('Пока нет сохранённых ответов ИИ.');
  });
});

describe('пагинация 4PDA в реальной разметке', () => {
  // Строки пагинатора скопированы с живой страницы темы 1108618 (682 страницы).
  const pager = `
    <html><body>
      682 страниц
      <a href="https://4pda.to/forum/index.php?showtopic=1108618" title="На первую страницу">«</a>
      <a href="https://4pda.to/forum/index.php?showtopic=1108618&st=13580" title="Предыдущая страница">&lt;</a>
      <a href="https://4pda.to/forum/index.php?showtopic=1108618&st=13560" title="679">679</a>
      <a href="https://4pda.to/forum/index.php?showtopic=1108618&st=13580" title="680">680</a>
      681
      <a href="https://4pda.to/forum/index.php?showtopic=1108618&st=13620" title="682">682</a>
      <a href="https://4pda.to/forum/index.php?showtopic=1108618&st=13620" title="Следующая страница">&gt;</a>
      <a href="https://4pda.to/forum/index.php?showtopic=1108618&st=13620" title="На последнюю страницу">»</a>
    </body></html>`;

  it('находит последнюю страницу темы, чтобы самые новые сообщения попали в сбор', () => {
    const { document } = parseHTML(pager);
    const pageUrl = 'https://4pda.to/forum/index.php?showtopic=1108618&st=13600';
    expect(findLastPageUrl(document as unknown as Document, pageUrl)).toBe(
      'https://4pda.to/forum/index.php?showtopic=1108618&st=13620',
    );
  });

  it('шагает на предыдущую страницу без пропусков', () => {
    const { document } = parseHTML(pager);
    const pageUrl = 'https://4pda.to/forum/index.php?showtopic=1108618&st=13600';
    expect(findPreviousPageUrl(document as unknown as Document, pageUrl)).toBe(
      'https://4pda.to/forum/index.php?showtopic=1108618&st=13580',
    );
  });

  it('с первой страницы темы тоже находит последнюю', () => {
    const { document } = parseHTML(pager);
    expect(findLastPageUrl(document as unknown as Document, 'https://4pda.to/forum/index.php?showtopic=1108618')).toBe(
      'https://4pda.to/forum/index.php?showtopic=1108618&st=13620',
    );
  });
});

describe('дата в разметке, где шапка поста — сосед тела', () => {
  it('находит дату в общем контейнере, а не только в строке таблицы', () => {
    const { document } = parseHTML(`
      <div class="message-block">
        <div class="message-head"><a href="?showtopic=1108618&view=findpost&p=777">#777</a> 02.09.26, 09:30</div>
        <div class="postcolor" id="post-777">Текст сообщения без даты внутри</div>
      </div>`);
    const result = fourPdaAdapter.parse(
      document as unknown as Document,
      'https://4pda.to/forum/index.php?showtopic=1108618&st=13620',
      { sourceId: '4pda:1108618', topicId: '1108618', imageMode: 'links', imageKeywords: [], manualSelection: null },
    );
    expect(result.posts).toHaveLength(1);
    const date = new Date(result.posts[0]?.posted_at || '');
    expect(Number.isFinite(date.getTime())).toBe(true);
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 9, 2]);
  });

  it('не берёт дату соседнего сообщения из общего списка', () => {
    const { document } = parseHTML(`
      <div class="topic-posts">
        <div class="message-block">
          <div class="message-head">#111 01.09.26, 10:00</div>
          <div class="postcolor" id="post-111">Первое сообщение</div>
        </div>
        <div class="message-block">
          <div class="message-head">#222 02.09.26, 11:00</div>
          <div class="postcolor" id="post-222">Второе сообщение</div>
        </div>
      </div>`);
    const result = fourPdaAdapter.parse(
      document as unknown as Document,
      'https://4pda.to/forum/index.php?showtopic=1108618&st=13620',
      { sourceId: '4pda:1108618', topicId: '1108618', imageMode: 'links', imageKeywords: [], manualSelection: null },
    );
    const days = result.posts.map((post) => new Date(post.posted_at || '').getDate());
    expect(days).toEqual([1, 2]);
  });

  it('сообщает в диагностике, сколько сообщений осталось без даты', () => {
    const { document } = parseHTML(`
      <div class="message-block"><div class="postcolor" id="post-555">Сообщение вообще без даты</div></div>`);
    const result = fourPdaAdapter.parse(
      document as unknown as Document,
      'https://4pda.to/forum/index.php?showtopic=1108618&st=13620',
      { sourceId: '4pda:1108618', topicId: '1108618', imageMode: 'links', imageKeywords: [], manualSelection: null },
    );
    expect(result.diagnostics.join(' ')).toContain('не найдена дата');
  });
});

describe('выжимка без повторов и лишнего', () => {
  const reportWithDuplicates: ReportRecord = {
    ...importAiResponse(
      readFileSync(fileURLToPath(new URL('./fixtures/ai-answer-2026-09.json', import.meta.url)), 'utf8'),
      'source',
      'topic',
    ).report,
    structured_facts: {
      ...importAiResponse(
        readFileSync(fileURLToPath(new URL('./fixtures/ai-answer-2026-09.json', import.meta.url)), 'utf8'),
        'source',
        'topic',
      ).report.structured_facts,
      important_news: [
        {
          title: 'Баг с Chrome при низком разрешении',
          details: 'Описание из новостей',
          status: 'confirmed',
          source_post_urls: ['https://4pda.to/forum/index.php?showtopic=1108618&st=13300'],
          external_urls: [],
        },
      ],
      bugs_and_problems: [
        {
          title: 'Баг с Chrome при низком разрешении',
          details: 'То же описание в багах',
          status: 'confirmed',
          source_post_urls: ['https://4pda.to/forum/index.php?showtopic=1108618&st=13540'],
          external_urls: [],
        },
      ],
    },
  };

  it('показывает одинаковый факт один раз и отмечает, где он ещё встречался', () => {
    const { document } = parseHTML('<div id="reports"></div>');
    const container = document.getElementById('reports') as unknown as HTMLElement;
    renderSavedReports(container, [reportWithDuplicates]);
    const text = container.textContent || '';
    expect(text).toContain('Объединено повторов: 1');
    expect(text).toContain('То же самое упоминалось в: Баги и проблемы');
    expect(text.match(/Баг с Chrome при низком разрешении/g)?.length).toBe(1);
    // источники обоих копий объединяются
    const links = Array.from(container.querySelectorAll('a')).map((anchor) => anchor.getAttribute('href'));
    expect(links).toContain('https://4pda.to/forum/index.php?showtopic=1108618&st=13300');
    expect(links).toContain('https://4pda.to/forum/index.php?showtopic=1108618&st=13540');
  });

  it('промпт запрещает дублировать факт в нескольких разделах', () => {
    const packet = createAiPacket([post('1', 'текст')]);
    expect(packet.prompt_md).toContain('Один факт — только в одном разделе');
    expect(packet.prompt_md).toContain('Цель отчёта — не количество пунктов');
    expect(packet.prompt_md).not.toContain('не меньше 6 Q&A-карточек');
  });

  it('импорт помечает ответ как не дубликат до проверки базы', () => {
    const result = importAiResponse('## Сводка\nТекст', 'source', 'topic');
    expect(result.duplicate).toBe(false);
  });
});

describe('удаление одной выжимки', () => {
  it('показывает кнопку и передаёт идентификатор отчёта', () => {
    const report = importAiResponse('## Сводка\nТекст', 'source', 'topic').report;
    const { document } = parseHTML('<div id="reports"></div>');
    const container = document.getElementById('reports') as unknown as HTMLElement;
    let removed: string | null = null;
    renderSavedReports(container, [report], (reportId) => {
      removed = reportId;
    });
    const button = container.querySelector('.report-remove');
    expect(button?.textContent).toBe('Удалить эту выжимку');
    const view = (container as unknown as { ownerDocument: { defaultView: typeof globalThis } }).ownerDocument
      .defaultView;
    button?.dispatchEvent(new view.Event('click'));
    expect(removed).toBe(report.report_id);
  });

  it('без обработчика кнопку удаления не показывает', () => {
    const report = importAiResponse('## Сводка\nТекст', 'source', 'topic').report;
    const { document } = parseHTML('<div id="reports"></div>');
    const container = document.getElementById('reports') as unknown as HTMLElement;
    renderSavedReports(container, [report]);
    expect(container.querySelector('.report-remove')).toBe(null);
  });
});

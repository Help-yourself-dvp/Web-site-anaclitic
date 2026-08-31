import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { fourPdaAdapter } from '../src/adapters';
import {
  checkpointMatches,
  deduplicatePosts,
  likelyServicePost,
  mergeKnownKeys,
  replyContextPosts,
  unknownPosts,
} from '../src/core/collection';
import { importAiResponse, validateAiResponse } from '../src/core/importer';
import { createAiPacket, createAiPacketBundle } from '../src/core/prompt';
import type { ForumPost } from '../src/core/types';
import { postKey } from '../src/core/utils';

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

  it('разбивает большой пакет на части и создаёт prompt для объединения', () => {
    const posts = Array.from({ length: 3 }, (_, index) => post(String(index + 1), 'текст '.repeat(1500)));
    const bundle = createAiPacketBundle(posts, [], 10_000, 'packet_test');
    expect(bundle.part_count).toBe(3);
    expect(bundle.chunks[0]?.prompt_md).toContain('часть 1 из 3');
    expect(bundle.combine_prompt_md).toContain('Ответ части 3 из 3');
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

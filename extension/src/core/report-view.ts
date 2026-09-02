import type { ReportRecord } from './types';

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'подтверждено',
  probable: 'вероятно',
  unconfirmed: 'не подтверждено',
  outdated: 'устарело',
  conflicting: 'противоречиво',
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status.toLowerCase()] || status || 'без статуса';
}

function shortDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString() : value.slice(0, 10);
}

function formatPeriod(from: string | null, to: string | null): string {
  const left = shortDate(from);
  const right = shortDate(to);
  if (left && right) return left === right ? `Период: ${left}` : `Период: ${left} — ${right}`;
  return `Период: ${left || right || 'не указан'}`;
}

function appendSourceLinks(doc: Document, target: HTMLElement, urls: string[], limit = 5): void {
  const clean = [...new Set(urls.filter(Boolean))];
  if (clean.length === 0) return;
  const wrap = doc.createElement('div');
  wrap.className = 'source-links';
  clean.slice(0, limit).forEach((url, index) => {
    const link = doc.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `источник ${index + 1}`;
    wrap.append(link);
  });
  if (clean.length > limit) {
    const more = doc.createElement('span');
    more.className = 'post-meta';
    more.textContent = `и ещё ${clean.length - limit}`;
    wrap.append(more);
  }
  target.append(wrap);
}

function appendItemBlock(
  doc: Document,
  target: HTMLElement,
  title: string,
  text: string,
  status: string,
  urls: string[],
): void {
  const block = doc.createElement('div');
  block.className = 'report-item';
  const heading = doc.createElement('div');
  heading.className = 'report-item-title';
  heading.textContent = title || 'Без заголовка';
  block.append(heading);
  if (status) {
    const badge = doc.createElement('span');
    badge.className = 'report-badge';
    badge.textContent = statusLabel(status);
    heading.append(' ', badge);
  }
  if (text) {
    const body = doc.createElement('div');
    body.textContent = text;
    block.append(body);
  }
  appendSourceLinks(doc, block, urls);
  target.append(block);
}

function appendSection(
  doc: Document,
  target: HTMLElement,
  caption: string,
  count: number,
  fill: (details: HTMLElement) => void,
): void {
  if (count === 0) return;
  const details = doc.createElement('details');
  details.className = 'report-section';
  const summary = doc.createElement('summary');
  summary.textContent = `${caption}: ${count}`;
  const body = doc.createElement('div');
  details.append(summary, body);
  fill(body);
  target.append(details);
}

export function renderSavedReports(container: HTMLElement, reports: ReportRecord[]): void {
  const doc = container.ownerDocument;
  container.replaceChildren();
  if (reports.length === 0) {
    container.textContent = 'Пока нет сохранённых ответов ИИ.';
    return;
  }
  for (const report of reports) {
    const facts = report.structured_facts;
    const item = doc.createElement('div');
    item.className = 'saved-report';

    const title = doc.createElement('strong');
    title.textContent = facts.title || 'Сводка без названия';

    const sections = [
      ['Важные новости', facts.important_news],
      ['Подтверждённые решения', facts.confirmed_decisions],
      ['Баги и проблемы', facts.bugs_and_problems],
      ['Слухи и противоречия', facts.rumors],
    ] as const;
    const sourceCount = new Set(
      sections.flatMap(([, list]) => list.flatMap((entry) => entry.source_post_urls)).filter(Boolean),
    ).size;

    const meta = doc.createElement('div');
    meta.className = 'post-meta';
    meta.textContent = [
      new Date(report.created_at).toLocaleString(),
      formatPeriod(facts.period.from, facts.period.to),
      `Карточек Q&A: ${report.qa_entries.length}`,
      `Пунктов в разделах: ${sections.reduce((total, [, list]) => total + list.length, 0)}`,
      `Ссылок на источники: ${sourceCount}`,
    ].join(' · ');

    const summary = doc.createElement('div');
    summary.className = 'report-summary';
    summary.textContent = report.parsed_summary || 'Сводка пустая.';

    item.append(title, meta, summary);

    for (const [caption, list] of sections) {
      appendSection(doc, item, caption, list.length, (body) => {
        for (const entry of list) {
          appendItemBlock(doc, body, entry.title, entry.details, entry.status, [
            ...entry.source_post_urls,
            ...entry.external_urls,
          ]);
        }
      });
    }

    appendSection(doc, item, 'Вопросы и ответы', report.qa_entries.length, (body) => {
      for (const entry of report.qa_entries) {
        appendItemBlock(doc, body, entry.question, entry.short_answer || entry.detailed_answer, entry.status, [
          ...entry.source_post_urls,
          ...entry.external_urls,
        ]);
        if (entry.detailed_answer && entry.short_answer && entry.detailed_answer !== entry.short_answer) {
          const full = doc.createElement('details');
          const caption = doc.createElement('summary');
          caption.textContent = 'Подробный ответ';
          const text = doc.createElement('div');
          text.className = 'report-item';
          text.textContent = entry.detailed_answer;
          full.append(caption, text);
          body.append(full);
        }
      }
    });

    appendSection(doc, item, 'Полезные ссылки', facts.links.length, (body) => {
      for (const link of facts.links) {
        const block = doc.createElement('div');
        block.className = 'report-item';
        const anchor = doc.createElement('a');
        anchor.href = link.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = link.url;
        block.append(anchor);
        if (link.annotation) {
          const note = doc.createElement('div');
          note.textContent = link.annotation;
          block.append(note);
        }
        appendSourceLinks(doc, block, link.source_post_urls);
        body.append(block);
      }
    });

    appendSection(doc, item, 'Что стоит проверить', facts.things_to_check.length, (body) => {
      const list = doc.createElement('ul');
      for (const thing of facts.things_to_check) {
        const row = doc.createElement('li');
        row.textContent = thing;
        list.append(row);
      }
      body.append(list);
    });

    appendSection(doc, item, 'Противоречия', facts.conflicts.length, (body) => {
      const list = doc.createElement('ul');
      for (const conflict of facts.conflicts) {
        const row = doc.createElement('li');
        row.textContent = conflict;
        list.append(row);
      }
      body.append(list);
    });

    const raw = doc.createElement('details');
    const rawCaption = doc.createElement('summary');
    rawCaption.textContent = 'Открыть полный ответ ИИ';
    const fullText = doc.createElement('pre');
    fullText.textContent = report.raw_ai_response;
    raw.append(rawCaption, fullText);
    item.append(raw);

    container.append(item);
  }
}

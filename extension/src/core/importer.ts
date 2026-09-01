import type { AiQaEntry, AiResponsePayload, AiSectionItem, ImportResult, ReportRecord, QaStatus } from './types';
import { makeId, nowIso } from './utils';

const QA_STATUSES = new Set<QaStatus>(['confirmed', 'probable', 'unconfirmed', 'outdated', 'conflicting']);
const SECTION_NAMES = ['important_news', 'confirmed_decisions', 'bugs_and_problems', 'rumors'] as const;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkExtraFields(record: RecordValue, allowed: string[], path: string, errors: string[]): void {
  const allowedSet = new Set(allowed);
  for (const field of Object.keys(record)) {
    if (!allowedSet.has(field)) errors.push(`${path}.${field} — неизвестное поле.`);
  }
}

function stringField(record: RecordValue, field: string, errors: string[], path: string, allowNull = false): string {
  const value = record[field];
  if (typeof value === 'string') return value;
  if (allowNull && value === null) return '';
  errors.push(`${path}.${field} должен быть строкой${allowNull ? ' или null' : ''}.`);
  return '';
}

function nullableString(record: RecordValue, field: string, errors: string[], path: string): string | null {
  const value = record[field];
  if (value === null) return null;
  if (typeof value === 'string') return value;
  errors.push(`${path}.${field} должен быть строкой или null.`);
  return null;
}

function stringArray(value: unknown, errors: string[], path: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    errors.push(`${path} должен быть массивом строк.`);
    return [];
  }
  return value;
}

function sectionItem(value: unknown, errors: string[], path: string): AiSectionItem {
  if (!isRecord(value)) {
    errors.push(`${path} должен быть объектом.`);
    return { title: '', details: '', status: '', source_post_urls: [], external_urls: [] };
  }
  checkExtraFields(value, ['title', 'details', 'status', 'source_post_urls', 'external_urls'], path, errors);
  return {
    title: stringField(value, 'title', errors, path),
    details: stringField(value, 'details', errors, path),
    status: stringField(value, 'status', errors, path),
    source_post_urls: stringArray(value.source_post_urls, errors, `${path}.source_post_urls`),
    external_urls: stringArray(value.external_urls, errors, `${path}.external_urls`),
  };
}

function qaItem(value: unknown, errors: string[], path: string): AiQaEntry {
  if (!isRecord(value)) {
    errors.push(`${path} должен быть объектом.`);
    return emptyQa();
  }
  checkExtraFields(
    value,
    [
      'question',
      'short_answer',
      'detailed_answer',
      'status',
      'tags',
      'device_topic',
      'source_post_urls',
      'external_urls',
      'first_seen_at',
      'updated_at',
      'confidence_note',
    ],
    path,
    errors,
  );
  const status = stringField(value, 'status', errors, path) as QaStatus;
  if (!QA_STATUSES.has(status)) errors.push(`${path}.status имеет недопустимое значение.`);
  return {
    question: stringField(value, 'question', errors, path),
    short_answer: stringField(value, 'short_answer', errors, path),
    detailed_answer: stringField(value, 'detailed_answer', errors, path),
    status: QA_STATUSES.has(status) ? status : 'unconfirmed',
    tags: stringArray(value.tags, errors, `${path}.tags`),
    device_topic: stringField(value, 'device_topic', errors, path),
    source_post_urls: stringArray(value.source_post_urls, errors, `${path}.source_post_urls`),
    external_urls: stringArray(value.external_urls, errors, `${path}.external_urls`),
    first_seen_at: nullableString(value, 'first_seen_at', errors, path),
    updated_at: nullableString(value, 'updated_at', errors, path),
    confidence_note: stringField(value, 'confidence_note', errors, path),
  };
}

function emptyQa(): AiQaEntry {
  return {
    question: '',
    short_answer: '',
    detailed_answer: '',
    status: 'unconfirmed',
    tags: [],
    device_topic: '',
    source_post_urls: [],
    external_urls: [],
    first_seen_at: null,
    updated_at: null,
    confidence_note: '',
  };
}

export function validateAiResponse(input: unknown): {
  valid: boolean;
  value: AiResponsePayload | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, value: null, errors: ['Ответ должен быть JSON-объектом.'] };
  checkExtraFields(input, ['schema_version', 'report', 'markdown_summary'], 'root', errors);
  if (input.schema_version !== '1.0') errors.push('schema_version должен быть "1.0".');
  if (!isRecord(input.report)) errors.push('Отсутствует объект report.');
  if (typeof input.markdown_summary !== 'string') errors.push('markdown_summary должен быть строкой.');
  if (errors.length > 0 || !isRecord(input.report)) return { valid: false, value: null, errors };

  const report = input.report;
  checkExtraFields(
    report,
    [
      'title',
      'period',
      'overview',
      'important_news',
      'confirmed_decisions',
      'bugs_and_problems',
      'rumors',
      'links',
      'things_to_check',
      'qa',
      'conflicts',
    ],
    'report',
    errors,
  );
  const period = report.period;
  if (!isRecord(period)) errors.push('report.period должен быть объектом.');
  if (isRecord(period)) checkExtraFields(period, ['from', 'to'], 'report.period', errors);
  const resultPeriod = isRecord(period)
    ? {
        from: nullableString(period, 'from', errors, 'report.period'),
        to: nullableString(period, 'to', errors, 'report.period'),
      }
    : { from: null, to: null };
  const normalized: AiResponsePayload['report'] = {
    title: stringField(report, 'title', errors, 'report'),
    period: resultPeriod,
    overview: stringField(report, 'overview', errors, 'report'),
    important_news: [],
    confirmed_decisions: [],
    bugs_and_problems: [],
    rumors: [],
    links: [],
    things_to_check: stringArray(report.things_to_check, errors, 'report.things_to_check'),
    qa: [],
    conflicts: stringArray(report.conflicts, errors, 'report.conflicts'),
  };

  for (const section of SECTION_NAMES) {
    const values = report[section];
    if (!Array.isArray(values)) {
      errors.push(`report.${section} должен быть массивом.`);
      continue;
    }
    normalized[section] = values.map((item, index) => sectionItem(item, errors, `report.${section}[${index}]`));
  }

  if (!Array.isArray(report.links)) {
    errors.push('report.links должен быть массивом.');
  } else {
    normalized.links = report.links.map((value, index) => {
      if (!isRecord(value)) {
        errors.push(`report.links[${index}] должен быть объектом.`);
        return { url: '', annotation: '', source_post_urls: [] };
      }
      checkExtraFields(value, ['url', 'annotation', 'source_post_urls'], `report.links[${index}]`, errors);
      return {
        url: stringField(value, 'url', errors, `report.links[${index}]`),
        annotation: stringField(value, 'annotation', errors, `report.links[${index}]`),
        source_post_urls: stringArray(value.source_post_urls, errors, `report.links[${index}].source_post_urls`),
      };
    });
  }
  if (!Array.isArray(report.qa)) {
    errors.push('report.qa должен быть массивом.');
  } else {
    normalized.qa = report.qa.map((value, index) => qaItem(value, errors, `report.qa[${index}]`));
  }

  if (errors.length > 0) return { valid: false, value: null, errors };
  return {
    valid: true,
    value: {
      schema_version: '1.0',
      report: normalized,
      markdown_summary: input.markdown_summary as string,
    },
    errors: [],
  };
}

function findJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }
  return null;
}

function extractHumanSummary(raw: string, jsonText: string | null): string {
  const marker = raw.match(/(^|\n)\s*---MARKDOWN---\s*(?:\n|$)/i);
  if (marker && marker.index !== undefined) return raw.slice(marker.index + marker[0].length).trim();
  if (jsonText) {
    const afterJson = raw.slice((raw.indexOf(jsonText) || 0) + jsonText.length).trim();
    if (afterJson) return afterJson;
  }
  return '';
}

function repairMissingFields(input: unknown, humanSummary: string): { value: unknown; warnings: string[] } {
  if (!isRecord(input)) return { value: input, warnings: [] };
  const root: RecordValue = { ...input };
  const warnings: string[] = [];
  const note = (path: string) => {
    if (warnings.length < 30) warnings.push(`Автоматически добавлено поле ${path}.`);
  };
  if (root.schema_version === undefined) {
    root.schema_version = '1.0';
    note('schema_version');
  }
  if (root.markdown_summary === undefined) {
    root.markdown_summary =
      humanSummary || (isRecord(root.report) && typeof root.report.overview === 'string' ? root.report.overview : '');
    note('markdown_summary');
  }
  // A few models call the human-readable part simply summary. Convert only
  // this known alias; unrelated unknown fields still fail strict validation.
  if (root.markdown_summary === '' && typeof root.summary === 'string') {
    root.markdown_summary = root.summary;
    delete root.summary;
    note('markdown_summary (из summary)');
  }
  if (!isRecord(root.report)) return { value: root, warnings };
  const report: RecordValue = { ...root.report };
  root.report = report;
  const reportTextDefaults: Array<[string, string]> = [
    ['title', ''],
    ['overview', ''],
  ];
  reportTextDefaults.forEach(([field, fallback]) => {
    if (report[field] === undefined) {
      report[field] = fallback;
      note(`report.${field}`);
    }
  });
  const periodValue = report.period;
  if (!isRecord(periodValue)) {
    if (periodValue === undefined) note('report.period');
    report.period = { from: null, to: null };
  } else {
    const period = { ...periodValue };
    if (period.from === undefined) {
      period.from = null;
      note('report.period.from');
    }
    if (period.to === undefined) {
      period.to = null;
      note('report.period.to');
    }
    report.period = period;
  }
  for (const section of SECTION_NAMES) {
    if (report[section] === undefined) {
      report[section] = [];
      note(`report.${section}`);
      continue;
    }
    if (!Array.isArray(report[section])) continue;
    report[section] = report[section].map((item) => {
      if (!isRecord(item)) return item;
      const fixed: RecordValue = { ...item };
      if (fixed.title === undefined) {
        fixed.title = '';
        note(`report.${section}[].title`);
      }
      if (fixed.details === undefined) {
        fixed.details = '';
        note(`report.${section}[].details`);
      }
      if (fixed.status === undefined) {
        fixed.status = 'unconfirmed';
        note(`report.${section}[].status`);
      }
      if (fixed.source_post_urls === undefined) {
        fixed.source_post_urls = [];
        note(`report.${section}[].source_post_urls`);
      }
      if (fixed.external_urls === undefined) {
        fixed.external_urls = [];
        note(`report.${section}[].external_urls`);
      }
      return fixed;
    });
  }
  if (report.links === undefined) {
    report.links = [];
    note('report.links');
  } else if (Array.isArray(report.links)) {
    report.links = report.links.map((item) => {
      if (!isRecord(item)) return item;
      const fixed: RecordValue = { ...item };
      if (fixed.url === undefined) {
        fixed.url = '';
        note('report.links[].url');
      }
      if (fixed.annotation === undefined) {
        fixed.annotation = '';
        note('report.links[].annotation');
      }
      if (fixed.source_post_urls === undefined) {
        fixed.source_post_urls = [];
        note('report.links[].source_post_urls');
      }
      return fixed;
    });
  }
  if (report.things_to_check === undefined) {
    report.things_to_check = [];
    note('report.things_to_check');
  }
  if (report.qa === undefined) {
    report.qa = [];
    note('report.qa');
  } else if (Array.isArray(report.qa)) {
    report.qa = report.qa.map((item) => {
      if (!isRecord(item)) return item;
      const fixed: RecordValue = { ...item };
      const defaults: Array<[string, unknown]> = [
        ['question', ''],
        ['short_answer', ''],
        ['detailed_answer', ''],
        ['status', 'unconfirmed'],
        ['tags', []],
        ['device_topic', ''],
        ['source_post_urls', []],
        ['external_urls', []],
        ['first_seen_at', null],
        ['updated_at', null],
        ['confidence_note', ''],
      ];
      defaults.forEach(([field, fallback]) => {
        if (fixed[field] === undefined) {
          fixed[field] = fallback;
          note(`report.qa[].${field}`);
        }
      });
      return fixed;
    });
  }
  if (report.conflicts === undefined) {
    report.conflicts = [];
    note('report.conflicts');
  }
  return { value: root, warnings };
}

function markdownQa(raw: string): { entries: AiQaEntry[]; unrecognized: string[] } {
  const entries: AiQaEntry[] = [];
  const unrecognized: string[] = [];
  const lines = raw.split(/\r?\n/);
  let inQa = false;
  let current: AiQaEntry | null = null;
  const save = () => {
    if (!current) return;
    if (current.question && (current.short_answer || current.detailed_answer)) entries.push(current);
    else if (current.question) unrecognized.push(current.question);
    current = null;
  };
  for (const line of lines) {
    const heading = line.match(/^#{2,6}\s+(.+)$/)?.[1]?.trim() || '';
    if (heading) {
      if (/q\s*&?\s*a|вопрос|ответы|частые вопросы/i.test(heading)) {
        save();
        inQa = true;
        continue;
      }
      if (inQa && current) {
        save();
        current = { ...emptyQa(), question: heading };
        continue;
      }
    }
    if (!inQa) continue;
    const question = line.match(/^(?:[-*]\s*)?(?:вопрос|question)\s*:\s*(.+)$/i)?.[1]?.trim();
    const answer = line.match(/^(?:[-*]\s*)?(?:ответ|answer)\s*:\s*(.+)$/i)?.[1]?.trim();
    if (question) {
      save();
      current = { ...emptyQa(), question };
    } else if (answer) {
      if (!current) {
        unrecognized.push(answer);
      } else {
        current.short_answer = answer;
        current.detailed_answer = answer;
      }
    } else if (current && line.trim() && !line.trim().startsWith('#')) {
      current.detailed_answer = `${current.detailed_answer}${current.detailed_answer ? '\n' : ''}${line.trim()}`;
    }
  }
  save();
  if (inQa && entries.length === 0 && unrecognized.length === 0)
    unrecognized.push('Раздел Q&A найден, но пары «Вопрос/Ответ» не распознаны.');
  return { entries, unrecognized };
}

function fallbackPayload(raw: string, qa: AiQaEntry[]): AiResponsePayload {
  return {
    schema_version: '1.0',
    report: {
      title: 'Импортированная Markdown-сводка',
      period: { from: null, to: null },
      overview: raw.trim(),
      important_news: [],
      confirmed_decisions: [],
      bugs_and_problems: [],
      rumors: [],
      links: [],
      things_to_check: [],
      qa,
      conflicts: [],
    },
    markdown_summary: raw.trim(),
  };
}

export function importAiResponse(raw: string, sourceId: string, topicId: string): ImportResult {
  const text = raw.trim();
  const warnings: string[] = [];
  let payload: AiResponsePayload | null = null;
  let validJson = false;
  const jsonText = findJsonObject(text);
  const humanSummary = extractHumanSummary(text, jsonText);
  let repairedJson = false;
  if (jsonText) {
    try {
      const parsed: unknown = JSON.parse(jsonText);
      const validation = validateAiResponse(parsed);
      if (!validation.valid) {
        const repaired = repairMissingFields(parsed, humanSummary);
        const repairedValidation = validateAiResponse(repaired.value);
        if (repairedValidation.valid && repairedValidation.value) {
          payload = repairedValidation.value;
          validJson = true;
          repairedJson = repaired.warnings.length > 0;
          warnings.push('JSON принят после безопасного добавления отсутствующих необязательных полей.');
          warnings.push(...repaired.warnings.slice(0, 10));
        } else {
          warnings.push('JSON найден, но не прошёл строгую проверку. Сохранена обычная Markdown-сводка.');
          warnings.push(...validation.errors.slice(0, 10));
        }
      } else if (validation.value) {
        payload = validation.value;
        validJson = true;
      }
    } catch (error) {
      warnings.push(`JSON найден, но повреждён: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    warnings.push('В ответе не найден JSON-блок; импортирован как Markdown.');
  }

  const markdown = markdownQa(humanSummary || text);
  const summaryForStorage = humanSummary || '';
  if (!payload) payload = fallbackPayload(summaryForStorage || text, markdown.entries);
  if (payload.report.qa.length === 0 && markdown.entries.length > 0) {
    payload.report.qa = markdown.entries;
    if (validJson) warnings.push('Q&A добавлены из отдельной Markdown-сводки.');
  }
  const reportId = makeId('report');
  const qaEntries = payload.report.qa.map((entry) => ({ ...entry, related_report_id: reportId }));
  const report: ReportRecord = {
    report_id: reportId,
    source_id: sourceId || 'manual-import',
    topic_id: topicId || 'unknown-topic',
    period_from: payload.report.period.from,
    period_to: payload.report.period.to,
    raw_ai_response: raw,
    parsed_summary: summaryForStorage || payload.markdown_summary || payload.report.overview,
    structured_facts: payload.report,
    qa_entries: qaEntries,
    created_at: nowIso(),
  };
  return {
    report,
    valid_json: validJson,
    repaired_json: repairedJson,
    warnings,
    unrecognized_qa: validJson ? [] : markdown.unrecognized,
  };
}

import { normalizeUrl } from '../core/utils';

function offsetOf(url: string): number | null {
  try {
    const parsed = new URL(url);
    const fullOffset = parsed.searchParams.get('st');
    if (fullOffset !== null) {
      const offset = Number.parseInt(fullOffset, 10);
      return Number.isFinite(offset) ? offset : null;
    }
    // 4PDA's lightweight version uses ?tTOPIC-OFFSET.html.
    const lofiOffset = parsed.search.match(/[?&]t\d+-(\d+)\.html(?:&|$)/i)?.[1];
    if (lofiOffset) {
      const offset = Number.parseInt(lofiOffset, 10);
      return Number.isFinite(offset) ? offset : null;
    }
    return 0;
  } catch {
    return null;
  }
}

function topicToken(url: string): string | null {
  try {
    const parsed = new URL(url);
    const showTopic = parsed.searchParams.get('showtopic');
    if (showTopic) return `full:${showTopic}`;
    const lofiTopic = parsed.search.match(/[?&]t(\d+)(?:-\d+)?\.html/i)?.[1];
    return lofiTopic ? `lofi:${lofiTopic}` : null;
  } catch {
    return null;
  }
}

function labelOf(anchor: HTMLAnchorElement): string {
  return `${anchor.textContent || ''} ${anchor.getAttribute('title') || ''} ${anchor.getAttribute('aria-label') || ''}`
    .trim()
    .toLocaleLowerCase();
}

function sameTopic(pageUrl: string, candidateUrl: string): boolean {
  try {
    const current = new URL(pageUrl);
    const candidate = new URL(candidateUrl);
    const currentToken = topicToken(pageUrl);
    const candidateToken = topicToken(candidateUrl);
    if (currentToken && candidateToken) return currentToken === candidateToken && candidate.origin === current.origin;
    return (
      candidate.origin === current.origin &&
      candidate.pathname === current.pathname &&
      candidate.searchParams.get('showtopic') === current.searchParams.get('showtopic')
    );
  } catch {
    return false;
  }
}

function sameTopicAnchors(document: Document, pageUrl: string): Array<{ anchor: HTMLAnchorElement; url: string }> {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .map((anchor) => ({ anchor, url: normalizeUrl(anchor.href, pageUrl) }))
    .filter((item): item is { anchor: HTMLAnchorElement; url: string } => Boolean(item.url))
    .filter((item) => sameTopic(pageUrl, item.url));
}

export function findPreviousPageUrl(document: Document, pageUrl: string): string | null {
  const relPrevious = document.querySelector<HTMLAnchorElement>('a[rel="prev"], link[rel="prev"]');
  const relUrl = relPrevious ? normalizeUrl(relPrevious.href, pageUrl) : null;
  if (relUrl && relUrl !== pageUrl) return relUrl;

  const sameTopic = sameTopicAnchors(document, pageUrl);
  const currentOffset = offsetOf(pageUrl);
  const labelled = sameTopic.filter(({ anchor }) => {
    const label = labelOf(anchor);
    // Do not include «/first page: on 4PDA it is not the immediately previous page.
    return /предыдущ|назад|previous|\bprev\b|‹|←|\bback\b/.test(label);
  });
  const labelledWithLowerOffset = labelled
    .map((item) => ({ ...item, offset: offsetOf(item.url) }))
    .filter(
      (item): item is typeof item & { offset: number } =>
        item.offset !== null && (currentOffset === null || item.offset < currentOffset),
    )
    .sort((a, b) => b.offset - a.offset);
  if (labelledWithLowerOffset[0]?.url && labelledWithLowerOffset[0].url !== pageUrl)
    return labelledWithLowerOffset[0].url;

  if (currentOffset !== null) {
    const lowerOffsets = sameTopic
      .map((item) => ({ ...item, offset: offsetOf(item.url) }))
      .filter((item): item is typeof item & { offset: number } => item.offset !== null && item.offset < currentOffset)
      .sort((a, b) => b.offset - a.offset);
    if (lowerOffsets[0]?.url && lowerOffsets[0].url !== pageUrl) return lowerOffsets[0].url;
  }

  return null;
}

export function findLastPageUrl(document: Document, pageUrl: string): string | null {
  const currentOffset = offsetOf(pageUrl);
  if (currentOffset === null) return null;
  const sameTopic = sameTopicAnchors(document, pageUrl);
  const candidates = sameTopic
    .map((item) => ({ ...item, offset: offsetOf(item.url) }))
    .filter((item): item is typeof item & { offset: number } => item.offset !== null && item.offset > currentOffset)
    .sort((a, b) => b.offset - a.offset);
  if (candidates.length === 0) return null;

  const labelled = candidates.filter(({ anchor }) => /послед|last|конец|»/.test(labelOf(anchor)));
  return (labelled[0] || candidates[0])?.url || null;
}

"use strict";
(() => {
  // src/core/utils.ts
  function nowIso() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  function makeId(prefix = "id") {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return `${prefix}_${uuid}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
  function normalizeWhitespace(value) {
    return value.replace(/\u00a0/g, " ").replace(/[\t\r ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  function normalizeUrl(value, baseUrl) {
    try {
      const url = new URL(value, baseUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      url.hash = url.hash.replace(/^#(post|entry)[-_]?/i, "#");
      return url.href;
    } catch {
      return null;
    }
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function clampInteger(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  }
  function parseTopicId(url) {
    try {
      const parsed = new URL(url);
      const showtopic = parsed.searchParams.get("showtopic");
      if (showtopic) return showtopic;
      const lofiTopic = parsed.search.match(/[?&]t(\d+)(?:-\d+)?\.html/i)?.[1];
      if (lofiTopic) return lofiTopic;
      const pathPart = parsed.pathname.split("/").filter(Boolean).pop();
      return pathPart || "unknown-topic";
    } catch {
      return "unknown-topic";
    }
  }
  function sourceKey(sourceId, postId, fingerprint) {
    return `${sourceId}:${postId || fingerprint}`;
  }
  function postKey(post) {
    return sourceKey(post.source_id, post.post_id, post.fingerprint);
  }
  function stableFingerprint(parts) {
    let hash = 2166136261;
    const value = parts.join("");
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }
  function sortPostsChronologically(posts) {
    return posts.map((post, index) => ({ post, index })).sort((a, b) => {
      const aTime = a.post.posted_at ? Date.parse(a.post.posted_at) : Number.NaN;
      const bTime = b.post.posted_at ? Date.parse(b.post.posted_at) : Number.NaN;
      if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
        return aTime - bTime;
      }
      if (Number.isFinite(aTime) !== Number.isFinite(bTime)) return Number.isFinite(aTime) ? -1 : 1;
      const aId = Number.parseInt(a.post.post_id || "", 10);
      const bId = Number.parseInt(b.post.post_id || "", 10);
      if (Number.isFinite(aId) && Number.isFinite(bId) && aId !== bId) return aId - bId;
      return a.index - b.index;
    }).map(({ post }) => post);
  }
  var MONTH_BY_NAME = {
    \u044F\u043D\u0432: 1,
    \u0444\u0435\u0432: 2,
    \u043C\u0430\u0440: 3,
    \u0430\u043F\u0440: 4,
    \u043C\u0430\u0439: 5,
    \u043C\u0430\u044F: 5,
    \u0438\u044E\u043D: 6,
    \u0438\u044E\u043B: 7,
    \u0430\u0432\u0433: 8,
    \u0441\u0435\u043D: 9,
    \u043E\u043A\u0442: 10,
    \u043D\u043E\u044F: 11,
    \u0434\u0435\u043A: 12,
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    sept: 9,
    oct: 10,
    nov: 11,
    dec: 12
  };
  var FORUM_DATE_PATTERN = /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}(?:\s*(?:,|г\.?)?\s*\d{1,2}:\d{2}(?::\d{2})?)?|\b\d{1,2}\s+[а-яa-z]{3,10}\.?\s+\d{4}(?:\s*(?:,|г\.?)?\s*\d{1,2}:\d{2}(?::\d{2})?)?|(?:^|[^\wа-яё])(?:сегодня|вчера|today|yesterday)\s*(?:,|\s)\s*\d{1,2}:\d{2}/gi;
  var DATE_CONTEXT_NOISE = /(?:регистрац\w*|зарегистрир\w*|registration|joined|рег\.)\s*:?[^\d]{0,8}$/i;
  function dateLikeMatches(text) {
    const found = [];
    for (const match of text.matchAll(FORUM_DATE_PATTERN)) {
      const start = match.index ?? 0;
      const value = match[0].trim();
      if (!value) continue;
      if (DATE_CONTEXT_NOISE.test(text.slice(Math.max(0, start - 40), start))) continue;
      found.push({ value, withTime: /\d{1,2}:\d{2}/.test(value) });
    }
    return found;
  }
  function firstDateLikeText(text) {
    const matches = dateLikeMatches(text);
    return (matches.find((item) => item.withTime) || matches[0])?.value || "";
  }
  function lastDateLikeText(text) {
    const matches = dateLikeMatches(text);
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      const item = matches[index];
      if (item?.withTime) return item.value;
    }
    return matches[matches.length - 1]?.value || "";
  }
  function localDate(year, month, day, hour, minute, second) {
    const date = new Date(year, month - 1, day, hour, minute, second);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }
  function expandYear(value) {
    if (value.length === 4) return Number.parseInt(value, 10);
    const short = Number.parseInt(value, 10);
    return short >= 80 ? 1900 + short : 2e3 + short;
  }
  function parseForumDate(raw, reference = /* @__PURE__ */ new Date()) {
    const text = raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?\s*(Z|[+-]\d{2}:?\d{2})?/.exec(text);
    if (iso) {
      const [, year = "1970", month = "1", day = "1", hour = "00", minute = "00", second = "00", zone] = iso;
      if (zone) {
        const parsed2 = Date.parse(text);
        return Number.isFinite(parsed2) ? new Date(parsed2) : null;
      }
      return localDate(
        Number.parseInt(year, 10),
        Number.parseInt(month, 10),
        Number.parseInt(day, 10),
        Number.parseInt(hour, 10),
        Number.parseInt(minute, 10),
        Number.parseInt(second, 10)
      );
    }
    const numeric = /\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?:\s*(?:,|г\.?)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(
      text
    );
    if (numeric) {
      let day = Number.parseInt(numeric[1] || "0", 10);
      let month = Number.parseInt(numeric[2] || "0", 10);
      const year = expandYear(numeric[3] || "1970");
      if (month > 12 && day <= 12) [day, month] = [month, day];
      const hour = Number.parseInt(numeric[4] || "0", 10);
      const minute = Number.parseInt(numeric[5] || "0", 10);
      const second = Number.parseInt(numeric[6] || "0", 10);
      const date = localDate(year, month, day, hour, minute, second);
      if (date) return date;
    }
    const named = /\b(\d{1,2})\s+([а-яa-z]{3,10})\.?\s+(\d{4})(?:\s*(?:,|г\.?)?\s*(\d{1,2}):(\d{2}))?/i.exec(text);
    if (named) {
      const month = MONTH_BY_NAME[named[2]?.slice(0, 3).toLowerCase() || ""];
      if (month) {
        const date = localDate(
          Number.parseInt(named[3] || "1970", 10),
          month,
          Number.parseInt(named[1] || "0", 10),
          Number.parseInt(named[4] || "0", 10),
          Number.parseInt(named[5] || "0", 10),
          0
        );
        if (date) return date;
      }
    }
    const relative = /(?:^|[^\wа-яё])(сегодня|вчера|today|yesterday)\s*(?:,|\s)\s*(\d{1,2}):(\d{2})/i.exec(text);
    if (relative) {
      const shift = /вчера|yesterday/i.test(relative[1] || "") ? -1 : 0;
      const base = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() + shift);
      return localDate(
        base.getFullYear(),
        base.getMonth() + 1,
        base.getDate(),
        Number.parseInt(relative[2] || "0", 10),
        Number.parseInt(relative[3] || "0", 10),
        0
      );
    }
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? new Date(parsed) : null;
  }
  function uniqueStrings(values) {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  // src/adapters/dom.ts
  var HTTP_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:"]);
  function queryFirst(root, selectors) {
    for (const selector of selectors) {
      const found = root.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  function elementText(root, selectors) {
    if (!root) return "";
    return normalizeWhitespace(queryFirst(root, selectors)?.textContent || "");
  }
  function titleFromDocument(document) {
    return normalizeWhitespace(document.title || "") || "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F";
  }
  var POST_BODY_MARKERS = "div.postcolor, .post_content, .postcontent, .post-content, .post_body, .post-body, .entry-content";
  function dateCandidateRoots(element, metadataRoot) {
    const roots = [];
    const push = (node) => {
      if (node && !roots.includes(node)) roots.push(node);
    };
    push(metadataRoot);
    push(element.closest('td[id^="post-main-"], td[id*="post-main-"]')?.parentElement);
    push(element.closest("tr"));
    let parent = element.parentElement;
    for (let depth = 0; parent && depth < 4; depth += 1) {
      if (parent.querySelectorAll(POST_BODY_MARKERS).length > 1) break;
      push(parent);
      parent = parent.parentElement;
    }
    push(element);
    return roots;
  }
  var NOISE_FOR_DATE_SEARCH = `${POST_BODY_MARKERS}, blockquote, .quote, .blockquote, .post_quote, script, style`;
  function dateSearchText(root) {
    if (typeof root.querySelectorAll !== "function") return root.textContent || "";
    const element = root;
    if (!element.querySelector(NOISE_FOR_DATE_SEARCH)) return element.textContent || "";
    const clone = element.cloneNode(true);
    clone.querySelectorAll(NOISE_FOR_DATE_SEARCH).forEach((node) => node.remove());
    return clone.textContent || "";
  }
  function precedingHeaderText(element, limit = 3e3) {
    const parts = [];
    let node = element;
    let total = 0;
    while (node && total < limit) {
      const parent = node.parentElement;
      if (!parent) break;
      if (parent.querySelectorAll(POST_BODY_MARKERS).length > 1) break;
      const chunk = [];
      for (let sibling = node.previousElementSibling; sibling && total < limit; sibling = sibling.previousElementSibling) {
        const text = normalizeWhitespace(dateSearchText(sibling));
        if (!text) continue;
        chunk.unshift(text);
        total += text.length;
      }
      if (chunk.length) parts.unshift(chunk.join(" "));
      node = parent;
    }
    return parts.join(" ");
  }
  function parsePostedAt(roots, selectors, precedingText = "") {
    const list = Array.isArray(roots) ? roots : [roots];
    let unparsedRaw = "";
    for (const root of list) {
      const element = queryFirst(root, selectors);
      const elementTextValue = element ? normalizeWhitespace(element.getAttribute("datetime") || element.textContent || "") : "";
      const rootText = normalizeWhitespace(dateSearchText(root));
      const raw = elementTextValue || firstDateLikeText(rootText);
      if (!raw) continue;
      const parsed = parseForumDate(raw);
      if (parsed) return parsed.toISOString();
      if (!unparsedRaw) unparsedRaw = raw;
    }
    if (!unparsedRaw && precedingText) {
      const raw = lastDateLikeText(precedingText);
      if (raw && /\d{1,2}:\d{2}/.test(raw)) {
        const parsed = parseForumDate(raw);
        if (parsed) return parsed.toISOString();
      }
    }
    return unparsedRaw || null;
  }
  function extractQuotes(root, baseUrl) {
    const quotes = [];
    for (const quote of Array.from(
      root.querySelectorAll('.quote, .blockquote, blockquote, .post_quote, [class*="quote"]')
    )) {
      const text = normalizeWhitespace(quote.textContent || "");
      if (!text) continue;
      const author = normalizeWhitespace(
        quote.getAttribute("data-author") || queryFirst(quote, [".quote_author", ".quote-header", ".author", "cite"])?.textContent || ""
      );
      const sourceLink = Array.from(quote.querySelectorAll("a[href]")).map((anchor) => normalizeUrl(anchor.href, baseUrl)).find((url) => Boolean(url && /findpost|#(?:entry|post)?[-_]?\d+/i.test(url)));
      quotes.push({ author: author || null, text, source_post_url: sourceLink || null });
    }
    return quotes;
  }
  function removeNoise(root) {
    root.querySelectorAll(
      "script, style, noscript, template, iframe, .quote, .blockquote, blockquote, .post_quote, .signature, .post_signature, .edit, .post-edit, .post_meta, .post-info, .post_author, .post_author_data"
    ).forEach((node) => node.remove());
  }
  function extractBody(root, bodySelectors) {
    const body = queryFirst(root, bodySelectors);
    const clone = (body || root).cloneNode(true);
    removeNoise(clone);
    return normalizeWhitespace(clone.textContent || "");
  }
  function extractLinks(root, baseUrl) {
    const result = [];
    for (const anchor of Array.from(root.querySelectorAll("a[href]"))) {
      const url = normalizeUrl(anchor.getAttribute("href") || "", baseUrl);
      if (!url) continue;
      const text = normalizeWhitespace(anchor.textContent || "") || url;
      if (!result.some((item) => item.url === url)) result.push({ url, text });
    }
    return result;
  }
  function extractReplyLinks(root, baseUrl) {
    const result = [];
    for (const anchor of Array.from(root.querySelectorAll("a[href]"))) {
      const url = normalizeUrl(anchor.getAttribute("href") || "", baseUrl);
      if (!url || !/findpost|view=findpost|#(?:entry|post)?[-_]?\d+/i.test(url)) continue;
      if (!result.includes(url)) result.push(url);
    }
    return result;
  }
  function imageIsNearKeywords(root, nearbyText, keywords) {
    if (keywords.length === 0) return false;
    const scope = normalizeWhitespace(`${root.textContent || ""} ${nearbyText}`).toLocaleLowerCase();
    return keywords.some((keyword) => keyword.trim() && scope.includes(keyword.trim().toLocaleLowerCase()));
  }
  function extractImageUrls(root, baseUrl, mode, keywords, manualSelection) {
    if (mode === "links") return [];
    if (mode === "manual" && (!manualSelection || !root.contains(manualSelection.anchorNode))) return [];
    const images = [];
    for (const image of Array.from(root.querySelectorAll("img"))) {
      if (image.closest(".avatar, .user_avatar, .post_author, .emoji, .smilie, .reaction")) continue;
      if (mode === "keywords" && !imageIsNearKeywords(root, image.alt || "", keywords)) continue;
      const raw = image.getAttribute("data-src") || image.getAttribute("data-original") || image.getAttribute("src") || "";
      const url = normalizeUrl(raw, baseUrl);
      if (!url || !HTTP_PROTOCOLS.has(new URL(url).protocol)) continue;
      if (!images.includes(url)) images.push(url);
    }
    for (const anchor of Array.from(root.querySelectorAll("a[href]"))) {
      const url = normalizeUrl(anchor.getAttribute("href") || "", baseUrl);
      if (!url || !/\.(avif|bmp|gif|jpe?g|png|webp)(?:$|[?#])/i.test(url) && !/\/forum\/dl\/post\//i.test(url))
        continue;
      if (mode === "keywords" && !imageIsNearKeywords(root, anchor.textContent || "", keywords)) continue;
      if (!images.includes(url)) images.push(url);
    }
    return images;
  }
  function findPostElements(document, selectors) {
    const candidates = [];
    for (const selector of selectors) {
      for (const element of Array.from(document.querySelectorAll(selector))) {
        if (candidates.some((existing) => existing.contains(element) || element.contains(existing))) continue;
        candidates.push(element);
      }
    }
    return candidates;
  }
  function extractPost(element, pageUrl, options, config, metadataRoot = element, authorRoot = null, dateRoot = null) {
    const bodyRoot = queryFirst(element, config.bodySelectors) || element;
    const bodyText = extractBody(element, config.bodySelectors);
    if (bodyText.length < 2) return null;
    const ownId = element.getAttribute("data-post-id") || element.getAttribute("data-entry-id") || element.getAttribute("id") || element.getAttribute("name") || "";
    const idElement = ownId ? element : queryFirst(metadataRoot, config.idSelectors) || queryFirst(element, config.idSelectors) || element;
    const idRaw = idElement.getAttribute("data-post-id") || idElement.getAttribute("data-entry-id") || idElement.getAttribute("id") || idElement.getAttribute("name") || "";
    const idMatch = idRaw.match(/(?:post|entry|comment)[-_]?(\d+)/i) || idRaw.match(/^(\d{3,})$/);
    const permalinkElement = queryFirst(metadataRoot, config.permalinkSelectors) || queryFirst(element, config.permalinkSelectors);
    const permalinkUrl = normalizeUrl(permalinkElement?.getAttribute("href") || "", pageUrl);
    let postId = idMatch?.[1] || idRaw.match(/^post[_-](.+)$/i)?.[1] || null;
    if (!postId && permalinkUrl) {
      try {
        const parsedPermalink = new URL(permalinkUrl);
        postId = parsedPermalink.searchParams.get("p") || parsedPermalink.hash.match(/(?:entry|post)[-_]?(\d+)/i)?.[1] || null;
      } catch {
      }
    }
    let fallbackPostUrl = pageUrl.split("#")[0] || pageUrl;
    if (postId) {
      try {
        const parsedPageUrl = new URL(pageUrl);
        if (parsedPageUrl.searchParams.get("showtopic")) {
          parsedPageUrl.hash = "";
          parsedPageUrl.searchParams.delete("st");
          parsedPageUrl.searchParams.set("view", "findpost");
          parsedPageUrl.searchParams.set("p", postId);
          fallbackPostUrl = parsedPageUrl.href;
        } else {
          fallbackPostUrl = `${fallbackPostUrl}#entry${postId}`;
        }
      } catch {
        fallbackPostUrl = `${fallbackPostUrl}#entry${postId}`;
      }
    }
    const canonicalPostUrl = permalinkUrl || fallbackPostUrl;
    const author = elementText(authorRoot || metadataRoot, config.authorSelectors) || elementText(metadataRoot, config.authorSelectors) || elementText(element, config.authorSelectors) || "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0430\u0432\u0442\u043E\u0440";
    const candidateRoots = dateCandidateRoots(element, metadataRoot);
    const postedAt = parsePostedAt(
      dateRoot ? [dateRoot, ...candidateRoots] : candidateRoots,
      config.dateSelectors,
      precedingHeaderText(element)
    );
    const quotes = extractQuotes(bodyRoot, pageUrl);
    const links = extractLinks(bodyRoot, pageUrl);
    const replyToUrls = extractReplyLinks(bodyRoot, pageUrl);
    const imageUrls = extractImageUrls(
      bodyRoot,
      pageUrl,
      options.imageMode,
      options.imageKeywords,
      options.manualSelection
    );
    const fingerprint = stableFingerprint([options.sourceId, options.topicId, author, postedAt || "", bodyText]);
    const contentHash = stableFingerprint([bodyText, ...links.map((link) => link.url), ...replyToUrls, ...imageUrls]);
    return {
      source_id: options.sourceId,
      topic_id: options.topicId,
      post_id: postId,
      canonical_post_url: canonicalPostUrl,
      fingerprint,
      author,
      posted_at: postedAt,
      page_url: pageUrl,
      body_text: bodyText,
      quotes,
      links,
      reply_to_urls: uniqueStrings(replyToUrls),
      image_urls: uniqueStrings(imageUrls),
      local_image_paths: [],
      collected_at: nowIso(),
      content_hash: contentHash
    };
  }
  function pageTitle(document) {
    return titleFromDocument(document);
  }

  // src/adapters/pagination.ts
  function offsetOf(url) {
    try {
      const parsed = new URL(url);
      const fullOffset = parsed.searchParams.get("st");
      if (fullOffset !== null) {
        const offset = Number.parseInt(fullOffset, 10);
        return Number.isFinite(offset) ? offset : null;
      }
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
  function topicToken(url) {
    try {
      const parsed = new URL(url);
      const showTopic = parsed.searchParams.get("showtopic");
      if (showTopic) return `full:${showTopic}`;
      const lofiTopic = parsed.search.match(/[?&]t(\d+)(?:-\d+)?\.html/i)?.[1];
      return lofiTopic ? `lofi:${lofiTopic}` : null;
    } catch {
      return null;
    }
  }
  function labelOf(anchor) {
    return `${anchor.textContent || ""} ${anchor.getAttribute("title") || ""} ${anchor.getAttribute("aria-label") || ""}`.trim().toLocaleLowerCase();
  }
  function sameTopic(pageUrl, candidateUrl) {
    try {
      const current = new URL(pageUrl);
      const candidate = new URL(candidateUrl);
      const currentToken = topicToken(pageUrl);
      const candidateToken = topicToken(candidateUrl);
      if (currentToken && candidateToken) return currentToken === candidateToken && candidate.origin === current.origin;
      return candidate.origin === current.origin && candidate.pathname === current.pathname && candidate.searchParams.get("showtopic") === current.searchParams.get("showtopic");
    } catch {
      return false;
    }
  }
  function sameTopicAnchors(document, pageUrl) {
    return Array.from(document.querySelectorAll("a[href]")).map((anchor) => ({ anchor, url: normalizeUrl(anchor.href, pageUrl) })).filter((item) => Boolean(item.url)).filter((item) => sameTopic(pageUrl, item.url));
  }
  function findPreviousPageUrl(document, pageUrl) {
    const relPrevious = document.querySelector('a[rel="prev"], link[rel="prev"]');
    const relUrl = relPrevious ? normalizeUrl(relPrevious.href, pageUrl) : null;
    if (relUrl && relUrl !== pageUrl) return relUrl;
    const sameTopic3 = sameTopicAnchors(document, pageUrl);
    const currentOffset = offsetOf(pageUrl);
    const labelled = sameTopic3.filter(({ anchor }) => {
      const label = labelOf(anchor);
      return /предыдущ|назад|previous|\bprev\b|‹|←|\bback\b/.test(label);
    });
    const labelledWithLowerOffset = labelled.map((item) => ({ ...item, offset: offsetOf(item.url) })).filter(
      (item) => item.offset !== null && (currentOffset === null || item.offset < currentOffset)
    ).sort((a, b) => b.offset - a.offset);
    if (labelledWithLowerOffset[0]?.url && labelledWithLowerOffset[0].url !== pageUrl)
      return labelledWithLowerOffset[0].url;
    if (currentOffset !== null) {
      const lowerOffsets = sameTopic3.map((item) => ({ ...item, offset: offsetOf(item.url) })).filter((item) => item.offset !== null && item.offset < currentOffset).sort((a, b) => b.offset - a.offset);
      if (lowerOffsets[0]?.url && lowerOffsets[0].url !== pageUrl) return lowerOffsets[0].url;
    }
    return null;
  }
  function findLastPageUrl(document, pageUrl) {
    const currentOffset = offsetOf(pageUrl);
    if (currentOffset === null) return null;
    const sameTopic3 = sameTopicAnchors(document, pageUrl);
    const candidates = sameTopic3.map((item) => ({ ...item, offset: offsetOf(item.url) })).filter((item) => item.offset !== null && item.offset > currentOffset).sort((a, b) => b.offset - a.offset);
    if (candidates.length === 0) return null;
    const labelled = candidates.filter(({ anchor }) => /послед|last|конец|»/.test(labelOf(anchor)));
    return (labelled[0] || candidates[0])?.url || null;
  }

  // src/adapters/fourpda.ts
  var FOURPDA_POST_CONFIG = {
    postSelectors: [
      ".postwrapper",
      ".post_wrap",
      "[data-post-id]",
      "[data-entry-id]",
      'div.postcolor[id^="post-"]',
      "article.post",
      ".post",
      '[id^="entry"]',
      '[id^="post-"]',
      '[id^="post_"]'
    ],
    idSelectors: [
      "[data-post-id]",
      "[data-entry-id]",
      '[id^="post-"]',
      '[id^="post_"]',
      '[id^="entry"]',
      '[name^="entry"]'
    ],
    permalinkSelectors: [
      "a.post_num",
      "a.post-number",
      "a.permalink",
      'a[href*="#entry"]',
      'a[href*="#post"]',
      'a[href*="view=findpost"]',
      'a[href*="showtopic"][href*="#"]'
    ],
    authorSelectors: [
      ".post_author_name",
      ".post_author-name",
      '.post_author a[href*="showuser"]',
      ".post_author .nickname",
      ".post_author",
      ".postname",
      ".normalname",
      ".nickname",
      ".username",
      '[class*="username"]',
      '[itemprop="author"]'
    ],
    dateSelectors: [
      "time[datetime]",
      '[itemprop="datePublished"]',
      ".post_date",
      ".post-date",
      ".post_header .date",
      ".post_footer .date",
      ".postdate",
      '[class*="post_date"]',
      '[class*="postdate"]'
    ],
    bodySelectors: [
      ".post_content_text",
      ".post_content",
      ".postcontent",
      ".post-content",
      ".entry-content",
      ".post_body"
    ]
  };
  function isLikelyPost(element) {
    if (element.matches('div.postcolor[id^="post-"]')) return true;
    const hasBody = Boolean(queryFirst(element, FOURPDA_POST_CONFIG.bodySelectors));
    if (!hasBody) return false;
    const hasPermalink = Boolean(
      queryFirst(element, [
        "a.post_num",
        "a.post-number",
        "a.permalink",
        'a[href*="view=findpost"]',
        'a[href*="findpost"]'
      ])
    );
    const hasDate = Boolean(queryFirst(element, FOURPDA_POST_CONFIG.dateSelectors));
    const hasAuthor = Boolean(queryFirst(element, FOURPDA_POST_CONFIG.authorSelectors));
    return hasPermalink || hasDate && hasAuthor;
  }
  var FourPdaAdapter = class {
    name = "4pda";
    label = "4PDA";
    canHandle(url) {
      try {
        return /(^|\.)4pda\.(to|ru)$/i.test(new URL(url).hostname);
      } catch {
        return false;
      }
    }
    parse(document, url, options) {
      const candidates = findPostElements(document, FOURPDA_POST_CONFIG.postSelectors);
      const elements = candidates.filter(isLikelyPost);
      const posts = elements.map((element) => {
        const mainCell = element.closest('td[id^="post-main-"], td[id*="post-main-"]');
        const metadataRoot = mainCell?.parentElement || element.closest("tr") || element;
        const rawId = element.getAttribute("data-post-id") || element.getAttribute("data-entry-id") || element.id || "";
        const postId = rawId.match(/(?:post|entry)[-_]?(\d+)/i)?.[1] || null;
        const authorRoot = postId ? document.getElementById(`post-member-${postId}`) : null;
        return extractPost(element, url, options, FOURPDA_POST_CONFIG, metadataRoot, authorRoot, mainCell);
      }).filter((post) => Boolean(post));
      const diagnostics = [];
      if (elements.length === 0) {
        diagnostics.push("\u0420\u0430\u0437\u043C\u0435\u0442\u043A\u0430 4PDA \u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u0430: \u0431\u043B\u043E\u043A\u0438 \u043F\u043E\u0441\u0442\u043E\u0432 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B.");
      }
      if (candidates.length > elements.length) {
        diagnostics.push(
          `4PDA: \u043E\u0442\u0431\u0440\u043E\u0448\u0435\u043D\u043E ${candidates.length - elements.length} \u0431\u043B\u043E\u043A\u043E\u0432 \u0431\u0435\u0437 \u043F\u0440\u0438\u0437\u043D\u0430\u043A\u043E\u0432 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F (\u043C\u0435\u043D\u044E/\u0441\u043B\u0443\u0436\u0435\u0431\u043D\u0430\u044F \u0440\u0430\u0437\u043C\u0435\u0442\u043A\u0430).`
        );
      }
      if (posts.length < elements.length) {
        diagnostics.push(`4PDA: \u0438\u0437 ${elements.length} \u0431\u043B\u043E\u043A\u043E\u0432 \u0438\u0437\u0432\u043B\u0435\u0447\u0435\u043D\u043E ${posts.length} \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439.`);
      }
      const undatedPosts = posts.filter((post) => !post.posted_at);
      if (undatedPosts.length > 0) {
        const sample = normalizeWhitespace(elements[0]?.textContent || "").slice(0, 160);
        diagnostics.push(
          `4PDA: \u0443 ${undatedPosts.length} \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0434\u0430\u0442\u0430. \u041D\u0430\u0447\u0430\u043B\u043E \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u0431\u043B\u043E\u043A\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B: \xAB${sample}\xBB.`
        );
      }
      return {
        title: pageTitle(document),
        posts,
        previousUrl: findPreviousPageUrl(document, url),
        lastUrl: findLastPageUrl(document, url),
        diagnostics
      };
    }
    findPreviousUrl(document, url) {
      return findPreviousPageUrl(document, url);
    }
  };

  // src/adapters/generic.ts
  var GENERIC_POST_CONFIG = {
    postSelectors: [
      "[data-post-id]",
      "[data-comment-id]",
      'article[class*="post"]',
      ".post",
      ".comment",
      '[id^="post-"]',
      '[id^="comment-"]'
    ],
    idSelectors: ["[data-post-id]", "[data-comment-id]", "[id]", "[name]"],
    permalinkSelectors: ["a.permalink", "a.post_permalink", 'a[href*="#"]', 'a[rel="bookmark"]'],
    authorSelectors: [
      '[itemprop="author"]',
      ".author",
      ".username",
      ".user-name",
      ".post_author_name",
      '[class*="author"] a'
    ],
    dateSelectors: [
      "time[datetime]",
      '[itemprop="datePublished"]',
      ".post_date",
      ".post-date",
      ".date",
      '[class*="date"]'
    ],
    bodySelectors: [
      '[itemprop="text"]',
      ".post_content",
      ".post-content",
      ".entry-content",
      ".comment-content",
      ".content"
    ]
  };
  var GenericForumAdapter = class {
    name = "generic-forum";
    label = "Generic forum (\u044D\u0432\u0440\u0438\u0441\u0442\u0438\u043A\u0430)";
    canHandle(url) {
      return !/4pda\./i.test(url);
    }
    parse(document, url, options) {
      const elements = findPostElements(document, GENERIC_POST_CONFIG.postSelectors);
      const posts = elements.map((element) => extractPost(element, url, options, GENERIC_POST_CONFIG)).filter((post) => Boolean(post));
      const diagnostics = [];
      if (elements.length === 0) {
        diagnostics.push("\u042D\u0432\u0440\u0438\u0441\u0442\u0438\u043A\u0430 generic-forum \u043D\u0435 \u043D\u0430\u0448\u043B\u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0449\u0438\u0435\u0441\u044F \u0431\u043B\u043E\u043A\u0438 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439.");
      }
      if (posts.length < elements.length) {
        diagnostics.push(`\u0418\u0437 ${elements.length} \u043D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0445 \u0431\u043B\u043E\u043A\u043E\u0432 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0438\u0437\u0432\u043B\u0435\u0447\u044C ${posts.length} \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439.`);
      }
      return {
        title: pageTitle(document),
        posts,
        previousUrl: findPreviousPageUrl(document, url),
        lastUrl: findLastPageUrl(document, url),
        diagnostics
      };
    }
    findPreviousUrl(document, url) {
      return findPreviousPageUrl(document, url);
    }
  };
  var GenericArticleAdapter = class {
    name = "generic-article";
    label = "Generic article (\u043E\u0434\u043D\u0430 \u0441\u0442\u0430\u0442\u044C\u044F)";
    canHandle(url) {
      return !/4pda\./i.test(url);
    }
    parse(document, url, options) {
      const main = document.querySelector('article, main, [role="main"], .article, .post-content');
      const diagnostics = [];
      if (!main) diagnostics.push("\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0431\u043B\u043E\u043A \u0441\u0442\u0430\u0442\u044C\u0438 (article/main).");
      const post = main ? extractPost(main, url, options, { ...GENERIC_POST_CONFIG, postSelectors: [] }) : null;
      return {
        title: pageTitle(document),
        posts: post ? [post] : [],
        previousUrl: null,
        lastUrl: null,
        diagnostics
      };
    }
    findPreviousUrl() {
      return null;
    }
  };

  // src/adapters/manual.ts
  var ManualSelectionAdapter = class {
    name = "manual-selection";
    label = "Manual selection (\u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442)";
    canHandle() {
      return true;
    }
    parse(document, url, options) {
      const selection = options.manualSelection || window.getSelection();
      const text = selection?.toString().trim() || "";
      const diagnostics = [];
      if (!text) diagnostics.push("\u0412\u044B\u0434\u0435\u043B\u0438\u0442\u0435 \u0442\u0435\u043A\u0441\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u043F\u0435\u0440\u0435\u0434 \u0440\u0443\u0447\u043D\u044B\u043C \u0441\u0431\u043E\u0440\u043E\u043C.");
      const container = document.createElement("article");
      container.textContent = text;
      const post = text ? extractPost(container, url, options, {
        postSelectors: [],
        idSelectors: [],
        permalinkSelectors: [],
        authorSelectors: [],
        dateSelectors: [],
        bodySelectors: []
      }) : null;
      return {
        title: pageTitle(document),
        posts: post ? [post] : [],
        previousUrl: null,
        lastUrl: null,
        diagnostics: [`\u0420\u0443\u0447\u043D\u043E\u0439 \u0440\u0435\u0436\u0438\u043C: \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A ${options.sourceId}, \u0442\u0435\u043C\u0430 ${parseTopicId(url)}.`, ...diagnostics]
      };
    }
    findPreviousUrl() {
      return null;
    }
  };

  // src/adapters/index.ts
  var fourPdaAdapter = new FourPdaAdapter();
  var genericForumAdapter = new GenericForumAdapter();
  var genericArticleAdapter = new GenericArticleAdapter();
  var manualSelectionAdapter = new ManualSelectionAdapter();
  function adapterByName(name) {
    if (name === fourPdaAdapter.name) return fourPdaAdapter;
    if (name === genericArticleAdapter.name) return genericArticleAdapter;
    if (name === manualSelectionAdapter.name) return manualSelectionAdapter;
    return genericForumAdapter;
  }
  function adapterForUrl(url, override = "auto") {
    if (override !== "auto") return adapterByName(override);
    if (fourPdaAdapter.canHandle(url)) return fourPdaAdapter;
    return genericForumAdapter;
  }
  function topicUrlFor(url) {
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      if (/\/lofiversion\/index\.php$/i.test(parsed.pathname)) {
        const topicId = parseTopicId(url);
        if (topicId !== "unknown-topic") {
          parsed.search = `?t${topicId}.html=`;
          return parsed.href;
        }
      }
      parsed.searchParams.delete("st");
      parsed.searchParams.delete("view");
      parsed.searchParams.delete("p");
      parsed.searchParams.delete("pid");
      return parsed.href;
    } catch {
      return url.split("#")[0] || url;
    }
  }
  function sourceForUrl(url, title = "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F", adapterOverride = "auto") {
    const adapter = adapterForUrl(url, adapterOverride);
    const topicUrl = topicUrlFor(url);
    const parsed = new URL(url);
    const is4Pda = adapter.name === "4pda";
    const topicId = is4Pda ? parsed.searchParams.get("showtopic") || parseTopicId(url) || stableFingerprint([topicUrl]) : stableFingerprint([topicUrl]);
    const sourceId = is4Pda ? `4pda:${topicId}` : `generic:${parsed.hostname}:${topicId}`;
    return {
      source_id: sourceId,
      source_name: is4Pda ? "4PDA" : parsed.hostname,
      base_url: parsed.origin,
      topic_url: topicUrl,
      title: title || topicUrl,
      adapter_name: adapter.name,
      last_checkpoint_post_id: null,
      last_checkpoint_url: null,
      last_checkpoint_page_url: null,
      recent_known_ids: [],
      pending_scan_page_url: null,
      pending_scan_checkpoint_key: null,
      pending_scan_checkpoint_post_id: null,
      pending_scan_checkpoint_url: null,
      pending_scan_checkpoint_page_url: null,
      pending_scan_post_keys: [],
      last_checked_at: null,
      configuration: {
        maxPages: 50,
        delayMs: 1200,
        imageMode: "links",
        imageKeywords: [],
        downloadImages: false
      },
      enabled: true
    };
  }

  // src/background-check.ts
  var BACKGROUND_CHECK_KEY = "fkb-background-check";
  function probeOffset(url) {
    try {
      const parsed = new URL(url);
      const fullOffset = parsed.searchParams.get("st");
      if (fullOffset !== null) {
        const value = Number.parseInt(fullOffset, 10);
        return Number.isFinite(value) ? value : null;
      }
      const lofiOffset = parsed.search.match(/[?&]t\d+-(\d+)\.html(?:&|$)/i)?.[1];
      if (lofiOffset) {
        const value = Number.parseInt(lofiOffset, 10);
        return Number.isFinite(value) ? value : null;
      }
      return 0;
    } catch {
      return null;
    }
  }
  function sameTopic2(sourceUrl, candidateUrl) {
    try {
      const source = new URL(sourceUrl);
      const candidate = new URL(candidateUrl);
      return source.origin === candidate.origin && parseTopicId(sourceUrl) === parseTopicId(candidateUrl);
    } catch {
      return false;
    }
  }
  function lastPageUrl(html, pageUrl) {
    const currentOffset = probeOffset(pageUrl);
    if (currentOffset === null) return null;
    const links = [];
    const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const match of html.matchAll(anchorPattern)) {
      const rawUrl = match[1]?.replace(/&amp;/g, "&");
      if (!rawUrl) continue;
      try {
        const url = new URL(rawUrl, pageUrl).href;
        const offset = probeOffset(url);
        if (!sameTopic2(pageUrl, url) || offset === null || offset <= currentOffset) continue;
        const label = (match[2] || "").replace(/<[^>]+>/g, " ").trim().toLocaleLowerCase();
        links.push({ url, offset, label });
      } catch {
      }
    }
    if (links.length === 0) return null;
    const labelled = links.filter((link) => /послед|last|конец|»/.test(link.label));
    return (labelled.sort((a, b) => b.offset - a.offset)[0] || links.sort((a, b) => b.offset - a.offset)[0])?.url || null;
  }
  function looksProtected(response, html) {
    if (response.status === 403) return "\u0421\u0430\u0439\u0442 \u0432\u0435\u0440\u043D\u0443\u043B 403; \u0444\u043E\u043D\u043E\u0432\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430.";
    if (response.status === 429) return "\u0421\u0430\u0439\u0442 \u0432\u0435\u0440\u043D\u0443\u043B 429; \u0444\u043E\u043D\u043E\u0432\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430.";
    if (response.status >= 400) return `\u0421\u0430\u0439\u0442 \u0432\u0435\u0440\u043D\u0443\u043B HTTP ${response.status}; \u0444\u043E\u043D\u043E\u0432\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430.`;
    const sample = html.slice(0, 12e4).toLocaleLowerCase();
    if (/cf-chl-|challenge-platform|g-recaptcha|hcaptcha|turnstile/.test(sample))
      return "\u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u0430 CAPTCHA \u0438\u043B\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430.";
    return null;
  }
  function decodeResponse(response, bytes) {
    const prefix = new TextDecoder("windows-1251").decode(bytes.slice(0, 2e4));
    const declared = prefix.match(/(?:charset|ipb_var_charset)\s*[=:]\s*["']?([\w-]+)/i)?.[1]?.toLowerCase() || response.headers.get("content-type")?.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]?.toLowerCase() || "";
    const encoding = declared === "utf-8" ? "utf-8" : declared === "koi8-r" ? "koi8-r" : "windows-1251";
    try {
      return new TextDecoder(encoding).decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
  async function fetchDecoded(url) {
    const response = await fetch(url, { credentials: "include", redirect: "follow" });
    const bytes = await response.arrayBuffer();
    return { response, html: decodeResponse(response, bytes) };
  }
  async function probeSource(source) {
    const checkedAt = nowIso();
    if (!source.enabled || source.adapter_name !== "4pda") {
      return {
        source_id: source.source_id,
        title: source.title,
        status: "not-configured",
        message: "\u0410\u0432\u0442\u043E\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F 4PDA; \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0432\u0440\u0443\u0447\u043D\u0443\u044E.",
        checked_at: checkedAt
      };
    }
    const startUrl = source.last_checkpoint_page_url || source.topic_url;
    try {
      const first = await fetchDecoded(startUrl);
      const blocked = looksProtected(first.response, first.html);
      if (blocked) {
        return {
          source_id: source.source_id,
          title: source.title,
          status: "blocked",
          message: blocked,
          checked_at: checkedAt
        };
      }
      const lastUrl = lastPageUrl(first.html, first.response.url || startUrl);
      let latestUrl = first.response.url || startUrl;
      let latestHtml = first.html;
      if (lastUrl) {
        const last = await fetchDecoded(lastUrl);
        const lastBlocked = looksProtected(last.response, last.html);
        if (lastBlocked) {
          return {
            source_id: source.source_id,
            title: source.title,
            status: "blocked",
            message: lastBlocked,
            checked_at: checkedAt
          };
        }
        latestUrl = last.response.url || lastUrl;
        latestHtml = last.html;
      }
      const checkpointOffset = probeOffset(startUrl) || 0;
      const latestOffset = probeOffset(latestUrl) || 0;
      const checkpointId = Number.parseInt(source.last_checkpoint_post_id || "", 10);
      const postIds = [...latestHtml.matchAll(/id=["']post-(\d+)["']/gi)].map((match) => Number.parseInt(match[1] || "", 10)).filter(Number.isFinite);
      const latestPostId = postIds.length ? Math.max(...postIds) : null;
      const hasNewPage = latestOffset > checkpointOffset;
      const hasNewPost = Number.isFinite(checkpointId) && latestPostId !== null && latestPostId > checkpointId;
      return {
        source_id: source.source_id,
        title: source.title,
        status: hasNewPage || hasNewPost ? "new-likely" : "no-change",
        message: hasNewPage || hasNewPost ? "\u0412\u0435\u0440\u043E\u044F\u0442\u043D\u043E \u043F\u043E\u044F\u0432\u0438\u043B\u0438\u0441\u044C \u043D\u043E\u0432\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0442\u0435\u043C\u0443 \u0438 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043E\u0431\u044B\u0447\u043D\u0443\u044E \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443." : "\u041D\u043E\u0432\u044B\u0445 \u0441\u0442\u0440\u0430\u043D\u0438\u0446 \u0438\u043B\u0438 \u043F\u043E\u0441\u0442\u043E\u0432 \u043D\u0435 \u043E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u043E.",
        checked_at: checkedAt
      };
    } catch (error) {
      return {
        source_id: source.source_id,
        title: source.title,
        status: "error",
        message: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A: ${error instanceof Error ? error.message : String(error)}`,
        checked_at: checkedAt
      };
    }
  }
  async function readBackgroundCheck() {
    const stored = await chrome.storage.local.get(BACKGROUND_CHECK_KEY);
    const value = stored[BACKGROUND_CHECK_KEY];
    if (!value || typeof value.checked_at !== "string" || !Array.isArray(value.items)) return null;
    return value;
  }
  async function setBadge(items) {
    const hasNew = items.some((item) => item.status === "new-likely");
    const hasBlocked = items.some((item) => item.status === "blocked");
    const hasError = items.some((item) => item.status === "error");
    const text = hasNew ? "+" : hasBlocked ? "!" : hasError ? "?" : "";
    await chrome.action.setBadgeText({ text });
    if (text)
      await chrome.action.setBadgeBackgroundColor({ color: hasNew ? "#147d53" : hasBlocked ? "#b42318" : "#a25b00" });
  }
  async function runBackgroundCheck(sources, enabled) {
    if (!enabled || sources.length === 0) {
      await chrome.storage.local.remove(BACKGROUND_CHECK_KEY);
      await chrome.action.setBadgeText({ text: "" });
      return null;
    }
    const items = [];
    for (const source of sources) {
      if (items.length > 0) await sleep(1500);
      items.push(await probeSource(source));
    }
    const state = { checked_at: nowIso(), items };
    await chrome.storage.local.set({ [BACKGROUND_CHECK_KEY]: state });
    await setBadge(items);
    return state;
  }
  async function clearBackgroundSource(sourceId) {
    const current = await readBackgroundCheck();
    if (!current) return;
    const items = current.items.filter((item) => item.source_id !== sourceId);
    const next = { ...current, items };
    await chrome.storage.local.set({ [BACKGROUND_CHECK_KEY]: next });
    await setBadge(items);
  }

  // src/core/db.ts
  var DB_NAME = "forum-knowledge-base";
  var DB_VERSION = 1;
  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    });
  }
  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
    });
  }
  function deleteByIndex(store, indexName, key) {
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
      request.onerror = () => reject(request.error || new Error("IndexedDB cursor failed"));
    });
  }
  async function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("sources")) db.createObjectStore("sources", { keyPath: "source_id" });
        if (!db.objectStoreNames.contains("posts")) {
          const store = db.createObjectStore("posts", { keyPath: "storage_key" });
          store.createIndex("source_id", "source_id", { unique: false });
          store.createIndex("posted_at", "posted_at", { unique: false });
        }
        if (!db.objectStoreNames.contains("runs")) {
          const store = db.createObjectStore("runs", { keyPath: "storage_key" });
          store.createIndex("source_id", "source_id", { unique: false });
          store.createIndex("created_at", "created_at", { unique: false });
        }
        if (!db.objectStoreNames.contains("reports")) {
          const store = db.createObjectStore("reports", { keyPath: "report_id" });
          store.createIndex("source_id", "source_id", { unique: false });
          store.createIndex("created_at", "created_at", { unique: false });
        }
        if (!db.objectStoreNames.contains("qa")) {
          const store = db.createObjectStore("qa", { keyPath: "storage_key" });
          store.createIndex("source_id", "source_id", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Unable to open IndexedDB"));
    });
  }
  async function getSource(sourceId) {
    const db = await openDatabase();
    try {
      const tx = db.transaction("sources", "readonly");
      return await requestResult(tx.objectStore("sources").get(sourceId)) || null;
    } finally {
      db.close();
    }
  }
  async function getAllSources() {
    const db = await openDatabase();
    try {
      const tx = db.transaction("sources", "readonly");
      return await requestResult(tx.objectStore("sources").getAll());
    } finally {
      db.close();
    }
  }
  async function putSource(source) {
    const db = await openDatabase();
    try {
      const tx = db.transaction("sources", "readwrite");
      tx.objectStore("sources").put(source);
      await transactionDone(tx);
    } finally {
      db.close();
    }
  }
  async function deletePostsByKeys(keys) {
    if (keys.length === 0) return;
    const db = await openDatabase();
    try {
      const tx = db.transaction("posts", "readwrite");
      const store = tx.objectStore("posts");
      keys.forEach((key) => store.delete(key));
      await transactionDone(tx);
    } finally {
      db.close();
    }
  }
  async function resetSource(sourceId) {
    const db = await openDatabase();
    try {
      const tx = db.transaction(["sources", "posts", "runs", "reports", "qa"], "readwrite");
      tx.objectStore("sources").delete(sourceId);
      await Promise.all([
        deleteByIndex(tx.objectStore("posts"), "source_id", sourceId),
        deleteByIndex(tx.objectStore("runs"), "source_id", sourceId),
        deleteByIndex(tx.objectStore("reports"), "source_id", sourceId),
        deleteByIndex(tx.objectStore("qa"), "source_id", sourceId)
      ]);
      await transactionDone(tx);
    } finally {
      db.close();
    }
  }
  async function clearAllData() {
    const db = await openDatabase();
    try {
      const tx = db.transaction(["sources", "posts", "runs", "reports", "qa"], "readwrite");
      tx.objectStore("sources").clear();
      tx.objectStore("posts").clear();
      tx.objectStore("runs").clear();
      tx.objectStore("reports").clear();
      tx.objectStore("qa").clear();
      await transactionDone(tx);
    } finally {
      db.close();
    }
  }
  async function putPosts(posts) {
    if (posts.length === 0) return 0;
    const db = await openDatabase();
    try {
      const tx = db.transaction("posts", "readwrite");
      const store = tx.objectStore("posts");
      for (const post of posts) store.put({ ...post, storage_key: postKey(post) });
      await transactionDone(tx);
      return posts.length;
    } finally {
      db.close();
    }
  }
  async function getPosts(sourceId) {
    const db = await openDatabase();
    try {
      const tx = db.transaction("posts", "readonly");
      const store = tx.objectStore("posts");
      const values = sourceId ? await requestResult(store.index("source_id").getAll(sourceId)) : await requestResult(store.getAll());
      return values.map(({ storage_key: _storageKey, ...post }) => post);
    } finally {
      db.close();
    }
  }
  async function putRun(run) {
    const db = await openDatabase();
    try {
      const tx = db.transaction("runs", "readwrite");
      tx.objectStore("runs").put({ ...run, storage_key: `${run.source_id}:${run.run_id}` });
      await transactionDone(tx);
    } finally {
      db.close();
    }
  }
  async function getLatestRun(sourceId) {
    const runs = await getRuns(sourceId);
    return runs[0] || null;
  }
  async function getRuns(sourceId) {
    const db = await openDatabase();
    try {
      const tx = db.transaction("runs", "readonly");
      const store = tx.objectStore("runs");
      const values = sourceId ? await requestResult(store.index("source_id").getAll(sourceId)) : await requestResult(store.getAll());
      return values.sort((a, b) => b.created_at.localeCompare(a.created_at)).map(({ storage_key: _storageKey, ...run }) => run);
    } finally {
      db.close();
    }
  }
  async function putReport(report) {
    const db = await openDatabase();
    try {
      const tx = db.transaction(["reports", "qa"], "readwrite");
      tx.objectStore("reports").put(report);
      const qaStore = tx.objectStore("qa");
      report.qa_entries.forEach((entry, index) => {
        const text = `${entry.question}
${entry.short_answer}
${entry.detailed_answer}`;
        const qa = {
          storage_key: `${report.report_id}:${index}`,
          report_id: report.report_id,
          source_id: report.source_id,
          question: entry.question,
          text,
          data: entry
        };
        qaStore.put(qa);
      });
      await transactionDone(tx);
    } finally {
      db.close();
    }
  }
  async function deleteReport(reportId) {
    const db = await openDatabase();
    try {
      const tx = db.transaction(["reports", "qa"], "readwrite");
      tx.objectStore("reports").delete(reportId);
      tx.objectStore("qa").delete(IDBKeyRange.bound(`${reportId}:`, `${reportId}:\uFFFF`));
      await transactionDone(tx);
    } finally {
      db.close();
    }
  }
  async function getQa(sourceId) {
    const db = await openDatabase();
    try {
      const tx = db.transaction("qa", "readonly");
      const store = tx.objectStore("qa");
      const values = sourceId ? await requestResult(store.index("source_id").getAll(sourceId)) : await requestResult(store.getAll());
      return values.sort((a, b) => a.storage_key.localeCompare(b.storage_key)).map((entry) => entry.data);
    } finally {
      db.close();
    }
  }
  async function getLocalDataSize() {
    const [sources, posts, reports, qa, runs] = await Promise.all([
      getAllSources(),
      getPosts(),
      getReports(),
      getQa(),
      getRuns()
    ]);
    const json = JSON.stringify({ sources, posts, reports, qa, runs });
    return typeof TextEncoder === "undefined" ? json.length * 2 : new TextEncoder().encode(json).byteLength;
  }
  async function getReports(sourceId) {
    const db = await openDatabase();
    try {
      const tx = db.transaction("reports", "readonly");
      const store = tx.objectStore("reports");
      const values = sourceId ? await requestResult(store.index("source_id").getAll(sourceId)) : await requestResult(store.getAll());
      return values.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } finally {
      db.close();
    }
  }
  async function searchLocal(query) {
    const normalized = query.trim().toLocaleLowerCase();
    const [posts, reports, qa] = await Promise.all([getPosts(), getReports(), getQa()]);
    if (!normalized)
      return { posts: posts.slice(-30).reverse(), reports: reports.slice(0, 10), qa: qa.slice(-20).reverse() };
    return {
      posts: posts.filter(
        (post) => `${post.author}
${post.body_text}
${post.links.map((link) => link.url).join(" ")}`.toLocaleLowerCase().includes(normalized)
      ).slice(0, 50),
      reports: reports.filter(
        (report) => `${report.parsed_summary}
${report.raw_ai_response}`.toLocaleLowerCase().includes(normalized)
      ).slice(0, 20),
      qa: qa.filter(
        (entry) => `${entry.question}
${entry.short_answer}
${entry.detailed_answer}`.toLocaleLowerCase().includes(normalized)
      ).slice(0, 20)
    };
  }
  function newRun(sourceId, postKeys, posts, stopReason) {
    const dates = posts.map((post) => post.posted_at).filter((date) => Boolean(date)).sort();
    return {
      run_id: makeId("run"),
      source_id: sourceId,
      post_keys: postKeys,
      post_count: posts.length,
      from_posted_at: dates[0] || null,
      to_posted_at: dates[dates.length - 1] || null,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      stop_reason: stopReason
    };
  }

  // src/core/collection.ts
  function deduplicatePosts(posts) {
    const seen = /* @__PURE__ */ new Set();
    return posts.filter((post) => {
      const key = postKey(post);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function unknownPosts(posts, knownPosts) {
    const known = new Set(knownPosts.map((post) => postKey(post)));
    return deduplicatePosts(posts).filter((post) => !known.has(postKey(post)));
  }
  function latestPost(posts) {
    return sortPostsChronologically(posts).at(-1) || null;
  }
  function mergeKnownKeys(existing, posts, limit = 1e3) {
    return Array.from(/* @__PURE__ */ new Set([...existing, ...posts.map((post) => postKey(post))])).slice(-limit);
  }
  function postReferenceId(url) {
    try {
      const parsed = new URL(url);
      return parsed.searchParams.get("p") || parsed.searchParams.get("pid") || parsed.hash.match(/(?:entry|post)?[-_]?(\d+)/i)?.[1] || null;
    } catch {
      return null;
    }
  }
  function likelyServicePost(post) {
    const text = `${post.body_text} ${post.author}`.toLocaleLowerCase();
    const markers = [
      "\u043C\u043E\u0438 \u043E\u0442\u0432\u0435\u0442\u044B",
      "\u043C\u043E\u0438 \u0444\u0430\u0439\u043B\u044B",
      "\u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438",
      "\u043C\u0435\u043D\u044E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F",
      "\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u043F\u0440\u043E\u0444\u0438\u043B\u044F",
      "\u043D\u0430\u0439\u0442\u0438 \u0442\u0435\u043C\u044B \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F",
      "\u043D\u0430\u0439\u0442\u0438 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F",
      "\u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0432 \u0442\u0435\u043C\u0435"
    ];
    const markerCount = markers.filter((marker) => text.includes(marker)).length;
    const replacementCharacters = (text.match(/�/g) || []).length;
    const mojibakeMarkers = (text.match(/(?:Р[ђџ]|С[Ђѓ]|Рµ|СЂ)/g) || []).length;
    return markerCount >= 2 || post.author === "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0430\u0432\u0442\u043E\u0440" && markerCount >= 1 || replacementCharacters >= 2 || mojibakeMarkers >= 3;
  }
  function replyContextPosts(newPosts, knownPosts) {
    const selectedKeys = new Set(newPosts.map((post) => postKey(post)));
    const directUrls = new Set(newPosts.flatMap((post) => post.reply_to_urls));
    const directIds = new Set([...directUrls].map(postReferenceId).filter((value) => Boolean(value)));
    return knownPosts.filter((post) => {
      if (selectedKeys.has(postKey(post))) return false;
      return directUrls.has(post.canonical_post_url) || post.post_id !== null && directIds.has(post.post_id);
    });
  }

  // src/core/prompt.ts
  function postBlock(post, index, label) {
    const links = post.links.length ? post.links.map((link) => `- ${link.text}: ${link.url}`).join("\n") : "- \u043D\u0435\u0442";
    const images = post.image_urls.length ? post.image_urls.map((url) => `- ${url}`).join("\n") : "- \u043D\u0435\u0442";
    const quotes = post.quotes.length ? post.quotes.map(
      (quote) => `- ${quote.author ? `${quote.author}: ` : ""}${quote.text}${quote.source_post_url ? ` (\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0446\u0438\u0442\u0430\u0442\u044B: ${quote.source_post_url})` : ""}`
    ).join("\n") : "- \u043D\u0435\u0442";
    const replies = post.reply_to_urls.length ? post.reply_to_urls.map((url) => `- ${url}`).join("\n") : "- \u043D\u0435\u0442";
    return [
      `### ${label} ${index}`,
      `- \u0410\u0432\u0442\u043E\u0440: ${post.author}`,
      `- \u0414\u0430\u0442\u0430: ${post.posted_at || "\u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u0430"}`,
      `- \u0418\u0441\u0445\u043E\u0434\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430: ${post.page_url}`,
      `- \u041F\u043E\u0441\u0442: ${post.canonical_post_url}`,
      "",
      "\u0422\u0435\u043A\u0441\u0442:",
      post.body_text,
      "",
      "\u0426\u0438\u0442\u0430\u0442\u044B (\u043D\u0435 \u0441\u0447\u0438\u0442\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u043C\u0438 \u0444\u0430\u043A\u0442\u0430\u043C\u0438 \u0431\u0435\u0437 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438):",
      quotes,
      "",
      "\u0421\u0441\u044B\u043B\u043A\u0438 \u0438\u0437 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F:",
      links,
      "",
      "\u0421\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F, \u043D\u0430 \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043C\u043E\u0436\u0435\u0442 \u043E\u0442\u0432\u0435\u0447\u0430\u0442\u044C \u044D\u0442\u043E\u0442 \u043F\u043E\u0441\u0442:",
      replies,
      "",
      "\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0438\u0437 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F (URL; \u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0435\u0441\u043B\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0438\u043B \u0444\u0430\u0439\u043B \u0438\u043B\u0438 URL \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D):",
      images
    ].join("\n");
  }
  function buildPrompt(postsInput, contextPostsInput = [], meta = {}) {
    const posts = sortPostsChronologically(postsInput);
    const contextPosts = sortPostsChronologically(contextPostsInput);
    const source = posts[0] || contextPosts[0];
    const from = posts.find((post) => post.posted_at)?.posted_at || "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E";
    const to = [...posts].reverse().find((post) => post.posted_at)?.posted_at || "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E";
    const urls = uniqueStrings(posts.map((post) => post.canonical_post_url));
    const contextUrls = new Set(contextPosts.map((post) => post.canonical_post_url));
    const unresolvedReplies = uniqueStrings(
      posts.flatMap((post) => post.reply_to_urls).filter((url) => !contextUrls.has(url))
    );
    const responseSchema = `{
  "schema_version": "1.0",
  "report": {
    "title": "\u0441\u0442\u0440\u043E\u043A\u0430",
    "period": {"from": "ISO \u0438\u043B\u0438 null", "to": "ISO \u0438\u043B\u0438 null"},
    "overview": "\u043A\u0440\u0430\u0442\u043A\u0430\u044F \u0432\u044B\u0436\u0438\u043C\u043A\u0430",
    "important_news": [{"title": "", "details": "", "status": "confirmed|probable|unconfirmed|conflicting", "source_post_urls": [], "external_urls": []}],
    "confirmed_decisions": [],
    "bugs_and_problems": [],
    "rumors": [],
    "links": [{"url": "", "annotation": "", "source_post_urls": []}],
    "things_to_check": [],
    "qa": [{"question": "", "short_answer": "", "detailed_answer": "", "status": "confirmed|probable|unconfirmed|outdated|conflicting", "tags": [], "device_topic": "", "source_post_urls": [], "external_urls": [], "first_seen_at": null, "updated_at": null, "confidence_note": ""}],
    "conflicts": []
  },
  "markdown_summary": "\u043F\u043E\u043B\u043D\u0430\u044F \u0447\u0438\u0442\u0430\u0435\u043C\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430 \u0434\u043B\u044F \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430: \u0432\u0430\u0436\u043D\u044B\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F, \u0440\u0435\u0448\u0435\u043D\u0438\u044F, \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B, \u0441\u043B\u0443\u0445\u0438, \u0441\u0441\u044B\u043B\u043A\u0438, \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0438 Q&A"
}`;
    const responseTemplate = `{
  "schema_version": "1.0",
  "report": {
    "title": "\u0410\u043D\u0430\u043B\u0438\u0437 \u043D\u043E\u0432\u044B\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 (\u043F\u0430\u043A\u0435\u0442 2026-08-01 \u2014 2026-08-31)",
    "period": {"from": "2026-08-01T00:00:00.000Z", "to": "2026-08-31T23:59:00.000Z"},
    "overview": "3-6 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0439: \u0447\u0442\u043E \u0440\u0435\u0430\u043B\u044C\u043D\u043E \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u043E\u0441\u044C \u0432 \u044D\u0442\u043E\u043C \u043F\u0430\u043A\u0435\u0442\u0435, \u0431\u0435\u0437 \u0432\u043E\u0434\u044B.",
    "important_news": [
      {"title": "\u041A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0444\u0430\u043A\u0442\u0430", "details": "\u0427\u0442\u043E \u0438\u043C\u0435\u043D\u043D\u043E \u043F\u0440\u043E\u0438\u0437\u043E\u0448\u043B\u043E \u0438 \u0447\u0442\u043E \u044D\u0442\u043E \u043C\u0435\u043D\u044F\u0435\u0442 \u0434\u043B\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F.", "status": "confirmed", "source_post_urls": ["https://4pda.to/forum/index.php?showtopic=1108618&st=13260"], "external_urls": []}
    ],
    "confirmed_decisions": [
      {"title": "\u0427\u0442\u043E \u0441\u0434\u0435\u043B\u0430\u0442\u044C, \u0447\u0442\u043E\u0431\u044B \u0440\u0435\u0448\u0438\u0442\u044C \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0443", "details": "\u041A\u0442\u043E \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B, \u043D\u0430 \u043A\u0430\u043A\u043E\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 \u0438 \u0440\u0435\u0433\u0438\u043E\u043D\u0435 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442, \u043A\u0430\u043A\u0438\u0435 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F.", "status": "confirmed", "source_post_urls": ["https://4pda.to/forum/index.php?showtopic=1108618&st=13280"], "external_urls": ["https://f-droid.org/packages/net.typeblog.shelter/"]}
    ],
    "bugs_and_problems": [
      {"title": "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0431\u0430\u0433\u0430", "details": "\u0421\u0438\u043C\u043F\u0442\u043E\u043C\u044B, \u0432\u0435\u0440\u0441\u0438\u044F \u0438 \u0440\u0435\u0433\u0438\u043E\u043D, \u0435\u0441\u0442\u044C \u043B\u0438 \u043E\u0431\u0445\u043E\u0434\u043D\u043E\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u0435.", "status": "probable", "source_post_urls": ["https://4pda.to/forum/index.php?showtopic=1108618&st=13300"], "external_urls": []}
    ],
    "rumors": [
      {"title": "\u0421\u043B\u0443\u0445 \u0438\u043B\u0438 \u043F\u0440\u0435\u0434\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435", "details": "\u041A\u0442\u043E \u044D\u0442\u043E \u0441\u043A\u0430\u0437\u0430\u043B \u0438 \u043F\u043E\u0447\u0435\u043C\u0443 \u044D\u0442\u043E \u0435\u0449\u0451 \u043D\u0435 \u0444\u0430\u043A\u0442.", "status": "unconfirmed", "source_post_urls": ["https://4pda.to/forum/index.php?showtopic=1108618&st=13320"], "external_urls": []}
    ],
    "links": [
      {"url": "https://f-droid.org/packages/net.typeblog.shelter/", "annotation": "\u0417\u0430\u0447\u0435\u043C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u044D\u0442\u0430 \u0441\u0441\u044B\u043B\u043A\u0430.", "source_post_urls": ["https://4pda.to/forum/index.php?showtopic=1108618&st=13280"]}
    ],
    "things_to_check": ["\u0427\u0442\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u0441\u0442\u043E\u0438\u0442 \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043D\u0430 \u0441\u0432\u043E\u0451\u043C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435"],
    "qa": [
      {"question": "\u041A\u0430\u043A \u0440\u0435\u0448\u0438\u0442\u044C \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0443\u044E \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0443?", "short_answer": "\u041E\u0434\u043D\u043E-\u0434\u0432\u0430 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F.", "detailed_answer": "\u041F\u043E\u0448\u0430\u0433\u043E\u0432\u043E, \u0441 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C\u0438 \u0438 \u043E\u0433\u043E\u0432\u043E\u0440\u043A\u0430\u043C\u0438.", "status": "confirmed", "tags": ["\u0437\u0430\u0440\u044F\u0434\u043A\u0430"], "device_topic": "Honor Magic 8 Pro", "source_post_urls": ["https://4pda.to/forum/index.php?showtopic=1108618&st=13260"], "external_urls": [], "first_seen_at": null, "updated_at": null, "confidence_note": "\u041F\u043E\u0447\u0435\u043C\u0443 \u0432\u044B\u0431\u0440\u0430\u043D \u0442\u0430\u043A\u043E\u0439 \u0441\u0442\u0430\u0442\u0443\u0441."}
    ],
    "conflicts": ["\u041F\u0440\u043E\u0448\u0438\u0432\u043A\u0443 193 \u043E\u0442\u043E\u0437\u0432\u0430\u043B\u0438: \u043E\u0434\u0438\u043D \u043F\u0438\u0448\u0435\u0442, \u0447\u0442\u043E \u0435\u0451 \u043E\u0442\u043E\u0437\u0432\u0430\u043B\u0438, \u0434\u0432\u043E\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u0438 \u0435\u0451 \u0438 \u043E\u043D\u0430 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 (https://4pda.to/forum/index.php?showtopic=1108618&st=13380)"]
  },
  "markdown_summary": "## \u0421\u0432\u043E\u0434\u043A\u0430\\n\\n### \u0412\u0430\u0436\u043D\u044B\u0435 \u043D\u043E\u0432\u043E\u0441\u0442\u0438\\n- ...\\n\\n### \u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u044F\\n- ...\\n\\n### \u0411\u0430\u0433\u0438 \u0438 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B\\n- ...\\n\\n### \u0421\u043B\u0443\u0445\u0438 \u0438 \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u0440\u0435\u0447\u0438\u044F\\n- ...\\n\\n### \u041F\u043E\u043B\u0435\u0437\u043D\u044B\u0435 \u0441\u0441\u044B\u043B\u043A\u0438\\n- ...\\n\\n### \u0427\u0442\u043E \u0441\u0442\u043E\u0438\u0442 \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C\\n- ...\\n\\n### Q&A\\n- **\u0412\u043E\u043F\u0440\u043E\u0441** \u2014 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u043E\u0442\u0432\u0435\u0442."
}`;
    const partHeader = meta.partCount ? [
      `## \u042D\u0442\u043E \u0447\u0430\u0441\u0442\u044C ${meta.partNumber || 1} \u0438\u0437 ${meta.partCount} \u043E\u0434\u043D\u043E\u0433\u043E \u043F\u0430\u043A\u0435\u0442\u0430`,
      `\u0418\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u043F\u0430\u043A\u0435\u0442\u0430: ${meta.packetId || "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u0435\u043D"}`,
      "\u0410\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u0443\u0439 \u044D\u0442\u0443 \u0447\u0430\u0441\u0442\u044C \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E, \u043D\u043E \u043D\u0435 \u043D\u0430\u0437\u044B\u0432\u0430\u0439 \u0435\u0451 \u043F\u043E\u043B\u043D\u043E\u0439 \u0441\u0432\u043E\u0434\u043A\u043E\u0439 \u0432\u0441\u0435\u0439 \u0442\u0435\u043C\u044B.",
      ""
    ] : [];
    return [
      "# \u0410\u043D\u0430\u043B\u0438\u0437 \u043D\u043E\u0432\u044B\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u0444\u043E\u0440\u0443\u043C\u0430",
      "",
      ...partHeader,
      "\u0422\u044B \u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u0443\u0435\u0448\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u0438\u0432\u0435\u0434\u0451\u043D\u043D\u044B\u0435 \u043D\u0438\u0436\u0435 \u043F\u0435\u0440\u0432\u0438\u0447\u043D\u044B\u0435 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B. \u041D\u0435 \u0432\u044B\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u0444\u0430\u043A\u0442\u044B \u0438 \u043D\u0435 \u0432\u044B\u0434\u0430\u0432\u0430\u0439 \u043C\u043D\u0435\u043D\u0438\u0435 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0437\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435.",
      "\u0421\u0447\u0438\u0442\u0430\u0439 \u0446\u0438\u0442\u0430\u0442\u044B, \u043F\u0435\u0440\u0435\u0441\u043A\u0430\u0437\u044B \u0438 \u043F\u0440\u0435\u0434\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C\u0438 \u043E\u0442 \u0444\u0430\u043A\u0442\u043E\u0432. \u041E\u0442\u043C\u0435\u0447\u0430\u0439 \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u0440\u0435\u0447\u0438\u044F \u0438 \u0441\u0442\u0435\u043F\u0435\u043D\u044C \u0443\u0432\u0435\u0440\u0435\u043D\u043D\u043E\u0441\u0442\u0438.",
      "",
      "## \u0417\u0430\u0434\u0430\u0447\u0430",
      "1. \u0414\u0430\u0439 \u043A\u043E\u0440\u043E\u0442\u043A\u0443\u044E \u0432\u044B\u0436\u0438\u043C\u043A\u0443 \u0431\u0435\u0437 \u0432\u043E\u0434\u044B \u0438 \u0432\u044B\u0434\u0435\u043B\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u043E\u0432\u044B\u0435 \u0444\u0430\u043A\u0442\u044B \u0438\u043B\u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0432\u043D\u0443\u0442\u0440\u0438 \u044D\u0442\u043E\u0433\u043E \u043F\u0430\u043A\u0435\u0442\u0430.",
      "2. \u0420\u0430\u0437\u0434\u0435\u043B\u0438 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043D\u0430: \u0432\u0430\u0436\u043D\u044B\u0435 \u043D\u043E\u0432\u043E\u0441\u0442\u0438; \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u044F; \u0431\u0430\u0433\u0438 \u0438 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B; \u043D\u0435\u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0435 \u0441\u043B\u0443\u0445\u0438; \u0441\u0441\u044B\u043B\u043A\u0438 \u0441 \u043A\u0440\u0430\u0442\u043A\u0438\u043C\u0438 \u0430\u043D\u043D\u043E\u0442\u0430\u0446\u0438\u044F\u043C\u0438; \u0447\u0442\u043E \u0441\u0442\u043E\u0438\u0442 \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E; Q&A-\u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438.",
      "3. \u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0437\u043D\u0430\u0447\u0438\u043C\u043E\u0433\u043E \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F \u0443\u043A\u0430\u0436\u0438 \u043E\u0434\u0438\u043D \u0438\u043B\u0438 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0442\u043E\u0447\u043D\u044B\u0445 URL \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0445 \u043F\u043E\u0441\u0442\u043E\u0432. \u0415\u0441\u043B\u0438 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430 \u043D\u0435\u0442, \u0442\u0430\u043A \u0438 \u043D\u0430\u043F\u0438\u0448\u0438.",
      "4. \u042F\u0441\u043D\u043E \u0440\u0430\u0437\u043B\u0438\u0447\u0430\u0439 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E, \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E, \u043D\u0435\u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E, \u0443\u0441\u0442\u0430\u0440\u0435\u043B\u043E \u0438 \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u0440\u0435\u0447\u0438\u0442 \u0434\u0440\u0443\u0433 \u0434\u0440\u0443\u0433\u0443.",
      "5. \u041D\u0435 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0439, \u043D\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0439 \u0438 \u043D\u0435 \u0441\u0447\u0438\u0442\u0430\u0439 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u044B\u043C\u0438 \u0432\u043D\u0435\u0448\u043D\u0438\u0435 \u0444\u0430\u0439\u043B\u044B \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0442\u043E\u043C\u0443, \u0447\u0442\u043E \u043D\u0430 \u043D\u0438\u0445 \u0435\u0441\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0430. \u0421\u0441\u044B\u043B\u043A\u0438 \u043B\u0438\u0448\u044C \u0430\u043D\u043D\u043E\u0442\u0438\u0440\u0443\u0439.",
      "6. \u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043E\u0442\u0432\u0435\u0442\u043E\u043C \u043D\u0430 \u0446\u0438\u0442\u0430\u0442\u0443 \u0438\u043B\u0438 \u0434\u0440\u0443\u0433\u043E\u0439 \u043F\u043E\u0441\u0442. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u043F\u043E\u043B\u044F \xAB\u0426\u0438\u0442\u0430\u0442\u044B\xBB \u0438 \xAB\u0421\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F\xBB, \u0441\u0432\u044F\u0436\u0438 \u043E\u0442\u0432\u0435\u0442 \u0441 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u043C \u043F\u043E\u0441\u0442\u043E\u043C, \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439 \u0446\u0438\u0442\u0430\u0442\u0443 \u043A\u0430\u043A \u043D\u043E\u0432\u0443\u044E \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044E. \u0415\u0441\u043B\u0438 \u0438\u0441\u0445\u043E\u0434\u043D\u0438\u043A \u043D\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D \u2014 \u0443\u043A\u0430\u0436\u0438, \u0447\u0442\u043E \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u043D\u0435\u043F\u043E\u043B\u043D\u044B\u0439.",
      `7. \u0412 \u043F\u0430\u043A\u0435\u0442\u0435 ${posts.length} \u043D\u043E\u0432\u044B\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439. \u0426\u0435\u043B\u044C \u043E\u0442\u0447\u0451\u0442\u0430 \u2014 \u043D\u0435 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043F\u0443\u043D\u043A\u0442\u043E\u0432, \u0430 \u0447\u0442\u043E\u0431\u044B \u043F\u043E \u043D\u0435\u043C\u0443 \u043C\u043E\u0436\u043D\u043E \u0431\u044B\u043B\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C: \u0447\u0442\u043E \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u043E\u0441\u044C, \u043D\u0430 \u043A\u0430\u043A\u043E\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 \u0438 \u0432 \u043A\u0430\u043A\u043E\u043C \u0440\u0435\u0433\u0438\u043E\u043D\u0435, \u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0442\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E, \u0447\u0442\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C. \u041D\u0435 \u043F\u0435\u0440\u0435\u0441\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0443 \u0438 \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439 \u043F\u0443\u043D\u043A\u0442\u044B \u0431\u0435\u0437 \u043D\u043E\u0432\u043E\u0433\u043E \u0441\u043C\u044B\u0441\u043B\u0430.`,
      "8. \u041E\u0434\u0438\u043D \u0444\u0430\u043A\u0442 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u043E\u0434\u043D\u043E\u043C \u0440\u0430\u0437\u0434\u0435\u043B\u0435. \u0415\u0441\u043B\u0438 \u043D\u043E\u0432\u043E\u0441\u0442\u044C \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0431\u0430\u0433\u043E\u043C, \u043E\u0441\u0442\u0430\u0432\u044C \u0435\u0451 \u0432 bugs_and_problems \u0438 \u043D\u0435 \u0434\u0443\u0431\u043B\u0438\u0440\u0443\u0439 \u0432 important_news. \u041D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u043E\u0431 \u043E\u0434\u043D\u043E\u043C \u0438 \u0442\u043E\u043C \u0436\u0435 \u043E\u0431\u044A\u0435\u0434\u0438\u043D\u044F\u0439 \u0432 \u043E\u0434\u0438\u043D \u043F\u0443\u043D\u043A\u0442, \u0430 \u0432\u0441\u0435 \u0438\u0445 URL \u043F\u0435\u0440\u0435\u0447\u0438\u0441\u043B\u044F\u0439 \u0432 source_post_urls \u044D\u0442\u043E\u0433\u043E \u043F\u0443\u043D\u043A\u0442\u0430.",
      "9. \u0412 important_news \u043D\u0435 \u043F\u0438\u0448\u0438 \u0442\u043E, \u0447\u0442\u043E \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u0432 bugs_and_problems \u0438\u043B\u0438 confirmed_decisions. \u0412 overview \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0441\u0430\u043C\u043E\u0435 \u0433\u043B\u0430\u0432\u043D\u043E\u0435, \u0431\u0435\u0437 \u043F\u043E\u0432\u0442\u043E\u0440\u0435\u043D\u0438\u044F \u0441\u043F\u0438\u0441\u043A\u043E\u0432 \u043D\u0438\u0436\u0435.",
      "10. \u0412 Q&A \u0432\u044B\u043D\u043E\u0441\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u0442\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0432 \u043F\u0430\u043A\u0435\u0442\u0435 \u0440\u0435\u0430\u043B\u044C\u043D\u043E \u0437\u0430\u0434\u0430\u0432\u0430\u043B\u0438 \u0438\u043B\u0438 \u043D\u0430 \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0440\u0435\u0430\u043B\u044C\u043D\u043E \u043E\u0442\u0432\u0435\u0447\u0430\u043B\u0438. \u0412\u044B\u0434\u0443\u043C\u0430\u043D\u043D\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B \u043D\u0435 \u043D\u0443\u0436\u043D\u044B; \u043A\u0430\u0440\u0442\u043E\u0447\u0435\u043A \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u0441\u0442\u043E\u043B\u044C\u043A\u043E, \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0448\u043B\u043E\u0441\u044C \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0449\u0438\u0445\u0441\u044F \u0432\u043E\u043F\u0440\u043E\u0441\u043E\u0432.",
      "11. \u0423 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043F\u0443\u043D\u043A\u0442\u0430 \u0432 important_news, confirmed_decisions, bugs_and_problems \u0438 \u0443 \u043A\u0430\u0436\u0434\u043E\u0439 Q&A-\u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u0438\u043D \u0442\u043E\u0447\u043D\u044B\u0439 URL \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0433\u043E \u043F\u043E\u0441\u0442\u0430. \u041F\u0443\u043D\u043A\u0442\u044B \u0431\u0435\u0437 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430 \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439.",
      "",
      "## \u0424\u043E\u0440\u043C\u0430\u0442 \u043E\u0442\u0432\u0435\u0442\u0430 \u2014 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D",
      "\u0412\u044B\u0432\u0435\u0434\u0438 \u043E\u0434\u0438\u043D \u0432\u0430\u043B\u0438\u0434\u043D\u044B\u0439 JSON \u0431\u0435\u0437 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u0439 \u0441\u0442\u0440\u043E\u0433\u043E \u043F\u043E \u0441\u0445\u0435\u043C\u0435 \u043D\u0438\u0436\u0435. \u041F\u043E\u043B\u043D\u0430\u044F \u0447\u0438\u0442\u0430\u0435\u043C\u0430\u044F Markdown-\u0441\u0432\u043E\u0434\u043A\u0430 \u043E\u0431\u044F\u0437\u0430\u043D\u0430 \u043B\u0435\u0436\u0430\u0442\u044C \u0432 \u043F\u043E\u043B\u0435 `markdown_summary` (\u0441\u0442\u0440\u043E\u043A\u043E\u0439 \u0441 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0430\u043C\u0438 `\\n`). \u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u043F\u043E\u0441\u043B\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u043E\u043A\u0438 `---MARKDOWN---` \u043C\u043E\u0436\u043D\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C \u0442\u043E\u0442 \u0436\u0435 \u0442\u0435\u043A\u0441\u0442 \u2014 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0435\u0442 \u0438 \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0441 \u043F\u043E\u043B\u0435\u043C, \u0438 \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u0441 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0431\u043B\u043E\u043A\u043E\u043C. Markdown \u043D\u0435 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043E\u0434\u043D\u043E\u0439 \u043A\u043E\u0440\u043E\u0442\u043A\u043E\u0439 \u0444\u0440\u0430\u0437\u043E\u0439: \u043F\u043E\u0432\u0442\u043E\u0440\u0438 \u0432 \u043D\u0451\u043C \u0432\u0430\u0436\u043D\u044B\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F, \u0440\u0435\u0448\u0435\u043D\u0438\u044F, \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B, \u0441\u043B\u0443\u0445\u0438, \u0441\u0441\u044B\u043B\u043A\u0438, \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0438 Q&A. \u0412\u0441\u0435 \u043C\u0430\u0441\u0441\u0438\u0432\u044B \u0434\u043E\u043B\u0436\u043D\u044B \u043F\u0440\u0438\u0441\u0443\u0442\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C, \u0434\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u043E\u043D\u0438 \u043F\u0443\u0441\u0442\u044B\u0435. \u041D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439 \u0432 JSON \u043F\u043E\u043B\u044F \u0441 \u0434\u043E\u0433\u0430\u0434\u043A\u0430\u043C\u0438 \u0431\u0435\u0437 \u043F\u043E\u043C\u0435\u0442\u043A\u0438 \u0441\u0442\u0430\u0442\u0443\u0441\u0430.",
      "\u0421\u0445\u0435\u043C\u0430 (\u044D\u043A\u0432\u0438\u0432\u0430\u043B\u0435\u043D\u0442\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u0433\u0430\u044F JSON Schema):",
      "```json",
      responseSchema,
      "```",
      "",
      "## \u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u0444\u043E\u0440\u043C\u0430\u0442\u0430, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0447\u0430\u0449\u0435 \u0432\u0441\u0435\u0433\u043E \u043D\u0430\u0440\u0443\u0448\u0430\u044E\u0442. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0438\u0445 \u043F\u0435\u0440\u0435\u0434 \u0432\u044B\u0434\u0430\u0447\u0435\u0439",
      "1. `report.conflicts` \u2014 \u043C\u0430\u0441\u0441\u0438\u0432 \u0421\u0422\u0420\u041E\u041A, \u0430 \u043D\u0435 \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432. \u041E\u0434\u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0430 = \u043E\u0434\u043D\u043E \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u0440\u0435\u0447\u0438\u0435: \xAB\u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u2014 \u0432 \u0447\u0451\u043C \u0440\u0430\u0441\u0445\u043E\u0434\u044F\u0442\u0441\u044F \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u2014 \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\xBB.",
      '   \u041F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E: `"conflicts": ["\u041F\u0440\u043E\u0448\u0438\u0432\u043A\u0443 193 \u043E\u0442\u043E\u0437\u0432\u0430\u043B\u0438: \u043E\u0434\u0438\u043D \u043F\u0438\u0448\u0435\u0442, \u0447\u0442\u043E \u043E\u0442\u043E\u0437\u0432\u0430\u043B\u0438, \u0434\u0432\u043E\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u0438 (https://4pda.to/forum/index.php?showtopic=1108618&st=13380)"]`',
      '   \u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E: `"conflicts": [{"title": "...", "description": "..."}]`',
      "2. \u0412\u0441\u0435 \u0430\u0434\u0440\u0435\u0441\u0430 \u2014 \u043E\u0431\u044B\u0447\u043D\u044B\u043C URL \u0431\u0435\u0437 Markdown-\u043E\u0431\u0451\u0440\u0442\u043A\u0438 \u0438 \u0431\u0435\u0437 HTML-\u044D\u043A\u0440\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F: `https://4pda.to/forum/index.php?showtopic=1108618&st=13260`.",
      '   \u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E: `"[https://4pda.to/...](https://4pda.to/...)"`, `&amp;`, `<https://...>`, \u0442\u0435\u043A\u0441\u0442 \u0432\u043E\u043A\u0440\u0443\u0433 \u0441\u0441\u044B\u043B\u043A\u0438.',
      "3. `status` \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u0438\u0437 \u0441\u0445\u0435\u043C\u044B: `confirmed`, `probable`, `unconfirmed`, `conflicting` (\u0432 Q&A \u0435\u0449\u0451 `outdated`). \u041D\u0438\u043A\u0430\u043A\u0438\u0445 \u0441\u043B\u043E\u0432 \u0432\u0440\u043E\u0434\u0435 \xAB\u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E\xBB \u0438\u043B\u0438 \xAB\u0440\u0435\u0448\u0435\u043D\u043E\xBB.",
      "4. \u041F\u0443\u0441\u0442\u043E\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u2014 `[]`, \u0430 \u043D\u0435 `null` \u0438 \u043D\u0435 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0435 \u043F\u043E\u043B\u0435. `null` \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C \u0442\u043E\u043B\u044C\u043A\u043E \u0432 `period.from`, `period.to`, `qa[].first_seen_at`, `qa[].updated_at`.",
      "5. \u041D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439 \u043F\u043E\u043B\u044F, \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043D\u0435\u0442 \u0432 \u0441\u0445\u0435\u043C\u0435. \u041D\u0435 \u043F\u0438\u0448\u0438 \u0442\u0435\u043A\u0441\u0442 \u0434\u043E JSON, \u0432\u043D\u0443\u0442\u0440\u0438 JSON \u0438 \u043C\u0435\u0436\u0434\u0443 JSON \u0438 `---MARKDOWN---`. \u0411\u0435\u0437 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0435\u0432 \u0438 \u0431\u0435\u0437 \u0437\u0430\u0432\u0435\u0440\u0448\u0430\u044E\u0449\u0438\u0445 \u0437\u0430\u043F\u044F\u0442\u044B\u0445.",
      "6. \u041D\u0435 \u043E\u0431\u043E\u0440\u0430\u0447\u0438\u0432\u0430\u0439 JSON \u0432 ```json ... ``` \u2014 \u043E\u0442\u0434\u0430\u0439 \u0435\u0433\u043E \u043A\u0430\u043A \u0435\u0441\u0442\u044C, \u0447\u0442\u043E\u0431\u044B \u0435\u0433\u043E \u043C\u043E\u0436\u043D\u043E \u0431\u044B\u043B\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432 \u0444\u0430\u0439\u043B \u0438 \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C.",
      "",
      "## \u0428\u0430\u0431\u043B\u043E\u043D \u043E\u0442\u0432\u0435\u0442\u0430 \u2014 \u0437\u0430\u043F\u043E\u043B\u043D\u0438 \u0435\u0433\u043E \u0440\u0435\u0430\u043B\u044C\u043D\u044B\u043C\u0438 \u0434\u0430\u043D\u043D\u044B\u043C\u0438 \u044D\u0442\u043E\u0433\u043E \u043F\u0430\u043A\u0435\u0442\u0430, \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0432\u044B\u0434\u0443\u043C\u044B\u0432\u0430\u044F",
      "```json",
      responseTemplate,
      "```",
      "",
      "## \u041C\u0435\u0442\u0430\u0434\u0430\u043D\u043D\u044B\u0435 \u043F\u0430\u043A\u0435\u0442\u0430",
      `\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A: ${source?.source_id || "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u0435\u043D"}`,
      `\u041F\u0435\u0440\u0438\u043E\u0434 \u043D\u043E\u0432\u044B\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439: ${from} \u2014 ${to}`,
      `\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043D\u043E\u0432\u044B\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439: ${posts.length}`,
      `\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u044B\u0445 \u0441\u0442\u0430\u0440\u044B\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439: ${contextPosts.length}`,
      `URL \u043D\u043E\u0432\u044B\u0445 \u043F\u043E\u0441\u0442\u043E\u0432 \u0432 \u043F\u0430\u043A\u0435\u0442\u0435: ${urls.length}`,
      "",
      "## \u041D\u043E\u0432\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u2014 \u0438\u043C\u0435\u043D\u043D\u043E \u0438\u0445 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043D\u0443\u0436\u043D\u043E \u0430\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
      posts.length ? posts.map((post, index) => postBlock(post, index, "\u041D\u043E\u0432\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435")).join("\n\n") : "\u041D\u043E\u0432\u044B\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u0432 \u043F\u0430\u043A\u0435\u0442\u0435 \u043D\u0435\u0442.",
      "",
      "## \u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u044B\u0435 \u0441\u0442\u0430\u0440\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u2014 \u043D\u0435 \u0441\u0447\u0438\u0442\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u043C\u0438",
      contextPosts.length ? contextPosts.map((post, index) => postBlock(post, index, "\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435")).join("\n\n") : "\u041F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0443\u0436\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B \u0432 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0439 \u0431\u0430\u0437\u0435. \u041D\u0435 \u0434\u0435\u043B\u0430\u0439\u0442\u0435 \u0432\u0438\u0434, \u0447\u0442\u043E \u0441\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u043D\u0438\u0445 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B.",
      "",
      "## \u0421\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F, \u0434\u043B\u044F \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E",
      unresolvedReplies.length ? unresolvedReplies.map((url) => `- ${url}`).join("\n") : "- \u043D\u0435\u0442"
    ].join("\n");
  }
  function createManifest(posts, contextPosts, extra = {}) {
    return JSON.stringify(
      {
        format: "forum-knowledge-base-packet",
        format_version: "1.0",
        created_at: nowIso(),
        post_count: posts.length,
        context_post_count: contextPosts.length,
        image_count: posts.reduce((total, post) => total + post.image_urls.length, 0),
        note: "\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u043F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u044B URL. \u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 \u0432\u043E \u0432\u043D\u0435\u0448\u043D\u0438\u0439 \u0418\u0418 \u043D\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F.",
        ...extra
      },
      null,
      2
    );
  }
  function createSingleAiPacket(postsInput, contextPostsInput = []) {
    const packet2 = createAiPacket(postsInput, contextPostsInput);
    const links = JSON.parse(packet2.links_json);
    const json = JSON.stringify(
      {
        format: "forum-knowledge-base-single-ai-file",
        format_version: "1.0",
        instructions: packet2.prompt_md,
        posts: packet2.posts,
        context_posts: packet2.context_posts,
        links,
        note: "\u041F\u043E\u043B\u0435 instructions \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u043F\u043E\u043B\u043D\u044B\u0439 \u043F\u0440\u043E\u043C\u043F\u0442. \u042D\u0442\u043E\u0442 \u0444\u0430\u0439\u043B \u043F\u0440\u0435\u0434\u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D \u0434\u043B\u044F \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0432 \u0418\u0418, \u0430 \u043D\u0435 \u0434\u043B\u044F \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0431\u0430\u0437\u044B."
      },
      null,
      2
    );
    return {
      markdown: packet2.prompt_md,
      json,
      text: packet2.prompt_md,
      post_count: packet2.posts.length,
      context_count: packet2.context_posts.length
    };
  }
  function createAiPacket(postsInput, contextPostsInput = []) {
    const posts = sortPostsChronologically(postsInput);
    const contextPosts = sortPostsChronologically(contextPostsInput).filter(
      (context) => !posts.some((post) => post.canonical_post_url === context.canonical_post_url)
    );
    const links = posts.flatMap((post) => [
      ...post.links.map((link) => ({
        ...link,
        link_type: "link",
        post_url: post.canonical_post_url,
        source_id: post.source_id
      })),
      ...post.reply_to_urls.map((url) => ({
        url,
        text: "\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435, \u043D\u0430 \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u043C\u043E\u0436\u0435\u0442 \u043E\u0442\u0432\u0435\u0447\u0430\u0442\u044C \u043F\u043E\u0441\u0442",
        link_type: "reply",
        post_url: post.canonical_post_url,
        source_id: post.source_id
      }))
    ]);
    return {
      prompt_md: buildPrompt(posts, contextPosts),
      posts_json: JSON.stringify(posts, null, 2),
      context_posts_json: JSON.stringify(contextPosts, null, 2),
      links_json: JSON.stringify(links, null, 2),
      manifest_json: createManifest(posts, contextPosts),
      posts,
      context_posts: contextPosts,
      created_at: nowIso()
    };
  }
  function splitPosts(posts, maxChars) {
    const chunks = [];
    let current = [];
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
  function buildCombinePrompt(packetId, partCount) {
    return [
      "# \u0418\u0442\u043E\u0433\u043E\u0432\u0430\u044F \u0432\u044B\u0436\u0438\u043C\u043A\u0430 \u0438\u0437 \u0447\u0430\u0441\u0442\u0435\u0439 \u043E\u0434\u043D\u043E\u0433\u043E \u043F\u0430\u043A\u0435\u0442\u0430",
      "",
      `\u0418\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u043F\u0430\u043A\u0435\u0442\u0430: ${packetId}`,
      `\u041E\u0436\u0438\u0434\u0430\u0435\u043C\u043E\u0435 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0447\u0430\u0441\u0442\u0435\u0439: ${partCount}`,
      "",
      "\u041D\u0438\u0436\u0435 \u0431\u0443\u0434\u0443\u0442 \u0432\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u044B \u043F\u0440\u043E\u043C\u0435\u0436\u0443\u0442\u043E\u0447\u043D\u044B\u0435 \u043E\u0442\u0432\u0435\u0442\u044B \u0418\u0418 \u043F\u043E \u0432\u0441\u0435\u043C \u0447\u0430\u0441\u0442\u044F\u043C. \u041E\u0431\u044A\u0435\u0434\u0438\u043D\u0438 \u0438\u0445 \u0432 \u043E\u0434\u0438\u043D \u0438\u0442\u043E\u0433\u043E\u0432\u044B\u0439 \u043E\u0442\u0447\u0451\u0442.",
      "\u0423\u0434\u0430\u043B\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u044B, \u0441\u043E\u0445\u0440\u0430\u043D\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0435 \u0441\u0441\u044B\u043B\u043A\u0430\u043C\u0438 \u0444\u0430\u043A\u0442\u044B, \u043E\u0442\u043C\u0435\u0442\u044C \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u0440\u0435\u0447\u0438\u044F \u0438 \u043D\u0435 \u043F\u0440\u0438\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044E.",
      "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0432\u0435\u0434\u0438 \u0432\u0430\u043B\u0438\u0434\u043D\u044B\u0439 JSON \u0441\u0442\u0440\u043E\u0433\u043E \u0441\u0445\u0435\u043C\u044B 1.0 \u0438\u0437 prompt \u0447\u0430\u0441\u0442\u0435\u0439. \u041F\u043E\u043B\u043D\u0443\u044E Markdown-\u0441\u0432\u043E\u0434\u043A\u0443 \u043F\u043E\u043B\u043E\u0436\u0438 \u0432 \u043F\u043E\u043B\u0435 `markdown_summary`; \u043F\u0440\u0438 \u0436\u0435\u043B\u0430\u043D\u0438\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u0438 \u0435\u0451 \u043F\u043E\u0441\u043B\u0435 \u0441\u0442\u0440\u043E\u043A\u0438 ---MARKDOWN---.",
      "\u0424\u043E\u0440\u043C\u0430\u0442 \u0442\u043E\u0442 \u0436\u0435, \u0447\u0442\u043E \u0432 prompt \u0447\u0430\u0441\u0442\u0435\u0439: `report.conflicts` \u2014 \u043C\u0430\u0441\u0441\u0438\u0432 \u0441\u0442\u0440\u043E\u043A; \u0432\u0441\u0435 URL \u2014 \u043E\u0431\u044B\u0447\u043D\u044B\u043C\u0438 \u0430\u0434\u0440\u0435\u0441\u0430\u043C\u0438 \u0431\u0435\u0437 Markdown-\u043E\u0431\u0451\u0440\u0442\u043A\u0438 \u0438 \u0431\u0435\u0437 `&amp;`; `status` \u2014 \u0442\u043E\u043B\u044C\u043A\u043E `confirmed`, `probable`, `unconfirmed`, `outdated`, `conflicting`; \u043F\u0443\u0441\u0442\u044B\u0435 \u0441\u043F\u0438\u0441\u043A\u0438 \u2014 `[]`, \u0430 \u043D\u0435 `null`.",
      "\u0415\u0441\u043B\u0438 \u043A\u0430\u043A\u0430\u044F-\u0442\u043E \u0447\u0430\u0441\u0442\u044C \u043D\u0435 \u0432\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0430, \u0443\u043A\u0430\u0436\u0438 \u044D\u0442\u043E \u0432 overview \u0438\u043B\u0438 conflicts, \u0430 \u043D\u0435 \u0434\u0435\u043B\u0430\u0439 \u0432\u0438\u0434, \u0447\u0442\u043E \u0430\u043D\u0430\u043B\u0438\u0437 \u043F\u043E\u043B\u043E\u043D.",
      "",
      "## \u041F\u0440\u043E\u043C\u0435\u0436\u0443\u0442\u043E\u0447\u043D\u044B\u0435 \u043E\u0442\u0432\u0435\u0442\u044B",
      ...Array.from({ length: partCount }, (_, index) => [
        `### \u041E\u0442\u0432\u0435\u0442 \u0447\u0430\u0441\u0442\u0438 ${index + 1} \u0438\u0437 ${partCount}`,
        "[\u0412\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0441\u044E\u0434\u0430 \u043F\u043E\u043B\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442 \u0418\u0418 \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u0447\u0430\u0441\u0442\u0438]",
        ""
      ]).flat()
    ].join("\n");
  }
  function buildPlainText(postsInput, contextPostsInput = []) {
    const posts = sortPostsChronologically(postsInput);
    const contextPosts = sortPostsChronologically(contextPostsInput);
    const plainPost = (post, index, label) => [
      `${label} ${index + 1}`,
      `\u0410\u0432\u0442\u043E\u0440: ${post.author}`,
      `\u0414\u0430\u0442\u0430: ${post.posted_at || "\u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u0430"}`,
      `\u041F\u043E\u0441\u0442: ${post.canonical_post_url}`,
      `\u0418\u0441\u0445\u043E\u0434\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430: ${post.page_url}`,
      `\u041E\u0442\u0432\u0435\u0442 \u043D\u0430: ${post.reply_to_urls.join(", ") || "\u043D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445"}`,
      `\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F: ${post.image_urls.join(", ") || "\u043D\u0435\u0442"}`,
      "",
      post.body_text,
      ""
    ].join("\n");
    return [
      "Forum Knowledge Base \u2014 \u043F\u043E\u043B\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439",
      "",
      "\u041D\u043E\u0432\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F:",
      ...posts.map((post, index) => plainPost(post, index, "\u041D\u043E\u0432\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435")),
      "\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F:",
      ...contextPosts.map((post, index) => plainPost(post, index, "\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435"))
    ].join("\n");
  }
  function createAiPacketBundle(postsInput, contextPostsInput = [], maxChars = 3e4, packetId = makeId("packet")) {
    const groups = splitPosts(postsInput, Math.max(1e4, maxChars));
    const partCount = Math.max(1, groups.length);
    const chunks = groups.map((group, index) => {
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
          part_count: partCount
        }),
        created_at: createdAt
      };
    });
    return {
      packet_id: packetId,
      part_count: partCount,
      total_post_count: postsInput.length,
      combine_prompt_md: buildCombinePrompt(packetId, partCount),
      full_text: buildPlainText(postsInput, contextPostsInput),
      chunks
    };
  }

  // src/core/importer.ts
  var QA_STATUSES = /* @__PURE__ */ new Set(["confirmed", "probable", "unconfirmed", "outdated", "conflicting"]);
  var SECTION_NAMES = ["important_news", "confirmed_decisions", "bugs_and_problems", "rumors"];
  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function checkExtraFields(record, allowed, path, errors) {
    const allowedSet = new Set(allowed);
    for (const field of Object.keys(record)) {
      if (!allowedSet.has(field)) errors.push(`${path}.${field} \u2014 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u043F\u043E\u043B\u0435.`);
    }
  }
  function stringField(record, field, errors, path, allowNull = false) {
    const value = record[field];
    if (typeof value === "string") return value;
    if (allowNull && value === null) return "";
    errors.push(`${path}.${field} \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u043E\u0439${allowNull ? " \u0438\u043B\u0438 null" : ""}.`);
    return "";
  }
  function nullableString(record, field, errors, path) {
    const value = record[field];
    if (value === null) return null;
    if (typeof value === "string") return value;
    errors.push(`${path}.${field} \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u043E\u0439 \u0438\u043B\u0438 null.`);
    return null;
  }
  function stringArray(value, errors, path) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      errors.push(`${path} \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043C\u0430\u0441\u0441\u0438\u0432\u043E\u043C \u0441\u0442\u0440\u043E\u043A.`);
      return [];
    }
    return value;
  }
  function sectionItem(value, errors, path) {
    if (!isRecord(value)) {
      errors.push(`${path} \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u043C.`);
      return { title: "", details: "", status: "", source_post_urls: [], external_urls: [] };
    }
    checkExtraFields(value, ["title", "details", "status", "source_post_urls", "external_urls"], path, errors);
    return {
      title: stringField(value, "title", errors, path),
      details: stringField(value, "details", errors, path),
      status: stringField(value, "status", errors, path),
      source_post_urls: stringArray(value.source_post_urls, errors, `${path}.source_post_urls`),
      external_urls: stringArray(value.external_urls, errors, `${path}.external_urls`)
    };
  }
  function qaItem(value, errors, path) {
    if (!isRecord(value)) {
      errors.push(`${path} \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u043C.`);
      return emptyQa();
    }
    checkExtraFields(
      value,
      [
        "question",
        "short_answer",
        "detailed_answer",
        "status",
        "tags",
        "device_topic",
        "source_post_urls",
        "external_urls",
        "first_seen_at",
        "updated_at",
        "confidence_note"
      ],
      path,
      errors
    );
    const status = stringField(value, "status", errors, path);
    if (!QA_STATUSES.has(status)) errors.push(`${path}.status \u0438\u043C\u0435\u0435\u0442 \u043D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435.`);
    return {
      question: stringField(value, "question", errors, path),
      short_answer: stringField(value, "short_answer", errors, path),
      detailed_answer: stringField(value, "detailed_answer", errors, path),
      status: QA_STATUSES.has(status) ? status : "unconfirmed",
      tags: stringArray(value.tags, errors, `${path}.tags`),
      device_topic: stringField(value, "device_topic", errors, path),
      source_post_urls: stringArray(value.source_post_urls, errors, `${path}.source_post_urls`),
      external_urls: stringArray(value.external_urls, errors, `${path}.external_urls`),
      first_seen_at: nullableString(value, "first_seen_at", errors, path),
      updated_at: nullableString(value, "updated_at", errors, path),
      confidence_note: stringField(value, "confidence_note", errors, path)
    };
  }
  function emptyQa() {
    return {
      question: "",
      short_answer: "",
      detailed_answer: "",
      status: "unconfirmed",
      tags: [],
      device_topic: "",
      source_post_urls: [],
      external_urls: [],
      first_seen_at: null,
      updated_at: null,
      confidence_note: ""
    };
  }
  function validateAiResponse(input) {
    const errors = [];
    if (!isRecord(input)) return { valid: false, value: null, errors: ["\u041E\u0442\u0432\u0435\u0442 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C JSON-\u043E\u0431\u044A\u0435\u043A\u0442\u043E\u043C."] };
    checkExtraFields(input, ["schema_version", "report", "markdown_summary"], "root", errors);
    if (input.schema_version !== "1.0") errors.push('schema_version \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C "1.0".');
    if (!isRecord(input.report)) errors.push("\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043E\u0431\u044A\u0435\u043A\u0442 report.");
    if (typeof input.markdown_summary !== "string") errors.push("markdown_summary \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u043E\u0439.");
    if (errors.length > 0 || !isRecord(input.report)) return { valid: false, value: null, errors };
    const report = input.report;
    checkExtraFields(
      report,
      [
        "title",
        "period",
        "overview",
        "important_news",
        "confirmed_decisions",
        "bugs_and_problems",
        "rumors",
        "links",
        "things_to_check",
        "qa",
        "conflicts"
      ],
      "report",
      errors
    );
    const period = report.period;
    if (!isRecord(period)) errors.push("report.period \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u043C.");
    if (isRecord(period)) checkExtraFields(period, ["from", "to"], "report.period", errors);
    const resultPeriod = isRecord(period) ? {
      from: nullableString(period, "from", errors, "report.period"),
      to: nullableString(period, "to", errors, "report.period")
    } : { from: null, to: null };
    const normalized = {
      title: stringField(report, "title", errors, "report"),
      period: resultPeriod,
      overview: stringField(report, "overview", errors, "report"),
      important_news: [],
      confirmed_decisions: [],
      bugs_and_problems: [],
      rumors: [],
      links: [],
      things_to_check: stringArray(report.things_to_check, errors, "report.things_to_check"),
      qa: [],
      conflicts: stringArray(report.conflicts, errors, "report.conflicts")
    };
    for (const section of SECTION_NAMES) {
      const values = report[section];
      if (!Array.isArray(values)) {
        errors.push(`report.${section} \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043C\u0430\u0441\u0441\u0438\u0432\u043E\u043C.`);
        continue;
      }
      normalized[section] = values.map((item, index) => sectionItem(item, errors, `report.${section}[${index}]`));
    }
    if (!Array.isArray(report.links)) {
      errors.push("report.links \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043C\u0430\u0441\u0441\u0438\u0432\u043E\u043C.");
    } else {
      normalized.links = report.links.map((value, index) => {
        if (!isRecord(value)) {
          errors.push(`report.links[${index}] \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u043C.`);
          return { url: "", annotation: "", source_post_urls: [] };
        }
        checkExtraFields(value, ["url", "annotation", "source_post_urls"], `report.links[${index}]`, errors);
        return {
          url: stringField(value, "url", errors, `report.links[${index}]`),
          annotation: stringField(value, "annotation", errors, `report.links[${index}]`),
          source_post_urls: stringArray(value.source_post_urls, errors, `report.links[${index}].source_post_urls`)
        };
      });
    }
    if (!Array.isArray(report.qa)) {
      errors.push("report.qa \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043C\u0430\u0441\u0441\u0438\u0432\u043E\u043C.");
    } else {
      normalized.qa = report.qa.map((value, index) => qaItem(value, errors, `report.qa[${index}]`));
    }
    if (errors.length > 0) return { valid: false, value: null, errors };
    return {
      valid: true,
      value: {
        schema_version: "1.0",
        report: normalized,
        markdown_summary: input.markdown_summary
      },
      errors: []
    };
  }
  function findJsonObject(raw) {
    const start = raw.indexOf("{");
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < raw.length; index += 1) {
      const char = raw[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") depth += 1;
      if (char === "}") {
        depth -= 1;
        if (depth === 0) return raw.slice(start, index + 1);
      }
    }
    return null;
  }
  function extractHumanSummary(raw, jsonText) {
    const marker = raw.match(/(^|\n)\s*---MARKDOWN---\s*(?:\n|$)/i);
    if (marker && marker.index !== void 0) return raw.slice(marker.index + marker[0].length).trim();
    if (jsonText) {
      const afterJson = raw.slice((raw.indexOf(jsonText) || 0) + jsonText.length).trim();
      if (afterJson) return afterJson;
    }
    return "";
  }
  var HTML_ENTITIES = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " "
  };
  function decodeHtmlEntities(value) {
    return value.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, code) => {
      const key = code.toLowerCase();
      if (HTML_ENTITIES[key]) return HTML_ENTITIES[key];
      if (!key.startsWith("#")) return match;
      const point = key.startsWith("#x") ? Number.parseInt(key.slice(2), 16) : Number.parseInt(key.slice(1), 10);
      if (!Number.isFinite(point) || point < 32 || point > 1114111) return match;
      try {
        return String.fromCodePoint(point);
      } catch {
        return match;
      }
    });
  }
  var MARKDOWN_LINK = /^\[([^\]]*)\]\(\s*<?([^)\s>]+)>?[^)]*\)$/s;
  function cleanUrlValue(value) {
    let url = decodeHtmlEntities(value).trim();
    const link = MARKDOWN_LINK.exec(url);
    if (link) url = (link[2] || link[1] || "").trim();
    url = decodeHtmlEntities(url).replace(/^<(.*)>$/s, "$1").trim();
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      const inline = /(https?:\/\/[^\s"'<>()[\],]+)/i.exec(url);
      if (inline?.[1]) url = inline[1];
    }
    return url.replace(/[,.;:]+$/, "");
  }
  function normalizeUrlList(value, stats) {
    if (value === void 0 || value === null) return [];
    const items = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    const urls = [];
    for (const item of items) {
      if (typeof item !== "string") continue;
      const cleaned = cleanUrlValue(item);
      if (!cleaned) continue;
      if (cleaned !== item.trim()) stats.urls += 1;
      if (!urls.includes(cleaned)) urls.push(cleaned);
    }
    return urls;
  }
  var STATUS_ALIASES = {
    confirmed: "confirmed",
    verified: "confirmed",
    \u0440\u0435\u0448\u0435\u043D\u043E: "confirmed",
    \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E: "confirmed",
    \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D: "confirmed",
    \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430: "confirmed",
    "\u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F\u043C\u0438": "confirmed",
    probable: "probable",
    likely: "probable",
    \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E: "probable",
    \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E: "probable",
    "\u0447\u0430\u0441\u0442\u0438\u0447\u043D\u043E \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E": "probable",
    unconfirmed: "unconfirmed",
    unverified: "unconfirmed",
    unknown: "unconfirmed",
    "\u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E": "unconfirmed",
    \u043D\u0435\u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E: "unconfirmed",
    "\u0431\u0435\u0437 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F": "unconfirmed",
    outdated: "outdated",
    stale: "outdated",
    \u0443\u0441\u0442\u0430\u0440\u0435\u043B\u043E: "outdated",
    \u0443\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0435\u0435: "outdated",
    "\u043D\u0435 \u0430\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u043E": "outdated",
    conflicting: "conflicting",
    disputed: "conflicting",
    \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u0440\u0435\u0447\u0438\u0432\u043E: "conflicting",
    \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u0440\u0435\u0447\u0438\u0435: "conflicting",
    \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u0440\u0435\u0447\u0438\u044F: "conflicting"
  };
  function normalizeStatus(value, stats) {
    if (typeof value !== "string") return value;
    const raw = value.trim();
    const key = raw.toLowerCase().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
    const mapped = STATUS_ALIASES[key];
    if (mapped && mapped !== raw) {
      stats.statuses += 1;
      return mapped;
    }
    return raw;
  }
  var ROOT_FIELDS = ["schema_version", "report", "markdown_summary"];
  var SUMMARY_ALIASES = ["summary", "markdown", "human_summary", "readable_summary"];
  var REPORT_FIELDS = [
    "title",
    "period",
    "overview",
    "important_news",
    "confirmed_decisions",
    "bugs_and_problems",
    "rumors",
    "links",
    "things_to_check",
    "qa",
    "conflicts"
  ];
  var SECTION_FIELDS = ["title", "details", "status", "source_post_urls", "external_urls"];
  var LINK_FIELDS = ["url", "annotation", "source_post_urls"];
  var QA_FIELDS = [
    "question",
    "short_answer",
    "detailed_answer",
    "status",
    "tags",
    "device_topic",
    "source_post_urls",
    "external_urls",
    "first_seen_at",
    "updated_at",
    "confidence_note"
  ];
  function pickKnown(source, allowed, path, stats) {
    const result = {};
    for (const [key, value] of Object.entries(source)) {
      if (allowed.includes(key)) result[key] = value;
      else if (stats.dropped.length < 12) stats.dropped.push(`${path}.${key}`);
    }
    return result;
  }
  function conflictText(value) {
    if (typeof value === "string") return value.trim();
    if (!isRecord(value)) return "";
    const text = (...fields) => {
      for (const field of fields) {
        const item = value[field];
        if (typeof item === "string" && item.trim()) return item.trim();
      }
      return "";
    };
    const title = text("title", "name", "topic", "question");
    const details = text("description", "details", "text", "note", "comment");
    const urls = normalizeUrlList(value.source_post_urls ?? value.urls ?? value.source_urls, {
      urls: 0,
      statuses: 0,
      conflicts: 0,
      dropped: []
    });
    const body = [title, details].filter(Boolean).join(" \u2014 ");
    if (!body) return "";
    return urls.length ? `${body} (\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438: ${urls.join(", ")})` : body;
  }
  function normalizeAiAnswer(input) {
    if (!isRecord(input)) return { value: input, notes: [] };
    const stats = { urls: 0, statuses: 0, conflicts: 0, dropped: [] };
    const notes = [];
    const root = {};
    for (const field of ROOT_FIELDS) if (input[field] !== void 0) root[field] = input[field];
    if (typeof root.markdown_summary !== "string") {
      const alias = SUMMARY_ALIASES.find((key) => typeof input[key] === "string");
      if (alias) {
        root.markdown_summary = input[alias];
        notes.push(`markdown_summary \u0432\u0437\u044F\u0442 \u0438\u0437 \u043F\u043E\u043B\u044F ${alias}.`);
      }
    }
    if (typeof root.markdown_summary === "string") root.markdown_summary = decodeHtmlEntities(root.markdown_summary);
    for (const key of Object.keys(input)) {
      if (!ROOT_FIELDS.includes(key) && !SUMMARY_ALIASES.includes(key)) {
        if (stats.dropped.length < 12) stats.dropped.push(`root.${key}`);
      }
    }
    if (isRecord(root.report)) {
      const report = pickKnown(root.report, REPORT_FIELDS, "report", stats);
      if (isRecord(report.period)) report.period = pickKnown(report.period, ["from", "to"], "report.period", stats);
      for (const section of SECTION_NAMES) {
        if (!Array.isArray(report[section])) continue;
        report[section] = report[section].map((item) => {
          if (!isRecord(item)) return item;
          const fixed = pickKnown(item, SECTION_FIELDS, `report.${section}[]`, stats);
          if ("status" in fixed) fixed.status = normalizeStatus(fixed.status, stats);
          fixed.source_post_urls = normalizeUrlList(fixed.source_post_urls, stats);
          fixed.external_urls = normalizeUrlList(fixed.external_urls, stats);
          return fixed;
        });
      }
      if (Array.isArray(report.links)) {
        report.links = report.links.map((item) => {
          if (!isRecord(item)) return item;
          const fixed = pickKnown(item, LINK_FIELDS, "report.links[]", stats);
          if (typeof fixed.url === "string") {
            const cleaned = cleanUrlValue(fixed.url);
            if (cleaned !== fixed.url.trim()) stats.urls += 1;
            fixed.url = cleaned;
          }
          fixed.source_post_urls = normalizeUrlList(fixed.source_post_urls, stats);
          return fixed;
        });
      }
      if (Array.isArray(report.qa)) {
        report.qa = report.qa.map((item) => {
          if (!isRecord(item)) return item;
          const fixed = pickKnown(item, QA_FIELDS, "report.qa[]", stats);
          if ("status" in fixed) fixed.status = normalizeStatus(fixed.status, stats);
          fixed.source_post_urls = normalizeUrlList(fixed.source_post_urls, stats);
          fixed.external_urls = normalizeUrlList(fixed.external_urls, stats);
          return fixed;
        });
      }
      if (report.things_to_check !== void 0 && !Array.isArray(report.things_to_check)) {
        if (typeof report.things_to_check === "string") report.things_to_check = [report.things_to_check];
      }
      if (report.conflicts !== void 0) {
        const list = Array.isArray(report.conflicts) ? report.conflicts : [report.conflicts];
        stats.conflicts += list.filter((item) => isRecord(item)).length;
        report.conflicts = list.map(conflictText).filter((item) => item.length > 0);
      }
      root.report = report;
    }
    if (stats.conflicts > 0) notes.push(`report.conflicts: ${stats.conflicts} \u043E\u0431\u044A\u0435\u043A\u0442(\u0430) \u0437\u0430\u043C\u0435\u043D\u0435\u043D\u044B \u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0438.`);
    if (stats.urls > 0) notes.push(`\u0421\u0441\u044B\u043B\u043A\u0438 \u043E\u0447\u0438\u0449\u0435\u043D\u044B \u043E\u0442 Markdown-\u043E\u0431\u0451\u0440\u0442\u043A\u0438 \u0438 HTML-\u044D\u043A\u0440\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F: ${stats.urls} \u0448\u0442.`);
    if (stats.statuses > 0) notes.push(`\u0421\u0442\u0430\u0442\u0443\u0441\u044B \u043F\u0440\u0438\u0432\u0435\u0434\u0435\u043D\u044B \u043A \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F\u043C \u0441\u0445\u0435\u043C\u044B: ${stats.statuses} \u0448\u0442.`);
    if (stats.dropped.length > 0)
      notes.push(`\u041F\u043E\u043B\u044F \u0432\u043D\u0435 \u0441\u0445\u0435\u043C\u044B \u0443\u0431\u0440\u0430\u043D\u044B (\u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0439 \u043E\u0442\u0432\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D): ${stats.dropped.join(", ")}.`);
    return { value: root, notes };
  }
  function repairMissingFields(input, humanSummary) {
    if (!isRecord(input)) return { value: input, warnings: [] };
    const root = { ...input };
    const isMissing = (value) => value === void 0 || value === null;
    const asStringArray = (value) => {
      if (typeof value === "string") return value.trim() ? [value] : [];
      if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value;
      return null;
    };
    const warnings = [];
    const note = (path) => {
      if (warnings.length < 30) warnings.push(`\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u043F\u043E\u043B\u0435 ${path}.`);
    };
    if (isMissing(root.schema_version)) {
      root.schema_version = "1.0";
      note("schema_version");
    }
    if (isMissing(root.markdown_summary)) {
      root.markdown_summary = humanSummary || (isRecord(root.report) && typeof root.report.overview === "string" ? root.report.overview : "");
      note("markdown_summary");
    }
    if (root.markdown_summary === "" && typeof root.summary === "string") {
      root.markdown_summary = root.summary;
      delete root.summary;
      note("markdown_summary (\u0438\u0437 summary)");
    }
    if (!isRecord(root.report)) return { value: root, warnings };
    const report = { ...root.report };
    root.report = report;
    const reportTextDefaults = [
      ["title", ""],
      ["overview", ""]
    ];
    reportTextDefaults.forEach(([field, fallback]) => {
      if (isMissing(report[field])) {
        report[field] = fallback;
        note(`report.${field}`);
      }
    });
    const periodValue = report.period;
    if (!isRecord(periodValue)) {
      if (periodValue === void 0) note("report.period");
      report.period = { from: null, to: null };
    } else {
      const period = { ...periodValue };
      if (period.from === void 0) {
        period.from = null;
        note("report.period.from");
      }
      if (period.to === void 0) {
        period.to = null;
        note("report.period.to");
      }
      report.period = period;
    }
    for (const section of SECTION_NAMES) {
      if (report[section] === void 0) {
        report[section] = [];
        note(`report.${section}`);
        continue;
      }
      if (!Array.isArray(report[section])) continue;
      report[section] = report[section].map((item) => {
        if (!isRecord(item)) return item;
        const fixed = { ...item };
        if (isMissing(fixed.title)) {
          fixed.title = "";
          note(`report.${section}[].title`);
        }
        if (isMissing(fixed.details)) {
          fixed.details = "";
          note(`report.${section}[].details`);
        }
        if (isMissing(fixed.status)) {
          fixed.status = "unconfirmed";
          note(`report.${section}[].status`);
        }
        if (isMissing(fixed.source_post_urls)) {
          fixed.source_post_urls = [];
          note(`report.${section}[].source_post_urls`);
        } else if (typeof fixed.source_post_urls === "string") {
          fixed.source_post_urls = asStringArray(fixed.source_post_urls);
          note(`report.${section}[].source_post_urls`);
        }
        if (isMissing(fixed.external_urls)) {
          fixed.external_urls = [];
          note(`report.${section}[].external_urls`);
        } else if (typeof fixed.external_urls === "string") {
          fixed.external_urls = asStringArray(fixed.external_urls);
          note(`report.${section}[].external_urls`);
        }
        return fixed;
      });
    }
    if (isMissing(report.links)) {
      report.links = [];
      note("report.links");
    } else if (Array.isArray(report.links)) {
      report.links = report.links.map((item) => {
        if (!isRecord(item)) return item;
        const fixed = { ...item };
        if (isMissing(fixed.url)) {
          fixed.url = "";
          note("report.links[].url");
        }
        if (isMissing(fixed.annotation)) {
          fixed.annotation = "";
          note("report.links[].annotation");
        }
        if (isMissing(fixed.source_post_urls)) {
          fixed.source_post_urls = [];
          note("report.links[].source_post_urls");
        } else if (typeof fixed.source_post_urls === "string") {
          fixed.source_post_urls = asStringArray(fixed.source_post_urls);
          note("report.links[].source_post_urls");
        }
        return fixed;
      });
    }
    if (isMissing(report.things_to_check)) {
      report.things_to_check = [];
      note("report.things_to_check");
    } else if (typeof report.things_to_check === "string") {
      report.things_to_check = asStringArray(report.things_to_check);
      note("report.things_to_check");
    }
    if (isMissing(report.qa)) {
      report.qa = [];
      note("report.qa");
    } else if (Array.isArray(report.qa)) {
      report.qa = report.qa.map((item) => {
        if (!isRecord(item)) return item;
        const fixed = { ...item };
        const defaults = [
          ["question", ""],
          ["short_answer", ""],
          ["detailed_answer", ""],
          ["status", "unconfirmed"],
          ["tags", []],
          ["device_topic", ""],
          ["source_post_urls", []],
          ["external_urls", []],
          ["first_seen_at", null],
          ["updated_at", null],
          ["confidence_note", ""]
        ];
        defaults.forEach(([field, fallback]) => {
          const nullable = field === "first_seen_at" || field === "updated_at";
          if (nullable && fixed[field] === void 0 || !nullable && isMissing(fixed[field])) {
            fixed[field] = fallback;
            note(`report.qa[].${field}`);
          } else if (!nullable && (field === "tags" || field === "source_post_urls" || field === "external_urls") && typeof fixed[field] === "string") {
            fixed[field] = asStringArray(fixed[field]);
            note(`report.qa[].${field}`);
          }
        });
        return fixed;
      });
    }
    if (isMissing(report.conflicts)) {
      report.conflicts = [];
      note("report.conflicts");
    } else if (typeof report.conflicts === "string") {
      report.conflicts = asStringArray(report.conflicts);
      note("report.conflicts");
    }
    return { value: root, warnings };
  }
  function markdownQa(raw) {
    const entries = [];
    const unrecognized = [];
    const lines = raw.split(/\r?\n/);
    let inQa = false;
    let current = null;
    const save = () => {
      if (!current) return;
      if (current.question && (current.short_answer || current.detailed_answer)) entries.push(current);
      else if (current.question) unrecognized.push(current.question);
      current = null;
    };
    for (const line of lines) {
      const heading = line.match(/^#{2,6}\s+(.+)$/)?.[1]?.trim() || "";
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
      } else if (current && line.trim() && !line.trim().startsWith("#")) {
        current.detailed_answer = `${current.detailed_answer}${current.detailed_answer ? "\n" : ""}${line.trim()}`;
      }
    }
    save();
    if (inQa && entries.length === 0 && unrecognized.length === 0)
      unrecognized.push("\u0420\u0430\u0437\u0434\u0435\u043B Q&A \u043D\u0430\u0439\u0434\u0435\u043D, \u043D\u043E \u043F\u0430\u0440\u044B \xAB\u0412\u043E\u043F\u0440\u043E\u0441/\u041E\u0442\u0432\u0435\u0442\xBB \u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u044B.");
    return { entries, unrecognized };
  }
  function fallbackPayload(raw, qa) {
    return {
      schema_version: "1.0",
      report: {
        title: "\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u0430\u044F Markdown-\u0441\u0432\u043E\u0434\u043A\u0430",
        period: { from: null, to: null },
        overview: raw.trim(),
        important_news: [],
        confirmed_decisions: [],
        bugs_and_problems: [],
        rumors: [],
        links: [],
        things_to_check: [],
        qa,
        conflicts: []
      },
      markdown_summary: raw.trim()
    };
  }
  function importAiResponse(raw, sourceId, topicId) {
    const text = raw.trim();
    const warnings = [];
    let payload = null;
    let validJson = false;
    const jsonText = findJsonObject(text);
    let humanSummary = decodeHtmlEntities(extractHumanSummary(text, jsonText));
    let repairedJson = false;
    if (jsonText) {
      try {
        const parsed = JSON.parse(jsonText);
        const normalized = normalizeAiAnswer(parsed);
        if (isRecord(normalized.value) && typeof normalized.value.markdown_summary === "string") {
          const jsonSummary = normalized.value.markdown_summary.trim();
          if (jsonSummary) humanSummary = humanSummary || jsonSummary;
        }
        const validation = validateAiResponse(normalized.value);
        if (validation.valid && validation.value) {
          payload = validation.value;
          validJson = true;
          if (normalized.notes.length > 0) {
            repairedJson = true;
            warnings.push("\u0424\u043E\u0440\u043C\u0430\u0442 \u043E\u0442\u0432\u0435\u0442\u0430 \u0418\u0418 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u0440\u0438\u0432\u0435\u0434\u0451\u043D \u043A \u0441\u0445\u0435\u043C\u0435 1.0.");
            warnings.push(...normalized.notes.slice(0, 10));
          }
        } else {
          const repaired = repairMissingFields(normalized.value, humanSummary);
          const repairedValidation = validateAiResponse(repaired.value);
          if (repairedValidation.valid && repairedValidation.value) {
            payload = repairedValidation.value;
            validJson = true;
            repairedJson = true;
            warnings.push("JSON \u043F\u0440\u0438\u043D\u044F\u0442 \u043F\u043E\u0441\u043B\u0435 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043F\u0440\u0438\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043F\u043E\u043B\u0435\u0439 \u043A \u0441\u0445\u0435\u043C\u0435 1.0.");
            warnings.push(...normalized.notes.slice(0, 5), ...repaired.warnings.slice(0, 5));
          } else {
            warnings.push("JSON \u043D\u0430\u0439\u0434\u0435\u043D, \u043D\u043E \u043D\u0435 \u043F\u0440\u043E\u0448\u0451\u043B \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 \u0434\u0430\u0436\u0435 \u043F\u043E\u0441\u043B\u0435 \u0430\u0432\u0442\u043E\u0438\u0441\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F. \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430 Markdown-\u0441\u0432\u043E\u0434\u043A\u0430.");
            warnings.push(...repairedValidation.errors.slice(0, 10));
          }
        }
      } catch (error) {
        warnings.push(`JSON \u043D\u0430\u0439\u0434\u0435\u043D, \u043D\u043E \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      warnings.push("\u0412 \u043E\u0442\u0432\u0435\u0442\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D JSON-\u0431\u043B\u043E\u043A; \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D \u043A\u0430\u043A Markdown.");
    }
    const markdown = markdownQa(humanSummary || text);
    const summaryForStorage = humanSummary;
    if (!payload) payload = fallbackPayload(summaryForStorage || text, markdown.entries);
    if (payload.report.qa.length === 0 && markdown.entries.length > 0) {
      payload.report.qa = markdown.entries;
      if (validJson) warnings.push("Q&A \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u044B \u0438\u0437 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0439 Markdown-\u0441\u0432\u043E\u0434\u043A\u0438.");
    }
    const reportId = makeId("report");
    const qaEntries = payload.report.qa.map((entry) => ({ ...entry, related_report_id: reportId }));
    const report = {
      report_id: reportId,
      source_id: sourceId || "manual-import",
      topic_id: topicId || "unknown-topic",
      period_from: payload.report.period.from,
      period_to: payload.report.period.to,
      raw_ai_response: raw,
      parsed_summary: summaryForStorage || payload.markdown_summary || payload.report.overview,
      structured_facts: payload.report,
      qa_entries: qaEntries,
      created_at: nowIso()
    };
    return {
      report,
      valid_json: validJson,
      repaired_json: repairedJson,
      duplicate: false,
      warnings,
      unrecognized_qa: validJson ? [] : markdown.unrecognized
    };
  }

  // src/core/types.ts
  var DEFAULT_EXTENSION_SETTINGS = {
    companionUrl: "",
    adapterName: "auto",
    backgroundCheckEnabled: false,
    maxPages: 50,
    delayMs: 1200,
    imageMode: "links",
    imageKeywords: [],
    downloadImages: false
  };

  // src/core/settings.ts
  var SETTINGS_KEY = "fkb-settings";
  function normalizeCompanionUrl(value) {
    if (value === "") return "";
    if (typeof value !== "string") return DEFAULT_EXTENSION_SETTINGS.companionUrl;
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)) {
        return DEFAULT_EXTENSION_SETTINGS.companionUrl;
      }
      return url.href.replace(/\/$/, "");
    } catch {
      return DEFAULT_EXTENSION_SETTINGS.companionUrl;
    }
  }
  function normalizeSettings(value) {
    const adapterNames = ["auto", "4pda", "generic-forum", "generic-article", "manual-selection"];
    return {
      companionUrl: normalizeCompanionUrl(value?.companionUrl),
      adapterName: adapterNames.includes(value?.adapterName) ? value?.adapterName : DEFAULT_EXTENSION_SETTINGS.adapterName,
      backgroundCheckEnabled: value?.backgroundCheckEnabled === true,
      maxPages: clampInteger(value?.maxPages, 1, 50, DEFAULT_EXTENSION_SETTINGS.maxPages),
      delayMs: clampInteger(value?.delayMs, 0, 3e4, DEFAULT_EXTENSION_SETTINGS.delayMs),
      imageMode: value?.imageMode === "all" || value?.imageMode === "keywords" || value?.imageMode === "manual" ? value.imageMode : "links",
      imageKeywords: Array.isArray(value?.imageKeywords) ? value.imageKeywords.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [],
      downloadImages: value?.downloadImages === true
    };
  }
  async function getSettings() {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    return normalizeSettings(stored[SETTINGS_KEY]);
  }
  async function saveSettings(settings) {
    const normalized = normalizeSettings(settings);
    await chrome.storage.local.set({ [SETTINGS_KEY]: normalized });
    return normalized;
  }

  // src/background.ts
  async function activeTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (typeof tab?.id !== "number" || !tab.url)
      throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u0430\u043A\u0442\u0438\u0432\u043D\u0443\u044E \u0432\u043A\u043B\u0430\u0434\u043A\u0443. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0442\u0435\u043C\u0443 \u0444\u043E\u0440\u0443\u043C\u0430.");
    if (!/^https?:\/\//i.test(tab.url)) throw new Error("\u0410\u043A\u0442\u0438\u0432\u043D\u0430\u044F \u0432\u043A\u043B\u0430\u0434\u043A\u0430 \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043E\u0431\u044B\u0447\u043D\u043E\u0439 \u0432\u0435\u0431-\u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435\u0439.");
    return tab;
  }
  function withSettings(source, settings) {
    return {
      ...source,
      configuration: {
        ...source.configuration,
        maxPages: settings.maxPages,
        delayMs: settings.delayMs,
        imageMode: settings.imageMode,
        imageKeywords: settings.imageKeywords,
        downloadImages: settings.downloadImages
      }
    };
  }
  async function sourceForActiveUrl(url, title, adapterOverride = "auto") {
    const detected = sourceForUrl(url, title || "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F", adapterOverride);
    const stored = await getSource(detected.source_id);
    if (stored) return stored;
    return detected;
  }
  async function injectAndCollect(tabId, options) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["collector.js"] });
    const result = await chrome.tabs.sendMessage(tabId, { type: "run-collector", options });
    if (!result || typeof result !== "object") throw new Error("\u0410\u0434\u0430\u043F\u0442\u0435\u0440 \u043D\u0435 \u0432\u0435\u0440\u043D\u0443\u043B \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0441\u0431\u043E\u0440\u0430.");
    return result;
  }
  function updateCheckpoint(source, post) {
    return {
      ...source,
      last_checkpoint_post_id: post.post_id || post.fingerprint,
      last_checkpoint_url: post.canonical_post_url,
      last_checkpoint_page_url: post.page_url,
      last_checked_at: nowIso()
    };
  }
  async function downloadImages(posts, source) {
    if (!source.configuration.downloadImages) return { posts, warnings: [] };
    const warnings = [];
    const safeSource = source.source_id.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
    let downloaded = 0;
    const result = [];
    for (const post of posts) {
      const localPaths = [];
      for (const [index, imageUrl] of post.image_urls.entries()) {
        if (downloaded >= 100) {
          warnings.push("\u0414\u043E\u0441\u0442\u0438\u0433\u043D\u0443\u0442 \u043B\u0438\u043C\u0438\u0442 100 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0439 \u0437\u0430 \u0437\u0430\u043F\u0443\u0441\u043A. \u041E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 URL \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u0431\u0435\u0437 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u044F.");
          break;
        }
        try {
          const parsed = new URL(imageUrl);
          if (!["http:", "https:"].includes(parsed.protocol)) continue;
          const extension = (parsed.pathname.match(/\\.(avif|bmp|gif|jpe?g|png|webp)$/i)?.[1] || "img").toLowerCase();
          const filename = `Forum Knowledge Base/images/${safeSource}/${post.fingerprint}-${index}.${extension}`;
          await chrome.downloads.download({ url: imageUrl, filename, saveAs: false, conflictAction: "uniquify" });
          localPaths.push(filename);
          downloaded += 1;
        } catch (error) {
          warnings.push(
            `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 ${imageUrl}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      result.push({ ...post, local_image_paths: localPaths });
    }
    if (downloaded > 0) warnings.unshift(`\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0439 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430: ${downloaded}.`);
    return { posts: result, warnings };
  }
  async function syncCompanion(path, body) {
    const settings = await getSettings();
    const base = settings.companionUrl.trim().replace(/\/$/, "");
    if (!base) return null;
    try {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5e3)
      });
      if (!response.ok) return `Companion \u043E\u0442\u0432\u0435\u0442\u0438\u043B HTTP ${response.status}.`;
      return null;
    } catch (error) {
      return `Companion \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  async function makeState(url) {
    const [settings, sources, backgroundCheck, localDataSize] = await Promise.all([
      getSettings(),
      getAllSources(),
      readBackgroundCheck(),
      getLocalDataSize()
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
        settings
      };
    }
    const detected = sourceForUrl(url, "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F", settings.adapterName);
    const currentSource = await getSource(detected.source_id);
    const source = currentSource ? withSettings(currentSource, settings) : null;
    const [storedPosts, recentReports, latestRun] = await Promise.all([
      source ? getPosts(source.source_id) : Promise.resolve([]),
      source ? getReports(source.source_id) : getReports(),
      source ? getLatestRun(source.source_id) : Promise.resolve(null)
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
      settings
    };
  }
  async function collect(request) {
    const tab = await activeTab();
    const settings = await getSettings();
    const existing = await sourceForActiveUrl(tab.url || request.url, tab.title, settings.adapterName);
    const source = withSettings(existing, settings);
    await putSource(source);
    if (request.mode === "new" && !source.last_checkpoint_post_id && !source.last_checkpoint_url) {
      return {
        ok: false,
        error: "Checkpoint \u0435\u0449\u0451 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u043D. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \xAB\u0421\u043E\u0437\u0434\u0430\u0442\u044C checkpoint\xBB \u0438\u043B\u0438 \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u044E."
      };
    }
    const storedPosts = await getPosts(source.source_id);
    const checkpointPost = source.last_checkpoint_post_id ? storedPosts.find((post) => (post.post_id || post.fingerprint) === source.last_checkpoint_post_id) : null;
    const checkpointPageUrl = source.last_checkpoint_page_url || checkpointPost?.page_url || null;
    const resumePageUrl = source.pending_scan_page_url || null;
    const pendingPostKeys = source.pending_scan_post_keys || [];
    const knownKeys = source.recent_known_ids.slice(-1e3);
    const checkpointKey = source.last_checkpoint_post_id ? `${source.source_id}:${source.last_checkpoint_post_id}` : null;
    const collectorOptions = {
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
      knownKeys
    };
    let result;
    try {
      result = await injectAndCollect(tab.id, collectorOptions);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        details: ["\u0423\u0431\u0435\u0434\u0438\u0442\u0435\u0441\u044C, \u0447\u0442\u043E \u0432\u043A\u043B\u0430\u0434\u043A\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u0430 \u043D\u0430 \u043E\u0431\u044B\u0447\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0438 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044E \u0440\u0430\u0437\u0440\u0435\u0448\u0451\u043D \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u043D\u0435\u0439."]
      };
    }
    if (request.mode === "checkpoint") {
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
          `Checkpoint \u0441\u043E\u0437\u0434\u0430\u043D \u043D\u0430 \u043F\u043E\u0441\u0442\u0435 ${checkpoint.post_id || checkpoint.fingerprint}. \u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043D\u0435 \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0430.`
        );
        const firstPage = result.pages[0];
        const newerUrl = firstPage ? normalizeUrl(firstPage.last_url || "", firstPage.url) : null;
        if (firstPage && newerUrl && newerUrl !== firstPage.url) {
          result.diagnostics.push(
            `\u0412\u043D\u0438\u043C\u0430\u043D\u0438\u0435: \u0443 \u0442\u0435\u043C\u044B \u0435\u0441\u0442\u044C \u0431\u043E\u043B\u0435\u0435 \u043D\u043E\u0432\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 (${newerUrl}). Checkpoint \u0441\u043E\u0437\u0434\u0430\u043D \u043D\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435, \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u0441\u0430\u043C\u044B\u0435 \u043D\u043E\u0432\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0435\u0449\u0451 \u043D\u0435 \u0443\u0447\u0442\u0435\u043D\u044B. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043D\u043E\u0432\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F\xBB.`
          );
        }
      }
      return { ok: true, collection: result };
    }
    const partialNewRun = request.mode === "new" && !result.checkpoint_found && Boolean(result.resume_url);
    const canPersist = result.ok && (request.mode === "history" || result.checkpoint_found || partialNewRun);
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
      updatedSource.pending_scan_post_keys = Array.from(/* @__PURE__ */ new Set([...pendingPostKeys, ...segmentKeys]));
      if (!updatedSource.pending_scan_checkpoint_key) {
        const segmentNewest = latestPost(postsToSave);
        if (segmentNewest) {
          updatedSource.pending_scan_checkpoint_key = postKey(segmentNewest);
          updatedSource.pending_scan_checkpoint_post_id = segmentNewest.post_id || segmentNewest.fingerprint;
          updatedSource.pending_scan_checkpoint_url = segmentNewest.canonical_post_url;
          updatedSource.pending_scan_checkpoint_page_url = segmentNewest.page_url;
        }
      }
      result.diagnostics.push("\u042D\u0442\u043E\u0442 \u0437\u0430\u043F\u0443\u0441\u043A \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043B \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0430\u0441\u0442\u044C \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430. \u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.");
    } else if (request.mode === "new") {
      const pendingKey = source.pending_scan_checkpoint_key;
      const allKnownAfterSave2 = [...storedPosts, ...postsToSave];
      const pendingCandidate = pendingKey ? allKnownAfterSave2.find((post) => postKey(post) === pendingKey) || null : null;
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
    updatedSource.recent_known_ids = mergeKnownKeys(updatedSource.recent_known_ids, result.posts, 1e3);
    updatedSource.last_checked_at = nowIso();
    await putSource(updatedSource);
    await clearBackgroundSource(updatedSource.source_id);
    const runKeys = partialNewRun ? segmentKeys : [...pendingPostKeys, ...segmentKeys];
    const allKnownAfterSave = [...storedPosts, ...postsToSave];
    const runPosts = allKnownAfterSave.filter((post) => runKeys.includes(postKey(post)));
    const run = newRun(updatedSource.source_id, Array.from(new Set(runKeys)), runPosts, result.stop_reason);
    await putRun(run);
    const companionWarning = await syncCompanion("/api/sync", {
      source: updatedSource,
      posts: postsToSave,
      run
    });
    if (companionWarning) result.diagnostics.push(companionWarning);
    result.source = updatedSource;
    result.posts = postsToSave;
    result.diagnostics.push(`\u041D\u043E\u0432\u044B\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E: ${postsToSave.length}. \u041F\u043E\u0432\u0442\u043E\u0440\u0435\u043D\u0438\u044F \u043E\u0442\u0431\u0440\u043E\u0448\u0435\u043D\u044B.`);
    return { ok: true, collection: result };
  }
  async function packet(mode) {
    const run = await getLatestRun();
    if (!run || run.post_keys.length === 0) {
      return {
        ok: false,
        error: "\u041D\u0435\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0433\u043E \u0441\u0431\u043E\u0440\u0430. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0441\u0431\u043E\u0440 \u043D\u043E\u0432\u044B\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u0438\u043B\u0438 \u0438\u043C\u043F\u043E\u0440\u0442 \u0438\u0441\u0442\u043E\u0440\u0438\u0438."
      };
    }
    const posts = await getPosts(run.source_id);
    const byKey = new Set(run.post_keys);
    const selected = posts.filter((post) => byKey.has(postKey(post)));
    if (selected.length === 0) return { ok: false, error: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0445 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439." };
    const contextPosts = replyContextPosts(selected, posts);
    if (mode === "single") {
      const single = createSingleAiPacket(selected, contextPosts);
      return { ok: true, singlePacket: single };
    }
    const bundle = createAiPacketBundle(selected, contextPosts);
    const packet2 = {
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
        context_count: chunk.context_posts.length
      }))
    };
    return { ok: true, packet: packet2 };
  }
  async function clearAllLocalData() {
    await clearAllData();
    await runBackgroundCheck([], false);
    const companionWarning = await syncCompanion("/api/clear-all", {});
    return {
      ok: true,
      message: companionWarning ? `\u0412\u0441\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F \u0443\u0434\u0430\u043B\u0435\u043D\u044B. ${companionWarning}` : "\u0412\u0441\u0435 \u043F\u043E\u0441\u0442\u044B, \u043E\u0442\u0447\u0451\u0442\u044B, Q&A \u0438 \u0442\u043E\u0447\u043A\u0438 \u043E\u0442\u0441\u0447\u0451\u0442\u0430 \u0443\u0434\u0430\u043B\u0435\u043D\u044B."
    };
  }
  async function resetActiveSource(url) {
    if (!/^https?:\/\//i.test(url)) return { ok: false, error: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u044D\u0442\u043E\u0439 \u0442\u0435\u043C\u044B." };
    const settings = await getSettings();
    const detected = sourceForUrl(url, "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F", settings.adapterName);
    const source = await getSource(detected.source_id);
    if (!source) return { ok: false, error: "\u0414\u043B\u044F \u044D\u0442\u043E\u0439 \u0442\u0435\u043C\u044B \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445." };
    await resetSource(source.source_id);
    await clearBackgroundSource(source.source_id);
    const companionWarning = await syncCompanion("/api/reset", { source_id: source.source_id });
    return {
      ok: true,
      message: companionWarning ? `\u0414\u0430\u043D\u043D\u044B\u0435 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044F \u0443\u0434\u0430\u043B\u0435\u043D\u044B. ${companionWarning}` : "\u0412\u0441\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u044D\u0442\u043E\u0439 \u0442\u0435\u043C\u044B, \u0432\u043A\u043B\u044E\u0447\u0430\u044F \u043F\u043E\u0441\u0442\u044B, \u043E\u0442\u0447\u0451\u0442\u044B \u0438 Q&A, \u0443\u0434\u0430\u043B\u0435\u043D\u044B."
    };
  }
  async function runDiagnostic(url) {
    const tab = await activeTab();
    const settings = await getSettings();
    const pageUrl = tab.url || url;
    const source = sourceForUrl(pageUrl, tab.title, settings.adapterName);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["collector.js"] });
    const result = await chrome.tabs.sendMessage(tab.id, {
      type: "run-diagnostic",
      adapterName: source.adapter_name
    });
    if (!result || typeof result !== "object" || !("markdown" in result) || !("json" in result)) {
      throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0434\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043B\u043E\u0433 \u0441\u043E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B.");
    }
    return { ok: true, diagnostic: result };
  }
  async function cleanServicePosts(url) {
    if (!/^https?:\/\//i.test(url)) return { ok: false, error: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u044D\u0442\u043E\u0439 \u0442\u0435\u043C\u044B." };
    const settings = await getSettings();
    const detected = sourceForUrl(url, "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F", settings.adapterName);
    const source = await getSource(detected.source_id);
    if (!source) return { ok: false, error: "\u0414\u043B\u044F \u044D\u0442\u043E\u0439 \u0442\u0435\u043C\u044B \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445." };
    const posts = await getPosts(source.source_id);
    const badPosts = posts.filter(likelyServicePost);
    const badKeys = badPosts.map((post) => postKey(post));
    await deletePostsByKeys(badKeys);
    if (badKeys.length > 0) {
      source.recent_known_ids = source.recent_known_ids.filter((key) => !badKeys.includes(key));
      await putSource(source);
    }
    await clearBackgroundSource(source.source_id);
    const companionWarning = await syncCompanion("/api/clean", { source_id: source.source_id, post_keys: badKeys });
    return {
      ok: true,
      message: companionWarning ? `\u0423\u0434\u0430\u043B\u0435\u043D\u043E \u0441\u043B\u0443\u0436\u0435\u0431\u043D\u044B\u0445 \u0437\u0430\u043F\u0438\u0441\u0435\u0439 \u0432 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0438: ${badKeys.length}. ${companionWarning}` : `\u0423\u0434\u0430\u043B\u0435\u043D\u043E \u0441\u043B\u0443\u0436\u0435\u0431\u043D\u044B\u0445 \u0437\u0430\u043F\u0438\u0441\u0435\u0439: ${badKeys.length}. \u0422\u043E\u0447\u043A\u0430 \u043E\u0442\u0441\u0447\u0451\u0442\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430.`
    };
  }
  async function openSavedSource(sourceId) {
    const source = await getSource(sourceId);
    if (!source) return { ok: false, error: "\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u0430\u044F \u0442\u0435\u043C\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0432 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0439 \u0431\u0430\u0437\u0435." };
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (typeof tab?.id !== "number") return { ok: false, error: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043D\u0430\u0439\u0442\u0438 \u0432\u043A\u043B\u0430\u0434\u043A\u0443 \u0434\u043B\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F \u0442\u0435\u043C\u044B." };
    await chrome.tabs.update(tab.id, { url: source.topic_url });
    return { ok: true, message: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u044E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u0443\u044E \u0442\u0435\u043C\u0443." };
  }
  async function exportLocal() {
    const [sources, posts, reports, qa, runs] = await Promise.all([
      getAllSources(),
      getPosts(),
      getReports(),
      getQa(),
      getRuns()
    ]);
    const payload = {
      format: "forum-knowledge-base-export",
      format_version: "1.0",
      exported_at: nowIso(),
      note: "\u0420\u0435\u0437\u0435\u0440\u0432\u043D\u0430\u044F \u043A\u043E\u043F\u0438\u044F \u0434\u0430\u043D\u043D\u044B\u0445 \u0434\u043B\u044F \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0438 \u0430\u0440\u0445\u0438\u0432\u0430. \u0414\u043B\u044F \u0430\u043D\u0430\u043B\u0438\u0437\u0430 \u0418\u0418 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0443\u044E \u043A\u043D\u043E\u043F\u043A\u0443 \u0435\u0434\u0438\u043D\u043E\u0433\u043E AI-\u0444\u0430\u0439\u043B\u0430.",
      sources,
      posts,
      reports,
      qa,
      runs
    };
    const lines = ["# Forum Knowledge Base \u2014 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u044D\u043A\u0441\u043F\u043E\u0440\u0442", "", `\u0421\u043E\u0437\u0434\u0430\u043D\u043E: ${payload.exported_at}`, ""];
    for (const source of sources) {
      lines.push(`## ${source.title}`, `\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A: ${source.topic_url}`, `\u0410\u0434\u0430\u043F\u0442\u0435\u0440: ${source.adapter_name}`, "");
      const sourcePosts = sortPostsChronologically(posts.filter((post) => post.source_id === source.source_id));
      for (const post of sourcePosts) {
        lines.push(
          `### ${post.author} \u2014 ${post.posted_at || "\u0434\u0430\u0442\u0430 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430"}`,
          `[\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u0441\u0442](${post.canonical_post_url})`,
          "",
          post.body_text,
          ""
        );
      }
    }
    if (reports.length) {
      lines.push("## \u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u0441\u0432\u043E\u0434\u043A\u0438", "");
      for (const report of reports) {
        lines.push(
          `### ${report.structured_facts.title || report.report_id}`,
          `\u0414\u0430\u0442\u0430: ${report.created_at}`,
          "",
          report.parsed_summary,
          ""
        );
      }
    }
    if (qa.length) {
      lines.push("## Q&A", "");
      for (const entry of qa) {
        lines.push(
          `### ${entry.question}`,
          `\u0421\u0442\u0430\u0442\u0443\u0441: ${entry.status}`,
          "",
          entry.detailed_answer || entry.short_answer,
          ""
        );
      }
    }
    return {
      ok: true,
      exportData: { json: JSON.stringify(payload, null, 2), markdown: lines.join("\n") }
    };
  }
  async function importResponse(request) {
    let sourceId = request.sourceId || "";
    let topicId = request.topicId || "";
    if (!sourceId || !topicId) {
      try {
        const tab = await activeTab();
        const settings = await getSettings();
        const source = await sourceForActiveUrl(tab.url || "", tab.title, settings.adapterName);
        sourceId ||= source.source_id;
        topicId ||= parseTopicId(source.topic_url);
      } catch {
      }
    }
    const result = importAiResponse(request.raw, sourceId, topicId);
    const storedReports = sourceId ? await getReports(sourceId) : [];
    const duplicate = storedReports.find((item) => item.raw_ai_response.trim() === request.raw.trim());
    if (duplicate) {
      result.duplicate = true;
      result.warnings.push(
        `\u0422\u0430\u043A\u043E\u0439 \u043E\u0442\u0432\u0435\u0442 \u0443\u0436\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D ${new Date(duplicate.created_at).toLocaleString()}. \u0412\u0442\u043E\u0440\u0430\u044F \u043A\u043E\u043F\u0438\u044F \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u0432\u0430\u043B\u0430\u0441\u044C.`
      );
      return { ok: true, importResult: result };
    }
    await putReport(result.report);
    const companionWarning = await syncCompanion("/api/reports", { report: result.report });
    if (companionWarning) result.warnings.push(companionWarning);
    return { ok: true, importResult: result };
  }
  async function runStartupProbe() {
    try {
      const [settings, sources] = await Promise.all([getSettings(), getAllSources()]);
      await runBackgroundCheck(sources, settings.backgroundCheckEnabled);
    } catch {
    }
  }
  async function handle(request) {
    switch (request.type) {
      case "get-settings":
        return { ok: true, settings: await getSettings() };
      case "save-settings": {
        const settings = await saveSettings(request.settings);
        void runStartupProbe();
        return { ok: true, settings };
      }
      case "get-state":
        return { ok: true, state: await makeState(request.url) };
      case "collect":
        return collect(request);
      case "create-package":
        return packet(request.mode);
      case "export-local":
        return exportLocal();
      case "reset-source":
        return resetActiveSource(request.url);
      case "clear-all-data":
        return clearAllLocalData();
      case "clean-service-posts":
        return cleanServicePosts(request.url);
      case "run-diagnostic":
        return runDiagnostic(request.url);
      case "search-local":
        return { ok: true, search: await searchLocal(request.query) };
      case "delete-report":
        await deleteReport(request.reportId);
        return { ok: true, message: "\u0412\u044B\u0436\u0438\u043C\u043A\u0430 \u0443\u0434\u0430\u043B\u0435\u043D\u0430." };
      case "import-ai":
        return importResponse(request);
      case "test-companion": {
        const settings = await getSettings();
        if (!settings.companionUrl) return { ok: false, error: "\u0410\u0434\u0440\u0435\u0441 companion \u043D\u0435 \u0437\u0430\u0434\u0430\u043D." };
        try {
          const response = await fetch(`${settings.companionUrl.replace(/\/$/, "")}/api/health`, {
            signal: AbortSignal.timeout(5e3)
          });
          if (!response.ok) return { ok: false, error: `Companion \u0432\u0435\u0440\u043D\u0443\u043B HTTP ${response.status}.` };
          return { ok: true, message: "Companion \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442." };
        } catch (error) {
          return {
            ok: false,
            error: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }
      case "open-options":
        await chrome.runtime.openOptionsPage();
        return { ok: true, message: "\u041E\u0442\u043A\u0440\u044B\u0442\u044B \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438." };
      case "open-source":
        return openSavedSource(request.sourceId);
      default:
        return { ok: false, error: "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430." };
    }
  }
  chrome.runtime.onInstalled.addListener(() => {
    void getSettings();
  });
  chrome.runtime.onStartup.addListener(() => {
    void runStartupProbe();
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void handle(message).then((response) => sendResponse(response)).catch(
      (error) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      })
    );
    return true;
  });
})();

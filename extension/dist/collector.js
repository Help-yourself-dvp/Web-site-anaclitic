"use strict";
(() => {
  // src/core/utils.ts
  function nowIso() {
    return (/* @__PURE__ */ new Date()).toISOString();
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
  var FORUM_DATE_PATTERN = /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}(?:\s*(?:,|г\.?)?\s*\d{1,2}:\d{2}(?::\d{2})?)?|\b\d{1,2}\s+[а-яa-z]{3,10}\.?\s+\d{4}(?:\s*(?:,|г\.?)?\s*\d{1,2}:\d{2}(?::\d{2})?)?|(?:^|[^\wа-яё])(?:сегодня|вчера|today|yesterday)\s*(?:,|\s)\s*\d{1,2}:\d{2}|\b\d{1,2}:\d{2}\b/gi;
  function firstDateLikeText(text) {
    const matches = text.match(FORUM_DATE_PATTERN) || [];
    const withTime = matches.find((item) => /\d{1,2}:\d{2}/.test(item));
    return (withTime || matches[0] || "").trim();
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
    const timeOnly = /^(\d{1,2}):(\d{2})$/.exec(text);
    if (timeOnly) {
      return localDate(
        reference.getFullYear(),
        reference.getMonth() + 1,
        reference.getDate(),
        Number.parseInt(timeOnly[1] || "0", 10),
        Number.parseInt(timeOnly[2] || "0", 10),
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
  function titleFromDocument(document2) {
    return normalizeWhitespace(document2.title || "") || "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F";
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
  function parsePostedAt(roots, selectors) {
    const list = Array.isArray(roots) ? roots : [roots];
    let unparsedRaw = "";
    for (const root of list) {
      const element = queryFirst(root, selectors);
      const elementTextValue = element ? normalizeWhitespace(element.getAttribute("datetime") || element.textContent || "") : "";
      const rootText = normalizeWhitespace(root.textContent || "");
      const raw = elementTextValue || firstDateLikeText(rootText);
      if (!raw) continue;
      const parsed = parseForumDate(raw);
      if (parsed) return parsed.toISOString();
      if (!unparsedRaw) unparsedRaw = raw;
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
  function findPostElements(document2, selectors) {
    const candidates = [];
    for (const selector of selectors) {
      for (const element of Array.from(document2.querySelectorAll(selector))) {
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
    const postedAt = parsePostedAt(
      dateRoot ? [dateRoot] : dateCandidateRoots(element, metadataRoot),
      config.dateSelectors
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
  function pageTitle(document2) {
    return titleFromDocument(document2);
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
  function sameTopicAnchors(document2, pageUrl) {
    return Array.from(document2.querySelectorAll("a[href]")).map((anchor) => ({ anchor, url: normalizeUrl(anchor.href, pageUrl) })).filter((item) => Boolean(item.url)).filter((item) => sameTopic(pageUrl, item.url));
  }
  function findPreviousPageUrl(document2, pageUrl) {
    const relPrevious = document2.querySelector('a[rel="prev"], link[rel="prev"]');
    const relUrl = relPrevious ? normalizeUrl(relPrevious.href, pageUrl) : null;
    if (relUrl && relUrl !== pageUrl) return relUrl;
    const sameTopic2 = sameTopicAnchors(document2, pageUrl);
    const currentOffset = offsetOf(pageUrl);
    const labelled = sameTopic2.filter(({ anchor }) => {
      const label = labelOf(anchor);
      return /предыдущ|назад|previous|\bprev\b|‹|←|\bback\b/.test(label);
    });
    const labelledWithLowerOffset = labelled.map((item) => ({ ...item, offset: offsetOf(item.url) })).filter(
      (item) => item.offset !== null && (currentOffset === null || item.offset < currentOffset)
    ).sort((a, b) => b.offset - a.offset);
    if (labelledWithLowerOffset[0]?.url && labelledWithLowerOffset[0].url !== pageUrl)
      return labelledWithLowerOffset[0].url;
    if (currentOffset !== null) {
      const lowerOffsets = sameTopic2.map((item) => ({ ...item, offset: offsetOf(item.url) })).filter((item) => item.offset !== null && item.offset < currentOffset).sort((a, b) => b.offset - a.offset);
      if (lowerOffsets[0]?.url && lowerOffsets[0].url !== pageUrl) return lowerOffsets[0].url;
    }
    return null;
  }
  function findLastPageUrl(document2, pageUrl) {
    const currentOffset = offsetOf(pageUrl);
    if (currentOffset === null) return null;
    const sameTopic2 = sameTopicAnchors(document2, pageUrl);
    const candidates = sameTopic2.map((item) => ({ ...item, offset: offsetOf(item.url) })).filter((item) => item.offset !== null && item.offset > currentOffset).sort((a, b) => b.offset - a.offset);
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
    parse(document2, url, options) {
      const candidates = findPostElements(document2, FOURPDA_POST_CONFIG.postSelectors);
      const elements = candidates.filter(isLikelyPost);
      const posts = elements.map((element) => {
        const mainCell = element.closest('td[id^="post-main-"], td[id*="post-main-"]');
        const metadataRoot = mainCell?.parentElement || element.closest("tr") || element;
        const rawId = element.getAttribute("data-post-id") || element.getAttribute("data-entry-id") || element.id || "";
        const postId = rawId.match(/(?:post|entry)[-_]?(\d+)/i)?.[1] || null;
        const authorRoot = postId ? document2.getElementById(`post-member-${postId}`) : null;
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
        title: pageTitle(document2),
        posts,
        previousUrl: findPreviousPageUrl(document2, url),
        lastUrl: findLastPageUrl(document2, url),
        diagnostics
      };
    }
    findPreviousUrl(document2, url) {
      return findPreviousPageUrl(document2, url);
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
    parse(document2, url, options) {
      const elements = findPostElements(document2, GENERIC_POST_CONFIG.postSelectors);
      const posts = elements.map((element) => extractPost(element, url, options, GENERIC_POST_CONFIG)).filter((post) => Boolean(post));
      const diagnostics = [];
      if (elements.length === 0) {
        diagnostics.push("\u042D\u0432\u0440\u0438\u0441\u0442\u0438\u043A\u0430 generic-forum \u043D\u0435 \u043D\u0430\u0448\u043B\u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0449\u0438\u0435\u0441\u044F \u0431\u043B\u043E\u043A\u0438 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439.");
      }
      if (posts.length < elements.length) {
        diagnostics.push(`\u0418\u0437 ${elements.length} \u043D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0445 \u0431\u043B\u043E\u043A\u043E\u0432 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0438\u0437\u0432\u043B\u0435\u0447\u044C ${posts.length} \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439.`);
      }
      return {
        title: pageTitle(document2),
        posts,
        previousUrl: findPreviousPageUrl(document2, url),
        lastUrl: findLastPageUrl(document2, url),
        diagnostics
      };
    }
    findPreviousUrl(document2, url) {
      return findPreviousPageUrl(document2, url);
    }
  };
  var GenericArticleAdapter = class {
    name = "generic-article";
    label = "Generic article (\u043E\u0434\u043D\u0430 \u0441\u0442\u0430\u0442\u044C\u044F)";
    canHandle(url) {
      return !/4pda\./i.test(url);
    }
    parse(document2, url, options) {
      const main = document2.querySelector('article, main, [role="main"], .article, .post-content');
      const diagnostics = [];
      if (!main) diagnostics.push("\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0431\u043B\u043E\u043A \u0441\u0442\u0430\u0442\u044C\u0438 (article/main).");
      const post = main ? extractPost(main, url, options, { ...GENERIC_POST_CONFIG, postSelectors: [] }) : null;
      return {
        title: pageTitle(document2),
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
    parse(document2, url, options) {
      const selection = options.manualSelection || window.getSelection();
      const text = selection?.toString().trim() || "";
      const diagnostics = [];
      if (!text) diagnostics.push("\u0412\u044B\u0434\u0435\u043B\u0438\u0442\u0435 \u0442\u0435\u043A\u0441\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u043F\u0435\u0440\u0435\u0434 \u0440\u0443\u0447\u043D\u044B\u043C \u0441\u0431\u043E\u0440\u043E\u043C.");
      const container = document2.createElement("article");
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
        title: pageTitle(document2),
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
  function checkpointMatches(post, checkpointKey, checkpointUrl, knownKeys = []) {
    return checkpointKey !== null && postKey(post) === checkpointKey || checkpointUrl !== null && post.canonical_post_url === checkpointUrl || knownKeys.includes(postKey(post));
  }

  // src/collector.ts
  function protectionFromHtml(url, status, html) {
    if (status === 403)
      return { protected: true, message: "\u0421\u0430\u0439\u0442 \u0432\u0435\u0440\u043D\u0443\u043B 403 Forbidden. \u0421\u0431\u043E\u0440 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D, \u043E\u0431\u0445\u043E\u0434 \u0437\u0430\u0449\u0438\u0442\u044B \u043D\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F." };
    if (status === 429)
      return { protected: true, message: "\u0421\u0430\u0439\u0442 \u0432\u0435\u0440\u043D\u0443\u043B 429 Too Many Requests. \u0423\u0432\u0435\u043B\u0438\u0447\u044C\u0442\u0435 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435." };
    if (status >= 400) return { protected: true, message: `\u0421\u0430\u0439\u0442 \u0432\u0435\u0440\u043D\u0443\u043B HTTP ${status}. \u0421\u0431\u043E\u0440 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D.` };
    let title = "";
    try {
      title = new DOMParser().parseFromString(html, "text/html").title.toLocaleLowerCase();
    } catch {
    }
    const sample = `${title}
${html.slice(0, 12e4).toLocaleLowerCase()}`;
    if (/cf-chl-|challenge-platform|g-recaptcha|hcaptcha|turnstile/.test(sample)) {
      return { protected: true, message: "\u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u0430 CAPTCHA \u0438\u043B\u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430. \u0421\u0431\u043E\u0440 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D." };
    }
    const parsedUrl = new URL(url);
    const isLoginUrl = /(^|[\s>/])(login|signin|auth)([\s</?]|$)/i.test(parsedUrl.pathname) || /^(auth|login|signin)$/i.test(parsedUrl.searchParams.get("act") || "");
    if (isLoginUrl || /<title>[^<]*(login|вход|авторизац)/i.test(sample)) {
      return { protected: true, message: "\u041E\u0442\u043A\u0440\u044B\u0442\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0432\u0445\u043E\u0434\u0430. \u0421\u0431\u043E\u0440 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D; \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0432\u0445\u043E\u0434 \u043D\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F." };
    }
    return { protected: false, message: null };
  }
  function protectionFromDocument(document2, url) {
    const html = document2.documentElement?.outerHTML || "";
    return protectionFromHtml(url, 200, html);
  }
  function samePageUrl(first, second) {
    try {
      const a = new URL(first);
      const b = new URL(second);
      a.hash = "";
      b.hash = "";
      return a.href === b.href;
    } catch {
      return false;
    }
  }
  function createPage(parsed, url) {
    return {
      url,
      title: parsed.title,
      posts: parsed.posts,
      previous_url: parsed.previousUrl,
      last_url: parsed.lastUrl,
      diagnostics: parsed.diagnostics
    };
  }
  function encodingFromResponse(response, bytes) {
    const contentType = response.headers.get("content-type") || "";
    const headerEncoding = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]?.toLowerCase();
    const prefix = new TextDecoder("windows-1251").decode(bytes.slice(0, 2e4));
    const pageEncoding = prefix.match(/(?:charset|ipb_var_charset)\s*[=:]\s*["']?([\w-]+)/i)?.[1]?.toLowerCase();
    if (pageEncoding === "windows-1251" || pageEncoding === "cp1251") return "windows-1251";
    if (pageEncoding === "koi8-r") return "koi8-r";
    if (headerEncoding === "windows-1251" || headerEncoding === "cp1251") return "windows-1251";
    if (headerEncoding === "koi8-r") return "koi8-r";
    try {
      if (/4pda\.(to|ru)$/i.test(new URL(response.url || "").hostname)) return "windows-1251";
    } catch {
    }
    return headerEncoding || "utf-8";
  }
  async function fetchDocument(url) {
    const response = await fetch(url, { credentials: "include", redirect: "follow" });
    const bytes = await response.arrayBuffer();
    let html;
    try {
      html = new TextDecoder(encodingFromResponse(response, bytes)).decode(bytes);
    } catch {
      html = new TextDecoder("utf-8").decode(bytes);
    }
    const protection = protectionFromHtml(response.url || url, response.status, html);
    if (protection.protected) {
      return {
        document: new DOMParser().parseFromString("<html></html>", "text/html"),
        url: response.url || url,
        protection
      };
    }
    return {
      document: new DOMParser().parseFromString(html, "text/html"),
      url: response.url || url,
      protection
    };
  }
  var DIAGNOSTIC_SELECTORS = [
    ".postwrapper",
    ".post_wrap",
    ".post",
    "article.post",
    "[data-post-id]",
    "[data-entry-id]",
    'div.postcolor[id^="post-"]',
    '[id^="entry"]',
    '[id^="post-"]',
    '[id^="post_"]',
    ".postcontent",
    ".post_content",
    ".post_content_text",
    ".post_body",
    ".postname",
    ".normalname",
    ".post_author",
    ".postdate",
    ".post_date",
    ".postdetails",
    ".mem-title",
    ".post-block",
    ".block-body",
    ".block-title",
    ".spoil",
    ".spoilbody",
    "blockquote"
  ];
  function truncate(value, maxLength) {
    return value.length <= maxLength ? value : `${value.slice(0, maxLength)}
\u2026 [\u043E\u0431\u0440\u0435\u0437\u0430\u043D\u043E]`;
  }
  function diagnosticHtml(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("script, style, noscript, iframe").forEach((node) => node.remove());
    return truncate(clone.outerHTML, 6e3);
  }
  function diagnosticClassName(element) {
    const classes = Array.from(element.classList).slice(0, 8).join(".");
    return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}${element.id ? `#${element.id}` : ""}`;
  }
  function makeDiagnosticReport(adapterName) {
    const protection = protectionFromDocument(document, location.href);
    const selectorCounts = Object.fromEntries(
      DIAGNOSTIC_SELECTORS.map((selector) => {
        try {
          return [selector, document.querySelectorAll(selector).length];
        } catch {
          return [selector, -1];
        }
      })
    );
    const classCounts = /* @__PURE__ */ new Map();
    for (const element of Array.from(document.querySelectorAll("[class]"))) {
      for (const className of Array.from(element.classList)) {
        if (/post|comment|message|entry|forum|content|author|user|date|spoil|quote/i.test(className)) {
          classCounts.set(className, (classCounts.get(className) || 0) + 1);
        }
      }
    }
    const relevantNodes = Array.from(
      document.querySelectorAll("[class], [id], [data-post-id], [data-entry-id]")
    ).filter(
      (element) => /post|comment|message|entry|forum|content|author|user|date|spoil|quote/i.test(
        `${element.className} ${element.id}`
      )
    ).filter((element) => (element.textContent || "").trim().length > 20).slice(0, 25);
    const linkSamples = Array.from(document.querySelectorAll("a[href]")).filter((anchor) => /findpost|showtopic|#entry|#post/i.test(anchor.href)).slice(0, 30).map((anchor) => ({
      text: normalizeWhitespace(anchor.textContent || ""),
      href: anchor.href,
      className: anchor.className
    }));
    const samples = {};
    for (const selector of DIAGNOSTIC_SELECTORS) {
      const elements = Array.from(document.querySelectorAll(selector)).slice(0, 3);
      if (elements.length) samples[selector] = elements.map(diagnosticHtml);
    }
    const report = {
      diagnostic_version: "1.0",
      generated_at: (/* @__PURE__ */ new Date()).toISOString(),
      url: location.href,
      title: document.title,
      ready_state: document.readyState,
      adapter: adapterName,
      protection,
      body_text_preview: truncate(normalizeWhitespace(document.body?.textContent || ""), 2e3),
      selector_counts: selectorCounts,
      relevant_class_counts: Object.fromEntries([...classCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100)),
      relevant_nodes: relevantNodes.map((element) => ({
        descriptor: diagnosticClassName(element),
        text_preview: truncate(normalizeWhitespace(element.textContent || ""), 300)
      })),
      link_samples: linkSamples,
      html_samples: samples,
      relevant_html_samples: relevantNodes.slice(0, 10).map(diagnosticHtml)
    };
    const json = JSON.stringify(report, null, 2);
    const markdown = [
      "# Forum Knowledge Base \u2014 \u0434\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043B\u043E\u0433",
      "",
      "> \u0412\u043D\u0438\u043C\u0430\u043D\u0438\u0435: \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442\u044B HTML \u043C\u043E\u0433\u0443\u0442 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u0442\u0435\u043A\u0441\u0442 \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B. \u041F\u0435\u0440\u0435\u0434 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u043E\u0439 \u0443\u0434\u0430\u043B\u0438\u0442\u0435 \u043B\u0438\u0447\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435, \u0435\u0441\u043B\u0438 \u043E\u043D\u0438 \u0442\u0430\u043C \u0435\u0441\u0442\u044C.",
      "",
      `- URL: ${report.url}`,
      `- \u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A: ${report.title}`,
      `- \u0410\u0434\u0430\u043F\u0442\u0435\u0440: ${report.adapter}`,
      `- \u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430: ${report.ready_state}`,
      `- \u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0437\u0430\u0449\u0438\u0442\u044B: ${protection.protected ? protection.message : "\u043D\u0435 \u043E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u0430"}`,
      "",
      "## \u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432 \u043F\u043E \u0441\u0435\u043B\u0435\u043A\u0442\u043E\u0440\u0430\u043C",
      ...Object.entries(selectorCounts).map(([selector, count]) => `- ${selector}: ${count}`),
      "",
      "## \u0427\u0430\u0441\u0442\u043E \u0432\u0441\u0442\u0440\u0435\u0447\u0430\u044E\u0449\u0438\u0435\u0441\u044F \u043A\u043B\u0430\u0441\u0441\u044B",
      ...Object.entries(report.relevant_class_counts).map(([className, count]) => `- ${className}: ${count}`),
      "",
      "## \u0421\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u043F\u043E\u0441\u0442\u044B/\u0442\u0435\u043C\u044B",
      "```json",
      JSON.stringify(linkSamples, null, 2),
      "```",
      "",
      "## \u041F\u0440\u0438\u043C\u0435\u0440\u044B HTML \u043F\u043E \u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u043C \u0441\u0435\u043B\u0435\u043A\u0442\u043E\u0440\u0430\u043C",
      ...Object.entries(samples).flatMap(([selector, html]) => [
        `### ${selector}`,
        "```html",
        ...html.map((sample) => sample.replace(/```/g, "` ` `")),
        "```"
      ]),
      "",
      "## \u041F\u0440\u0438\u043C\u0435\u0440\u044B \u0440\u0435\u043B\u0435\u0432\u0430\u043D\u0442\u043D\u044B\u0445 HTML-\u0431\u043B\u043E\u043A\u043E\u0432",
      "```html",
      ...report.relevant_html_samples.map((sample) => sample.replace(/```/g, "` ` `")),
      "```",
      "",
      "## JSON",
      "\u041F\u043E\u043B\u043D\u0430\u044F \u043C\u0430\u0448\u0438\u043D\u043E\u0447\u0438\u0442\u0430\u0435\u043C\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u0441\u044F \u0432 \u0441\u043E\u0441\u0435\u0434\u043D\u0435\u043C \u0444\u0430\u0439\u043B\u0435 `.json`."
    ].join("\n");
    return { json, markdown };
  }
  async function runCollector(options) {
    const source = options.source;
    const adapter = adapterByName(source.adapter_name);
    const maxPages = clampInteger(options.maxPages, 1, 50, source.configuration.maxPages);
    const delayMs = clampInteger(options.delayMs, 0, 3e4, source.configuration.delayMs);
    const pages = [];
    const diagnostics = [`\u0410\u0434\u0430\u043F\u0442\u0435\u0440: ${adapter.label}.`, `\u041B\u0438\u043C\u0438\u0442 \u0441\u0442\u0440\u0430\u043D\u0438\u0446: ${maxPages}.`];
    const initialProtection = protectionFromDocument(document, location.href);
    if (initialProtection.protected) {
      return {
        ok: false,
        mode: options.mode,
        source,
        pages,
        posts: [],
        stop_reason: "protection-detected",
        checkpoint_found: false,
        resume_url: null,
        diagnostics,
        protection_message: initialProtection.message
      };
    }
    let currentDocument = document;
    let currentUrl = location.href;
    const visited = /* @__PURE__ */ new Set();
    let checkpointFound = options.mode !== "new";
    let stopReason = options.mode === "history" ? "history-limit" : "no-previous-page";
    let protectionMessage = null;
    let resumeUrl = null;
    let setupFailed = false;
    const checkpointPageUrl = options.checkpointPageUrl ? normalizeUrl(options.checkpointPageUrl, location.href) : null;
    if (options.mode === "new" && options.resumePageUrl) {
      try {
        const resumePageUrl = normalizeUrl(options.resumePageUrl, location.href);
        if (resumePageUrl) {
          const resumed = await fetchDocument(resumePageUrl);
          if (resumed.protection.protected) {
            setupFailed = true;
            protectionMessage = resumed.protection.message;
            stopReason = "protection-detected";
          } else {
            currentDocument = resumed.document;
            currentUrl = resumed.url;
            diagnostics.push("\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u044E \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439 \u043D\u0435\u043F\u043E\u043B\u043D\u044B\u0439 \u043F\u0440\u043E\u0445\u043E\u0434 \u0441 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B.");
          }
        }
      } catch (error) {
        setupFailed = true;
        stopReason = "error";
        diagnostics.push(
          `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u0441 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    const shouldFindLatest = !options.resumePageUrl && !options.fromOpenPage && (options.mode === "history" || options.mode === "new" && options.startPageUrl);
    if (options.fromOpenPage) diagnostics.push("\u0418\u0434\u0443 \u043D\u0430\u0437\u0430\u0434 \u043E\u0442 \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B, \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0442\u0435\u043C\u044B \u043D\u0435 \u0438\u0449\u0435\u0442\u0441\u044F.");
    if (shouldFindLatest) {
      try {
        if (options.mode === "new" && options.startPageUrl) {
          const savedUrl = normalizeUrl(options.startPageUrl, location.href);
          if (savedUrl && savedUrl !== currentUrl) {
            const saved = await fetchDocument(savedUrl);
            if (saved.protection.protected) {
              setupFailed = true;
              protectionMessage = saved.protection.message;
              stopReason = "protection-detected";
            } else {
              currentDocument = saved.document;
              currentUrl = saved.url;
              diagnostics.push("\u0412\u0437\u044F\u0442\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0442\u043E\u0447\u043A\u0438 \u043E\u0442\u0441\u0447\u0451\u0442\u0430.");
            }
          }
        }
        if (!setupFailed) {
          const probe = adapter.parse(currentDocument, currentUrl, {
            sourceId: source.source_id,
            topicId: parseTopicId(source.topic_url),
            imageMode: source.configuration.imageMode,
            imageKeywords: source.configuration.imageKeywords,
            manualSelection: null
          });
          const lastUrl = normalizeUrl(probe.lastUrl || "", currentUrl);
          if (lastUrl && lastUrl !== currentUrl) {
            const latest = await fetchDocument(lastUrl);
            if (latest.protection.protected) {
              setupFailed = true;
              protectionMessage = latest.protection.message;
              stopReason = "protection-detected";
            } else {
              currentDocument = latest.document;
              currentUrl = latest.url;
              diagnostics.push("\u041D\u0430\u0439\u0434\u0435\u043D\u0430 \u0438 \u043E\u0442\u043A\u0440\u044B\u0442\u0430 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0442\u0435\u043C\u044B \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.");
            }
          }
        }
      } catch (error) {
        setupFailed = true;
        stopReason = "error";
        diagnostics.push(
          `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043D\u0430\u0439\u0442\u0438 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044E\u044E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    for (let pageIndex = 0; !setupFailed && pageIndex < maxPages; pageIndex += 1) {
      if (pageIndex > 0) await sleep(delayMs);
      if (visited.has(currentUrl)) {
        diagnostics.push("\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0443\u0436\u0435 \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043D\u0443\u044E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443; \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0434\u043B\u044F \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438.");
        stopReason = "error";
        break;
      }
      visited.add(currentUrl);
      const parsed = adapter.parse(currentDocument, currentUrl, {
        sourceId: source.source_id,
        topicId: parseTopicId(source.topic_url),
        imageMode: source.configuration.imageMode,
        imageKeywords: source.configuration.imageKeywords,
        manualSelection: pageIndex === 0 ? window.getSelection() : null
      });
      const page = createPage(parsed, currentUrl);
      pages.push(page);
      diagnostics.push(...parsed.diagnostics.map((item) => `\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u0430 ${pageIndex + 1}: ${item}`));
      if (page.posts.length === 0 && pageIndex === 0) {
        diagnostics.push("\u041D\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0430\u0434\u0430\u043F\u0442\u0435\u0440 \u0438\u043B\u0438 \u0440\u0430\u0437\u043C\u0435\u0442\u043A\u0443 \u0441\u0430\u0439\u0442\u0430.");
        stopReason = "unexpected-markup";
        break;
      }
      if (options.mode === "new" && page.posts.some(
        (post) => checkpointMatches(post, options.checkpointKey, options.checkpointUrl, options.knownKeys)
      )) {
        checkpointFound = true;
        stopReason = "checkpoint-found";
        break;
      }
      if (options.mode === "new" && checkpointPageUrl && samePageUrl(currentUrl, checkpointPageUrl)) {
        checkpointFound = true;
        stopReason = "checkpoint-found";
        diagnostics.push("\u0414\u043E\u0441\u0442\u0438\u0433\u043D\u0443\u0442\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0442\u043E\u0447\u043A\u0438 \u043E\u0442\u0441\u0447\u0451\u0442\u0430.");
        break;
      }
      if (options.mode === "checkpoint") {
        checkpointFound = true;
        stopReason = "checkpoint-found";
        break;
      }
      const previousUrl = normalizeUrl(page.previous_url || "", currentUrl);
      if (!previousUrl) {
        stopReason = options.mode === "new" && !checkpointFound ? "checkpoint-not-found" : "no-previous-page";
        break;
      }
      try {
        const fetched = await fetchDocument(previousUrl);
        if (fetched.protection.protected) {
          protectionMessage = fetched.protection.message;
          stopReason = "protection-detected";
          break;
        }
        currentDocument = fetched.document;
        currentUrl = fetched.url;
      } catch (error) {
        diagnostics.push(
          `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0443\u044E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443: ${error instanceof Error ? error.message : String(error)}`
        );
        stopReason = "error";
        break;
      }
    }
    if (options.mode === "new" && !checkpointFound && stopReason === "history-limit") {
      stopReason = "checkpoint-not-found";
    }
    if (options.mode === "new" && !checkpointFound && pages.length >= maxPages) {
      diagnostics.push(
        "Checkpoint \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445 \u043B\u0438\u043C\u0438\u0442\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446. \u041D\u043E\u0432\u044B\u0435 \u043F\u043E\u0441\u0442\u044B \u043D\u0435 \u0431\u0443\u0434\u0443\u0442 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u043A\u0430\u043A \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0435."
      );
      const lastPage = pages.at(-1);
      resumeUrl = lastPage ? normalizeUrl(lastPage.previous_url || "", lastPage.url) : null;
      if (resumeUrl) diagnostics.push("\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0437\u0430\u043F\u0443\u0441\u043A \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442 \u0441 \u0431\u043E\u043B\u0435\u0435 \u0441\u0442\u0430\u0440\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438.");
      stopReason = "checkpoint-not-found";
    }
    const posts = deduplicatePosts(pages.flatMap((page) => page.posts));
    return {
      ok: stopReason !== "protection-detected" && stopReason !== "unexpected-markup" && stopReason !== "error",
      mode: options.mode,
      source,
      pages,
      posts,
      stop_reason: stopReason,
      checkpoint_found: checkpointFound,
      resume_url: resumeUrl,
      diagnostics,
      protection_message: protectionMessage
    };
  }
  var loadedFlag = "__fkbCollectorLoaded";
  var collectorWindow = window;
  if (!collectorWindow[loadedFlag]) {
    collectorWindow[loadedFlag] = true;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const request = message;
      if (request.type === "run-diagnostic") {
        sendResponse(makeDiagnosticReport(request.adapterName || "unknown"));
        return false;
      }
      if (request.type !== "run-collector" || !request.options) return false;
      runCollector(request.options).then((result) => sendResponse(result)).catch((error) => {
        sendResponse({
          ok: false,
          mode: request.options?.mode || "new",
          source: request.options?.source,
          pages: [],
          posts: [],
          stop_reason: "error",
          checkpoint_found: false,
          resume_url: null,
          diagnostics: [error instanceof Error ? error.message : String(error)],
          protection_message: null
        });
      });
      return true;
    });
  }
})();

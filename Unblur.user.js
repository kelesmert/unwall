// ==UserScript==
// @name         Unblur
// @namespace    https://github.com/kelesmert/unwall
// @version      0.1.0
// @description  Detects revealable page content and shows it only with user approval.
// @author       Mert Keles
// @license      GPL-3.0-or-later
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @noframes
// @grant        GM_registerMenuCommand
// @grant        GM.registerMenuCommand
// ==/UserScript==

(() => {
  "use strict";

  window.__unblur?.stop?.();

  const APP_NAME = "Unblur";
  const PROMPT_THRESHOLD = 72;
  const STRUCTURED_BODY_MIN_LENGTH = 700;
  const STRUCTURED_BODY_RATIO = 1.55;
  const HIDDEN_ARTICLE_MIN_LENGTH = 700;
  const SERVER_PAYWALL_THRESHOLD = 70;
  const COVER_OVERLAY_THRESHOLD = 50;
  const DEFAULT_OBSERVER_MS = 9000;
  const CARD_FADE_MS = 1000;
  const UNDO_CARD_MS = 6000;
  const UNBLUR_ROOT_SELECTOR = "[data-unblur-root]";
  const UNBLUR_Z_INDEX = "2147483647";

  const protectedSelector = [
    "iframe",
    "video",
    "audio",
    "canvas",
    "object",
    "embed",
    "form",
    "input",
    "textarea",
    "select",
    '[type="password"]',
    '[type="file"]'
  ].join(",");

  const protectedTokenPattern =
    /(?:captcha|recaptcha|hcaptcha|turnstile|login|signin|sign-in|sign_in|password|payment|checkout|billing|upload|video-player|videoplayer|youtube|pdf-viewer|document-viewer|google-map|leaflet|cookie|consent|privacy)/i;

  const contentTokenPattern =
    /(?:article|paragraph|content|story|post|entry|body|text|premium|subscriber|locked|gated|metered|paywall|blur)/i;

  const barrierTokenPattern =
    /(?:subscribe|subscription|subscriber|paywall|pay\s*wall|barrier|continue reading|keep reading|read more|full article|full story|full transcript|transcript and summary|premium|member|membership|sign in|log in|login|register|metered|locked|access|tam transkript|özet|ozet|ücretsiz deneme|ucretsiz deneme|deneme başlat|deneme baslat|ücretsiz deneyin|ucretsiz deneyin)/i;

  const strongBarrierTokenPattern =
    /(?:paywall|continue reading|full article|full story|full transcript|transcript and summary|rest (?:is )?for subscribers|article left to read|subscribe (?:now )?to (?:read|continue)|subscribe to continue|subscribers only|for subscribers only|premium article|metered|locked|abone|abonelik|okumaya devam|tamam[ıi]n[ıi] oku|tam transkript|(?:özet|ozet)(?:'i)? (?:görmek|gormek)|ücretsiz deneme başlat|ucretsiz deneme baslat|ücretsiz deneyin|ucretsiz deneyin)/i;

  const nonArticleHiddenTokenPattern =
    /(?:menu|nav|burger|footer|header|comment|comments|account|connexion|login|signin|sign-in|capping|ad|advert|related|recommend|share|newsletter|cookie|consent|privacy|social|search)/i;

  const navigationOverlayTokenPattern =
    /(?:menu|nav|navbar|header|footer|breadcrumb|toolbar|tabbar|sidebar|search|share|social|cookie|consent|privacy|login|signin|sign-in|account)/i;

  const messagesByLanguage = {
    en: {
      active: "Unblur is active.",
      blurTitle: "Unblur detected blurred page content",
      blurDescription: "Do you want to reveal the blurred text-like content on this page?",
      articleTitle: "Unblur detected embedded article text",
      articleDescription:
        "This page includes a longer article body in structured data. Do you want to show it on the page?",
      hiddenTitle: "Unblur detected hidden article text",
      hiddenDescription:
        "This page appears to include hidden article text. Do you want to show it on the page?",
      coverTitle: "Unblur detected a content cover",
      coverDescription:
        "This page appears to have a client-side card or overlay covering content. Do you want to hide the cover?",
      serverTitle: "Unblur detected a server-side paywall",
      serverDescription:
        "The remaining content does not appear to be present in this page. No blur, embedded article body, or hidden article text was found to reveal.",
      reveal: "Reveal",
      ok: "OK",
      ignore: "Ignore",
      revealed: "Unblur revealed blurred content.",
      articleRevealed: "Unblur showed the embedded article text.",
      hiddenRevealed: "Unblur showed hidden article text.",
      coverRemoved: "Unblur hid the content cover.",
      undo: "Undo",
      restored: "Unblur restored the page changes.",
      noDetection: "Unblur did not find revealable content candidates.",
      scanNow: "Scan for revealable content",
      diagnostics: "Show diagnostics",
      tableConfidence: "Confidence",
      tableCandidateCount: "Candidates",
      tableRevealedCount: "Revealed elements",
      tableMode: "Detection type",
      tableVisibleLength: "Visible text length",
      tableBodyLength: "Embedded body length",
      tableBarrierCount: "Barriers",
      tableHiddenCount: "Hidden article candidates",
      tableReasons: "Reasons"
    },
    tr: {
      active: "Unblur aktif.",
      blurTitle: "Unblur bulanık sayfa içeriği algıladı",
      blurDescription: "Bu sayfadaki bulanık metin benzeri içeriği açmak ister misiniz?",
      articleTitle: "Unblur gömülü makale metni algıladı",
      articleDescription:
        "Bu sayfada yapılandırılmış verinin içinde daha uzun bir makale metni var. Sayfada göstermeyi ister misiniz?",
      hiddenTitle: "Unblur gizli makale metni algıladı",
      hiddenDescription:
        "Bu sayfada gizli makale metni var gibi görünüyor. Sayfada göstermeyi ister misiniz?",
      coverTitle: "Unblur içerik kapatan bir kart algıladı",
      coverDescription:
        "Bu sayfada içeriğin üstünü kapatan istemci tarafı bir kart veya katman var gibi görünüyor. Gizlemek ister misiniz?",
      serverTitle: "Unblur sunucu tarafı paywall algıladı",
      serverDescription:
        "Kalan içerik bu sayfaya gönderilmemiş görünüyor. Açılabilecek blur, gömülü makale gövdesi veya gizli makale metni bulunamadı.",
      reveal: "Aç",
      ok: "Tamam",
      ignore: "Yok say",
      revealed: "Unblur bulanık içeriği açtı.",
      articleRevealed: "Unblur gömülü makale metnini gösterdi.",
      hiddenRevealed: "Unblur gizli makale metnini gösterdi.",
      coverRemoved: "Unblur içerik kapatan katmanı gizledi.",
      undo: "Geri al",
      restored: "Unblur sayfa değişikliklerini geri aldı.",
      noDetection: "Unblur açılabilir içerik adayı bulamadı.",
      scanNow: "Açılabilir içeriği tara",
      diagnostics: "Teşhis bilgilerini göster",
      tableConfidence: "Güven",
      tableCandidateCount: "Aday",
      tableRevealedCount: "Açılan element",
      tableMode: "Algılama türü",
      tableVisibleLength: "Görünür metin uzunluğu",
      tableBodyLength: "Gömülü metin uzunluğu",
      tableBarrierCount: "Bariyer",
      tableHiddenCount: "Gizli makale adayı",
      tableReasons: "Nedenler"
    }
  };

  const language = detectLanguage();
  const messages =
    messagesByLanguage[language] ||
    messagesByLanguage.en;

  const state = {
    observer: null,
    observerTimer: null,
    scheduledScan: false,
    suppressObserver: false,
    cardHost: null,
    cardShadow: null,
    cardEscapeHandler: null,
    ignoredSignatures: new Set(),
    lastDetection: null,
    lastRestore: null,
    stopped: false
  };

  function detectLanguage() {
    const browserLanguage =
      navigator.languages?.[0] ||
      navigator.language ||
      navigator.userLanguage ||
      "en";

    const language =
      String(browserLanguage).toLowerCase().split("-")[0];

    return ["en", "tr"].includes(language)
      ? language
      : "en";
  }

  function isInUnblurUI(element) {
    return Boolean(element?.closest?.(UNBLUR_ROOT_SELECTOR));
  }

  function normalizedText(element) {
    return (element.innerText || element.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizedSignalText(element) {
    if (!(element instanceof Element)) {
      return "";
    }

    const parts = [
      element.tagName,
      element.id,
      element.className,
      element.getAttribute("name"),
      element.getAttribute("aria-label"),
      element.getAttribute("role"),
      element.getAttribute("itemprop")
    ];

    return String(parts.join(" "))
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isVisible(element) {
    if (!(element instanceof Element) || isInUnblurUI(element)) {
      return false;
    }

    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || 1) > 0.02 &&
      rect.width > 8 &&
      rect.height > 8
    );
  }

  function numericZIndex(element) {
    const value = parseInt(getComputedStyle(element).zIndex, 10);
    return Number.isFinite(value) ? value : 0;
  }

  function isLikelyPageChrome(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    try {
      if (
        element.closest?.(
          'header, nav, [role="banner"], [role="navigation"]'
        )
      ) {
        return true;
      }
    } catch {}

    const rect = element.getBoundingClientRect();
    const text = normalizedText(element);
    const signalText = normalizedSignalText(element);
    const topBar =
      rect.top <= 140 &&
      rect.height <= 150 &&
      rect.width >= innerWidth * 0.55;

    if (!topBar || hasContentContext(element)) {
      return false;
    }

    const interactiveCount =
      element.querySelectorAll?.('a, button, [role="button"]').length || 0;

    const chromeText =
      /(?:menu|nav|navbar|header|language|login|sign in|sign-in|try free|free trial|ücretsiz|dene|clipto)/i
        .test(`${signalText} ${text}`);

    return interactiveCount > 0 || chromeText;
  }

  function rectsOverlap(first, second) {
    return (
      first.left < second.right &&
      first.right > second.left &&
      first.top < second.bottom &&
      first.bottom > second.top
    );
  }

  function hasProtectedToken(element) {
    const nodes = [element];

    try {
      nodes.push(
        ...[...element.querySelectorAll("[class],[id],[name],[aria-label],[role]")]
          .slice(0, 80)
      );
    } catch {}

    return nodes.some(node =>
      protectedTokenPattern.test(normalizedSignalText(node))
    );
  }

  function containsProtectedContent(element) {
    if (!(element instanceof Element)) {
      return true;
    }

    try {
      if (
        element.matches?.(protectedSelector) ||
        element.querySelector?.(protectedSelector)
      ) {
        return true;
      }
    } catch {}

    return hasProtectedToken(element);
  }

  function getBlurInfo(element) {
    const style = getComputedStyle(element);
    const valueOf = property =>
      style.getPropertyValue(property) ||
      style[property] ||
      "";

    const properties = [
      ["filter", valueOf("filter")],
      ["-webkit-filter", valueOf("-webkit-filter")],
      ["backdrop-filter", valueOf("backdrop-filter")],
      ["-webkit-backdrop-filter", valueOf("-webkit-backdrop-filter")]
    ].filter(([, value]) => /blur\(/i.test(String(value || "")));

    return {
      properties,
      hasOwnBlur: properties.some(([property]) =>
        property === "filter" ||
        property === "-webkit-filter"
      ),
      hasBackdropBlur: properties.some(([property]) =>
        property === "backdrop-filter" ||
        property === "-webkit-backdrop-filter"
      ),
      text: properties
        .map(([property, value]) => `${property}: ${value}`)
        .join(" | ")
    };
  }

  function hasContentContext(element) {
    let current = element;
    let depth = 0;

    while (
      current &&
      current !== document.body &&
      current !== document.documentElement &&
      depth < 6
    ) {
      const tag = current.tagName?.toLowerCase();

      if (
        tag === "article" ||
        tag === "main" ||
        current.getAttribute?.("role") === "main" ||
        contentTokenPattern.test(normalizedSignalText(current))
      ) {
        return true;
      }

      current = current.parentElement;
      depth += 1;
    }

    return false;
  }

  function getCandidateScore(element, blurInfo) {
    const reasons = [];
    let score = 0;

    const rect = element.getBoundingClientRect();
    const text = normalizedText(element);
    const signalText = normalizedSignalText(element);
    const tag = element.tagName.toLowerCase();
    const area = rect.width * rect.height;

    if (blurInfo.hasOwnBlur) {
      score += 42;
      reasons.push("own-filter-blur");
    }

    if (blurInfo.hasBackdropBlur) {
      score += 18;
      reasons.push("backdrop-filter-blur");
    }

    if (text.length >= 40) {
      score += 24;
      reasons.push("readable-text");
    }

    if (text.length >= 120) {
      score += 8;
      reasons.push("substantial-text");
    }

    if (rect.width >= Math.min(280, innerWidth * 0.35) && rect.height >= 28) {
      score += 10;
      reasons.push("content-sized");
    }

    if (area >= 12000) {
      score += 6;
      reasons.push("meaningful-area");
    }

    if (["p", "li", "ul", "ol", "section", "article", "div"].includes(tag)) {
      score += 8;
      reasons.push("content-like-tag");
    }

    if (hasContentContext(element)) {
      score += 14;
      reasons.push("content-context");
    }

    if (contentTokenPattern.test(signalText)) {
      score += 10;
      reasons.push("content-token");
    }

    const fixedOrSticky = ["fixed", "sticky"].includes(
      getComputedStyle(element).position
    );

    const looksLikeFullScreenOverlay =
      fixedOrSticky &&
      rect.width >= innerWidth * 0.85 &&
      rect.height >= innerHeight * 0.85;

    if (looksLikeFullScreenOverlay) {
      score -= 40;
      reasons.push("fullscreen-overlay-penalty");
    }

    if (containsProtectedContent(element)) {
      score = 0;
      reasons.push("protected-content");
    }

    return {
      score: Math.max(0, Math.min(score, 100)),
      reasons
    };
  }

  function candidateGroupKey(candidate) {
    const className = String(candidate.element.className || "")
      .replace(/\b[a-z0-9]{10,}\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);

    return [
      candidate.element.tagName.toLowerCase(),
      candidate.blurInfo.text,
      className
    ].join(":");
  }

  function boostRepeatedCandidates(candidates) {
    const groupCounts = new Map();

    for (const candidate of candidates) {
      const key = candidateGroupKey(candidate);
      groupCounts.set(key, (groupCounts.get(key) || 0) + 1);
    }

    return candidates.map(candidate => {
      const count = groupCounts.get(candidateGroupKey(candidate)) || 1;

      if (count < 2) {
        return candidate;
      }

      const repeatBoost = count >= 5 ? 12 : 8;

      return {
        ...candidate,
        confidence: Math.min(candidate.confidence + repeatBoost, 100),
        reasons: [...candidate.reasons, "repeated-blur-pattern"]
      };
    });
  }

  function detectBlurredContent() {
    const elements = [...document.querySelectorAll("body *")];
    const rawCandidates = [];

    for (const element of elements) {
      if (!isVisible(element)) {
        continue;
      }

      const blurInfo = getBlurInfo(element);

      if (blurInfo.properties.length === 0) {
        continue;
      }

      if (blurInfo.hasBackdropBlur && !blurInfo.hasOwnBlur) {
        continue;
      }

      const text = normalizedText(element);
      const rect = element.getBoundingClientRect();

      if (!text || text.length < 20 || rect.width < 120 || rect.height < 18) {
        continue;
      }

      const scored = getCandidateScore(element, blurInfo);

      if (scored.score <= 0) {
        continue;
      }

      rawCandidates.push({
        element,
        blurInfo,
        confidence: scored.score,
        reasons: scored.reasons,
        text: text.slice(0, 180),
        rect: {
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      });
    }

    const candidates = boostRepeatedCandidates(rawCandidates)
      .filter(candidate => candidate.confidence >= PROMPT_THRESHOLD);

    const confidence =
      candidates.length > 0
        ? Math.max(...candidates.map(candidate => candidate.confidence))
        : 0;

    const reasons = [
      ...new Set(candidates.flatMap(candidate => candidate.reasons))
    ];

    const detection = {
      kind: "blurred-content",
      found: candidates.length > 0,
      confidence,
      candidates,
      reasons,
      signature: makeSignature(candidates)
    };

    return detection;
  }

  function getCoverOverlayScore(element, container) {
    const reasons = [];
    let score = 0;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const text = normalizedText(element);
    const signalText = normalizedSignalText(element);
    const position = style.position;
    const articleRect = container?.element?.getBoundingClientRect?.();
    const blurInfo = getBlurInfo(element);
    const positioned = ["fixed", "sticky", "absolute"].includes(position);
    const highStack = numericZIndex(element) >= 5;
    const sizeable =
      rect.width >= Math.min(280, innerWidth * 0.45) &&
      rect.height >= 40;
    const notHuge =
      rect.height <= innerHeight * 0.75 &&
      text.length < 1800;
    const overlapsArticle =
      articleRect
        ? rectsOverlap(rect, articleRect)
        : hasContentContext(element);
    const strongBarrier = strongBarrierTokenPattern.test(
      `${signalText} ${text}`
    );

    if (isLikelyPageChrome(element)) {
      return {
        score: 0,
        reasons: ["page-chrome"]
      };
    }

    if (blurInfo.hasBackdropBlur && !blurInfo.hasOwnBlur) {
      score += 30;
      reasons.push("backdrop-blur-cover");
    }

    if (/backdrop\s*blur|backdrop-blur/i.test(signalText)) {
      score += 8;
      reasons.push("backdrop-blur-token");
    }

    if (positioned) {
      score += 18;
      reasons.push("positioned-cover");
    }

    if (highStack) {
      score += 8;
      reasons.push("stacked-cover");
    }

    if (sizeable && notHuge) {
      score += 12;
      reasons.push("cover-sized");
    }

    if (overlapsArticle) {
      score += 18;
      reasons.push("overlaps-content");
    }

    if (text.length >= 20) {
      score += 10;
      reasons.push("cover-text");
    }

    if (strongBarrier) {
      score += 24;
      reasons.push("barrier-text");
    }

    if (contentTokenPattern.test(signalText)) {
      score += 8;
      reasons.push("content-token");
    }

    if (navigationOverlayTokenPattern.test(signalText)) {
      score -= 45;
      reasons.push("navigation-overlay-penalty");
    }

    if (
      rect.top <= 120 &&
      rect.height <= 120 &&
      !strongBarrier
    ) {
      score -= 28;
      reasons.push("top-navigation-penalty");
    }

    if (containsProtectedContent(element)) {
      score = 0;
      reasons.push("protected-content");
    }

    return {
      score: Math.max(0, Math.min(score, 100)),
      reasons
    };
  }

  function detectCoverOverlay() {
    const container = findArticleContentContainer();
    const candidates = [...document.querySelectorAll("body *")]
      .filter(isVisible)
      .filter(element => !isInUnblurUI(element))
      .map(element => {
        const scored = getCoverOverlayScore(element, container);
        const rect = element.getBoundingClientRect();

        return {
          element,
          confidence: scored.score,
          reasons: scored.reasons,
          text: normalizedText(element).slice(0, 180),
          rect: {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            top: Math.round(rect.top),
            left: Math.round(rect.left)
          }
        };
      })
      .filter(candidate => candidate.confidence >= COVER_OVERLAY_THRESHOLD)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    const confidence =
      candidates.length > 0
        ? Math.max(...candidates.map(candidate => candidate.confidence))
        : 0;

    const reasons = [
      ...new Set(candidates.flatMap(candidate => candidate.reasons))
    ];

    return {
      kind: "cover-overlay",
      found: candidates.length > 0,
      confidence,
      candidates,
      reasons,
      signature: [
        "cover-overlay",
        location.hostname,
        candidates
          .map(candidate => {
            const element = candidate.element;
            return [
              element.tagName,
              element.id,
              String(element.className || "").slice(0, 80),
              candidate.rect.width,
              candidate.rect.height,
              candidate.rect.top
            ].join(":");
          })
          .join("|")
      ].join(":")
    };
  }

  function detect() {
    const revealableDetections = [
      detectBlurredContent(),
      detectStructuredArticle(),
      detectHiddenArticleContent()
    ].filter(detection => detection.found);

    const revealableDetection =
      revealableDetections.sort((a, b) => b.confidence - a.confidence)[0];

    const detection =
      revealableDetection ||
      detectServerSidePaywall() ||
      detectCoverOverlay() ||
      {
        kind: "none",
        found: false,
        confidence: 0,
        candidates: [],
        reasons: [],
        signature: ""
      };

    state.lastDetection = detection;
    return detection;
  }

  function parseJsonLdScript(script) {
    try {
      return JSON.parse(script.textContent || "null");
    } catch {
      return null;
    }
  }

  function flattenJsonLd(value, output = []) {
    if (!value || typeof value !== "object") {
      return output;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        flattenJsonLd(item, output);
      }

      return output;
    }

    output.push(value);

    for (const nestedValue of Object.values(value)) {
      if (nestedValue && typeof nestedValue === "object") {
        flattenJsonLd(nestedValue, output);
      }
    }

    return output;
  }

  function decodeHtmlEntities(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = String(value || "");
    return textarea.value;
  }

  function normalizeArticleBody(value) {
    return decodeHtmlEntities(value)
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getStructuredArticleBodies() {
    const scripts = [
      ...document.querySelectorAll('script[type="application/ld+json"]')
    ];

    return scripts
      .flatMap(script => flattenJsonLd(parseJsonLdScript(script)))
      .filter(node => typeof node.articleBody === "string")
      .map(node => ({
        body: normalizeArticleBody(node.articleBody),
        headline: normalizeArticleBody(node.headline || ""),
        type: Array.isArray(node["@type"])
          ? node["@type"].join(", ")
          : String(node["@type"] || "")
      }))
      .filter(entry => entry.body.length >= STRUCTURED_BODY_MIN_LENGTH)
      .sort((a, b) => b.body.length - a.body.length);
  }

  function findArticleContentContainer() {
    const selectors = [
      '[itemprop="articleBody"]',
      '[class*="article-content"]',
      '[class*="article_content"]',
      '[class*="article-body"]',
      '[class*="article_body"]',
      '[class*="story-body"]',
      '[class*="story_content"]',
      '[class*="entry-content"]',
      '[class*="post-content"]',
      '[class*="content-body"]',
      '[class*="content_block"]',
      '[class*="content-block"]',
      "article",
      "main"
    ].join(",");

    const candidates = [...document.querySelectorAll(selectors)]
      .filter(element => element instanceof Element)
      .filter(element => !isInUnblurUI(element))
      .map(element => {
        const text = normalizedText(element);
        const rect = element.getBoundingClientRect();
        const signalText = normalizedSignalText(element);
        const paragraphs = element.querySelectorAll("p").length;
        let score = 0;

        if (text.length >= 100) score += 26;
        if (text.length >= 250) score += 10;
        if (text.length <= 2000) score += 6;
        if (rect.width >= Math.min(300, innerWidth * 0.35)) score += 8;
        if (paragraphs > 0) score += Math.min(paragraphs * 7, 28);
        if (contentTokenPattern.test(signalText)) score += 24;
        if (element.matches?.('[itemprop="articleBody"]')) score += 16;
        if (element.matches?.("article")) score += 12;
        if (element.matches?.("main")) score += 6;

        return {
          element,
          text,
          paragraphs,
          score
        };
      })
      .filter(candidate => candidate.text.length >= 80)
      .sort((a, b) => b.score - a.score);

    return candidates[0] || null;
  }

  function findBarrierElements() {
    const selectors = [
      '[class*="subscribe"]',
      '[class*="subscrib"]',
      '[class*="paywall"]',
      '[class*="barrier"]',
      '[class*="barrirer"]',
      '[class*="meter"]',
      '[class*="premium"]',
      '[class*="member"]',
      '[class*="locked"]',
      '[id*="subscribe"]',
      '[id*="subscrib"]',
      '[id*="paywall"]',
      '[id*="barrier"]',
      '[id*="premium"]',
      '[id*="member"]'
    ].join(",");

    const textSelectors = [
      "section",
      "aside",
      "article",
      "div",
      "p",
      "h1",
      "h2",
      "h3",
      "button",
      "a"
    ].join(",");

    const selectorCandidates = [...document.querySelectorAll(selectors)];
    const textCandidates = [...document.querySelectorAll(textSelectors)]
      .filter(element => {
        const text = normalizedText(element);

        return (
          text.length >= 20 &&
          text.length <= 2600 &&
          barrierTokenPattern.test(
            `${normalizedSignalText(element)} ${text}`
          )
        );
      });

    return uniqueElements([...selectorCandidates, ...textCandidates])
      .filter(element => element instanceof Element)
      .filter(isVisible)
      .filter(element => !isInUnblurUI(element))
      .filter(element => !isLikelyPageChrome(element))
      .filter(element => {
        const rect = element.getBoundingClientRect();
        const tag = element.tagName.toLowerCase();
        const text = normalizedText(element);
        const signalText = [
          normalizedSignalText(element),
          text
        ].join(" ");
        const hasBarrierChild = [...element.children]
          .slice(0, 25)
          .some(child =>
            barrierTokenPattern.test([
              normalizedSignalText(child),
              normalizedText(child)
            ].join(" "))
          );

        if (!barrierTokenPattern.test(signalText)) {
          return false;
        }

        if (hasBarrierChild && text.length > 360) {
          return false;
        }

        if (
          (tag === "a" || tag === "button") &&
          text.length < 35 &&
          rect.width < 220 &&
          rect.height < 80
        ) {
          return false;
        }

        return text.length >= 25 || rect.width * rect.height >= 5000;
      });
  }

  function findFadeElements(container) {
    const roots = [document];

    if (container?.element?.parentElement) {
      roots.push(container.element.parentElement);
    }

    const selectors = [
      '[class*="gradient"]',
      '[class*="fade"]',
      '[class*="shadow-patch"]',
      '[class*="shadow"]',
      '[class*="teaser"]',
      '[id*="gradient"]',
      '[id*="fade"]'
    ].join(",");

    return [...new Set(
      roots.flatMap(root => {
        try {
          return [...root.querySelectorAll(selectors)];
        } catch {
          return [];
        }
      })
    )]
      .filter(element => element instanceof Element)
      .filter(isVisible)
      .filter(element => !isInUnblurUI(element))
      .filter(element => {
        const style = getComputedStyle(element);
        const text = normalizedText(element);
        const rect = element.getBoundingClientRect();
        const hasGradient =
          /gradient/i.test(style.backgroundImage || "") ||
          /gradient|fade|shadow|teaser/i.test(normalizedSignalText(element));

        return hasGradient && (text.length < 120 || rect.height <= 180);
      });
  }

  function hashText(value) {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }

    return String(hash);
  }

  function uniqueElements(elements) {
    return [...new Set(elements)].filter(Boolean);
  }

  function detectStructuredArticle() {
    const [articleBody] = getStructuredArticleBodies();

    if (!articleBody) {
      return {
        kind: "structured-article",
        found: false,
        confidence: 0,
        candidates: [],
        reasons: [],
        signature: ""
      };
    }

    const container = findArticleContentContainer();

    if (!container) {
      return {
        kind: "structured-article",
        found: false,
        confidence: 0,
        candidates: [],
        reasons: [],
        signature: ""
      };
    }

    const barrierElements = findBarrierElements();
    const fadeElements = findFadeElements(container);
    const visibleLength = container.text.length;
    const bodyLength = articleBody.body.length;
    const ratio = bodyLength / Math.max(visibleLength, 1);
    const reasons = [];
    let confidence = 0;

    if (bodyLength >= STRUCTURED_BODY_MIN_LENGTH) {
      confidence += 38;
      reasons.push("structured-article-body");
    }

    if (ratio >= STRUCTURED_BODY_RATIO) {
      confidence += 24;
      reasons.push("embedded-body-longer-than-visible-content");
    }

    if (container.paragraphs <= 3 && bodyLength >= 1200) {
      confidence += 12;
      reasons.push("short-visible-teaser");
    }

    if (barrierElements.length > 0) {
      confidence += 18;
      reasons.push("subscription-or-paywall-barrier");
    }

    if (fadeElements.length > 0) {
      confidence += 8;
      reasons.push("fade-or-gradient");
    }

    if (hasContentContext(container.element)) {
      confidence += 8;
      reasons.push("content-context");
    }

    const found =
      confidence >= PROMPT_THRESHOLD &&
      ratio >= STRUCTURED_BODY_RATIO;

    return {
      kind: "structured-article",
      found,
      confidence: Math.min(confidence, 100),
      candidates: [],
      reasons,
      signature: [
        "structured-article",
        location.hostname,
        hashText(articleBody.body),
        visibleLength,
        bodyLength
      ].join(":"),
      structuredArticle: {
        body: articleBody.body,
        headline: articleBody.headline,
        type: articleBody.type,
        container: container.element,
        visibleLength,
        bodyLength,
        barrierElements,
        fadeElements
      }
    };
  }

  function findStrongBarrierElements() {
    return findBarrierElements().filter(element =>
      strongBarrierTokenPattern.test([
        normalizedSignalText(element),
        normalizedText(element)
      ].join(" "))
    );
  }

  function findHiddenArticleTextCandidates(container = null) {
    const selectors = [
      '[itemprop="articleBody"]',
      '[class*="article-content"]',
      '[class*="article_content"]',
      '[class*="article-body"]',
      '[class*="article_body"]',
      '[class*="story-body"]',
      '[class*="story_content"]',
      '[class*="entry-content"]',
      '[class*="post-content"]',
      '[class*="content-body"]',
      '[class*="content_block"]',
      '[class*="content-block"]',
      '[class*="paragraph"]',
      '[class*="body"]',
      "article",
      "main"
    ].join(",");

    const roots = new Set([document]);

    if (container?.element?.parentElement) {
      roots.add(container.element.parentElement);
    }

    const elements = [...roots].flatMap(root => {
      try {
        return [...root.querySelectorAll(selectors)];
      } catch {
        return [];
      }
    });

    return uniqueElements(elements)
      .filter(element => element instanceof Element)
      .filter(element => !isInUnblurUI(element))
      .filter(element => !isVisible(element))
      .filter(element => !containsProtectedContent(element))
      .map(element => {
        const text = normalizedText(element);
        const signalText = normalizedSignalText(element);
        const paragraphs = element.querySelectorAll("p").length;
        const rect = element.getBoundingClientRect();

        return {
          element,
          text,
          signalText,
          paragraphs,
          rect: {
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        };
      })
      .filter(candidate =>
        candidate.text.length >= HIDDEN_ARTICLE_MIN_LENGTH &&
        !nonArticleHiddenTokenPattern.test(candidate.signalText)
      )
      .filter(candidate =>
        hasContentContext(candidate.element) ||
        contentTokenPattern.test(candidate.signalText)
      )
      .sort((a, b) => b.text.length - a.text.length);
  }

  function detectHiddenArticleContent() {
    const container = findArticleContentContainer();
    const barrierElements = findStrongBarrierElements();
    const candidates = findHiddenArticleTextCandidates(container);
    const [candidate] = candidates;

    if (!candidate) {
      return {
        kind: "hidden-article",
        found: false,
        confidence: 0,
        candidates: [],
        reasons: [],
        signature: ""
      };
    }

    const visibleLength =
      container?.text?.length || 0;

    const hiddenLength = candidate.text.length;
    const ratio =
      visibleLength > 0
        ? hiddenLength / visibleLength
        : hiddenLength;

    const reasons = [];
    let confidence = 0;

    if (hiddenLength >= HIDDEN_ARTICLE_MIN_LENGTH) {
      confidence += 36;
      reasons.push("hidden-article-text");
    }

    if (ratio >= STRUCTURED_BODY_RATIO) {
      confidence += 22;
      reasons.push("hidden-text-longer-than-visible-content");
    }

    if (candidate.paragraphs >= 3) {
      confidence += 10;
      reasons.push("hidden-paragraphs");
    }

    if (barrierElements.length > 0) {
      confidence += 18;
      reasons.push("subscription-or-paywall-barrier");
    }

    if (contentTokenPattern.test(candidate.signalText)) {
      confidence += 10;
      reasons.push("content-token");
    }

    if (hasContentContext(candidate.element)) {
      confidence += 8;
      reasons.push("content-context");
    }

    const found =
      confidence >= PROMPT_THRESHOLD &&
      hiddenLength >= Math.max(
        HIDDEN_ARTICLE_MIN_LENGTH,
        visibleLength * STRUCTURED_BODY_RATIO
      );

    return {
      kind: "hidden-article",
      found,
      confidence: Math.min(confidence, 100),
      candidates: [candidate],
      reasons,
      signature: [
        "hidden-article",
        location.hostname,
        hashText(candidate.text),
        visibleLength,
        hiddenLength
      ].join(":"),
      hiddenArticle: {
        candidates: [candidate],
        container: container?.element || null,
        visibleLength,
        bodyLength: hiddenLength,
        barrierElements
      }
    };
  }

  function detectServerSidePaywall() {
    const container = findArticleContentContainer();
    const barrierElements = findStrongBarrierElements();

    if (!container || barrierElements.length === 0) {
      return null;
    }

    const structuredBodies = getStructuredArticleBodies();
    const hiddenCandidates = findHiddenArticleTextCandidates(container);
    const visibleLength = container.text.length;
    const barrierText = barrierElements
      .map(element => normalizedText(element))
      .join(" ");
    const reasons = [];
    let confidence = 0;

    if (barrierElements.length > 0) {
      confidence += 36;
      reasons.push("strong-paywall-barrier");
    }

    if (visibleLength >= 300) {
      confidence += 12;
      reasons.push("visible-article-teaser");
    }

    if (
      container.paragraphs > 0 &&
      container.paragraphs <= 8 &&
      visibleLength < 5000
    ) {
      confidence += 10;
      reasons.push("partial-article-shape");
    }

    if (structuredBodies.length === 0) {
      confidence += 14;
      reasons.push("no-embedded-article-body");
    }

    if (hiddenCandidates.length === 0) {
      confidence += 14;
      reasons.push("no-hidden-article-text");
    }

    if (
      /(?:article left to read|rest (?:is )?for subscribers|subscribe (?:now )?to (?:read|continue)|subscribe to continue|full story)/i
        .test(barrierText)
    ) {
      confidence += 14;
      reasons.push("explicit-remaining-content-message");
    }

    const found =
      confidence >= SERVER_PAYWALL_THRESHOLD &&
      structuredBodies.length === 0 &&
      hiddenCandidates.length === 0;

    if (!found) {
      return null;
    }

    return {
      kind: "server-side-paywall",
      found: true,
      revealable: false,
      confidence: Math.min(confidence, 100),
      candidates: [],
      reasons,
      signature: [
        "server-side-paywall",
        location.hostname,
        visibleLength,
        barrierElements
          .map(element => normalizedSignalText(element).slice(0, 80))
          .join("|")
      ].join(":"),
      serverSidePaywall: {
        visibleLength,
        paragraphs: container.paragraphs,
        barrierCount: barrierElements.length,
        hiddenCandidateCount: hiddenCandidates.length,
        structuredBodyCount: structuredBodies.length
      }
    };
  }

  function makeSignature(candidates) {
    return candidates
      .slice(0, 12)
      .map(candidate => {
        const element = candidate.element;
        return [
          element.tagName,
          element.id,
          String(element.className || "").slice(0, 80),
          candidate.rect.width,
          candidate.rect.height,
          candidate.blurInfo.text
        ].join(":");
      })
      .join("|");
  }

  function createRestoreSession() {
    const records = [];

    return {
      records,

      setStyle(element, property, value, priority = "") {
        records.push({
          type: "style",
          element,
          property,
          value: element.style.getPropertyValue(property),
          priority: element.style.getPropertyPriority(property)
        });

        element.style.setProperty(property, value, priority);
      },

      setAttribute(element, name, value) {
        records.push({
          type: "attribute",
          element,
          name,
          hadValue: element.hasAttribute(name),
          value: element.getAttribute(name)
        });

        if (value === null) {
          element.removeAttribute(name);
        } else {
          element.setAttribute(name, value);
        }
      },

      setHTML(element, html) {
        records.push({
          type: "html",
          element,
          value: element.innerHTML
        });

        element.innerHTML = html;
      },

      restore() {
        state.suppressObserver = true;

        for (const record of [...records].reverse()) {
          if (!record.element?.isConnected) {
            continue;
          }

          if (record.type === "style") {
            record.element.style.setProperty(
              record.property,
              record.value,
              record.priority
            );
          }

          if (record.type === "attribute") {
            if (record.hadValue) {
              record.element.setAttribute(record.name, record.value);
            } else {
              record.element.removeAttribute(record.name);
            }
          }

          if (record.type === "html") {
            record.element.innerHTML = record.value;
          }
        }

        state.suppressObserver = false;
      }
    };
  }

  function revealBlurredContent(detection) {
    const restore = createRestoreSession();
    const revealed = new Set();

    state.suppressObserver = true;

    try {
      for (const candidate of detection.candidates) {
        const element = candidate.element;

        if (!element?.isConnected || revealed.has(element)) {
          continue;
        }

        restore.setAttribute(element, "data-unblur-revealed", "true");
        restore.setStyle(element, "filter", "none", "important");
        restore.setStyle(element, "-webkit-filter", "none", "important");
        restore.setStyle(element, "backdrop-filter", "none", "important");
        restore.setStyle(element, "-webkit-backdrop-filter", "none", "important");
        revealed.add(element);
      }

      return {
        restore,
        revealedCount: revealed.size,
        message: messages.revealed
      };
    } finally {
      state.suppressObserver = false;
    }
  }

  function splitArticleBodyIntoParagraphs(text) {
    const decoded = decodeHtmlEntities(text)
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(?:p|div|section|article)[^>]*>/gi, "\n\n");

    const explicitParagraphs = decoded
      .replace(/<[^>]+>/g, " ")
      .split(/\n{2,}/)
      .map(part => part.replace(/\s+/g, " ").trim())
      .filter(part => part.length > 0);

    const normalized = decoded
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (explicitParagraphs.length > 1) {
      return explicitParagraphs;
    }

    const sentences = normalized
      .split(/(?<=[.!?:"”’])\s+(?=[A-Z0-9“‘])/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0);

    if (sentences.length <= 3) {
      return [normalized];
    }

    const paragraphs = [];
    let current = "";

    for (const sentence of sentences) {
      const next =
        current
          ? `${current} ${sentence}`
          : sentence;

      if (next.length > 430 && current) {
        paragraphs.push(current);
        current = sentence;
      } else {
        current = next;
      }
    }

    if (current) {
      paragraphs.push(current);
    }

    return paragraphs;
  }

  function revealStructuredArticle(detection) {
    const restore = createRestoreSession();
    const article = detection.structuredArticle;
    const container = article?.container;

    if (!container?.isConnected || !article?.body) {
      return {
        restore,
        revealedCount: 0,
        message: messages.noDetection
      };
    }

    state.suppressObserver = true;

    try {
      restore.setAttribute(container, "data-unblur-structured-article", "true");
      restore.setHTML(container, "");

      for (const paragraphText of splitArticleBodyIntoParagraphs(article.body)) {
        const paragraph = document.createElement("p");
        paragraph.setAttribute("data-unblur-structured-paragraph", "true");
        paragraph.textContent = paragraphText;
        container.appendChild(paragraph);
      }

      const hiddenElements = new Set([
        ...(article.barrierElements || []),
        ...(article.fadeElements || [])
      ]);

      for (const element of hiddenElements) {
        if (!element?.isConnected || element.contains(container)) {
          continue;
        }

        restore.setStyle(element, "display", "none", "important");
      }

      return {
        restore,
        revealedCount: container.querySelectorAll(
          "[data-unblur-structured-paragraph]"
        ).length,
        message: messages.articleRevealed
      };
    } finally {
      state.suppressObserver = false;
    }
  }

  function revealHiddenElement(element, restore) {
    let current = element;
    let depth = 0;

    while (
      current &&
      current !== document.body &&
      current !== document.documentElement &&
      depth < 6
    ) {
      const style = getComputedStyle(current);

      restore.setAttribute(current, "data-unblur-hidden-article", "true");

      if (current.hasAttribute("hidden")) {
        restore.setAttribute(current, "hidden", null);
      }

      if (current.getAttribute("aria-hidden") === "true") {
        restore.setAttribute(current, "aria-hidden", "false");
      }

      if (style.display === "none") {
        restore.setStyle(current, "display", "block", "important");
      }

      if (style.visibility === "hidden") {
        restore.setStyle(current, "visibility", "visible", "important");
      }

      if (Number(style.opacity || 1) <= 0.02) {
        restore.setStyle(current, "opacity", "1", "important");
      }

      if (style.clip && style.clip !== "auto") {
        restore.setStyle(current, "clip", "auto", "important");
      }

      if (style.clipPath && style.clipPath !== "none") {
        restore.setStyle(current, "clip-path", "none", "important");
      }

      if (style.webkitClipPath && style.webkitClipPath !== "none") {
        restore.setStyle(current, "-webkit-clip-path", "none", "important");
      }

      if (style.maskImage && style.maskImage !== "none") {
        restore.setStyle(current, "mask-image", "none", "important");
      }

      if (style.webkitMaskImage && style.webkitMaskImage !== "none") {
        restore.setStyle(current, "-webkit-mask-image", "none", "important");
      }

      if (["hidden", "clip"].includes(style.overflow)) {
        restore.setStyle(current, "overflow", "visible", "important");
      }

      if (["hidden", "clip"].includes(style.overflowY)) {
        restore.setStyle(current, "overflow-y", "visible", "important");
      }

      if (parseFloat(style.maxHeight) > 0) {
        restore.setStyle(current, "max-height", "none", "important");
      }

      if (
        parseFloat(style.height) > 0 &&
        current.scrollHeight > current.clientHeight + 20
      ) {
        restore.setStyle(current, "height", "auto", "important");
      }

      current = current.parentElement;
      depth += 1;
    }
  }

  function revealHiddenArticleContent(detection) {
    const restore = createRestoreSession();
    const hiddenArticle = detection.hiddenArticle;
    const candidates = hiddenArticle?.candidates || [];
    const [candidate] = candidates;
    const container = hiddenArticle?.container;
    const revealed = new Set();

    state.suppressObserver = true;

    try {
      if (container?.isConnected && candidate?.text) {
        restore.setAttribute(container, "data-unblur-hidden-article-container", "true");
        restore.setHTML(container, "");

        for (const paragraphText of splitArticleBodyIntoParagraphs(candidate.text)) {
          const paragraph = document.createElement("p");
          paragraph.setAttribute("data-unblur-hidden-paragraph", "true");
          paragraph.textContent = paragraphText;
          container.appendChild(paragraph);
        }

        revealed.add(container);
        container.scrollIntoView?.({
          behavior: "smooth",
          block: "start"
        });
      } else {
        for (const candidate of candidates) {
          const element = candidate.element;

          if (!element?.isConnected || revealed.has(element)) {
            continue;
          }

          revealHiddenElement(element, restore);
          revealed.add(element);
        }
      }

      for (const element of hiddenArticle?.barrierElements || []) {
        if (!element?.isConnected || revealed.has(element)) {
          continue;
        }

        restore.setStyle(element, "display", "none", "important");
      }

      return {
        restore,
        revealedCount: revealed.size,
        message: messages.hiddenRevealed
      };
    } finally {
      state.suppressObserver = false;
    }
  }

  function revealCoverOverlay(detection) {
    const restore = createRestoreSession();
    const hidden = new Set();

    state.suppressObserver = true;

    try {
      for (const candidate of detection.candidates) {
        const element = candidate.element;

        if (!element?.isConnected || hidden.has(element)) {
          continue;
        }

        restore.setAttribute(element, "data-unblur-cover-hidden", "true");
        restore.setStyle(element, "display", "none", "important");
        restore.setStyle(element, "pointer-events", "none", "important");
        hidden.add(element);
      }

      return {
        restore,
        revealedCount: hidden.size,
        message: messages.coverRemoved
      };
    } finally {
      state.suppressObserver = false;
    }
  }

  function revealDetection(detection) {
    if (detection.kind === "structured-article") {
      return revealStructuredArticle(detection);
    }

    if (detection.kind === "hidden-article") {
      return revealHiddenArticleContent(detection);
    }

    if (detection.kind === "cover-overlay") {
      return revealCoverOverlay(detection);
    }

    return revealBlurredContent(detection);
  }

  function closeCard() {
    if (state.cardEscapeHandler) {
      document.removeEventListener("keydown", state.cardEscapeHandler, true);
      state.cardEscapeHandler = null;
    }

    try {
      if (state.cardHost?.matches?.(":popover-open")) {
        state.cardHost.hidePopover();
      }
    } catch {}

    state.cardHost?.remove();
    state.cardHost = null;
    state.cardShadow = null;
  }

  function setImportantStyle(element, property, value) {
    element.style.setProperty(property, value, "important");
  }

  function createCardBase(mode = "dialog") {
    closeCard();

    const host = document.createElement("div");
    host.setAttribute("data-unblur-root", "");
    setImportantStyle(host, "all", "initial");
    setImportantStyle(host, "display", "block");
    setImportantStyle(host, "visibility", "visible");
    setImportantStyle(host, "opacity", "1");
    setImportantStyle(host, "position", "fixed");
    setImportantStyle(host, "right", "16px");
    setImportantStyle(host, "bottom", "16px");
    setImportantStyle(host, "z-index", UNBLUR_Z_INDEX);
    setImportantStyle(host, "max-width", "calc(100vw - 32px)");
    setImportantStyle(host, "background", "transparent");
    setImportantStyle(host, "pointer-events", "auto");
    setImportantStyle(host, "isolation", "isolate");
    setImportantStyle(host, "contain", "layout style paint");
    setImportantStyle(host, "filter", "none");
    setImportantStyle(host, "backdrop-filter", "none");
    setImportantStyle(host, "-webkit-backdrop-filter", "none");

    if (typeof host.showPopover === "function") {
      host.setAttribute("popover", "manual");
    }

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
        color-scheme: dark;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        box-sizing: border-box;
        width: min(370px, calc(100vw - 32px));
        padding: 14px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 8px;
        background: #111318;
        color: #f8fafc;
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.48);
        font-size: 14px;
        line-height: 1.4;
        opacity: 1;
        transform: translateY(0);
        transition: opacity ${CARD_FADE_MS}ms ease, transform ${CARD_FADE_MS}ms ease;
      }
      .card.closing {
        opacity: 0;
        transform: translateY(6px);
        pointer-events: none;
      }
      .title {
        margin: 0 0 6px;
        font-size: 15px;
        font-weight: 700;
        color: #ffffff;
      }
      .text {
        margin: 0 0 12px;
        color: #cbd5e1;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
      }
      button {
        min-height: 34px;
        padding: 0 12px;
        border: 1px solid rgba(148, 163, 184, 0.32);
        border-radius: 7px;
        background: #1f242d;
        color: #f8fafc;
        font: inherit;
        cursor: pointer;
      }
      button:hover {
        background: #2a303b;
      }
      button.primary {
        border-color: #38bdf8;
        background: #38bdf8;
        color: #03121a;
        font-weight: 700;
      }
      button.primary:hover {
        background: #7dd3fc;
      }
      button:focus-visible {
        outline: 2px solid #7dd3fc;
        outline-offset: 2px;
      }
      .mini {
        margin: 0;
        font-size: 13px;
        color: #cbd5e1;
      }
    `;

    const card = document.createElement("section");
    card.className = "card";
    card.setAttribute("role", mode);
    card.setAttribute("aria-live", "polite");

    shadow.append(style, card);
    (document.body || document.documentElement).appendChild(host);

    try {
      host.showPopover?.();
    } catch {}

    state.cardHost = host;
    state.cardShadow = shadow;
    state.cardEscapeHandler = event => {
      if (event.key === "Escape") {
        closeCard();
      }
    };

    document.addEventListener("keydown", state.cardEscapeHandler, true);
    return card;
  }

  function appendTextElement(parent, tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function createButton(label, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    return button;
  }

  function closeCardWithFade(host, fadeMs = CARD_FADE_MS) {
    if (state.cardHost !== host || !host?.isConnected) {
      return;
    }

    const card = host.shadowRoot?.querySelector?.(".card");
    card?.classList.add("closing");

    window.setTimeout(() => {
      if (state.cardHost === host && host?.isConnected) {
        closeCard();
      }
    }, fadeMs);
  }

  function scheduleCardClose(host, duration) {
    if (duration <= 0) {
      return;
    }

    window.setTimeout(() => {
      closeCardWithFade(host);
    }, duration);
  }

  function showToast(text, duration = 5000) {
    const card = createCardBase("status");
    appendTextElement(card, "p", "mini", text);
    scheduleCardClose(state.cardHost, duration);
  }

  function showUndo(result) {
    state.lastRestore = result.restore;

    const card = createCardBase("status");
    appendTextElement(card, "p", "text", result.message || messages.revealed);

    const actions = document.createElement("div");
    actions.className = "actions";

    const undoButton = createButton(messages.undo, "primary");
    undoButton.addEventListener("click", () => {
      result.restore.restore();
      showToast(messages.restored, 5000);
    });

    actions.appendChild(undoButton);
    card.appendChild(actions);
    scheduleCardClose(state.cardHost, UNDO_CARD_MS);

    console.table({
      [messages.tableRevealedCount]: result.revealedCount
    });
  }

  function getPromptCopy(detection) {
    if (detection.kind === "structured-article") {
      return {
        title: messages.articleTitle,
        description: messages.articleDescription
      };
    }

    if (detection.kind === "hidden-article") {
      return {
        title: messages.hiddenTitle,
        description: messages.hiddenDescription
      };
    }

    if (detection.kind === "cover-overlay") {
      return {
        title: messages.coverTitle,
        description: messages.coverDescription
      };
    }

    if (detection.kind === "server-side-paywall") {
      return {
        title: messages.serverTitle,
        description: messages.serverDescription
      };
    }

    return {
      title: messages.blurTitle,
      description: messages.blurDescription
    };
  }

  function showPrompt(detection) {
    const card = createCardBase("dialog");
    const { title, description } = getPromptCopy(detection);

    appendTextElement(card, "h2", "title", title);
    appendTextElement(card, "p", "text", description);

    const actions = document.createElement("div");
    actions.className = "actions";

    const closeButton = createButton(
      detection.revealable === false
        ? messages.ok
        : messages.ignore
    );

    closeButton.addEventListener("click", () => {
      state.ignoredSignatures.add(detection.signature);
      closeCard();
    });

    if (detection.revealable === false) {
      actions.appendChild(closeButton);
      card.appendChild(actions);
      return;
    }

    const revealButton = createButton(messages.reveal, "primary");

    revealButton.addEventListener("click", () => {
      closeCard();
      const result = revealDetection(detection);
      showUndo(result);
    });

    actions.append(closeButton, revealButton);
    card.appendChild(actions);
  }

  function scan({ manual = false } = {}) {
    if (state.stopped) {
      return null;
    }

    const detection = detect();

    if (!detection.found) {
      if (manual) {
        showToast(messages.noDetection, 5000);
      }

      return detection;
    }

    if (state.ignoredSignatures.has(detection.signature) && !manual) {
      return detection;
    }

    stopObserver();
    showPrompt(detection);
    return detection;
  }

  function mutationTouchesUnblur(mutation) {
    const target =
      mutation.target instanceof Element
        ? mutation.target
        : null;

    if (target && isInUnblurUI(target)) {
      return true;
    }

    return [...mutation.addedNodes].some(
      node =>
        node instanceof Element &&
        isInUnblurUI(node)
    );
  }

  function mutationLooksInteresting(mutation) {
    if (mutationTouchesUnblur(mutation)) {
      return false;
    }

    if (mutation.type === "childList") {
      return [...mutation.addedNodes].some(
        node =>
          node instanceof Element &&
          !isInUnblurUI(node)
      );
    }

    if (mutation.type === "attributes") {
      return mutation.target instanceof Element;
    }

    return false;
  }

  function scheduleObserverScan() {
    if (state.scheduledScan || state.suppressObserver) {
      return;
    }

    state.scheduledScan = true;

    window.setTimeout(() => {
      state.scheduledScan = false;
      scan({ manual: false });
    }, 350);
  }

  function startObserver(durationMs) {
    stopObserver();

    const observer = new MutationObserver(mutations => {
      if (
        state.suppressObserver ||
        !mutations.some(mutationLooksInteresting)
      ) {
        return;
      }

      scheduleObserverScan();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "class",
        "style",
        "hidden",
        "aria-hidden"
      ]
    });

    state.observer = observer;
    state.observerTimer = window.setTimeout(
      stopObserver,
      durationMs
    );
  }

  function stopObserver() {
    state.observer?.disconnect();
    state.observer = null;

    if (state.observerTimer) {
      window.clearTimeout(state.observerTimer);
      state.observerTimer = null;
    }
  }

  function logDiagnostics() {
    const detection = state.lastDetection || detect();
    const structuredArticle = detection.structuredArticle || {};
    const hiddenArticle = detection.hiddenArticle || {};
    const serverSidePaywall = detection.serverSidePaywall || {};

    console.table({
      [messages.tableMode]: detection.kind,
      [messages.tableConfidence]: detection.confidence,
      [messages.tableCandidateCount]: detection.candidates.length,
      [messages.tableVisibleLength]:
        structuredArticle.visibleLength ||
        hiddenArticle.visibleLength ||
        serverSidePaywall.visibleLength ||
        0,
      [messages.tableBodyLength]:
        structuredArticle.bodyLength ||
        hiddenArticle.bodyLength ||
        0,
      [messages.tableBarrierCount]:
        structuredArticle.barrierElements?.length ||
        hiddenArticle.barrierElements?.length ||
        serverSidePaywall.barrierCount ||
        0,
      [messages.tableHiddenCount]:
        hiddenArticle.candidates?.length ||
        serverSidePaywall.hiddenCandidateCount ||
        0,
      [messages.tableReasons]: detection.reasons.join(", ")
    });

    if (detection.kind === "structured-article") {
      console.table([
        {
          headline: structuredArticle.headline || "",
          type: structuredArticle.type || "",
          visibleLength: structuredArticle.visibleLength || 0,
          bodyLength: structuredArticle.bodyLength || 0,
          barriers: structuredArticle.barrierElements?.length || 0,
          fades: structuredArticle.fadeElements?.length || 0
        }
      ]);
      return;
    }

    if (detection.kind === "hidden-article") {
      console.table(
        hiddenArticle.candidates.map(candidate => ({
          tag: candidate.element.tagName.toLowerCase(),
          id: candidate.element.id || "",
          class: String(candidate.element.className || "").slice(0, 120),
          textLength: candidate.text.length,
          paragraphs: candidate.paragraphs,
          size: `${candidate.rect.width}x${candidate.rect.height}`,
          text: candidate.text.slice(0, 180)
        }))
      );
      return;
    }

    if (detection.kind === "server-side-paywall") {
      console.table([
        {
          visibleLength: serverSidePaywall.visibleLength || 0,
          paragraphs: serverSidePaywall.paragraphs || 0,
          barriers: serverSidePaywall.barrierCount || 0,
          hiddenCandidates: serverSidePaywall.hiddenCandidateCount || 0,
          structuredBodies: serverSidePaywall.structuredBodyCount || 0
        }
      ]);
      return;
    }

    if (detection.kind === "cover-overlay") {
      console.table(
        detection.candidates.map(candidate => ({
          confidence: candidate.confidence,
          tag: candidate.element.tagName.toLowerCase(),
          id: candidate.element.id || "",
          class: String(candidate.element.className || "").slice(0, 120),
          size: `${candidate.rect.width}x${candidate.rect.height}`,
          top: candidate.rect.top,
          text: candidate.text,
          reasons: candidate.reasons.join(", ")
        }))
      );
      return;
    }

    console.table(
      detection.candidates.map(candidate => ({
        confidence: candidate.confidence,
        tag: candidate.element.tagName.toLowerCase(),
        id: candidate.element.id || "",
        class: String(candidate.element.className || "").slice(0, 120),
        blur: candidate.blurInfo.text,
        size: `${candidate.rect.width}x${candidate.rect.height}`,
        text: candidate.text,
        reasons: candidate.reasons.join(", ")
      }))
    );
  }

  function registerMenuCommand(label, callback) {
    try {
      if (typeof GM_registerMenuCommand === "function") {
        return GM_registerMenuCommand(`${APP_NAME} - ${label}`, callback);
      }

      if (
        typeof GM !== "undefined" &&
        typeof GM.registerMenuCommand === "function"
      ) {
        return GM.registerMenuCommand(`${APP_NAME} - ${label}`, callback);
      }
    } catch (error) {
      console.warn(`${APP_NAME}: registerMenuCommand failed`, error);
    }

    return null;
  }

  function registerMenuCommands() {
    registerMenuCommand(messages.scanNow, () => scan({ manual: true }));
    registerMenuCommand(messages.diagnostics, logDiagnostics);
  }

  function stop() {
    state.stopped = true;
    stopObserver();
    closeCard();
  }

  registerMenuCommands();

  window.__unblur = {
    stop,
    scanNow: () => scan({ manual: true }),
    diagnostics: logDiagnostics,
    restoreLast: () => state.lastRestore?.restore()
  };

  scan({ manual: false });

  if (!state.lastDetection?.found) {
    startObserver(DEFAULT_OBSERVER_MS);
  }

  console.log(messages.active);
})();

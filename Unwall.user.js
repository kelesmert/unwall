// ==UserScript==
// @name         Unwall
// @namespace    https://github.com/kelesmert/unwall
// @version      0.1.8
// @description  Detects anti-adblock access walls and removes them only with user approval.
// @author       Mert Keleş
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/kelesmert/unwall
// @supportURL   https://github.com/kelesmert/unwall/issues
// @updateURL    https://github.com/kelesmert/unwall/releases/latest/download/Unwall.user.js
// @downloadURL  https://github.com/kelesmert/unwall/releases/latest/download/Unwall.user.js
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @noframes
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM.registerMenuCommand
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// ==/UserScript==

(async () => {
  "use strict";

  const APP_NAME = "Unwall";
  const SCRIPT_VERSION = "0.1.8";
  const INSTANCE_KEY = "__unwall";
  let previousInstance = null;

  try {
    previousInstance = window[INSTANCE_KEY];
  } catch (error) {
    console.warn(`${APP_NAME}: previous instance lookup failed`, error);
  }

  const STORAGE_KEYS = {
    globalDetection: "globalDetection",
    siteModes: "siteModes"
  };

  const MODES = {
    default: "default",
    remember: "remember",
    auto: "auto"
  };

  const PROMPT_THRESHOLD = 70;
  const AUTO_THRESHOLD = 88;
  const DEFAULT_OBSERVER_MS = 7000;
  const EXTENDED_OBSERVER_MS = 18000;
  const OBSERVER_SCAN_DEBOUNCE_MS = 300;
  const OBSERVER_SCAN_COOLDOWN_MS = 1200;
  const OBSERVER_MUTATION_BATCH_LIMIT = 80;
  const EVENT_HANDLER_RESTORE_MS = 250;
  const IGNORED_SIGNATURE_LIMIT = 100;
  const CARD_FADE_MS = 1000;
  const UNDO_CARD_MS = 5000;
  const UNWALL_ROOT_SELECTOR = "[data-unwall-root]";
  const UNWALL_Z_INDEX = "2147483647";

  const wait = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  function detectLanguage() {
    const browserLanguage =
      navigator.languages?.[0] ||
      navigator.language ||
      navigator.userLanguage ||
      "en";

    const language =
      String(browserLanguage).toLowerCase().split("-")[0];

    return ["en", "tr", "ru"].includes(language)
      ? language
      : "en";
  }

  const language = detectLanguage();

  const messagesByLanguage = {
    en: {
      active: "Unwall is active.",
      wallTitle: "Unwall detected an access wall",
      wallDescription: "Do you want to remove this page access block?",
      remove: "Remove",
      ignore: "Ignore",
      remember: "Remember detection on this site",
      auto: "Automatically remove on this site",
      autoConfirmTitle: "Enable automatic removal?",
      autoConfirmText:
        "Unwall will remove high-confidence access walls on this domain without asking again.",
      autoConfirmEnable: "Enable auto remove",
      cancel: "Cancel",
      removed: "Unwall removed the access wall.",
      undo: "Undo",
      restored: "Unwall restored the page changes.",
      noVisiblePopup:
        "No visible anti-adblock wall was found; no content was removed.",
      noDetection: "Unwall did not detect an access wall on this page.",
      scanNow: "Scan this page now",
      globalOn: "Turn global detection on",
      globalOff: "Turn global detection off",
      rememberSite: "Remember detection for this site",
      autoEnableSite: "Enable auto remove for this site",
      autoDisableSite: "Disable auto remove for this site",
      forgetSite: "Forget this site setting",
      diagnostics: "Show diagnostics",
      remembered: "Unwall will watch this site for longer.",
      autoEnabled: "Automatic removal is enabled for this site.",
      autoDisabled: "Automatic removal is disabled for this site.",
      siteForgotten: "This site setting was forgotten.",
      sensitiveAutoBlocked:
        "Automatic removal is disabled on sensitive sites.",
      sensitiveDetectionBlocked:
        "Automatic detection is disabled on sensitive sites.",
      tableConfidence: "Confidence",
      tablePopupCount: "Popups",
      tableBackdropCount: "Backdrops",
      tableBlurCount: "Blur elements",
      tableScrollLock: "Scroll lock",
      tableTextSignals: "Text signals",
      tableDomSignals: "DOM signals",
      tableReasons: "Reasons",
      resultPopupHidden: "Hidden popups",
      resultBackdropHidden: "Hidden backdrops",
      resultBlurFixed: "Fixed blur",
      resultCSSScrollLock: "CSS scroll lock",
      resultJSScrollLock: "JS scroll lock"
    },
    tr: {
      active: "Unwall aktif.",
      wallTitle: "Unwall bir erişim duvarı algıladı",
      wallDescription: "Sayfadaki erişim engelini kaldırmak ister misiniz?",
      remove: "Kaldır",
      ignore: "Yok say",
      remember: "Bu sitede algılamayı hatırla",
      auto: "Bu sitede bundan sonra otomatik kaldır",
      autoConfirmTitle: "Otomatik kaldırma açılsın mı?",
      autoConfirmText:
        "Unwall bu alan adında yüksek güvenli erişim duvarlarını tekrar sormadan kaldıracaktır.",
      autoConfirmEnable: "Otomatik kaldırmayı aç",
      cancel: "İptal",
      removed: "Unwall erişim duvarını kaldırdı.",
      undo: "Geri al",
      restored: "Unwall sayfa değişikliklerini geri aldı.",
      noVisiblePopup:
        "Görünür anti-adblock penceresi bulunamadı; hiçbir içerik silinmedi.",
      noDetection: "Unwall bu sayfada erişim duvarı algılamadı.",
      scanNow: "Bu sayfayı şimdi tara",
      globalOn: "Global algılamayı aç",
      globalOff: "Global algılamayı kapat",
      rememberSite: "Bu sitede algılamayı hatırla",
      autoEnableSite: "Bu site için otomatik kaldırmayı aç",
      autoDisableSite: "Bu site için otomatik kaldırmayı kapat",
      forgetSite: "Bu sitenin ayarını unut",
      diagnostics: "Teşhis bilgilerini göster",
      remembered: "Unwall bu siteyi daha uzun süre izleyecek.",
      autoEnabled: "Bu site için otomatik kaldırma açık.",
      autoDisabled: "Bu site için otomatik kaldırma kapalı.",
      siteForgotten: "Bu sitenin ayarı unutuldu.",
      sensitiveAutoBlocked:
        "Hassas sitelerde otomatik kaldırma devre dışıdır.",
      sensitiveDetectionBlocked:
        "Hassas sitelerde otomatik algılama devre dışıdır.",
      tableConfidence: "Güven",
      tablePopupCount: "Popup",
      tableBackdropCount: "Backdrop",
      tableBlurCount: "Blur elementi",
      tableScrollLock: "Scroll kilidi",
      tableTextSignals: "Metin sinyali",
      tableDomSignals: "DOM sinyali",
      tableReasons: "Nedenler",
      resultPopupHidden: "Gizlenen popup",
      resultBackdropHidden: "Gizlenen backdrop",
      resultBlurFixed: "Düzeltilen blur",
      resultCSSScrollLock: "CSS scroll kilidi",
      resultJSScrollLock: "JS scroll kilidi"
    },
    ru: {
      active: "Unwall активен.",
      wallTitle: "Unwall обнаружил стену доступа",
      wallDescription: "Удалить блокировку доступа на этой странице?",
      remove: "Удалить",
      ignore: "Игнорировать",
      remember: "Запомнить обнаружение для этого сайта",
      auto: "Автоматически удалять на этом сайте",
      autoConfirmTitle: "Включить автоматическое удаление?",
      autoConfirmText:
        "Unwall будет удалять надежно обнаруженные стены доступа на этом домене без повторного запроса.",
      autoConfirmEnable: "Включить",
      cancel: "Отмена",
      removed: "Unwall удалил стену доступа.",
      undo: "Отменить",
      restored: "Unwall восстановил изменения страницы.",
      noVisiblePopup:
        "Видимое окно антиблокировки рекламы не найдено; содержимое не удалялось.",
      noDetection: "Unwall не обнаружил стену доступа на этой странице.",
      scanNow: "Проверить страницу сейчас",
      globalOn: "Включить глобальное обнаружение",
      globalOff: "Отключить глобальное обнаружение",
      rememberSite: "Запомнить обнаружение для этого сайта",
      autoEnableSite: "Включить автоудаление для сайта",
      autoDisableSite: "Отключить автоудаление для сайта",
      forgetSite: "Забыть настройку сайта",
      diagnostics: "Показать диагностику",
      remembered: "Unwall будет дольше наблюдать за этим сайтом.",
      autoEnabled: "Автоматическое удаление включено для этого сайта.",
      autoDisabled: "Автоматическое удаление отключено для этого сайта.",
      siteForgotten: "Настройка этого сайта удалена.",
      sensitiveAutoBlocked:
        "Автоматическое удаление отключено на чувствительных сайтах.",
      sensitiveDetectionBlocked:
        "Автоматическое обнаружение отключено на чувствительных сайтах.",
      tableConfidence: "Уверенность",
      tablePopupCount: "Окна",
      tableBackdropCount: "Фоны",
      tableBlurCount: "Размытие",
      tableScrollLock: "Блокировка прокрутки",
      tableTextSignals: "Текстовые сигналы",
      tableDomSignals: "DOM-сигналы",
      tableReasons: "Причины",
      resultPopupHidden: "Скрыто окон",
      resultBackdropHidden: "Скрыто фонов",
      resultBlurFixed: "Исправлено размытие",
      resultCSSScrollLock: "CSS-блокировка прокрутки",
      resultJSScrollLock: "JS-блокировка прокрутки"
    }
  };

  const messages =
    messagesByLanguage[language] ||
    messagesByLanguage.en;

  const antiAdblockPatternSets = {
    en: [
      /ad\s*block(?:er)?.{0,40}(?:detected|enabled|active)/i,
      /(?:detected|enabled|active).{0,40}ad\s*block(?:er)?/i,
      /disable.{0,40}(?:your )?ad\s*block(?:er|ing)?/i,
      /turn off.{0,40}ad\s*block(?:er|ing)?/i,
      /please.{0,40}(?:disable|turn off).{0,40}ad\s*block/i,
      /whitelist.{0,40}(?:this )?(?:site|website)/i,
      /allow.{0,40}ads.{0,40}(?:continue|access|support)/i
    ],
    tr: [
      /reklam engelleyici(?:niz|yi)?.{0,40}(?:alg[ıi]land[ıi]|aç[ıi]k|etkin|kapat|devre d[ıi][şs][ıi])/i,
      /(?:kapat|devre d[ıi][şs][ıi]).{0,40}reklam engelleyici/i,
      /reklam engellemeyi.{0,40}devre d[ıi][şs][ıi]/i,
      /devam etmek için.{0,40}reklam engelleyici/i,
      /siteyi.{0,40}(?:beyaz listeye|izin verilenlere).{0,40}ekleyin/i
    ],
    ru: [
      /блокировщик рекламы.{0,40}(?:обнаружен|включен|активен)/i,
      /(?:обнаружен|включен|активен).{0,40}блокировщик рекламы/i,
      /(?:отключите|выключите|деактивируйте).{0,40}блокировщик рекламы/i,
      /(?:отключите|выключите|деактивируйте).{0,40}блокировку рекламы/i,
      /добавьте.{0,40}(?:сайт|нас).{0,40}(?:в белый список|в список исключений)/i,
      /разрешите.{0,40}рекламу.{0,40}(?:продолжить|доступ)/i
    ]
  };

  const antiAdblockPatterns = [
    ...(antiAdblockPatternSets[language] || antiAdblockPatternSets.en),
    ...(language === "en" ? [] : antiAdblockPatternSets.en)
  ];

  const antiAdblockAttributePatterns = [
    /\bad\s*block(?:er|ing)?\b/i,
    /\badblock(?:er|ing)?\b/i,
    /\banti\s*ad\s*block(?:er|ing)?\b/i,
    /\bad\s*block(?:er|ing)?\s*(?:overlay|modal|popup|wall|notice|detect|detected)\b/i,
    /\b(?:overlay|modal|popup|wall|notice)\s*ad\s*block(?:er|ing)?\b/i
  ];

  const protectedSelector = [
    "video",
    "audio",
    "iframe",
    "canvas",
    "object",
    "embed",
    "picture",
    "form",
    "input",
    "textarea",
    "select",
    '[type="password"]',
    '[type="file"]',
    ".video-js",
    ".display-card.video",
    '[class*="video-player"]',
    '[class*="videoplayer"]',
    '[class*="youtube"]',
    '[class*="player-container"]',
    '[id*="video-player"]',
    ".adsninja-video-player",
    ".emaki-video-player",
    ".an-vp-int"
  ].join(",");

  const protectedTokenPattern =
    /(?:captcha|recaptcha|hcaptcha|turnstile|login|signin|sign-in|sign_in|password|payment|checkout|billing|upload|video-player|videoplayer|youtube|adsninja|emaki|pdf-viewer|document-viewer|google-map|leaflet)/i;

  const scrollLockClasses = [
    "modal-open",
    "no-scroll",
    "noscroll",
    "scroll-lock",
    "scroll-locked",
    "overflow-hidden",
    "locked"
  ];

  const sensitiveSubdomains = new Set([
    "account",
    "accounts",
    "admin",
    "auth",
    "bank",
    "billing",
    "checkout",
    "dashboard",
    "login",
    "pay",
    "payment",
    "secure",
    "signin",
    "store",
    "wallet"
  ]);

  const sensitiveHostSuffixes = new Set([
    "accounts.google.com",
    "mail.google.com",
    "outlook.live.com",
    "login.live.com",
    "login.microsoftonline.com",
    "paypal.com",
    "venmo.com",
    "stripe.com",
    "checkout.stripe.com",
    "coinbase.com",
    "robinhood.com",
    "chase.com",
    "bankofamerica.com",
    "wellsfargo.com",
    "citi.com",
    "capitalone.com",
    "americanexpress.com",
    "discover.com",
    "ally.com"
  ]);

  const state = {
    observer: null,
    observerTimer: null,
    scheduledScan: false,
    lastObserverScanAt: 0,
    suppressObserver: false,
    cardHost: null,
    cardShadow: null,
    cardEscapeHandler: null,
    ignoredSignatures: new Set(),
    ignoredSignatureQueue: [],
    lastDetection: null,
    lastRestore: null,
    globalDetection: true,
    siteModes: {},
    siteMode: MODES.default,
    stopped: false
  };

  const memoryStorage = new Map();
  const hostInfo = getHostInfo();

  const manager = {
    async getValue(key, fallback) {
      try {
        if (typeof GM_getValue === "function") {
          return await unwrap(GM_getValue(key, fallback));
        }

        if (
          typeof GM !== "undefined" &&
          typeof GM.getValue === "function"
        ) {
          return await GM.getValue(key, fallback);
        }
      } catch (error) {
        console.warn(`${APP_NAME}: GM_getValue failed`, error);
      }

      return memoryStorage.has(key)
        ? memoryStorage.get(key)
        : fallback;
    },

    async setValue(key, value) {
      try {
        if (typeof GM_setValue === "function") {
          await unwrap(GM_setValue(key, value));
          return;
        }

        if (
          typeof GM !== "undefined" &&
          typeof GM.setValue === "function"
        ) {
          await GM.setValue(key, value);
          return;
        }
      } catch (error) {
        console.warn(`${APP_NAME}: GM_setValue failed`, error);
      }

      memoryStorage.set(key, value);
    },

    async deleteValue(key) {
      try {
        if (typeof GM_deleteValue === "function") {
          await unwrap(GM_deleteValue(key));
          return;
        }

        if (
          typeof GM !== "undefined" &&
          typeof GM.deleteValue === "function"
        ) {
          await GM.deleteValue(key);
          return;
        }
      } catch (error) {
        console.warn(`${APP_NAME}: GM_deleteValue failed`, error);
      }

      memoryStorage.delete(key);
    },

    registerMenuCommand(label, callback) {
      try {
        if (typeof GM_registerMenuCommand === "function") {
          return GM_registerMenuCommand(label, callback);
        }

        if (
          typeof GM !== "undefined" &&
          typeof GM.registerMenuCommand === "function"
        ) {
          return GM.registerMenuCommand(label, callback);
        }
      } catch (error) {
        console.warn(`${APP_NAME}: GM_registerMenuCommand failed`, error);
      }

      return null;
    }
  };

  function unwrap(value) {
    return value && typeof value.then === "function"
      ? value
      : Promise.resolve(value);
  }

  function isUnwallInstance(value) {
    return (
      value &&
      typeof value.stop === "function" &&
      (
        value.app === APP_NAME ||
        typeof value.scanNow === "function" ||
        typeof value.diagnostics === "function"
      )
    );
  }

  function hostMatchesSuffix(host, suffix) {
    return host === suffix || host.endsWith(`.${suffix}`);
  }

  function hasSensitiveHostSuffix(host) {
    for (const suffix of sensitiveHostSuffixes) {
      if (hostMatchesSuffix(host, suffix)) {
        return true;
      }
    }

    return false;
  }

  function getHostInfo(hostname = location.hostname) {
    const host = String(hostname || "")
      .toLowerCase()
      .replace(/\.$/, "");

    const parts = host.split(".").filter(Boolean);
    const effectiveParts =
      parts[0] === "www" ? parts.slice(1) : parts;

    const siteKey = effectiveParts.join(".") || host;
    const firstLabel = effectiveParts[0] || "";
    const hasSensitiveSubdomain =
      effectiveParts.length > 2 &&
      sensitiveSubdomains.has(firstLabel);
    const isSensitive =
      hasSensitiveSubdomain ||
      hasSensitiveHostSuffix(host);

    return {
      host,
      siteKey,
      isSensitive
    };
  }

  async function loadPreferences() {
    const storedGlobalDetection =
      await manager.getValue(STORAGE_KEYS.globalDetection, true);

    state.globalDetection = storedGlobalDetection !== false;

    const storedSiteModes =
      await manager.getValue(STORAGE_KEYS.siteModes, {});

    const rawSiteModes =
      storedSiteModes && typeof storedSiteModes === "object"
        ? storedSiteModes
        : {};

    state.siteModes = Object.fromEntries(
      Object.entries(rawSiteModes).filter(([, mode]) =>
        Object.values(MODES).includes(mode)
      )
    );

    state.siteMode =
      state.siteModes[hostInfo.siteKey] ||
      MODES.default;
  }

  async function saveSiteMode(mode) {
    if (mode === MODES.default) {
      delete state.siteModes[hostInfo.siteKey];
      state.siteMode = MODES.default;
    } else {
      state.siteModes[hostInfo.siteKey] = mode;
      state.siteMode = mode;
    }

    await manager.setValue(STORAGE_KEYS.siteModes, state.siteModes);
  }

  async function setGlobalDetection(enabled) {
    state.globalDetection = Boolean(enabled);
    await manager.setValue(
      STORAGE_KEYS.globalDetection,
      state.globalDetection
    );
  }

  function isInUnwallUI(element) {
    return Boolean(element?.closest?.(UNWALL_ROOT_SELECTOR));
  }

  function normalizedText(element) {
    return (element.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizedSignalText(value) {
    return String(value || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isVisible(element) {
    if (!(element instanceof Element) || isInUnwallUI(element)) {
      return false;
    }

    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || 1) > 0.02 &&
      rect.width > 5 &&
      rect.height > 5
    );
  }

  function getAntiAdblockMatch(element) {
    const text = normalizedText(element);

    if (!text || text.length > 1200) {
      return null;
    }

    const matchedPattern = antiAdblockPatterns.find(pattern =>
      pattern.test(text)
    );

    return matchedPattern
      ? {
          text,
          pattern: String(matchedPattern)
        }
      : null;
  }

  function containsAntiAdblockText(element) {
    return Boolean(getAntiAdblockMatch(element));
  }

  function getAttributeSignalText(element) {
    if (!(element instanceof Element)) {
      return "";
    }

    const parts = [
      element.id,
      element.className,
      element.getAttribute("name"),
      element.getAttribute("aria-label"),
      element.getAttribute("role")
    ];

    try {
      for (const attribute of element.attributes) {
        if (attribute.name.startsWith("data-")) {
          parts.push(attribute.name, attribute.value);
        }
      }
    } catch {}

    return normalizedSignalText(parts.join(" "));
  }

  function getAntiAdblockAttributeMatch(element) {
    const signalText = getAttributeSignalText(element);

    if (!signalText) {
      return null;
    }

    const matchedPattern = antiAdblockAttributePatterns.find(pattern =>
      pattern.test(signalText)
    );

    return matchedPattern
      ? {
          text: signalText,
          pattern: String(matchedPattern)
        }
      : null;
  }

  function containsAntiAdblockAttribute(element) {
    return Boolean(getAntiAdblockAttributeMatch(element));
  }

  function hasAntiAdblockSignal(element) {
    return (
      containsAntiAdblockText(element) ||
      containsAntiAdblockAttribute(element)
    );
  }

  function hasProtectedToken(element) {
    const nodes = [element];

    try {
      nodes.push(
        ...[...element.querySelectorAll("[class],[id],[name],[aria-label]")]
          .slice(0, 80)
      );
    } catch {}

    return nodes.some(node => {
      const value = [
        node.id,
        node.className,
        node.getAttribute?.("name"),
        node.getAttribute?.("aria-label")
      ].join(" ");

      return protectedTokenPattern.test(String(value));
    });
  }

  function containsProtectedContent(element) {
    if (!(element instanceof Element)) {
      return false;
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

  function numericZIndex(element) {
    const value = parseInt(getComputedStyle(element).zIndex, 10);
    return Number.isFinite(value) ? value : 0;
  }

  function isNativeDialog(element) {
    return (
      element?.localName === "dialog" &&
      typeof element.close === "function"
    );
  }

  function isOpenNativeDialog(element) {
    return (
      isNativeDialog(element) &&
      (element.open || element.hasAttribute("open"))
    );
  }

  function closeNativeDialog(element) {
    try {
      if (element.open) {
        element.close();
      }
    } catch {}

    element.removeAttribute("open");
  }

  function findWarningTextElements(scope = document) {
    const selectors = [
      '[role="dialog"]',
      '[role="alertdialog"]',
      '[aria-modal="true"]',
      "[id]",
      "[class]",
      "[aria-label]",
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "span",
      "button",
      "dialog",
      "div",
      "section",
      "aside"
    ].join(",");

    const root =
      scope instanceof Document ? scope : scope.ownerDocument || document;

    return [...root.querySelectorAll(selectors)]
      .filter(isVisible)
      .filter(element => {
        if (
          element.closest(UNWALL_ROOT_SELECTOR) ||
          element.closest(protectedSelector)
        ) {
          return false;
        }

        if (!hasAntiAdblockSignal(element)) {
          return false;
        }

        const matchingChild = [...element.children].some(
          child =>
            isVisible(child) &&
            hasAntiAdblockSignal(child)
        );

        return !matchingChild;
      });
  }

  function findPopup(element) {
    let current = element;

    while (
      current &&
      current !== document.body &&
      current !== document.documentElement
    ) {
      if (isInUnwallUI(current) || containsProtectedContent(current)) {
        return null;
      }

      const tag = current.tagName.toLowerCase();

      if (tag === "main" || tag === "article") {
        return null;
      }

      const style = getComputedStyle(current);
      const rect = current.getBoundingClientRect();
      const role = current.getAttribute("role");
      const nativeDialogOpen = isOpenNativeDialog(current);

      const positioned = [
        "fixed",
        "absolute",
        "sticky"
      ].includes(style.position);

      const dialogRole =
        role === "dialog" ||
        role === "alertdialog";

      const ariaModal =
        current.getAttribute("aria-modal") === "true";

      const dialogLike =
        nativeDialogOpen ||
        dialogRole ||
        ariaModal;

      const reasonableSize =
        rect.width >= Math.min(250, innerWidth * 0.25) &&
        rect.height >= Math.min(120, innerHeight * 0.15);

      const notHugeContent =
        normalizedText(current).length < 2500 ||
        dialogLike;

      const stackingLooksModal =
        numericZIndex(current) >= 5 ||
        style.position === "fixed" ||
        dialogLike;

      if (
        reasonableSize &&
        notHugeContent &&
        stackingLooksModal &&
        (dialogLike || positioned)
      ) {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  }

  function getColorAlpha(color) {
    if (!color || color === "transparent") {
      return 0;
    }

    const rgbaMatch = color.match(
      /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*([.\d]+))?\s*\)/i
    );

    if (!rgbaMatch) {
      return 1;
    }

    return rgbaMatch[1] === undefined
      ? 1
      : Number(rgbaMatch[1]);
  }

  function hasBlur(style) {
    return (
      style.filter?.includes("blur") ||
      style.backdropFilter?.includes("blur") ||
      style.webkitBackdropFilter?.includes("blur")
    );
  }

  function findBackdrop(popup) {
    const popupZ = numericZIndex(popup);
    const parent = popup.parentElement;

    const candidates = new Set([
      ...document.body.children,
      ...(parent ? parent.children : [])
    ]);

    return [...candidates].filter(element => {
      if (
        element === popup ||
        isInUnwallUI(element) ||
        !isVisible(element) ||
        containsProtectedContent(element)
      ) {
        return false;
      }

      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const text = normalizedText(element);

      const fullScreen =
        rect.width >= innerWidth * 0.9 &&
        rect.height >= innerHeight * 0.9;

      const fixed = style.position === "fixed";
      const nearPopup =
        numericZIndex(element) >= popupZ - 5;

      const visibleBackground =
        getColorAlpha(style.backgroundColor) > 0.05;

      const looksLikeBackdrop =
        hasBlur(style) ||
        visibleBackground ||
        Number(style.opacity || 1) < 0.95;

      return (
        fixed &&
        fullScreen &&
        nearPopup &&
        looksLikeBackdrop &&
        text.length < 300
      );
    });
  }

  function findRelatedBlurElements(popups, backdrops) {
    const candidates = new Set([
      ...document.body.children
    ]);

    for (const element of [...popups, ...backdrops]) {
      const parent = element.parentElement;

      if (parent) {
        for (const child of parent.children) {
          candidates.add(child);
        }
      }
    }

    return [...candidates].filter(element => {
      if (
        popups.includes(element) ||
        backdrops.includes(element) ||
        isInUnwallUI(element) ||
        !isVisible(element) ||
        containsProtectedContent(element)
      ) {
        return false;
      }

      const style = getComputedStyle(element);

      if (!hasBlur(style)) {
        return false;
      }

      const rect = element.getBoundingClientRect();

      return (
        rect.width >= innerWidth * 0.5 &&
        rect.height >= innerHeight * 0.35
      );
    });
  }

  function detectCSSScrollLock() {
    const html = document.documentElement;
    const body = document.body;
    const entries = [];

    for (const element of [html, body]) {
      if (!element) continue;

      const style = getComputedStyle(element);
      const overflowLocked =
        ["hidden", "clip"].includes(style.overflow) ||
        ["hidden", "clip"].includes(style.overflowY);

      const fixedBody =
        element === body &&
        style.position === "fixed";

      const maxHeight =
        parseFloat(style.maxHeight);

      const heightLimited =
        Number.isFinite(maxHeight) &&
        maxHeight > 0 &&
        maxHeight <= innerHeight + 5;

      const touchLocked =
        style.touchAction === "none";

      if (
        overflowLocked ||
        fixedBody ||
        heightLimited ||
        touchLocked
      ) {
        entries.push({
          element,
          overflowLocked,
          fixedBody,
          heightLimited,
          touchLocked
        });
      }
    }

    const bodyClassLocks =
      body
        ? scrollLockClasses.filter(className =>
            body.classList.contains(className)
          )
        : [];

    return {
      locked: entries.length > 0 || bodyClassLocks.length > 0,
      entries,
      bodyClassLocks
    };
  }

  function uniqueElements(elements) {
    return [...new Set(elements)].filter(Boolean);
  }

  function viewportSize() {
    return {
      width:
        window.innerWidth ||
        document.documentElement?.clientWidth ||
        1,
      height:
        window.innerHeight ||
        document.documentElement?.clientHeight ||
        1
    };
  }

  function viewportProbePoints() {
    const { width, height } = viewportSize();

    return [
      [width / 2, height / 2],
      [width / 2, height * 0.25],
      [width / 2, height * 0.75],
      [width * 0.25, height / 2],
      [width * 0.75, height / 2]
    ];
  }

  function elementsAtPoint(x, y) {
    try {
      if (typeof document.elementsFromPoint === "function") {
        return document.elementsFromPoint(x, y);
      }

      const element = document.elementFromPoint?.(x, y);
      return element ? [element] : [];
    } catch {
      return [];
    }
  }

  function hitTestCandidates() {
    return uniqueElements(
      viewportProbePoints().flatMap(([x, y]) =>
        elementsAtPoint(x, y).slice(0, 12)
      )
    );
  }

  function isRelatedToDetection(element, detection) {
    const relatedElements = [
      ...detection.popups,
      ...detection.backdrops
    ];

    return relatedElements.some(related => {
      if (!related) {
        return false;
      }

      return (
        element === related ||
        element.contains(related) ||
        related.contains(element) ||
        (
          element.parentElement &&
          element.parentElement === related.parentElement
        )
      );
    });
  }

  function isDetectionDialog(element, detection) {
    return (
      isOpenNativeDialog(element) &&
      (
        detection.warningElements.some(warning => element.contains(warning)) ||
        detection.popups.some(popup =>
          element === popup ||
          element.contains(popup) ||
          popup.contains(element)
        ) ||
        hasAntiAdblockSignal(element)
      )
    );
  }

  function findOpenDetectionDialog(detection) {
    if (!detection?.found) {
      return null;
    }

    return [...document.querySelectorAll("dialog[open]")]
      .filter(dialog => isDetectionDialog(dialog, detection))
      .sort((a, b) => numericZIndex(b) - numericZIndex(a))[0] ||
      null;
  }

  function looksLikeResidualClickBlocker(element, detection) {
    if (
      !(element instanceof Element) ||
      !element.isConnected ||
      element === document.documentElement ||
      element === document.body ||
      element.hasAttribute("data-unwall-hidden") ||
      isInUnwallUI(element) ||
      containsProtectedContent(element)
    ) {
      return false;
    }

    const style = getComputedStyle(element);

    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.pointerEvents === "none"
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const { width, height } = viewportSize();
    const coversViewport =
      rect.width >= width * 0.85 &&
      rect.height >= height * 0.85;

    const pinned = [
      "fixed",
      "absolute",
      "sticky"
    ].includes(style.position);

    const transparentish =
      getColorAlpha(style.backgroundColor) < 0.12 ||
      Number(style.opacity || 1) < 0.25;

    const blockerish =
      hasBlur(style) ||
      transparentish ||
      style.cursor === "not-allowed";

    const lowContent = normalizedText(element).length < 300;
    const highLayer =
      numericZIndex(element) >= 5 ||
      style.position === "fixed" ||
      isRelatedToDetection(element, detection);

    return (
      coversViewport &&
      pinned &&
      blockerish &&
      lowContent &&
      highLayer
    );
  }

  function makeSignature(warningElements, popups) {
    const textPart =
      warningElements
        .map(element => normalizedText(element).slice(0, 120))
        .join("|")
        .slice(0, 240);

    const popupPart =
      popups
        .map(element => {
          const rect = element.getBoundingClientRect();
          return [
            element.tagName,
            element.id,
            String(element.className || "").slice(0, 80),
            Math.round(rect.width),
            Math.round(rect.height)
          ].join(":");
        })
        .join("|");

    return `${language}:${textPart}:${popupPart}`;
  }

  function rememberIgnoredSignature(signature) {
    if (!signature || state.ignoredSignatures.has(signature)) {
      return;
    }

    state.ignoredSignatures.add(signature);
    state.ignoredSignatureQueue.push(signature);

    while (state.ignoredSignatureQueue.length > IGNORED_SIGNATURE_LIMIT) {
      const oldest = state.ignoredSignatureQueue.shift();
      state.ignoredSignatures.delete(oldest);
    }
  }

  function scoreDetection({
    warningElements,
    popups,
    backdrops,
    blurElements,
    scrollLock
  }) {
    const reasons = [];
    let confidence = 0;

    const hasTextSignal =
      warningElements.some(containsAntiAdblockText);

    const hasAttributeSignal =
      warningElements.some(containsAntiAdblockAttribute) ||
      popups.some(containsAntiAdblockAttribute);

    if (hasTextSignal) {
      confidence += 70;
      reasons.push("localized-anti-adblock-text");
    }

    if (hasAttributeSignal) {
      confidence += 58;
      reasons.push("anti-adblock-dom-signal");
    }

    if (
      popups.some(element => {
        const role = element.getAttribute("role");
        return (
          isOpenNativeDialog(element) ||
          role === "dialog" ||
          role === "alertdialog" ||
          element.getAttribute("aria-modal") === "true"
        );
      })
    ) {
      confidence += 10;
      reasons.push("dialog-semantics");
    }

    if (
      popups.some(element =>
        ["fixed", "absolute", "sticky"].includes(
          getComputedStyle(element).position
        )
      )
    ) {
      confidence += 8;
      reasons.push("modal-positioning");
    }

    if (
      popups.some(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          style.position === "fixed" &&
          rect.width >= innerWidth * 0.75 &&
          rect.height >= innerHeight * 0.45
        );
      })
    ) {
      confidence += 12;
      reasons.push("blocking-overlay-layout");
    }

    if (backdrops.length > 0) {
      confidence += 6;
      reasons.push("related-backdrop");
    }

    if (blurElements.length > 0) {
      confidence += 4;
      reasons.push("related-blur");
    }

    if (scrollLock.locked) {
      confidence += 4;
      reasons.push("scroll-lock");
    }

    return {
      confidence: Math.min(confidence, 100),
      reasons
    };
  }

  function detect() {
    const warningElements = findWarningTextElements();
    const popups = uniqueElements(
      warningElements
        .map(findPopup)
        .filter(Boolean)
    );

    const backdrops = uniqueElements(
      popups.flatMap(findBackdrop)
    );

    const blurElements =
      popups.length > 0
        ? findRelatedBlurElements(popups, backdrops)
        : [];

    const scrollLock =
      popups.length > 0
        ? detectCSSScrollLock()
        : {
            locked: false,
            entries: [],
            bodyClassLocks: []
          };

    const score = scoreDetection({
      warningElements,
      popups,
      backdrops,
      blurElements,
      scrollLock
    });

    const detection = {
      found:
        popups.length > 0 &&
        score.confidence >= PROMPT_THRESHOLD,
      language,
      confidence: score.confidence,
      reasons: score.reasons,
      warningElements,
      popups,
      backdrops,
      blurElements,
      scrollLock,
      signature: makeSignature(warningElements, popups)
    };

    state.lastDetection = detection;
    return detection;
  }

  function restoreEventHandlers(record, onlyIfCleared = false) {
    if (!record || record.type !== "event-handlers") {
      return;
    }

    if (!onlyIfCleared || window.onscroll === null) {
      window.onscroll = record.windowOnScroll;
    }

    if (!onlyIfCleared || document.onscroll === null) {
      document.onscroll = record.documentOnScroll;
    }

    if (document.body && (!onlyIfCleared || document.body.onscroll === null)) {
      document.body.onscroll = record.bodyOnScroll;
    }
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

      saveClassAttribute(element) {
        records.push({
          type: "class",
          element,
          value: element.getAttribute("class")
        });
      },

      hideElement(element, reason) {
        records.push({
          type: "style-attribute",
          element,
          value: element.getAttribute("style")
        });

        if (isOpenNativeDialog(element)) {
          records.push({
            type: "attribute",
            element,
            name: "open",
            hadValue: element.hasAttribute("open"),
            value: element.getAttribute("open")
          });

          closeNativeDialog(element);
        }

        this.setAttribute(element, "aria-hidden", "true");
        this.setAttribute(element, "data-unwall-hidden", reason);
        element.style.setProperty("display", "none", "important");
        element.style.setProperty("pointer-events", "none", "important");
      },

      saveEventHandlers() {
        const record = {
          type: "event-handlers",
          windowOnScroll: window.onscroll,
          documentOnScroll: document.onscroll,
          bodyOnScroll: document.body?.onscroll || null
        };

        records.push(record);
        return record;
      },

      restore() {
        state.suppressObserver = true;

        for (const record of [...records].reverse()) {
          if (!record.element?.isConnected && record.type !== "event-handlers") {
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

          if (record.type === "class") {
            if (record.value === null) {
              record.element.removeAttribute("class");
            } else {
              record.element.setAttribute("class", record.value);
            }
          }

          if (record.type === "style-attribute") {
            if (record.value === null) {
              record.element.removeAttribute("style");
            } else {
              record.element.setAttribute("style", record.value);
            }

            record.element.removeAttribute("data-unwall-hidden");
          }

          if (record.type === "event-handlers") {
            restoreEventHandlers(record);
          }
        }

        state.suppressObserver = false;
      }
    };
  }

  function unlockCSSScroll(detection, restore) {
    if (!detection.scrollLock.locked) {
      return false;
    }

    const body = document.body;

    for (const entry of detection.scrollLock.entries) {
      const element = entry.element;
      const style = getComputedStyle(element);

      if (entry.overflowLocked) {
        restore.setStyle(element, "overflow-y", "auto", "important");

        if (["hidden", "clip"].includes(style.overflowX)) {
          restore.setStyle(element, "overflow-x", "visible", "important");
        }
      }

      if (entry.fixedBody) {
        const previousTop =
          Math.abs(parseInt(style.top, 10)) || 0;

        restore.setStyle(element, "position", "static", "important");
        restore.setStyle(element, "top", "auto", "important");

        if (previousTop > 0) {
          window.scrollTo(0, previousTop);
        }
      }

      if (entry.heightLimited) {
        restore.setStyle(element, "max-height", "none", "important");
      }

      if (entry.touchLocked) {
        restore.setStyle(element, "touch-action", "auto", "important");
      }
    }

    if (body && detection.scrollLock.bodyClassLocks.length > 0) {
      restore.saveClassAttribute(body);

      for (const className of detection.scrollLock.bodyClassLocks) {
        body.classList.remove(className);
      }
    }

    return true;
  }

  async function releaseJavaScriptScrollLock(restore) {
    const scroller =
      document.scrollingElement ||
      document.documentElement;

    const maximum =
      scroller.scrollHeight - scroller.clientHeight;

    if (maximum < 100) {
      return false;
    }

    const startingPosition = scroller.scrollTop;
    const target =
      startingPosition + 120 <= maximum
        ? startingPosition + 120
        : Math.max(0, startingPosition - 120);

    window.scrollTo(0, target);
    await wait(180);

    const pulledBack =
      Math.abs(scroller.scrollTop - target) > 25;

    if (!pulledBack) {
      return false;
    }

    const eventHandlers = restore.saveEventHandlers();
    window.onscroll = null;
    document.onscroll = null;

    if (document.body) {
      document.body.onscroll = null;
    }

    window.scrollTo(0, target);
    window.setTimeout(
      () => restoreEventHandlers(eventHandlers, true),
      EVENT_HANDLER_RESTORE_MS
    );

    return true;
  }

  function unlockRootInteraction(restore) {
    for (const element of [
      document.documentElement,
      document.body
    ].filter(Boolean)) {
      const style = getComputedStyle(element);

      if (style.pointerEvents === "none") {
        restore.setStyle(element, "pointer-events", "auto", "important");
      }

      if (style.touchAction === "none") {
        restore.setStyle(element, "touch-action", "auto", "important");
      }
    }
  }

  function closeRelatedOpenDialogs(detection, restore) {
    for (const dialog of document.querySelectorAll("dialog[open]")) {
      if (!isDetectionDialog(dialog, detection)) {
        continue;
      }

      restore.hideElement(dialog, "open-dialog");
    }
  }

  function hideResidualClickBlockers(detection, restore) {
    for (const element of hitTestCandidates()) {
      if (!looksLikeResidualClickBlocker(element, detection)) {
        continue;
      }

      restore.hideElement(element, "residual-click-blocker");
    }
  }

  function unlockResidualInteraction(detection, restore) {
    unlockRootInteraction(restore);
    closeRelatedOpenDialogs(detection, restore);
    hideResidualClickBlockers(detection, restore);
  }

  async function cleanDetection(detection) {
    const restore = createRestoreSession();
    state.suppressObserver = true;

    try {
      for (const popup of detection.popups) {
        restore.hideElement(popup, "popup");
      }

      for (const backdrop of detection.backdrops) {
        restore.hideElement(backdrop, "backdrop");
      }

      for (const element of detection.blurElements) {
        const style = getComputedStyle(element);

        if (style.filter?.includes("blur")) {
          restore.setStyle(element, "filter", "none", "important");
        }

        if (
          style.backdropFilter?.includes("blur") ||
          style.webkitBackdropFilter?.includes("blur")
        ) {
          restore.setStyle(element, "backdrop-filter", "none", "important");
          restore.setStyle(element, "-webkit-backdrop-filter", "none", "important");
        }
      }

      const cssScrollUnlocked = unlockCSSScroll(detection, restore);
      const jsScrollUnlocked =
        detection.confidence >= AUTO_THRESHOLD
          ? await releaseJavaScriptScrollLock(restore)
          : false;
      unlockResidualInteraction(detection, restore);

      return {
        restore,
        popupCount: detection.popups.length,
        backdropCount: detection.backdrops.length,
        blurCount: detection.blurElements.length,
        cssScrollUnlocked,
        jsScrollUnlocked
      };
    } finally {
      state.suppressObserver = false;
    }
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

  function getCardMountParent() {
    return (
      findOpenDetectionDialog(state.lastDetection) ||
      document.body ||
      document.documentElement
    );
  }

  function createCardBase(mode = "dialog") {
    closeCard();

    const host = document.createElement("div");
    host.setAttribute("data-unwall-root", "");
    setImportantStyle(host, "all", "initial");
    setImportantStyle(host, "display", "block");
    setImportantStyle(host, "visibility", "visible");
    setImportantStyle(host, "opacity", "1");
    setImportantStyle(host, "position", "fixed");
    setImportantStyle(host, "top", "auto");
    setImportantStyle(host, "left", "auto");
    setImportantStyle(host, "right", "16px");
    setImportantStyle(host, "bottom", "16px");
    setImportantStyle(host, "z-index", UNWALL_Z_INDEX);
    setImportantStyle(host, "max-width", "calc(100vw - 32px)");
    setImportantStyle(host, "margin", "0");
    setImportantStyle(host, "padding", "0");
    setImportantStyle(host, "border", "0");
    setImportantStyle(host, "background", "transparent");
    setImportantStyle(host, "overflow", "visible");
    setImportantStyle(host, "pointer-events", "auto");
    setImportantStyle(host, "isolation", "isolate");
    setImportantStyle(host, "contain", "layout style paint");
    setImportantStyle(host, "transform", "translateZ(0)");
    setImportantStyle(host, "filter", "none");
    setImportantStyle(host, "backdrop-filter", "none");
    setImportantStyle(host, "-webkit-backdrop-filter", "none");

    if (typeof host.showPopover === "function") {
      host.setAttribute("popover", "manual");
    }

    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
        color-scheme: dark;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        box-sizing: border-box;
        position: relative;
        z-index: ${UNWALL_Z_INDEX};
        width: min(360px, calc(100vw - 32px));
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
      .options {
        display: grid;
        gap: 8px;
        margin: 10px 0 12px;
      }
      label {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        color: #e5e7eb;
      }
      input {
        flex: 0 0 auto;
        margin-top: 2px;
        accent-color: #10b981;
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
        border-color: #10b981;
        background: #10b981;
        color: #07120d;
        font-weight: 700;
      }
      button.primary:hover {
        background: #34d399;
      }
      button:disabled,
      input:disabled + span {
        cursor: not-allowed;
        opacity: 0.55;
      }
      button:focus-visible,
      input:focus-visible {
        outline: 2px solid #34d399;
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

    const mountParent = getCardMountParent();

    if (isOpenNativeDialog(mountParent)) {
      host.setAttribute("data-unwall-dialog-mounted", "");
    }

    mountParent.appendChild(host);

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

  function createCheckbox(label, checked = false, disabled = false) {
    const wrapper = document.createElement("label");
    const input = document.createElement("input");
    const text = document.createElement("span");

    input.type = "checkbox";
    input.checked = checked;
    input.disabled = disabled;
    text.textContent = label;

    wrapper.append(input, text);
    return { wrapper, input };
  }

  function closeCardWithFade(host, fadeMs = CARD_FADE_MS) {
    if (state.cardHost !== host || !host?.isConnected) {
      return;
    }

    const card =
      state.cardHost === host
        ? state.cardShadow?.querySelector?.(".card")
        : null;
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
    const host = state.cardHost;

    scheduleCardClose(host, duration);
  }

  function showUndo(result) {
    state.lastRestore = result.restore;

    const card = createCardBase("status");
    appendTextElement(card, "p", "text", messages.removed);

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
      [messages.resultPopupHidden]: result.popupCount,
      [messages.resultBackdropHidden]: result.backdropCount,
      [messages.resultBlurFixed]: result.blurCount,
      [messages.resultCSSScrollLock]: result.cssScrollUnlocked,
      [messages.resultJSScrollLock]: result.jsScrollUnlocked
    });
  }

  async function applyPreferencesBeforeClean({
    rememberChecked,
    autoChecked
  }) {
    if (autoChecked) {
      await saveSiteMode(MODES.auto);
      return;
    }

    if (rememberChecked && state.siteMode !== MODES.auto) {
      await saveSiteMode(MODES.remember);
    }
  }

  async function runCleanFromPrompt(detection, options) {
    await applyPreferencesBeforeClean(options);
    closeCard();

    const result = await cleanDetection(detection);
    showUndo(result);
  }

  function showAutoConfirm(detection, rememberChecked) {
    const card = createCardBase("dialog");
    appendTextElement(card, "h2", "title", messages.autoConfirmTitle);
    appendTextElement(card, "p", "text", messages.autoConfirmText);

    const actions = document.createElement("div");
    actions.className = "actions";

    const cancelButton = createButton(messages.cancel);
    const enableButton = createButton(messages.autoConfirmEnable, "primary");

    cancelButton.addEventListener("click", () => {
      showPrompt(detection, {
        rememberChecked,
        autoChecked: false
      });
    });

    enableButton.addEventListener("click", async () => {
      await runCleanFromPrompt(detection, {
        rememberChecked,
        autoChecked: true
      });
    });

    actions.append(cancelButton, enableButton);
    card.appendChild(actions);
  }

  function showPrompt(
    detection,
    initialOptions = {
      rememberChecked: state.siteMode === MODES.remember,
      autoChecked: state.siteMode === MODES.auto
    }
  ) {
    const card = createCardBase("dialog");
    appendTextElement(card, "h2", "title", messages.wallTitle);
    appendTextElement(card, "p", "text", messages.wallDescription);

    const options = document.createElement("div");
    options.className = "options";

    const remember = createCheckbox(
      messages.remember,
      initialOptions.rememberChecked
    );

    const auto = createCheckbox(
      messages.auto,
      initialOptions.autoChecked,
      hostInfo.isSensitive
    );

    options.append(remember.wrapper, auto.wrapper);

    if (hostInfo.isSensitive) {
      appendTextElement(options, "p", "mini", messages.sensitiveAutoBlocked);
    }

    const actions = document.createElement("div");
    actions.className = "actions";

    const ignoreButton = createButton(messages.ignore);
    const removeButton = createButton(messages.remove, "primary");

    ignoreButton.addEventListener("click", () => {
      rememberIgnoredSignature(detection.signature);
      closeCard();
    });

    removeButton.addEventListener("click", async () => {
      if (
        auto.input.checked &&
        state.siteMode !== MODES.auto &&
        !hostInfo.isSensitive
      ) {
        showAutoConfirm(detection, remember.input.checked);
        return;
      }

      await runCleanFromPrompt(detection, {
        rememberChecked: remember.input.checked,
        autoChecked:
          auto.input.checked &&
          !hostInfo.isSensitive
      });
    });

    actions.append(ignoreButton, removeButton);
    card.append(options, actions);
  }

  function canAutoRemove(detection) {
    return (
      state.siteMode === MODES.auto &&
      !hostInfo.isSensitive &&
      detection.confidence >= AUTO_THRESHOLD &&
      detection.popups.length > 0
    );
  }

  function isAutomaticDetectionAllowed() {
    return !hostInfo.isSensitive;
  }

  function shouldRunAutomatically() {
    return (
      state.globalDetection ||
      state.siteMode === MODES.remember ||
      state.siteMode === MODES.auto
    );
  }

  function automaticObserverDuration() {
    return state.siteMode === MODES.default
      ? DEFAULT_OBSERVER_MS
      : EXTENDED_OBSERVER_MS;
  }

  async function runAutomaticDetection() {
    if (!shouldRunAutomatically()) {
      stopObserver();
      return;
    }

    if (!isAutomaticDetectionAllowed()) {
      stopObserver();
      console.log(messages.sensitiveDetectionBlocked);
      return;
    }

    await scan({ manual: false });

    if (!state.lastDetection?.found) {
      startObserver(automaticObserverDuration());
    }
  }

  async function scan({ manual = false } = {}) {
    if (state.stopped) {
      return null;
    }

    if (!manual && !isAutomaticDetectionAllowed()) {
      return null;
    }

    const detection = detect();

    if (!detection.found) {
      if (manual) {
        showToast(messages.noDetection, 5000);
        console.log(messages.noVisiblePopup);
      }

      return detection;
    }

    if (state.ignoredSignatures.has(detection.signature) && !manual) {
      return detection;
    }

    stopObserver();

    if (canAutoRemove(detection)) {
      const result = await cleanDetection(detection);
      showUndo(result);
      return detection;
    }

    showPrompt(detection);
    return detection;
  }

  function mutationTouchesUnwall(mutation) {
    const target =
      mutation.target instanceof Element
        ? mutation.target
        : null;

    if (target && isInUnwallUI(target)) {
      return true;
    }

    return [...mutation.addedNodes].some(
      node =>
        node instanceof Element &&
        isInUnwallUI(node)
    );
  }

  function mutationLooksInteresting(mutation) {
    if (mutationTouchesUnwall(mutation)) {
      return false;
    }

    if (mutation.type === "childList") {
      return [...mutation.addedNodes].some(
        node =>
          node instanceof Element &&
          !isInUnwallUI(node)
      );
    }

    if (mutation.type === "attributes") {
      return mutation.target instanceof Element;
    }

    return false;
  }

  function mutationBatchLooksInteresting(mutations) {
    const sampledMutations =
      mutations.length > OBSERVER_MUTATION_BATCH_LIMIT
        ? mutations.slice(0, OBSERVER_MUTATION_BATCH_LIMIT)
        : mutations;

    if (!sampledMutations.some(mutationLooksInteresting)) {
      return false;
    }

    const hasChildListMutation =
      sampledMutations.some(mutation => mutation.type === "childList");

    return (
      hasChildListMutation ||
      Date.now() - state.lastObserverScanAt >= OBSERVER_SCAN_COOLDOWN_MS
    );
  }

  function scheduleObserverScan() {
    if (state.scheduledScan || state.suppressObserver) {
      return;
    }

    state.scheduledScan = true;
    const elapsed = Date.now() - state.lastObserverScanAt;
    const delay = Math.max(
      OBSERVER_SCAN_DEBOUNCE_MS,
      OBSERVER_SCAN_COOLDOWN_MS - elapsed
    );

    window.setTimeout(async () => {
      state.scheduledScan = false;
      await scan({ manual: false });
      state.lastObserverScanAt = Date.now();
    }, delay);
  }

  function startObserver(durationMs) {
    stopObserver();

    if (!isAutomaticDetectionAllowed()) {
      return;
    }

    const observer = new MutationObserver(mutations => {
      if (
        state.suppressObserver ||
        !mutationBatchLooksInteresting(mutations)
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
        "aria-hidden",
        "aria-modal"
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

    console.table({
      [messages.tableConfidence]: detection.confidence,
      [messages.tablePopupCount]: detection.popups.length,
      [messages.tableBackdropCount]: detection.backdrops.length,
      [messages.tableBlurCount]: detection.blurElements.length,
      [messages.tableScrollLock]: detection.scrollLock.locked,
      [messages.tableTextSignals]:
        detection.warningElements.filter(containsAntiAdblockText).length,
      [messages.tableDomSignals]:
        detection.warningElements.filter(containsAntiAdblockAttribute).length,
      [messages.tableReasons]: detection.reasons.join(", ")
    });
  }

  function menuLabel(label) {
    return `${APP_NAME} — ${label}`;
  }

  function registerMenuCommands() {
    manager.registerMenuCommand(
      menuLabel(messages.scanNow),
      () => scan({ manual: true })
    );

    manager.registerMenuCommand(
      menuLabel(
        state.globalDetection
          ? messages.globalOff
          : messages.globalOn
      ),
      async () => {
        await setGlobalDetection(!state.globalDetection);

        if (state.globalDetection) {
          await runAutomaticDetection();
        } else {
          stopObserver();
        }

        showToast(
          state.globalDetection
            ? hostInfo.isSensitive
              ? messages.sensitiveDetectionBlocked
              : messages.globalOn
            : messages.globalOff,
          5000
        );
      }
    );

    manager.registerMenuCommand(
      menuLabel(messages.rememberSite),
      async () => {
        if (hostInfo.isSensitive) {
          showToast(messages.sensitiveDetectionBlocked, 6000);
          return;
        }

        await saveSiteMode(MODES.remember);
        showToast(messages.remembered, 5000);
      }
    );

    manager.registerMenuCommand(
      menuLabel(messages.autoEnableSite),
      async () => {
        if (hostInfo.isSensitive) {
          showToast(messages.sensitiveAutoBlocked, 6000);
          return;
        }

        await saveSiteMode(MODES.auto);
        showToast(messages.autoEnabled, 5000);
      }
    );

    manager.registerMenuCommand(
      menuLabel(messages.autoDisableSite),
      async () => {
        if (state.siteMode === MODES.auto) {
          await saveSiteMode(MODES.remember);
        }

        showToast(messages.autoDisabled, 5000);
      }
    );

    manager.registerMenuCommand(
      menuLabel(messages.forgetSite),
      async () => {
        await saveSiteMode(MODES.default);
        showToast(messages.siteForgotten, 5000);
      }
    );

    manager.registerMenuCommand(
      menuLabel(messages.diagnostics),
      logDiagnostics
    );
  }

  function stop() {
    state.stopped = true;
    stopObserver();
    closeCard();

    try {
      if (window[INSTANCE_KEY]?.stop === stop) {
        delete window[INSTANCE_KEY];
      }
    } catch (error) {
      console.warn(`${APP_NAME}: instance cleanup failed`, error);
    }
  }

  await loadPreferences();
  registerMenuCommands();

  if (isUnwallInstance(previousInstance)) {
    try {
      previousInstance.stop();
    } catch (error) {
      console.warn(`${APP_NAME}: previous instance cleanup failed`, error);
    }
  }

  try {
    Object.defineProperty(window, INSTANCE_KEY, {
      configurable: true,
      enumerable: false,
      value: Object.freeze({
        app: APP_NAME,
        version: SCRIPT_VERSION,
        stop
      })
    });
  } catch (error) {
    console.warn(`${APP_NAME}: instance registration failed`, error);
  }

  await runAutomaticDetection();

  console.log(messages.active);
})();

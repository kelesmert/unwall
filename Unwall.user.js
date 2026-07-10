// ==UserScript==
// @name         Unwall
// @namespace    https://github.com/kelesmert/unwall
// @version      0.1.10
// @description  Detects anti-adblock access walls and removes them only with user approval.
// @author       Mert Keleş
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/kelesmert/unwall
// @supportURL   https://github.com/kelesmert/unwall/issues
// @updateURL    https://github.com/kelesmert/unwall/releases/latest/download/Unwall.user.js
// @downloadURL  https://github.com/kelesmert/unwall/releases/latest/download/Unwall.user.js
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @noframes
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM.registerMenuCommand
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        unsafeWindow
// ==/UserScript==

(async () => {
  "use strict";

  const APP_NAME = "Unwall";
  const SCRIPT_VERSION = "0.1.10";
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
    auto: "auto"
  };

  const PROMPT_THRESHOLD = 70;
  const AUTO_THRESHOLD = 88;
  const DEFAULT_OBSERVER_MS = 7000;
  const EXTENDED_OBSERVER_MS = 18000;
  const OBSERVER_SCAN_DEBOUNCE_MS = 300;
  const OBSERVER_SCAN_COOLDOWN_MS = 1200;
  const OBSERVER_MUTATION_BATCH_LIMIT = 80;
  const DELAYED_SCAN_OFFSETS_MS = [1000, 3000, 7000, 12000];
  const IGNORED_SIGNATURE_LIMIT = 100;
  const DOWNLOAD_SLOT_SNAPSHOT_MS = 12000;
  const DOWNLOAD_SLOT_SNAPSHOT_LIMIT = 8;
  const REHYDRATION_LINK_LIMIT = 8;
  const CARD_FADE_MS = 1000;
  const UNDO_CARD_MS = 5000;
  const POST_CLEAN_UNLOCK_WATCH_MS = 2200;
  const TRACKED_SCROLL_LISTENER_LIMIT = 800;
  const TRACKED_SCROLL_LISTENER_WINDOW_MS = 18000;
  const UNWALL_ROOT_SELECTOR = "[data-unwall-root]";
  const UNWALL_Z_INDEX = "2147483647";
  const SCROLL_LOCK_EVENT_TYPES = new Set([
    "scroll",
    "wheel",
    "touchmove",
    "keydown"
  ]);
  const pageWindow =
    typeof unsafeWindow !== "undefined"
      ? unsafeWindow
      : window;

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
      remember: "Remember removal",
      autoConfirmTitle: "Remember removal on this site?",
      autoConfirmText:
        "Unwall will remove high-confidence access walls on {site} without asking again.",
      autoConfirmEnable: "Remember removal",
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
      autoEnableSite: "Remember removal for this site",
      autoDisableSite: "Disable remembered removal for this site",
      forgetSite: "Forget this site setting",
      diagnostics: "Show diagnostics",
      autoEnabled: "Removal will be remembered for this site.",
      autoDisabled: "Remembered removal is disabled for this site.",
      siteForgotten: "This site setting was forgotten.",
      sensitiveAutoBlocked:
        "Automatic removal is disabled on sensitive sites.",
      sensitiveDetectionBlocked:
        "Automatic detection is disabled on sensitive sites.",
      tableConfidence: "Confidence",
      tablePopupCount: "Popups",
      tableBackdropCount: "Backdrops",
      tableBlurCount: "Blur elements",
      tableInlineGateCount: "Inline gates",
      tableScrollLock: "Scroll lock",
      tableTextSignals: "Text signals",
      tableDomSignals: "DOM signals",
      tableSiteKey: "Site key",
      tableSiteMode: "Site mode",
      tableAutoEligible: "Auto eligible",
      tableAutoThreshold: "Auto threshold",
      tableReasons: "Reasons",
      resultPopupHidden: "Hidden popups",
      resultBackdropHidden: "Hidden backdrops",
      resultBlurFixed: "Fixed blur",
      resultInlineGateHidden: "Hidden inline gates",
      resultResidualNoticeHidden: "Hidden residual notices",
      resultControlsRevealed: "Revealed controls",
      resultControlsRehydrated: "Rehydrated controls",
      resultRehydrationReason: "Rehydration reason",
      resultCSSScrollLock: "CSS scroll lock",
      resultJSScrollLock: "JS scroll lock"
    },
    tr: {
      active: "Unwall aktif.",
      wallTitle: "Unwall bir erişim duvarı algıladı",
      wallDescription: "Sayfadaki erişim engelini kaldırmak ister misiniz?",
      remove: "Kaldır",
      ignore: "Yok say",
      remember: "Kaldırmayı hatırla",
      autoConfirmTitle: "Kaldırmayı hatırla?",
      autoConfirmText:
        "Unwall {site} üzerinde yüksek güvenli erişim duvarlarını tekrar sormadan kaldıracak.",
      autoConfirmEnable: "Kaldırmayı hatırla",
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
      autoEnableSite: "Bu site için kaldırmayı hatırla",
      autoDisableSite: "Bu site için kaldırmayı hatırlamayı kapat",
      forgetSite: "Bu sitenin ayarını unut",
      diagnostics: "Teşhis bilgilerini göster",
      autoEnabled: "Unwall bu site için kaldırmayı hatırlayacak.",
      autoDisabled: "Bu site için kaldırmayı hatırlama kapalı.",
      siteForgotten: "Bu sitenin ayarı unutuldu.",
      sensitiveAutoBlocked:
        "Hassas sitelerde otomatik kaldırma devre dışıdır.",
      sensitiveDetectionBlocked:
        "Hassas sitelerde otomatik algılama devre dışıdır.",
      tableConfidence: "Güven",
      tablePopupCount: "Popup",
      tableBackdropCount: "Backdrop",
      tableBlurCount: "Blur elementi",
      tableInlineGateCount: "Satır içi engel",
      tableScrollLock: "Scroll kilidi",
      tableTextSignals: "Metin sinyali",
      tableDomSignals: "DOM sinyali",
      tableSiteKey: "Site anahtarı",
      tableSiteMode: "Site modu",
      tableAutoEligible: "Otomatik uygun",
      tableAutoThreshold: "Otomatik eşik",
      tableReasons: "Nedenler",
      resultPopupHidden: "Gizlenen popup",
      resultBackdropHidden: "Gizlenen backdrop",
      resultBlurFixed: "Düzeltilen blur",
      resultInlineGateHidden: "Gizlenen satır içi engel",
      resultResidualNoticeHidden: "Gizlenen artık uyarı",
      resultControlsRevealed: "Açılan kontroller",
      resultControlsRehydrated: "Yeniden oluşturulan kontroller",
      resultRehydrationReason: "Yeniden oluşturma nedeni",
      resultCSSScrollLock: "CSS scroll kilidi",
      resultJSScrollLock: "JS scroll kilidi"
    },
    ru: {
      active: "Unwall активен.",
      wallTitle: "Unwall обнаружил стену доступа",
      wallDescription: "Удалить блокировку доступа на этой странице?",
      remove: "Удалить",
      ignore: "Игнорировать",
      remember: "Запомнить удаление",
      autoConfirmTitle: "Запомнить удаление для сайта?",
      autoConfirmText:
        "Unwall будет удалять надежно обнаруженные стены доступа на {site} без повторного запроса.",
      autoConfirmEnable: "Запомнить удаление",
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
      autoEnableSite: "Запомнить удаление для сайта",
      autoDisableSite: "Отключить запомненное удаление для сайта",
      forgetSite: "Забыть настройку сайта",
      diagnostics: "Показать диагностику",
      autoEnabled: "Удаление запомнено для этого сайта.",
      autoDisabled: "Запомненное удаление отключено для этого сайта.",
      siteForgotten: "Настройка этого сайта удалена.",
      sensitiveAutoBlocked:
        "Автоматическое удаление отключено на чувствительных сайтах.",
      sensitiveDetectionBlocked:
        "Автоматическое обнаружение отключено на чувствительных сайтах.",
      tableConfidence: "Уверенность",
      tablePopupCount: "Окна",
      tableBackdropCount: "Фоны",
      tableBlurCount: "Размытие",
      tableInlineGateCount: "Встроенные блоки",
      tableScrollLock: "Блокировка прокрутки",
      tableTextSignals: "Текстовые сигналы",
      tableDomSignals: "DOM-сигналы",
      tableSiteKey: "Ключ сайта",
      tableSiteMode: "Режим сайта",
      tableAutoEligible: "Авто подходит",
      tableAutoThreshold: "Порог авто",
      tableReasons: "Причины",
      resultPopupHidden: "Скрыто окон",
      resultBackdropHidden: "Скрыто фонов",
      resultBlurFixed: "Исправлено размытие",
      resultInlineGateHidden: "Скрыто встроенных блоков",
      resultResidualNoticeHidden: "Скрыто остаточных уведомлений",
      resultControlsRevealed: "Открыто элементов",
      resultControlsRehydrated: "Восстановлено элементов",
      resultRehydrationReason: "Причина восстановления",
      resultCSSScrollLock: "CSS-блокировка прокрутки",
      resultJSScrollLock: "JS-блокировка прокрутки"
    }
  };

  const messages =
    messagesByLanguage[language] ||
    messagesByLanguage.en;

  const antiAdblockPatternSets = {
    en: [
      /(?:ad[-\s]*block(?:er|ing)?|ad\s*block(?:er|ing)?|anti[-\s]*banner).{0,50}(?:detected|enabled|active|found|running|in use)/i,
      /(?:detected|enabled|active|found|running|in use).{0,50}(?:ad[-\s]*block(?:er|ing)?|ad\s*block(?:er|ing)?|anti[-\s]*banner)/i,
      /(?:you(?:'re| are)?|you seem to be|it looks like you(?:'re| are)?).{0,60}(?:using|running).{0,40}(?:an? )?(?:ad[-\s]*block(?:er|ing)?|ad\s*block(?:er|ing)?|anti[-\s]*banner)/i,
      /(?:disable|turn off|pause|remove).{0,50}(?:your )?(?:ad[-\s]*block(?:er|ing)?|ad\s*block(?:er|ing)?|anti[-\s]*banner)/i,
      /please.{0,40}(?:disable|turn off|pause|remove).{0,50}(?:ad[-\s]*block|ad\s*block|anti[-\s]*banner)/i,
      /(?:ad[-\s]*block(?:er|ing)?|ad\s*block(?:er|ing)?|anti[-\s]*banner).{0,80}(?:site|download|refresh|access|continue|support)/i,
      /whitelist.{0,40}(?:this )?(?:site|website)/i,
      /(?:allow|enable).{0,50}(?:ads?|advertis(?:ing|ements)?).{0,50}(?:site|website|continue|access|support|free)/i
    ],
    tr: [
      /reklam engelleyici(?:niz|yi)?.{0,60}(?:alg[ıi]land[ıi]|tespit edildi|bulundu|aç[ıi]k|etkin|kullan(?:d[ıi]ğ[ıi]n[ıi]z|[ıi]yorsunuz)?|anla[şs][ıi]l[ıi]yor)/i,
      /(?:alg[ıi]land[ıi]|tespit edildi|bulundu|anla[şs][ıi]l[ıi]yor).{0,60}reklam engelleyici/i,
      /(?:kapat|devre d[ıi][şs][ıi]|duraklat).{0,50}(?:reklam engelleyici|reklam engellemeyi)/i,
      /reklam engellemeyi.{0,40}(?:devre d[ıi][şs][ıi]|kapat|duraklat)/i,
      /devam etmek için.{0,40}reklam engelleyici/i,
      /siteyi.{0,40}(?:beyaz listeye|izin verilenlere).{0,40}ekleyin/i,
      /(?:lütfen|devam etmek için|eri[şs]im için|sitemiz(?:de|e|i)?).{0,50}(?:reklamlara|reklama).{0,40}izin ver(?:in|iniz)?/i,
      /(?:reklamlara|reklama).{0,40}izin ver(?:in|iniz)?.{0,50}(?:devam|eri[şs]im|site|sitemiz|destek)/i
    ],
    ru: [
      /блокировщик рекламы.{0,60}(?:обнаружен|включен|активен|найден|работает|используется)/i,
      /(?:обнаружен|включен|активен|найден|работает|используется).{0,60}блокировщик рекламы/i,
      /(?:похоже|кажется)?.{0,40}(?:вы )?(?:используете|запустили|включили).{0,50}(?:блокировщик рекламы|блокировку рекламы)/i,
      /(?:отключите|выключите|деактивируйте|приостановите|уберите).{0,50}блокировщик рекламы/i,
      /(?:отключите|выключите|деактивируйте|приостановите|уберите).{0,50}блокировку рекламы/i,
      /добавьте.{0,40}(?:сайт|нас).{0,40}(?:в белый список|в список исключений)/i,
      /(?:разрешите|включите).{0,50}реклам[уы].{0,50}(?:сайт|продолж|доступ|поддерж)/i,
      /реклам[уы].{0,50}(?:разрешите|включите).{0,50}(?:сайт|продолж|доступ|поддерж)/i
    ]
  };

  const fallbackPatternLanguages = ["en", "tr", "ru"];
  const antiAdblockPatterns = [
    ...(antiAdblockPatternSets[language] || []),
    ...fallbackPatternLanguages
      .filter(patternLanguage => patternLanguage !== language)
      .flatMap(patternLanguage => antiAdblockPatternSets[patternLanguage] || [])
  ];

  const antiAdblockAttributePatterns = [
    /\bad[-\s]*block(?:er|ing)?\b/i,
    /\bad\s*block(?:er|ing)?\b/i,
    /\badblock(?:er|ing)?\b/i,
    /\banti[-\s]*banner\b/i,
    /\banti[-\s]*ad[-\s]*block(?:er|ing)?\b/i,
    /\banti\s*ad\s*block(?:er|ing)?\b/i,
    /\bad[-\s]*block(?:er|ing)?\s*(?:overlay|modal|popup|wall|notice|detect|detected|download|refresh)\b/i,
    /\bad\s*block(?:er|ing)?\s*(?:overlay|modal|popup|wall|notice|detect|detected)\b/i,
    /\b(?:overlay|modal|popup|wall|notice|download|refresh)\s*(?:ad[-\s]*block(?:er|ing)?|anti[-\s]*banner)\b/i,
    /\b(?:overlay|modal|popup|wall|notice)\s*ad\s*block(?:er|ing)?\b/i
  ];

  const inlineGateContextPattern =
    /(?:download|downloaded|refresh|reload|site|access|continue|allow|whitelist|support|indir|yenile|eri[şs]im|devam|скач|загруз|обнов|доступ)/i;

  const inlineGateActionPattern =
    /(?:(?:please|you need to|you must|must|have to|required).{0,80})?(?:disable|turn off|whitelist|allow|pause|remove).{0,80}(?:ad[-\s]*block(?:er|ing)?|anti[-\s]*banner|ads?|advertis(?:e|ement|ing))|(?:ad[-\s]*block(?:er|ing)?|anti[-\s]*banner|ads?|advertis(?:e|ement|ing)).{0,80}(?:disable|turn off|whitelist|allow|refresh|reload|downloaded|download|continue|support)|(?:devre d[ıi][şs][ıi]|kapat|izin|beyaz liste|yenile|indir|devam).{0,80}(?:reklam|engelleyici)|(?:reklam|engelleyici).{0,80}(?:devre d[ıi][şs][ıi]|kapat|izin|beyaz liste|yenile|indir|devam)|(?:отключите|выключите|деактивируйте|разрешите|добавьте|обновите).{0,80}(?:реклам|блокиров)|(?:реклам|блокиров).{0,80}(?:отключ|выключ|разреш|добав|обнов)/i;

  const downloadControlTokenPattern =
    /(?:download|downloaded|downlink|file|firmware|rom|mirror|indir|yükle|yukle|скач|загруз)/i;

  const rehydrationControlTokenPattern =
    /(?:download|downloaded|downlink|file|firmware|rom|mirror|server|redirect|tok=|wp-content\/uploads|\.zip\b|\.rar\b|\.7z\b|\.img\b|\.bin\b|\.tar\b|\.gz\b|\.xz\b|\.apk\b|\.exe\b|\.msi\b|\.dmg\b|\.iso\b|\.rom\b|\.pac\b|indir|yükle|yukle|скач|загруз)/i;

  const broadRehydrationSourceTokenPattern =
    /(?:\bnav(?:igation)?\b|\bmenu\b|\bcategory\b|\bcategories\b|\bcat[-_\s]*item\b|\bbreadcrumb\b|\bheader\b|\bfooter\b|\bsidebar\b|\bwidget\b|\barchive\b|\btaxonomy\b|\bpagination\b|\bpage[-_\s]*numbers\b|\bsocial\b|\bshare\b|\brelated\b|\bpopular\b|\blatest\b)/i;

  const residualInlineNoticePattern =
    /(?:advertisement|advertisements|advertising|ad revenue|living on ads|living on advertisement|lives on ads|lives on advertisement|support.{0,40}ads|ads.{0,40}support|thank you|reklam|te[şs]ekkür|спасибо|реклам)/i;

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
    delayedScanTimers: [],
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
    snapshotObserver: null,
    snapshotTimer: null,
    downloadSlotSnapshots: [],
    downloadSlotSnapshotKeys: new Set(),
    globalDetection: true,
    siteModes: {},
    siteMode: MODES.default,
    stopped: false
  };

  const scrollListenerTracker = setupScrollListenerTracker();
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

  function normalizeListenerOptions(options) {
    if (options === true || options === false) {
      return {
        capture: Boolean(options),
        passive: null,
        once: false,
        signal: null
      };
    }

    if (options && typeof options === "object") {
      return {
        capture: Boolean(options.capture),
        passive:
          typeof options.passive === "boolean"
            ? options.passive
            : null,
        once: Boolean(options.once),
        signal: options.signal || null
      };
    }

    return {
      capture: false,
      passive: null,
      once: false,
      signal: null
    };
  }

  function listenerTargetLabel(target) {
    if (target === window || target === pageWindow) {
      return "window";
    }

    if (target === document) {
      return "document";
    }

    if (target === document.documentElement) {
      return "html";
    }

    if (target === document.body) {
      return "body";
    }

    if (target instanceof Element) {
      const tag = target.tagName.toLowerCase();
      const id = target.id ? `#${target.id}` : "";
      const classes = [...target.classList]
        .slice(0, 3)
        .map(className => `.${className}`)
        .join("");

      return `${tag}${id}${classes}`;
    }

    return Object.prototype.toString.call(target);
  }

  function setupScrollListenerTracker() {
    const trackerKey = "__unwallScrollListenerTracker";
    const trackerWindow = pageWindow || window;
    const EventTargetPrototype =
      trackerWindow.EventTarget?.prototype ||
      EventTarget.prototype;

    try {
      if (trackerWindow[trackerKey]?.records) {
        return trackerWindow[trackerKey];
      }
    } catch {}

    const records = [];
    const nativeAddEventListener =
      EventTargetPrototype.addEventListener;
    const nativeRemoveEventListener =
      EventTargetPrototype.removeEventListener;

    function pruneRecords() {
      while (records.length > TRACKED_SCROLL_LISTENER_LIMIT) {
        records.shift();
      }
    }

    function rememberRecord(target, type, listener, options) {
      if (
        !SCROLL_LOCK_EVENT_TYPES.has(type) ||
        (
          typeof listener !== "function" &&
          !(listener && typeof listener.handleEvent === "function")
        )
      ) {
        return;
      }

      const normalizedOptions = normalizeListenerOptions(options);

      if (normalizedOptions.once) {
        return;
      }

      const existing = records.find(record =>
        record.target === target &&
        record.type === type &&
        record.listener === listener &&
        record.capture === normalizedOptions.capture
      );

      if (existing) {
        existing.options = options;
        existing.passive = normalizedOptions.passive;
        existing.signal = normalizedOptions.signal;
        existing.createdAt = Date.now();
        return;
      }

      records.push({
        target,
        targetLabel: listenerTargetLabel(target),
        type,
        listener,
        options,
        capture: normalizedOptions.capture,
        passive: normalizedOptions.passive,
        signal: normalizedOptions.signal,
        createdAt: Date.now(),
        stack: new Error().stack || "",
        removed: false
      });

      pruneRecords();
    }

    function forgetRecord(target, type, listener, options) {
      const normalizedOptions = normalizeListenerOptions(options);

      for (let index = records.length - 1; index >= 0; index -= 1) {
        const record = records[index];

        if (
          record.target === target &&
          record.type === type &&
          record.listener === listener &&
          record.capture === normalizedOptions.capture
        ) {
          records.splice(index, 1);
        }
      }
    }

    EventTargetPrototype.addEventListener = function (type, listener, options) {
      const result =
        nativeAddEventListener.call(this, type, listener, options);

      try {
        rememberRecord(this, String(type), listener, options);
      } catch (error) {
        console.warn(`${APP_NAME}: scroll listener tracking failed`, error);
      }

      return result;
    };

    EventTargetPrototype.removeEventListener = function (type, listener, options) {
      const result =
        nativeRemoveEventListener.call(this, type, listener, options);

      try {
        forgetRecord(this, String(type), listener, options);
      } catch (error) {
        console.warn(`${APP_NAME}: scroll listener untracking failed`, error);
      }

      return result;
    };

    const tracker = {
      records,
      nativeAddEventListener,
      nativeRemoveEventListener
    };

    try {
      Object.defineProperty(trackerWindow, trackerKey, {
        configurable: true,
        enumerable: false,
        value: tracker
      });
    } catch {}

    return tracker;
  }

  function waitForDocumentReady() {
    if (document.body && document.readyState !== "loading") {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      let done = false;

      const finish = () => {
        if (done) {
          return;
        }

        if (!document.body && document.readyState === "loading") {
          return;
        }

        done = true;
        document.removeEventListener("DOMContentLoaded", finish, true);
        resolve();
      };

      document.addEventListener("DOMContentLoaded", finish, true);
      window.setTimeout(finish, 3000);
      finish();
    });
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

  function hasInlineGateContext(element) {
    const text = normalizedText(element);
    const signalText = getAttributeSignalText(element);

    return (
      inlineGateContextPattern.test(text) ||
      inlineGateContextPattern.test(signalText)
    );
  }

  function hasInlineGateActionSignal(element) {
    const text = normalizedText(element);
    const signalText = getAttributeSignalText(element);

    return (
      inlineGateActionPattern.test(text) ||
      inlineGateActionPattern.test(signalText)
    );
  }

  function isInlineGateBoundary(element) {
    if (!(element instanceof Element)) {
      return true;
    }

    return [
      "html",
      "body",
      "main",
      "article",
      "form"
    ].includes(element.tagName.toLowerCase());
  }

  function looksLikeInlineGate(element) {
    if (
      !(element instanceof Element) ||
      isInUnwallUI(element) ||
      isInlineGateBoundary(element) ||
      containsProtectedContent(element) ||
      !isVisible(element) ||
      !hasAntiAdblockSignal(element) ||
      !hasInlineGateContext(element)
    ) {
      return false;
    }

    const text = normalizedText(element);
    const styleSignals = inlineGateNoticeStyleSignals(element);
    const noticeStyled =
      styleSignals.hasBackground &&
      styleSignals.hasPadding &&
      (
        styleSignals.hasLeftBorder ||
        styleSignals.hasBorder
      );
    const signalLineCount = inlineGateSignalLineCount(element);
    const strongNoticeEvidence =
      noticeStyled &&
      (
        signalLineCount >= 2 ||
        hasResidualInlineNoticeSignal(element)
      );

    if (
      !hasInlineGateActionSignal(element) &&
      !strongNoticeEvidence
    ) {
      return false;
    }

    const maxTextLength = noticeStyled ? 1200 : 900;

    if (text.length < 12 || text.length > maxTextLength) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const { width, height } = viewportSize();
    const maxInlineWidth =
      noticeStyled
        ? Math.min(width * 0.98, 1400)
        : Math.min(width * 0.95, 900);

    const boundedWidth =
      rect.width >= 80 &&
      rect.width <= maxInlineWidth;

    const boundedHeight =
      rect.height >= 12 &&
      rect.height <= Math.min(height * 0.8, 320);

    return boundedWidth && boundedHeight;
  }

  function inlineGateNoticeStyleSignals(element) {
    const style = getComputedStyle(element);
    const borderWidths = [
      style.borderTopWidth,
      style.borderRightWidth,
      style.borderBottomWidth,
      style.borderLeftWidth
    ].map(value => parseFloat(value) || 0);
    const paddings = [
      style.paddingTop,
      style.paddingRight,
      style.paddingBottom,
      style.paddingLeft
    ].map(value => parseFloat(value) || 0);

    return {
      hasBackground: getColorAlpha(style.backgroundColor) > 0.04,
      hasBorder: borderWidths.some(width => width >= 1),
      hasLeftBorder: borderWidths[3] >= 2,
      hasPadding: paddings.some(padding => padding >= 6)
    };
  }

  function inlineGateSignalLineCount(element) {
    const nodes = [element];

    try {
      nodes.push(
        ...[...element.querySelectorAll("p,span,div,section,aside,strong,b,em,small,li")]
          .slice(0, 80)
      );
    } catch {}

    const lines = new Set();

    for (const node of nodes) {
      if (!(node instanceof Element) || !isVisible(node)) {
        continue;
      }

      const text = normalizedText(node);

      if (!text || text.length > 900) {
        continue;
      }

      if (!hasAntiAdblockSignal(node) && !hasResidualInlineNoticeSignal(node)) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      lines.add(`${Math.round(rect.top)}:${text.slice(0, 100)}`);
    }

    return lines.size;
  }

  function inlineGateCandidateScore(element, warningElement) {
    if (!looksLikeInlineGate(element)) {
      return -Infinity;
    }

    const text = normalizedText(element);
    const styleSignals = inlineGateNoticeStyleSignals(element);
    const lineCount = inlineGateSignalLineCount(element);
    const rect = element.getBoundingClientRect();
    const tag = element.tagName.toLowerCase();
    let score = 0;

    if (element.contains(warningElement)) {
      score += 8;
    }

    if (element !== warningElement) {
      score += 10;
    }

    if (lineCount >= 2) {
      score += 22 + Math.min(lineCount, 5) * 3;
    }

    if (hasResidualInlineNoticeSignal(element)) {
      score += 10;
    }

    if (styleSignals.hasBackground) {
      score += 12;
    }

    if (styleSignals.hasLeftBorder) {
      score += 16;
    } else if (styleSignals.hasBorder) {
      score += 8;
    }

    if (styleSignals.hasPadding) {
      score += 10;
    }

    if (rect.width >= 180) {
      score += 4;
    }

    if (rect.height >= 32) {
      score += 6;
    }

    if (containsVisibleControl(element)) {
      score -= 18;
    }

    if (text.length > 700) {
      score -= 10;
    }

    if (
      tag === "span" &&
      lineCount <= 1 &&
      !styleSignals.hasBackground &&
      !styleSignals.hasBorder &&
      !styleSignals.hasPadding
    ) {
      score -= 30;
    }

    return score;
  }

  function findInlineGate(element) {
    let current = element;
    const candidates = [];

    while (
      current &&
      current !== document.body &&
      current !== document.documentElement
    ) {
      if (looksLikeInlineGate(current)) {
        candidates.push({
          element: current,
          score: inlineGateCandidateScore(current, element)
        });
      }

      if (isInlineGateBoundary(current.parentElement)) {
        break;
      }

      current = current.parentElement;
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.score > -Infinity
      ? candidates[0].element
      : null;
  }

  function elementOverlapsAny(element, elements) {
    return elements.some(other =>
      other === element ||
      other.contains(element) ||
      element.contains(other)
    );
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

  function uniqueOutermostElements(elements) {
    const unique = uniqueElements(elements);

    return unique.filter(element =>
      !unique.some(other =>
        other !== element &&
        other.contains(element)
      )
    );
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

    const wrapsHiddenDetection = [
      ...detection.popups,
      ...detection.backdrops,
      ...detection.inlineGates
    ].some(related =>
      related !== element &&
      related.hasAttribute("data-unwall-hidden") &&
      element.contains(related)
    );

    const elevatedDetectionWrapper =
      wrapsHiddenDetection &&
      numericZIndex(element) >= 5;

    const blockerish =
      hasBlur(style) ||
      transparentish ||
      style.cursor === "not-allowed" ||
      elevatedDetectionWrapper;

    const lowContent =
      visibleNormalizedText(element).length < 120 &&
      !containsVisibleControl(element);
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

  function isSafeInlineRevealScope(element) {
    if (
      !(element instanceof Element) ||
      isInUnwallUI(element) ||
      isInlineGateBoundary(element) ||
      containsProtectedContent(element)
    ) {
      return false;
    }

    const text = normalizedText(element);

    if (text.length > 3000) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const { width } = viewportSize();

    return (
      rect.width === 0 ||
      rect.height === 0 ||
      (
        rect.width <= width * 0.98 &&
        rect.height <= 600
      )
    );
  }

  function inlineRevealScopes(inlineGate) {
    const scopes = new Set();
    const parent = inlineGate.parentElement;

    if (isSafeInlineRevealScope(parent)) {
      scopes.add(parent);
    }

    for (const sibling of [
      inlineGate.previousElementSibling,
      inlineGate.nextElementSibling,
      parent?.previousElementSibling,
      parent?.nextElementSibling
    ]) {
      if (isSafeInlineRevealScope(sibling)) {
        scopes.add(sibling);
      }
    }

    return [...scopes];
  }

  function hiddenOrDisabled(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const style = getComputedStyle(element);

    return (
      element.hasAttribute("hidden") ||
      element.getAttribute("aria-hidden") === "true" ||
      element.hasAttribute("disabled") ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      Number(style.opacity || 1) <= 0.02 ||
      style.pointerEvents === "none"
    );
  }

  function downloadControlSignal(element) {
    return normalizedSignalText([
      element.id,
      element.className,
      element.getAttribute?.("name"),
      element.getAttribute?.("aria-label"),
      element.getAttribute?.("title"),
      element.getAttribute?.("href"),
      element.getAttribute?.("download"),
      element.getAttribute?.("onclick"),
      element.getAttribute?.("data-key"),
      normalizedText(element).slice(0, 160)
    ].join(" "));
  }

  function looksLikeDownloadControl(element, detection) {
    if (
      !(element instanceof Element) ||
      isInUnwallUI(element) ||
      containsProtectedContent(element) ||
      elementOverlapsAny(element, detection.inlineGates)
    ) {
      return false;
    }

    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    const controlLike =
      tag === "a" ||
      tag === "button" ||
      role === "button" ||
      element.hasAttribute("download") ||
      element.hasAttribute("href");

    return (
      controlLike &&
      hiddenOrDisabled(element) &&
      downloadControlTokenPattern.test(downloadControlSignal(element))
    );
  }

  function looksLikeDownloadControlCandidate(element, detection) {
    if (
      !(element instanceof Element) ||
      isInUnwallUI(element) ||
      containsProtectedContent(element) ||
      elementOverlapsAny(element, detection.inlineGates)
    ) {
      return false;
    }

    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    const controlLike =
      tag === "a" ||
      tag === "button" ||
      role === "button" ||
      element.hasAttribute("download") ||
      element.hasAttribute("href") ||
      element.hasAttribute("onclick") ||
      element.hasAttribute("data-key");

    return (
      controlLike &&
      downloadControlTokenPattern.test(downloadControlSignal(element))
    );
  }

  function containsDownloadControlCandidate(element, detection) {
    if (!(element instanceof Element)) {
      return false;
    }

    try {
      return [
        ...element.querySelectorAll(
          'a,button,[role="button"],[download],[href],[onclick],[data-key]'
        )
      ]
        .slice(0, 120)
        .some(candidate =>
          looksLikeDownloadControlCandidate(candidate, detection)
        );
    } catch {
      return false;
    }
  }

  function looksLikeHiddenDownloadScope(element, detection) {
    return (
      element instanceof Element &&
      !isInUnwallUI(element) &&
      !containsProtectedContent(element) &&
      !elementOverlapsAny(element, detection.inlineGates) &&
      hiddenOrDisabled(element) &&
      containsDownloadControlCandidate(element, detection)
    );
  }

  function defaultDisplayFor(element) {
    const tag = element.tagName.toLowerCase();

    return ["a", "button", "span"].includes(tag)
      ? "inline-block"
      : "block";
  }

  function revealInlineControl(element, restore) {
    let changed = false;
    const style = getComputedStyle(element);

    if (element.hasAttribute("hidden")) {
      restore.setAttribute(element, "hidden", null);
      changed = true;
    }

    if (element.getAttribute("aria-hidden") === "true") {
      restore.setAttribute(element, "aria-hidden", "false");
      changed = true;
    }

    if (element.hasAttribute("disabled")) {
      restore.setAttribute(element, "disabled", null);
      changed = true;
    }

    if (style.display === "none") {
      restore.setStyle(element, "display", defaultDisplayFor(element), "important");
      changed = true;
    }

    if (
      style.visibility === "hidden" ||
      style.visibility === "collapse"
    ) {
      restore.setStyle(element, "visibility", "visible", "important");
      changed = true;
    }

    if (Number(style.opacity || 1) <= 0.02) {
      restore.setStyle(element, "opacity", "1", "important");
      changed = true;
    }

    if (style.pointerEvents === "none") {
      restore.setStyle(element, "pointer-events", "auto", "important");
      changed = true;
    }

    return changed;
  }

  function revealInlineGateControls(detection, restore) {
    const candidates = new Set();

    for (const inlineGate of detection.inlineGates) {
      for (const scope of inlineRevealScopes(inlineGate)) {
        candidates.add(scope);

        try {
          for (const element of [
            ...scope.querySelectorAll(
              'a,button,[role="button"],[download],[href],[class],[id],[aria-label],[title]'
            )
          ].slice(0, 120)) {
            candidates.add(element);
          }
        } catch {}
      }
    }

    let revealedCount = 0;

    for (const element of candidates) {
      if (
        (
          looksLikeDownloadControl(element, detection) ||
          looksLikeHiddenDownloadScope(element, detection)
        ) &&
        revealInlineControl(element, restore)
      ) {
        revealedCount += 1;
      }
    }

    return revealedCount;
  }

  function cssEscape(value) {
    try {
      if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return CSS.escape(value);
      }
    } catch {}

    return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function elementAndDescendants(element, selector) {
    const elements = [];

    if (element.matches?.(selector)) {
      elements.push(element);
    }

    try {
      elements.push(...element.querySelectorAll(selector));
    } catch {}

    return elements;
  }

  function extractWindowOpenTarget(value) {
    const match = String(value || "").match(
      /window\.open\s*\(\s*(['"])(.*?)\1/i
    );

    return match?.[2] || "";
  }

  function safeNavigationUrl(value, baseUrl = location.href) {
    const rawValue = String(value || "").trim();

    if (
      !rawValue ||
      /^(?:javascript|data|blob|about):/i.test(rawValue)
    ) {
      return null;
    }

    try {
      const url = new URL(rawValue, baseUrl);

      return ["http:", "https:"].includes(url.protocol)
        ? url
        : null;
    } catch {
      return null;
    }
  }

  function rehydrationSourceText(element) {
    return normalizedSignalText([
      normalizedText(element).slice(0, 800),
      element.id,
      element.className
    ].join(" "));
  }

  function sourceSlotHasDownloadContext(element) {
    return rehydrationControlTokenPattern.test(
      rehydrationSourceText(element)
    );
  }

  function rehydrationSourceSignal(element) {
    const parts = [];
    let current = element;
    let depth = 0;

    while (
      current &&
      current instanceof Element &&
      depth < 4
    ) {
      parts.push(
        current.tagName,
        current.id,
        current.className,
        current.getAttribute("role"),
        current.getAttribute("aria-label")
      );
      current = current.parentElement;
      depth += 1;
    }

    return normalizedSignalText(parts.join(" "));
  }

  function hasBroadRehydrationSourceSignal(element) {
    if (!(element instanceof Element)) {
      return true;
    }

    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");

    return (
      ["nav", "header", "footer"].includes(tag) ||
      ["navigation", "menubar", "menu"].includes(role) ||
      Boolean(element.closest?.("nav,header,footer,[role='navigation']")) ||
      broadRehydrationSourceTokenPattern.test(
        rehydrationSourceSignal(element)
      )
    );
  }

  function rehydrationSourceIsBounded(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const rect = element.getBoundingClientRect?.();

    if (!rect) {
      return true;
    }

    const { width } = viewportSize();

    return (
      rect.width === 0 ||
      rect.height === 0 ||
      (
        rect.width <= width * 0.98 &&
        rect.height <= 520
      )
    );
  }

  function rehydrationElementKeys(element) {
    if (!(element instanceof Element)) {
      return [];
    }

    const tag = element.tagName.toLowerCase();
    const keys = [];

    if (element.id) {
      keys.push(`#${element.id}`);
      keys.push(`${tag}#${element.id}`);
    }

    const classes = [...element.classList].filter(Boolean);

    if (classes.length > 0) {
      keys.push(`.${classes.join(".")}`);
      keys.push(`${tag}.${classes.join(".")}`);
    }

    return keys;
  }

  function rehydrationAncestorKeys(element) {
    const keys = new Set();
    let current = element;
    let depth = 0;

    while (
      current &&
      current instanceof Element &&
      current !== document.documentElement &&
      depth < 6
    ) {
      for (const key of rehydrationElementKeys(current)) {
        keys.add(key);
      }

      current = current.parentElement;
      depth += 1;
    }

    return [...keys];
  }

  function rehydrationLinkData(anchor) {
    if (!(anchor instanceof Element)) {
      return null;
    }

    const href = anchor.getAttribute("href") || "";
    const onclickTarget = extractWindowOpenTarget(
      anchor.getAttribute("onclick")
    );
    const target =
      href && !/^javascript:/i.test(href) && href !== "#"
        ? href
        : onclickTarget;

    if (String(target || "").trim().startsWith("#")) {
      return null;
    }

    const url = safeNavigationUrl(target);

    if (!url) {
      return null;
    }

    if (
      url.hash &&
      url.origin === location.origin &&
      url.pathname === location.pathname &&
      url.search === location.search
    ) {
      return null;
    }

    const signal = normalizedSignalText([
      anchor.id,
      anchor.className,
      anchor.getAttribute("name"),
      anchor.getAttribute("aria-label"),
      anchor.getAttribute("title"),
      anchor.getAttribute("download"),
      href,
      onclickTarget,
      url.href,
      normalizedText(anchor).slice(0, 180)
    ].join(" "));

    const hasDirectSignal =
      rehydrationControlTokenPattern.test(signal);

    if (!hasDirectSignal) {
      return null;
    }

    return {
      href: url.href,
      text: normalizedText(anchor).slice(0, 160),
      title: anchor.getAttribute("title") || "",
      download: anchor.getAttribute("download") || ""
    };
  }

  function rehydrationLinkDataList(sourceSlot) {
    const anchors = elementAndDescendants(sourceSlot, "a");
    const entries = [];

    anchors.forEach((anchor, index) => {
      const data = rehydrationLinkData(anchor, sourceSlot);

      if (data) {
        entries.push({
          index,
          anchor,
          data
        });
      }
    });

    return entries;
  }

  function liveRehydrationSlots(inlineGate) {
    const slots = [];
    let current = inlineGate.parentElement;
    let depth = 0;

    while (
      current &&
      current !== document.body &&
      current !== document.documentElement &&
      depth < 4
    ) {
      if (isSafeInlineRevealScope(current)) {
        slots.push({
          element: current,
          depth
        });
      }

      if (isInlineGateBoundary(current.parentElement)) {
        break;
      }

      current = current.parentElement;
      depth += 1;
    }

    return slots;
  }

  function sourceSelectorsForLiveSlot(element) {
    const tag = element.tagName.toLowerCase();
    const selectors = [];

    if (element.id) {
      selectors.push(`#${cssEscape(element.id)}`);
    }

    const classes = [...element.classList]
      .filter(Boolean)
      .slice(0, 3);

    if (classes.length > 0) {
      selectors.push(
        `${tag}${classes.map(className => `.${cssEscape(className)}`).join("")}`
      );

      for (const className of classes) {
        selectors.push(`.${cssEscape(className)}`);
      }
    }

    return uniqueElements(selectors);
  }

  function sourceSlotsForLiveSlot(liveSlot, sourceDocument) {
    const selectors = sourceSelectorsForLiveSlot(liveSlot);
    const candidates = [];

    for (const selector of selectors) {
      try {
        for (const element of [
          ...sourceDocument.querySelectorAll(selector)
        ].slice(0, 30)) {
          candidates.push(element);
        }
      } catch {}
    }

    return uniqueElements(candidates);
  }

  function rehydrationSourceRejectionReason(element) {
    if (
      !(element instanceof Element) ||
      containsProtectedContent(element) ||
      hasAntiAdblockSignal(element)
    ) {
      return "protected-or-wall-source";
    }

    if (hasBroadRehydrationSourceSignal(element)) {
      return "rejected-broad-source";
    }

    const text = normalizedText(element);

    if (text.length < 4) {
      return "empty-source";
    }

    if (text.length > 1400) {
      return "rejected-broad-source";
    }

    if (!rehydrationSourceIsBounded(element)) {
      return "rejected-broad-source";
    }

    const links = rehydrationLinkDataList(element);

    if (links.length === 0) {
      return "no-source-controls";
    }

    if (links.length > REHYDRATION_LINK_LIMIT) {
      return "rejected-broad-source";
    }

    if (!sourceSlotHasDownloadContext(element)) {
      return "no-source-controls";
    }

    return "";
  }

  function looksLikeRehydrationSourceSlot(element) {
    return !rehydrationSourceRejectionReason(element);
  }

  function scoreRehydrationSourceSlot(sourceSlot, liveSlot, depth) {
    const links = rehydrationLinkDataList(sourceSlot);
    let score = links.length * 25;

    if (liveSlot.id && sourceSlot.id === liveSlot.id) {
      score += 25;
    }

    const liveClasses = [...liveSlot.classList];
    const sharedClassCount = liveClasses.filter(className =>
      sourceSlot.classList.contains(className)
    ).length;

    score += sharedClassCount * 28;
    score -= depth * 8;

    const textLength = normalizedText(sourceSlot).length;

    if (textLength < 900) {
      score += 12;
    }

    if (sourceSlot.tagName === liveSlot.tagName) {
      score += 8;
    }

    return score;
  }

  function scoreSnapshotSlotCandidate(element, depth) {
    const links = rehydrationLinkDataList(element);
    const signal = rehydrationSourceSignal(element);
    let score = links.length * 35;

    if (rehydrationControlTokenPattern.test(signal)) {
      score += 18;
    }

    if (element.id || element.classList.length > 0) {
      score += 12;
    }

    if (["li", "div", "section"].includes(element.tagName.toLowerCase())) {
      score += 6;
    }

    const textLength = normalizedText(element).length;

    if (textLength < 700) {
      score += 10;
    }

    return score - depth * 6;
  }

  function snapshotSlotCandidatesForAnchor(anchor) {
    const candidates = [];
    let current = anchor.parentElement;
    let depth = 0;

    while (
      current &&
      current !== document.body &&
      current !== document.documentElement &&
      depth < 5
    ) {
      if (
        !current.querySelector?.("[data-unwall-rehydrated-controls]") &&
        isVisible(current) &&
        looksLikeRehydrationSourceSlot(current)
      ) {
        candidates.push({
          element: current,
          score: scoreSnapshotSlotCandidate(current, depth)
        });
      }

      if (isInlineGateBoundary(current.parentElement)) {
        break;
      }

      current = current.parentElement;
      depth += 1;
    }

    return candidates;
  }

  function rememberDownloadSlotSnapshot(element) {
    const linkData = rehydrationLinkDataList(element);

    if (
      linkData.length === 0 ||
      linkData.length > REHYDRATION_LINK_LIMIT
    ) {
      return;
    }

    const key = linkData
      .map(entry => `${entry.data.href}|${entry.data.text}`)
      .join("||");

    if (!key || state.downloadSlotSnapshotKeys.has(key)) {
      return;
    }

    state.downloadSlotSnapshotKeys.add(key);
    state.downloadSlotSnapshots.push({
      sourceSlot: element.cloneNode(true),
      linkData,
      text: normalizedText(element).slice(0, 500),
      ancestorKeys: rehydrationAncestorKeys(element),
      createdAt: Date.now()
    });

    while (state.downloadSlotSnapshots.length > DOWNLOAD_SLOT_SNAPSHOT_LIMIT) {
      const removed = state.downloadSlotSnapshots.shift();
      const removedKey = removed?.linkData
        ?.map(entry => `${entry.data.href}|${entry.data.text}`)
        .join("||");

      if (removedKey) {
        state.downloadSlotSnapshotKeys.delete(removedKey);
      }
    }
  }

  function captureDownloadSlotSnapshots() {
    if (!document.body || state.stopped) {
      return;
    }

    const anchors = [
      ...document.querySelectorAll("a[href],a[onclick]")
    ].slice(0, 220);
    const candidates = [];

    for (const anchor of anchors) {
      if (
        isInUnwallUI(anchor) ||
        anchor.closest?.("[data-unwall-rehydrated-controls]") ||
        anchor.closest?.(protectedSelector) ||
        hasBroadRehydrationSourceSignal(anchor) ||
        containsProtectedContent(anchor) ||
        !isVisible(anchor) ||
        !rehydrationLinkData(anchor)
      ) {
        continue;
      }

      candidates.push(...snapshotSlotCandidatesForAnchor(anchor));
    }

    candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, DOWNLOAD_SLOT_SNAPSHOT_LIMIT)
      .forEach(candidate => rememberDownloadSlotSnapshot(candidate.element));
  }

  function stopDownloadSlotSnapshotObserver() {
    state.snapshotObserver?.disconnect();
    state.snapshotObserver = null;

    if (state.snapshotTimer) {
      window.clearTimeout(state.snapshotTimer);
      state.snapshotTimer = null;
    }
  }

  function startDownloadSlotSnapshotObserver() {
    captureDownloadSlotSnapshots();

    if (
      state.snapshotObserver ||
      !document.documentElement
    ) {
      return;
    }

    const observer = new MutationObserver(mutations => {
      if (
        state.suppressObserver ||
        !mutations.some(mutation => mutation.type === "childList")
      ) {
        return;
      }

      window.setTimeout(captureDownloadSlotSnapshots, 0);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    state.snapshotObserver = observer;
    state.snapshotTimer = window.setTimeout(
      stopDownloadSlotSnapshotObserver,
      DOWNLOAD_SLOT_SNAPSHOT_MS
    );
  }

  function scoreSnapshotRehydrationPlan(snapshot, liveSlot) {
    const liveKeys = rehydrationAncestorKeys(liveSlot.element);
    const relatedKeyCount = snapshot.ancestorKeys.filter(key =>
      liveKeys.includes(key)
    ).length;

    if (relatedKeyCount === 0) {
      return 0;
    }

    let score = snapshot.linkData.length * 40;
    score += relatedKeyCount * 45;
    score -= liveSlot.depth * 10;

    if (snapshot.text.length < 700) {
      score += 10;
    }

    return score;
  }

  function findSnapshotRehydrationSource(detection) {
    captureDownloadSlotSnapshots();

    const plans = [];

    for (const inlineGate of detection.inlineGates) {
      for (const liveSlot of liveRehydrationSlots(inlineGate)) {
        if (liveSlot.element.querySelector("[data-unwall-rehydrated-controls]")) {
          continue;
        }

        for (const snapshot of state.downloadSlotSnapshots) {
          const rejection =
            rehydrationSourceRejectionReason(snapshot.sourceSlot);

          if (rejection) {
            continue;
          }

          const score =
            scoreSnapshotRehydrationPlan(snapshot, liveSlot);

          if (score <= 0) {
            continue;
          }

          plans.push({
            inlineGate,
            targetSlot: liveSlot.element,
            sourceSlot: snapshot.sourceSlot,
            linkData: snapshot.linkData,
            source: "snapshot-source",
            score
          });
        }
      }
    }

    plans.sort((a, b) => b.score - a.score);
    return plans[0] || null;
  }

  function findRehydrationSource(detection, sourceDocument) {
    const plans = [];
    let sawBroadSource = false;

    for (const inlineGate of detection.inlineGates) {
      for (const liveSlot of liveRehydrationSlots(inlineGate)) {
        if (liveSlot.element.querySelector("[data-unwall-rehydrated-controls]")) {
          continue;
        }

        for (const sourceSlot of sourceSlotsForLiveSlot(
          liveSlot.element,
          sourceDocument
        )) {
          const rejection =
            rehydrationSourceRejectionReason(sourceSlot);

          if (rejection) {
            sawBroadSource =
              sawBroadSource ||
              rejection === "rejected-broad-source";
            continue;
          }

          plans.push({
            inlineGate,
            targetSlot: liveSlot.element,
            sourceSlot,
            linkData: rehydrationLinkDataList(sourceSlot),
            source: "refetch-source",
            score: scoreRehydrationSourceSlot(
              sourceSlot,
              liveSlot.element,
              liveSlot.depth
            )
          });
        }
      }
    }

    plans.sort((a, b) => b.score - a.score);
    return {
      plan: plans[0] || null,
      reason: plans[0]
        ? "refetch-source"
        : sawBroadSource
          ? "rejected-broad-source"
          : "no-source-controls"
    };
  }

  function removeUnsafeAttributes(element) {
    try {
      for (const attribute of [...element.attributes]) {
        if (
          /^on/i.test(attribute.name) ||
          attribute.name === "srcdoc" ||
          attribute.name === "ping" ||
          attribute.name === "id"
        ) {
          element.removeAttribute(attribute.name);
        }
      }
    } catch {}
  }

  function sanitizeRehydratedClone(sourceSlot, linkData) {
    const clone = document.importNode(sourceSlot, true);
    const acceptedLinks = new Map(
      linkData.map(entry => [entry.index, entry.data])
    );

    for (const element of elementAndDescendants(
      clone,
      "script,style,noscript,iframe,object,embed,canvas,video,audio,form,input,textarea,select"
    )) {
      element.remove();
    }

    for (const element of elementAndDescendants(clone, "*")) {
      removeUnsafeAttributes(element);
    }

    const cloneAnchors = elementAndDescendants(clone, "a");

    cloneAnchors.forEach((anchor, index) => {
      const data = acceptedLinks.get(index);

      if (!data) {
        const text = normalizedText(anchor);
        anchor.replaceWith(document.createTextNode(text));
        return;
      }

      removeUnsafeAttributes(anchor);
      anchor.setAttribute("href", data.href);
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener nofollow");
      anchor.setAttribute("referrerpolicy", "same-origin");

      if (data.title) {
        anchor.setAttribute("title", data.title);
      }

      if (data.download) {
        anchor.setAttribute("download", data.download);
      }
    });

    return clone;
  }

  function makeRehydratedFragment(plan) {
    const wrapper = document.createElement("div");
    const clone = sanitizeRehydratedClone(
      plan.sourceSlot,
      plan.linkData
    );

    wrapper.setAttribute("data-unwall-rehydrated-controls", "");
    wrapper.setAttribute(
      "data-unwall-rehydrated-source",
      plan.source || "unknown-source"
    );
    wrapper.style.setProperty("display", "block", "important");
    wrapper.style.setProperty("visibility", "visible", "important");
    wrapper.style.setProperty("opacity", "1", "important");
    wrapper.style.setProperty("pointer-events", "auto", "important");

    if (clone.matches?.("a,button,[role='button']")) {
      wrapper.appendChild(clone);
    } else if (clone.childNodes.length > 0) {
      while (clone.firstChild) {
        wrapper.appendChild(clone.firstChild);
      }
    } else {
      wrapper.appendChild(clone);
    }

    return wrapper;
  }

  async function rehydrateInlineGateControls(detection, restore) {
    if (detection.inlineGates.length === 0) {
      return {
        count: 0,
        reason: "no-inline-gates"
      };
    }

    const snapshotPlan = findSnapshotRehydrationSource(detection);

    if (snapshotPlan) {
      const fragment = makeRehydratedFragment(snapshotPlan);

      if (!normalizedText(fragment)) {
        return {
          count: 0,
          reason: "empty-fragment"
        };
      }

      restore.insertNode(snapshotPlan.targetSlot, fragment);

      return {
        count: snapshotPlan.linkData.length,
        reason: "snapshot-source"
      };
    }

    const requestUrl = new URL(location.href);

    if (requestUrl.origin !== location.origin) {
      return {
        count: 0,
        reason: "cross-origin-blocked"
      };
    }

    let response;

    try {
      response = await fetch(requestUrl.href, {
        credentials: "include",
        cache: "no-store"
      });
    } catch (error) {
      console.warn(`${APP_NAME}: inline rehydration fetch failed`, error);
      return {
        count: 0,
        reason: "fetch-failed"
      };
    }

    if (!response.ok) {
      return {
        count: 0,
        reason: `fetch-status-${response.status}`
      };
    }

    let sourceDocument;

    try {
      const html = await response.text();
      sourceDocument = new DOMParser().parseFromString(html, "text/html");
    } catch (error) {
      console.warn(`${APP_NAME}: inline rehydration parse failed`, error);
      return {
        count: 0,
        reason: "parse-failed"
      };
    }

    const sourceResult = findRehydrationSource(detection, sourceDocument);
    const plan = sourceResult.plan;

    if (!plan) {
      return {
        count: 0,
        reason: sourceResult.reason
      };
    }

    const fragment = makeRehydratedFragment(plan);

    if (!normalizedText(fragment)) {
      return {
        count: 0,
        reason: "empty-fragment"
      };
    }

    restore.insertNode(plan.targetSlot, fragment);

    return {
      count: plan.linkData.length,
      reason: "refetch-source"
    };
  }

  function residualInlineNoticeSignal(element) {
    return normalizedSignalText([
      normalizedText(element).slice(0, 500),
      element.id,
      element.className,
      element.getAttribute?.("aria-label"),
      element.getAttribute?.("title")
    ].join(" "));
  }

  function hasResidualInlineNoticeSignal(element) {
    return residualInlineNoticePattern.test(
      residualInlineNoticeSignal(element)
    );
  }

  function isLocalToInlineGate(element, inlineGate) {
    const parent = inlineGate.parentElement;

    return Boolean(
      parent &&
      (
        element === parent ||
        element.parentElement === parent ||
        parent.contains(element) ||
        element === inlineGate.previousElementSibling ||
        element === inlineGate.nextElementSibling ||
        element === parent.previousElementSibling ||
        element === parent.nextElementSibling ||
        parent.previousElementSibling?.contains(element) ||
        parent.nextElementSibling?.contains(element)
      )
    );
  }

  function containsVisibleControl(element) {
    try {
      return [...element.querySelectorAll("a,button,[role='button'],input,textarea,select")]
        .some(isVisible);
    } catch {
      return false;
    }
  }

  function looksLikeResidualInlineNotice(element, detection) {
    if (
      !(element instanceof Element) ||
      !element.isConnected ||
      element.hasAttribute("data-unwall-hidden") ||
      isInUnwallUI(element) ||
      isInlineGateBoundary(element) ||
      containsProtectedContent(element) ||
      elementOverlapsAny(element, detection.inlineGates) ||
      !isVisible(element) ||
      !hasResidualInlineNoticeSignal(element) ||
      !detection.inlineGates.some(inlineGate =>
        isLocalToInlineGate(element, inlineGate)
      )
    ) {
      return false;
    }

    const text = normalizedText(element);

    if (text.length < 8 || text.length > 700) {
      return false;
    }

    if (containsVisibleControl(element)) {
      return false;
    }

    const matchingChild = [...element.children].some(child =>
      child instanceof Element &&
      isVisible(child) &&
      hasResidualInlineNoticeSignal(child)
    );

    if (matchingChild) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const { width, height } = viewportSize();

    return (
      rect.width >= 40 &&
      rect.width <= Math.min(width * 0.95, 900) &&
      rect.height >= 10 &&
      rect.height <= Math.min(height * 0.8, 260)
    );
  }

  function hideResidualInlineNotices(detection, restore) {
    const candidates = new Set();

    for (const inlineGate of detection.inlineGates) {
      for (const scope of inlineRevealScopes(inlineGate)) {
        candidates.add(scope);

        try {
          for (const element of [
            ...scope.querySelectorAll("p,span,div,section,aside,strong,b,em,small")
          ].slice(0, 120)) {
            candidates.add(element);
          }
        } catch {}
      }
    }

    let hiddenCount = 0;

    for (const element of candidates) {
      if (looksLikeResidualInlineNotice(element, detection)) {
        restore.hideElement(element, "inline-residual-notice");
        hiddenCount += 1;
      }
    }

    return hiddenCount;
  }

  function visibleNormalizedText(element) {
    if (!(element instanceof Element)) {
      return "";
    }

    const parts = [];

    try {
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            const parent = node.parentElement;

            if (
              !parent ||
              parent.closest?.(UNWALL_ROOT_SELECTOR) ||
              parent.closest?.("[data-unwall-hidden]") ||
              !isVisible(parent)
            ) {
              return NodeFilter.FILTER_REJECT;
            }

            return node.textContent.trim()
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          }
        }
      );

      let node = walker.nextNode();

      while (node) {
        parts.push(node.textContent);
        node = walker.nextNode();
      }
    } catch {
      return normalizedText(element);
    }

    return parts.join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hiddenInlineChildCount(element) {
    try {
      return [...element.querySelectorAll('[data-unwall-hidden*="inline"]')]
        .filter(child => child !== element)
        .length;
    } catch {
      return 0;
    }
  }

  function looksLikeEmptyInlineGateShell(element) {
    if (
      !(element instanceof Element) ||
      !element.isConnected ||
      element.hasAttribute("data-unwall-hidden") ||
      isInUnwallUI(element) ||
      isInlineGateBoundary(element) ||
      containsProtectedContent(element) ||
      !isVisible(element) ||
      containsVisibleControl(element) ||
      hiddenInlineChildCount(element) === 0 ||
      visibleNormalizedText(element).length > 3
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const { width, height } = viewportSize();
    const boundedNoticeShell =
      rect.width >= 40 &&
      rect.width <= Math.min(width * 0.98, 1000) &&
      rect.height >= 10 &&
      rect.height <= Math.min(height * 0.85, 380);

    if (!boundedNoticeShell) {
      return false;
    }

    const styleSignals = inlineGateNoticeStyleSignals(element);

    return (
      styleSignals.hasBackground ||
      styleSignals.hasBorder ||
      styleSignals.hasPadding
    );
  }

  function hideEmptyInlineGateShells(detection, restore) {
    const anchors = new Set(detection.inlineGates);

    try {
      for (const element of [
        ...document.querySelectorAll('[data-unwall-hidden*="inline"]')
      ].slice(0, 120)) {
        anchors.add(element);
      }
    } catch {}

    const candidates = new Set();

    for (const anchor of anchors) {
      if (!(anchor instanceof Element)) {
        continue;
      }

      let current = anchor.parentElement;

      while (
        current &&
        current !== document.body &&
        current !== document.documentElement
      ) {
        candidates.add(current);

        if (isInlineGateBoundary(current.parentElement)) {
          break;
        }

        current = current.parentElement;
      }
    }

    const sortedCandidates = [...candidates].sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return (rectB.width * rectB.height) - (rectA.width * rectA.height);
    });

    let hiddenCount = 0;

    for (const element of sortedCandidates) {
      if (!looksLikeEmptyInlineGateShell(element)) {
        continue;
      }

      restore.hideElement(element, "inline-empty-shell");
      hiddenCount += 1;
    }

    return hiddenCount;
  }

  function makeSignature(warningElements, popups, inlineGates = []) {
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

    const inlinePart =
      inlineGates
        .map(element => {
          const rect = element.getBoundingClientRect();
          return [
            element.tagName,
            element.id,
            String(element.className || "").slice(0, 80),
            normalizedText(element).slice(0, 80),
            Math.round(rect.width),
            Math.round(rect.height)
          ].join(":");
        })
        .join("|")
        .slice(0, 320);

    return `${language}:${textPart}:${popupPart}:${inlinePart}`;
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
    inlineGates,
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
      popups.some(containsAntiAdblockAttribute) ||
      inlineGates.some(containsAntiAdblockAttribute);

    if (hasTextSignal) {
      confidence += 70;
      reasons.push("localized-anti-adblock-text");
    }

    if (hasAttributeSignal) {
      confidence += 58;
      reasons.push("anti-adblock-dom-signal");
    }

    if (inlineGates.length > 0) {
      confidence += 10;
      reasons.push("inline-access-gate");
    }

    if (inlineGates.some(hasInlineGateContext)) {
      confidence += 10;
      reasons.push("inline-download-context");
    }

    if (inlineGates.some(hasInlineGateActionSignal)) {
      confidence += 8;
      reasons.push("inline-action-signal");
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
    const inlineGates = uniqueOutermostElements(
      warningElements
        .filter(warning => !elementOverlapsAny(warning, popups))
        .map(findInlineGate)
        .filter(Boolean)
        .filter(inlineGate => !elementOverlapsAny(inlineGate, popups))
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
      inlineGates,
      backdrops,
      blurElements,
      scrollLock
    });

    const detection = {
      found:
        (popups.length > 0 || inlineGates.length > 0) &&
        score.confidence >= PROMPT_THRESHOLD,
      language,
      confidence: score.confidence,
      reasons: score.reasons,
      warningElements,
      popups,
      inlineGates,
      backdrops,
      blurElements,
      scrollLock,
      createdAt: Date.now(),
      signature: makeSignature(warningElements, popups, inlineGates)
    };

    state.lastDetection = detection;
    return detection;
  }

  function restoreEventHandlers(record) {
    if (!record || record.type !== "event-handlers") {
      return;
    }

    window.onscroll = record.windowOnScroll;
    document.onscroll = record.documentOnScroll;

    if (document.body) {
      document.body.onscroll = record.bodyOnScroll;
    }
  }

  function createRestoreSession() {
    const records = [];

    return {
      records,

      discardRecord(record) {
        const index = records.lastIndexOf(record);

        if (index >= 0) {
          records.splice(index, 1);
        }
      },

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

      insertNode(parent, node, before = null) {
        records.push({
          type: "inserted-node",
          element: node
        });

        parent.insertBefore(node, before);
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

      addCustomUndo(label, undo) {
        const record = {
          type: "custom",
          label,
          undo
        };

        records.push(record);
        return record;
      },

      restore() {
        state.suppressObserver = true;

        try {
          for (const record of [...records].reverse()) {
            if (
              !record.element?.isConnected &&
              !["event-handlers", "custom"].includes(record.type)
            ) {
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

            if (record.type === "inserted-node") {
              record.element.remove();
            }

            if (record.type === "event-handlers") {
              restoreEventHandlers(record);
            }

            if (record.type === "custom") {
              try {
                record.undo?.();
              } catch (error) {
                console.warn(`${APP_NAME}: custom restore failed`, error);
              }
            }
          }
        } finally {
          state.suppressObserver = false;
        }
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

  function unlockCurrentCSSScroll(restore) {
    const currentScrollLock = detectCSSScrollLock();

    if (!currentScrollLock.locked) {
      return false;
    }

    return unlockCSSScroll(
      {
        scrollLock: currentScrollLock
      },
      restore
    );
  }

  function captureScrollHandlerProperties(restore) {
    const handlers = [
      window.onscroll,
      document.onscroll,
      document.body?.onscroll || null
    ];
    const count = handlers.filter(Boolean).length;

    if (count === 0) {
      return {
        count: 0,
        record: null
      };
    }

    const record = restore.saveEventHandlers();
    window.onscroll = null;
    document.onscroll = null;

    if (document.body) {
      document.body.onscroll = null;
    }

    return {
      count,
      record
    };
  }

  function relatedDetectionElements(detection) {
    return [
      ...(detection?.popups || []),
      ...(detection?.backdrops || []),
      ...(detection?.inlineGates || [])
    ].filter(Boolean);
  }

  function isDetectionRelatedTarget(target, detection) {
    if (!(target instanceof Element)) {
      return false;
    }

    return relatedDetectionElements(detection).some(element =>
      element === target ||
      element.contains(target) ||
      target.contains(element) ||
      element.parentElement === target ||
      target.parentElement === element.parentElement
    );
  }

  function isGlobalScrollTarget(target) {
    return (
      target === window ||
      target === pageWindow ||
      target === document ||
      target === document.documentElement ||
      target === document.body
    );
  }

  function listenerStackLooksLikeWall(record) {
    return /(?:ad[-_\s]*block|anti[-_\s]*(?:ad|banner)|\badvert(?:is(?:e|ement|ing))?\b|\bads?\b|\bmodal\b|\bpopup\b|\boverlay\b|\bbackdrop\b|\bwall\b|\block\b)/i.test(
      String(record.stack || "")
    );
  }

  function listenerWasCreatedNearDetection(record, detection) {
    return Boolean(
      detection?.createdAt &&
      Math.abs(detection.createdAt - record.createdAt) <=
        TRACKED_SCROLL_LISTENER_WINDOW_MS
    );
  }

  function listenerLooksLikeScrollLock(record, detection, aggressive = false) {
    if (
      !record ||
      record.removed ||
      record.signal?.aborted ||
      !SCROLL_LOCK_EVENT_TYPES.has(record.type)
    ) {
      return false;
    }

    const globalTarget = isGlobalScrollTarget(record.target);
    const relatedTarget =
      isDetectionRelatedTarget(record.target, detection);

    if (!globalTarget && !relatedTarget) {
      return false;
    }

    const stackSuspicious = listenerStackLooksLikeWall(record);
    const closeToDetection =
      listenerWasCreatedNearDetection(record, detection);
    const passiveFalse = record.passive === false;
    const cancelableInput =
      record.type === "wheel" ||
      record.type === "touchmove";

    if (relatedTarget) {
      if (cancelableInput) {
        return passiveFalse || stackSuspicious || closeToDetection;
      }

      return stackSuspicious || closeToDetection;
    }

    if (cancelableInput) {
      return (
        (
          passiveFalse &&
          (stackSuspicious || closeToDetection || aggressive)
        ) ||
        (stackSuspicious && closeToDetection)
      );
    }

    if (record.type === "scroll") {
      return (
        stackSuspicious &&
        (closeToDetection || aggressive)
      );
    }

    if (record.type === "keydown") {
      return (
        stackSuspicious &&
        closeToDetection
      );
    }

    return false;
  }

  function getSuspiciousScrollLockListeners(detection, aggressive = false) {
    return [...scrollListenerTracker.records]
      .filter(record =>
        listenerLooksLikeScrollLock(record, detection, aggressive)
      );
  }

  function removeTrackedScrollLockListeners(records, restore) {
    const removedTypes = new Set();
    const undoRecords = [];
    let count = 0;

    for (const record of records) {
      try {
        record.target.removeEventListener(
          record.type,
          record.listener,
          record.capture
        );

        record.removed = true;
        count += 1;
        removedTypes.add(record.type);

        const undoRecord = restore.addCustomUndo(
          "tracked-scroll-listener",
          () => {
            try {
              record.target.addEventListener(
                record.type,
                record.listener,
                record.options
              );
              record.removed = false;
            } catch (error) {
              console.warn(`${APP_NAME}: tracked listener restore failed`, error);
            }
          }
        );

        undoRecords.push(undoRecord);
      } catch (error) {
        console.warn(`${APP_NAME}: tracked listener removal failed`, error);
      }
    }

    return {
      count,
      types: [...removedTypes],
      undoRecords
    };
  }

  function rollbackScrollUnlockChanges(restore, undoRecords, eventRecord) {
    if (eventRecord) {
      restoreEventHandlers(eventRecord);
      restore.discardRecord(eventRecord);
    }

    for (const undoRecord of [...undoRecords].reverse()) {
      try {
        undoRecord.undo?.();
      } catch (error) {
        console.warn(`${APP_NAME}: tracked listener rollback failed`, error);
      }

      restore.discardRecord(undoRecord);
    }
  }

  async function verifyScrollIsFree() {
    const scroller =
      document.scrollingElement ||
      document.documentElement;

    if (!scroller) {
      return {
        free: true,
        reason: "no-scroller"
      };
    }

    const maximum =
      scroller.scrollHeight - scroller.clientHeight;

    if (maximum < 80) {
      return {
        free: true,
        reason: "not-scrollable-enough"
      };
    }

    const startingPosition = scroller.scrollTop;
    const delta =
      startingPosition + 32 <= maximum
        ? 32
        : -32;
    const target = Math.max(
      0,
      Math.min(maximum, startingPosition + delta)
    );

    if (target === startingPosition) {
      return {
        free: true,
        reason: "no-scroll-room"
      };
    }

    try {
      scroller.scrollTo({
        top: target,
        behavior: "instant"
      });
    } catch {
      window.scrollTo(0, target);
    }

    await wait(90);

    const reached =
      Math.abs(scroller.scrollTop - target) <= 10;

    try {
      scroller.scrollTo({
        top: startingPosition,
        behavior: "instant"
      });
    } catch {
      window.scrollTo(0, startingPosition);
    }

    await wait(0);

    return {
      free: reached,
      reason: reached
        ? "scroll-position-stable"
        : "scroll-position-reverted"
    };
  }

  async function unlockScrollAfterWallRemoval(detection, restore) {
    const result = {
      cssScrollUnlocked: false,
      unlocked: false,
      scrollFree: false,
      reason: "not-run",
      propertyHandlerCount: 0,
      trackedListenerCount: 0,
      trackedListenerTypes: [],
      attempts: []
    };
    const undoRecords = [];
    let eventRecord = null;
    const passDelays = [0, 250, 650];

    result.cssScrollUnlocked = unlockCurrentCSSScroll(restore);

    for (let pass = 0; pass < passDelays.length; pass += 1) {
      const delay = passDelays[pass];

      if (delay > 0) {
        await wait(delay);
      }

      result.cssScrollUnlocked =
        unlockCurrentCSSScroll(restore) ||
        result.cssScrollUnlocked;

      const before = await verifyScrollIsFree();
      result.attempts.push(`pass-${pass}:before:${before.reason}`);

      if (before.free) {
        result.scrollFree = true;
        result.reason = pass === 0
          ? "already-free"
          : "free-after-delayed-pass";
        return result;
      }

      if (result.propertyHandlerCount === 0) {
        const propertyResult =
          captureScrollHandlerProperties(restore);

        if (propertyResult.count > 0) {
          eventRecord = propertyResult.record;
          result.propertyHandlerCount = propertyResult.count;
          result.unlocked = true;

          const afterProperties = await verifyScrollIsFree();
          result.attempts.push(
            `pass-${pass}:properties:${afterProperties.reason}`
          );

          if (afterProperties.free) {
            result.scrollFree = true;
            result.reason = "property-scroll-handlers-cleared";
            return result;
          }
        }
      }

      const listeners =
        getSuspiciousScrollLockListeners(detection, pass > 0);
      const listenerResult =
        removeTrackedScrollLockListeners(listeners, restore);

      if (listenerResult.count > 0) {
        undoRecords.push(...listenerResult.undoRecords);
        result.trackedListenerCount += listenerResult.count;
        result.trackedListenerTypes = uniqueElements([
          ...result.trackedListenerTypes,
          ...listenerResult.types
        ]);
        result.unlocked = true;

        const afterListeners = await verifyScrollIsFree();
        result.attempts.push(
          `pass-${pass}:listeners:${afterListeners.reason}`
        );

        if (afterListeners.free) {
          result.scrollFree = true;
          result.reason = listenerResult.types.length > 0
            ? `tracked-listeners-cleared:${listenerResult.types.join("+")}`
            : "tracked-listeners-cleared";
          return result;
        }
      }
    }

    const finalCheck = await verifyScrollIsFree();
    result.scrollFree = finalCheck.free;
    result.reason = finalCheck.free
      ? "free-after-final-check"
      : finalCheck.reason;

    if (!result.scrollFree) {
      rollbackScrollUnlockChanges(restore, undoRecords, eventRecord);
      result.unlocked = false;
      result.propertyHandlerCount = 0;
      result.trackedListenerCount = 0;
      result.trackedListenerTypes = [];
      result.reason = `${result.reason}-rolled-back`;
    }

    return result;
  }

  function startPostCleanUnlockWatch(
    detection,
    restore,
    durationMs = POST_CLEAN_UNLOCK_WATCH_MS
  ) {
    if (!document.documentElement || state.stopped) {
      return null;
    }

    const observer = new MutationObserver(() => {
      if (state.suppressObserver) {
        return;
      }

      state.suppressObserver = true;

      try {
        unlockCurrentCSSScroll(restore);
        unlockResidualInteraction(detection, restore);
      } finally {
        state.suppressObserver = false;
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: [
        "class",
        "style",
        "hidden",
        "aria-hidden",
        "aria-modal"
      ]
    });

    restore.addCustomUndo(
      "post-clean-unlock-watch",
      () => observer.disconnect()
    );
    window.setTimeout(() => observer.disconnect(), durationMs);

    return observer;
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
    captureDownloadSlotSnapshots();
    state.suppressObserver = true;

    try {
      for (const popup of detection.popups) {
        restore.hideElement(popup, "popup");
      }

      for (const backdrop of detection.backdrops) {
        restore.hideElement(backdrop, "backdrop");
      }

      for (const inlineGate of detection.inlineGates) {
        restore.hideElement(inlineGate, "inline-gate");
      }

      const revealedControlCount =
        revealInlineGateControls(detection, restore);
      const rehydrationResult =
        revealedControlCount > 0
          ? {
              count: 0,
              reason: "existing-controls-revealed"
            }
          : await rehydrateInlineGateControls(detection, restore);
      let residualNoticeCount =
        hideResidualInlineNotices(detection, restore) +
        hideEmptyInlineGateShells(detection, restore);

      if (detection.inlineGates.length > 0) {
        await wait(120);
        residualNoticeCount +=
          hideResidualInlineNotices(detection, restore) +
          hideEmptyInlineGateShells(detection, restore);
        await wait(400);
        residualNoticeCount +=
          hideResidualInlineNotices(detection, restore) +
          hideEmptyInlineGateShells(detection, restore);
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

      let cssScrollUnlocked = unlockCSSScroll(detection, restore);
      cssScrollUnlocked =
        unlockCurrentCSSScroll(restore) ||
        cssScrollUnlocked;
      unlockResidualInteraction(detection, restore);
      const scrollUnlockResult =
        await unlockScrollAfterWallRemoval(detection, restore);

      cssScrollUnlocked =
        scrollUnlockResult.cssScrollUnlocked ||
        cssScrollUnlocked;

      await wait(250);
      cssScrollUnlocked =
        unlockCurrentCSSScroll(restore) ||
        cssScrollUnlocked;
      unlockResidualInteraction(detection, restore);
      startPostCleanUnlockWatch(detection, restore);

      return {
        restore,
        popupCount: detection.popups.length,
        backdropCount: detection.backdrops.length,
        blurCount: detection.blurElements.length,
        inlineGateCount: detection.inlineGates.length,
        residualNoticeCount,
        revealedControlCount,
        rehydratedControlCount: rehydrationResult.count,
        rehydrationReason: rehydrationResult.reason,
        cssScrollUnlocked,
        jsScrollUnlocked: scrollUnlockResult.unlocked,
        jsScrollFree: scrollUnlockResult.scrollFree,
        jsScrollReason: scrollUnlockResult.reason,
        jsScrollListenerCount: scrollUnlockResult.trackedListenerCount,
        jsScrollListenerTypes:
          scrollUnlockResult.trackedListenerTypes.join(", "),
        jsScrollPropertyHandlerCount:
          scrollUnlockResult.propertyHandlerCount
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
      button[aria-disabled="true"] {
        cursor: not-allowed;
        opacity: 0.55;
      }
      button:focus-visible {
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
      [messages.resultInlineGateHidden]: result.inlineGateCount,
      [messages.resultResidualNoticeHidden]: result.residualNoticeCount,
      [messages.resultControlsRevealed]: result.revealedControlCount,
      [messages.resultControlsRehydrated]: result.rehydratedControlCount,
      [messages.resultRehydrationReason]: result.rehydrationReason,
      [messages.resultCSSScrollLock]: result.cssScrollUnlocked,
      [messages.resultJSScrollLock]: result.jsScrollUnlocked,
      "JS scroll free": result.jsScrollFree,
      "JS scroll reason": result.jsScrollReason,
      "JS listener removed": result.jsScrollListenerCount,
      "JS listener types": result.jsScrollListenerTypes,
      "JS property handlers": result.jsScrollPropertyHandlerCount
    });
  }

  async function applyPreferencesBeforeClean({
    rememberRemoval = false
  } = {}) {
    if (rememberRemoval) {
      await saveSiteMode(MODES.auto);
    }
  }

  async function runCleanFromPrompt(detection, options) {
    await applyPreferencesBeforeClean(options);
    closeCard();

    const result = await cleanDetection(detection);
    showUndo(result);
  }

  function formattedAutoConfirmText() {
    return messages.autoConfirmText.replace("{site}", hostInfo.siteKey);
  }

  function showAutoConfirm(detection) {
    const card = createCardBase("dialog");
    appendTextElement(card, "h2", "title", messages.autoConfirmTitle);
    appendTextElement(card, "p", "text", formattedAutoConfirmText());

    const actions = document.createElement("div");
    actions.className = "actions";

    const cancelButton = createButton(messages.cancel);
    const enableButton = createButton(messages.autoConfirmEnable, "primary");

    cancelButton.addEventListener("click", () => {
      showPrompt(detection);
    });

    enableButton.addEventListener("click", async () => {
      await runCleanFromPrompt(detection, {
        rememberRemoval: true
      });
    });

    actions.append(cancelButton, enableButton);
    card.appendChild(actions);
  }

  function showPrompt(detection) {
    const card = createCardBase("dialog");
    appendTextElement(card, "h2", "title", messages.wallTitle);
    appendTextElement(card, "p", "text", messages.wallDescription);

    const options = document.createElement("div");
    options.className = "options";

    if (hostInfo.isSensitive) {
      appendTextElement(options, "p", "mini", messages.sensitiveAutoBlocked);
    }

    const actions = document.createElement("div");
    actions.className = "actions";

    const ignoreButton = createButton(messages.ignore);
    const removeButton = createButton(messages.remove);
    const rememberRemovalButton = createButton(messages.remember, "primary");

    ignoreButton.addEventListener("click", () => {
      rememberIgnoredSignature(detection.signature);
      closeCard();
    });

    removeButton.addEventListener("click", async () => {
      await runCleanFromPrompt(detection);
    });

    rememberRemovalButton.addEventListener("click", () => {
      showAutoConfirm(detection);
    });

    actions.append(ignoreButton, removeButton);

    if (!hostInfo.isSensitive && state.siteMode !== MODES.auto) {
      actions.appendChild(rememberRemovalButton);
    }

    if (options.childNodes.length > 0) {
      card.appendChild(options);
    }

    card.appendChild(actions);
  }

  function canAutoRemove(detection) {
    return (
      state.siteMode === MODES.auto &&
      !hostInfo.isSensitive &&
      detection.confidence >= AUTO_THRESHOLD &&
      (detection.popups.length > 0 || detection.inlineGates.length > 0)
    );
  }

  function isAutomaticDetectionAllowed() {
    return !hostInfo.isSensitive;
  }

  function shouldRunAutomatically() {
    return (
      state.globalDetection ||
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
      stopDelayedScans();
      return;
    }

    if (!isAutomaticDetectionAllowed()) {
      stopObserver();
      stopDelayedScans();
      console.log(messages.sensitiveDetectionBlocked);
      return;
    }

    await scan({ manual: false });

    if (!state.lastDetection?.found) {
      startObserver(automaticObserverDuration());
      startDelayedScans();
    }
  }

  async function scan({ manual = false } = {}) {
    if (state.stopped) {
      return null;
    }

    if (!manual && !isAutomaticDetectionAllowed()) {
      return null;
    }

    captureDownloadSlotSnapshots();
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
    stopDelayedScans();

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

  function stopDelayedScans() {
    for (const timer of state.delayedScanTimers) {
      window.clearTimeout(timer);
    }

    state.delayedScanTimers = [];
  }

  function startDelayedScans() {
    stopDelayedScans();

    if (
      state.stopped ||
      !shouldRunAutomatically() ||
      !isAutomaticDetectionAllowed()
    ) {
      return;
    }

    state.delayedScanTimers = DELAYED_SCAN_OFFSETS_MS.map(delay => {
      const timer = window.setTimeout(async () => {
        state.delayedScanTimers =
          state.delayedScanTimers.filter(activeTimer => activeTimer !== timer);

        if (
          state.stopped ||
          state.suppressObserver ||
          state.lastDetection?.found ||
          !shouldRunAutomatically() ||
          !isAutomaticDetectionAllowed()
        ) {
          return;
        }

        const detection = await scan({ manual: false });

        if (detection?.found) {
          stopDelayedScans();
        }
      }, delay);

      return timer;
    });
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
      [messages.tableSiteKey]: hostInfo.siteKey,
      [messages.tableSiteMode]: state.siteMode,
      [messages.tableConfidence]: detection.confidence,
      [messages.tableAutoEligible]: canAutoRemove(detection),
      [messages.tableAutoThreshold]: AUTO_THRESHOLD,
      [messages.tablePopupCount]: detection.popups.length,
      [messages.tableBackdropCount]: detection.backdrops.length,
      [messages.tableBlurCount]: detection.blurElements.length,
      [messages.tableInlineGateCount]: detection.inlineGates.length,
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
          stopDelayedScans();
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
          await saveSiteMode(MODES.default);
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
    stopDelayedScans();
    stopDownloadSlotSnapshotObserver();
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

  await waitForDocumentReady();

  if (!hostInfo.isSensitive) {
    startDownloadSlotSnapshotObserver();
  }

  await runAutomaticDetection();

  console.log(messages.active);
})();

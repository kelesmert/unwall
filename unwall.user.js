(async () => {
  // Önce eski gözlemciyi durdur
  window.__antiAdblockCleaner?.disconnect();

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
      noVisiblePopup:
        "No visible anti-adblock wall was found; no content was removed.",
      tablePopupRemoved: "Removed popups",
      tableBackdropRemoved: "Removed backdrops",
      tableBlurFixed: "Fixed blur",
      tableJSScrollLock: "JS scroll lock",
      active: "Safe anti-adblock cleaner is active."
    },
    tr: {
      noVisiblePopup:
        "Görünür anti-adblock penceresi bulunamadı; hiçbir içerik silinmedi.",
      tablePopupRemoved: "Kaldırılan popup",
      tableBackdropRemoved: "Kaldırılan backdrop",
      tableBlurFixed: "Düzeltilen blur",
      tableJSScrollLock: "JS scroll kilidi",
      active: "Güvenli anti-adblock temizleyici aktif."
    },
    ru: {
      noVisiblePopup:
        "Видимое окно антиблокировки рекламы не найдено; содержимое не удалялось.",
      tablePopupRemoved: "Удалено окон",
      tableBackdropRemoved: "Удалено фонов",
      tableBlurFixed: "Исправлено размытие",
      tableJSScrollLock: "JS-блокировка прокрутки",
      active: "Безопасный очиститель антиблокировки рекламы активен."
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
      /reklam engelleyici(?:niz|yi)?.{0,40}(?:algılandı|açık|etkin|kapat|devre dışı)/i,
      /(?:kapat|devre dışı).{0,40}reklam engelleyici/i,
      /reklam engellemeyi.{0,40}devre dışı/i,
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

  const antiAdblockPatterns =
    antiAdblockPatternSets[language] ||
    antiAdblockPatternSets.en;

  // Asla silinmemesi gereken medya alanları
  const protectedSelector = [
    "video",
    "audio",
    "iframe",
    "canvas",
    "object",
    "embed",
    "picture",
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

  function isVisible(element) {
    if (!(element instanceof Element)) {
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

  function normalizedText(element) {
    return (element.innerText || element.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function containsAntiAdblockText(element) {
    const text = normalizedText(element);

    if (!text || text.length > 1200) {
      return false;
    }

    return antiAdblockPatterns.some(pattern =>
      pattern.test(text)
    );
  }

  function containsProtectedMedia(element) {
    return (
      element.matches?.(protectedSelector) ||
      Boolean(element.querySelector?.(protectedSelector))
    );
  }

  function numericZIndex(element) {
    const value = parseInt(
      getComputedStyle(element).zIndex,
      10
    );

    return Number.isFinite(value) ? value : 0;
  }

  /*
   * Yalnızca uyarının en içteki metin elementlerini bulur.
   * Böylece body, article veya ana içerik eşleşmez.
   */
  function findWarningTextElements() {
    const selectors = [
      '[role="dialog"]',
      '[role="alertdialog"]',
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "span",
      "button",
      "div",
      "section"
    ].join(",");

    return [...document.querySelectorAll(selectors)]
      .filter(isVisible)
      .filter(element => {
        if (!containsAntiAdblockText(element)) {
          return false;
        }

        if (element.closest(protectedSelector)) {
          return false;
        }

        /*
         * İçindeki daha küçük bir çocuk zaten eşleşiyorsa
         * büyük üst elementi alma.
         */
        const matchingChild = [...element.children].some(
          child =>
            isVisible(child) &&
            containsAntiAdblockText(child)
        );

        return !matchingChild;
      });
  }

  /*
   * Uyarı metninden yukarı çıkarak en yakın gerçek
   * dialog/modal kutusunu bulur.
   */
  function findPopup(element) {
    let current = element;

    while (
      current &&
      current !== document.body &&
      current !== document.documentElement
    ) {
      if (containsProtectedMedia(current)) {
        return null;
      }

      const style = getComputedStyle(current);
      const rect = current.getBoundingClientRect();
      const role = current.getAttribute("role");

      const positioned = [
        "fixed",
        "absolute",
        "sticky"
      ].includes(style.position);

      const dialogRole =
        role === "dialog" ||
        role === "alertdialog";

      const reasonableSize =
        rect.width >= Math.min(250, innerWidth * 0.25) &&
        rect.height >= Math.min(120, innerHeight * 0.15);

      if (
        reasonableSize &&
        (dialogRole || positioned) &&
        numericZIndex(current) >= 5
      ) {
        return current;
      }

      current = current.parentElement;
    }

    // Emin değilsek hiçbir şey silme
    return null;
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
        !isVisible(element) ||
        containsProtectedMedia(element)
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

      const looksLikeBackdrop =
        style.backdropFilter !== "none" ||
        style.webkitBackdropFilter !== "none" ||
        style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
        Number(style.opacity || 1) < 1;

      /*
       * Gerçek içerik taşıyan büyük wrapper'ları kaldırmamak
       * için metin miktarını sınırla.
       */
      return (
        fixed &&
        fullScreen &&
        nearPopup &&
        looksLikeBackdrop &&
        text.length < 300
      );
    });
  }

  function removeLargeBlur() {
    let count = 0;

    for (const element of document.querySelectorAll("body *")) {
      if (containsProtectedMedia(element)) {
        continue;
      }

      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      const large =
        rect.width >= innerWidth * 0.5 &&
        rect.height >= innerHeight * 0.4;

      if (!large) {
        continue;
      }

      if (style.filter?.includes("blur")) {
        element.style.setProperty(
          "filter",
          "none",
          "important"
        );
        count++;
      }

      if (
        style.backdropFilter?.includes("blur") ||
        style.webkitBackdropFilter?.includes("blur")
      ) {
        element.style.setProperty(
          "backdrop-filter",
          "none",
          "important"
        );

        element.style.setProperty(
          "-webkit-backdrop-filter",
          "none",
          "important"
        );

        count++;
      }
    }

    return count;
  }

  function unlockCSSScroll() {
    const html = document.documentElement;
    const body = document.body;

    for (const element of [html, body]) {
      if (!element) continue;

      const style = getComputedStyle(element);

      if (
        style.overflow === "hidden" ||
        style.overflowY === "hidden" ||
        style.overflow === "clip" ||
        style.overflowY === "clip"
      ) {
        element.style.setProperty(
          "overflow-y",
          "auto",
          "important"
        );

        element.style.setProperty(
          "overflow-x",
          "visible",
          "important"
        );
      }

      if (
        element === body &&
        style.position === "fixed"
      ) {
        const previousTop =
          Math.abs(parseInt(style.top, 10)) || 0;

        element.style.setProperty(
          "position",
          "static",
          "important"
        );

        element.style.setProperty(
          "top",
          "auto",
          "important"
        );

        if (previousTop > 0) {
          window.scrollTo(0, previousTop);
        }
      }

      element.style.setProperty(
        "max-height",
        "none",
        "important"
      );

      element.style.setProperty(
        "touch-action",
        "auto",
        "important"
      );
    }

    body?.classList.remove(
      "modal-open",
      "no-scroll",
      "noscroll",
      "scroll-lock",
      "scroll-locked",
      "overflow-hidden",
      "locked"
    );
  }

  async function testJavaScriptScrollLock() {
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
    await wait(200);

    const pulledBack =
      Math.abs(scroller.scrollTop - target) > 25;

    if (!pulledBack) {
      return false;
    }

    window.onscroll = null;
    document.onscroll = null;
    document.body.onscroll = null;

    try {
      Object.defineProperty(window, "onscroll", {
        configurable: true,
        get() {
          return null;
        },
        set() {}
      });
    } catch {}

    window.scrollTo(0, target);

    return true;
  }

  let cleaning = false;

  async function clean(showResult = false) {
    if (cleaning) {
      return;
    }

    cleaning = true;

    try {
      const warningElements =
        findWarningTextElements();

      const popups = [
        ...new Set(
          warningElements
            .map(findPopup)
            .filter(Boolean)
        )
      ];

      if (popups.length === 0) {
        if (showResult) {
          console.log(messages.noVisiblePopup);
        }

        return;
      }

      const backdrops = [
        ...new Set(
          popups.flatMap(findBackdrop)
        )
      ];

      /*
       * Önce yalnızca kesin popup ve sade backdrop'ları kaldır.
       */
      for (const popup of popups) {
        popup.remove();
      }

      for (const backdrop of backdrops) {
        backdrop.remove();
      }

      const removedBlur = removeLargeBlur();

      unlockCSSScroll();

      const removedJSLock =
        await testJavaScriptScrollLock();

      if (showResult) {
        console.table({
          [messages.tablePopupRemoved]: popups.length,
          [messages.tableBackdropRemoved]: backdrops.length,
          [messages.tableBlurFixed]: removedBlur,
          [messages.tableJSScrollLock]: removedJSLock
        });
      }
    } finally {
      cleaning = false;
    }
  }

  await clean(true);

  let scheduled = false;

  const observer = new MutationObserver(() => {
    if (scheduled) {
      return;
    }

    scheduled = true;

    requestAnimationFrame(async () => {
      scheduled = false;
      await clean(false);
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"]
  });

  window.__antiAdblockCleaner = observer;

  console.log(messages.active);
})();

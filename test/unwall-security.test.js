const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(repoRoot, "Unwall.user.js"), "utf8");

function metadataValue(key) {
  const match = script.match(new RegExp(`^//\\s+@${key}\\s+(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

function regexLiteralValue(name) {
  const match = script.match(
    new RegExp(`const ${name} =\\s*\\n\\s*/(.+)/([a-z]*);`)
  );

  assert.ok(match, `${name} regex literal should exist`);
  return new RegExp(match[1], match[2]);
}

function regexArrayValues(language) {
  const marker = `    ${language}: [`;
  const start = script.indexOf(marker);

  assert.notEqual(start, -1, `${language} pattern set should exist`);

  const end = script.indexOf("\n    ]", start);

  assert.notEqual(end, -1, `${language} pattern set should close`);

  return script
    .slice(start + marker.length, end)
    .split("\n")
    .map(line => line.trim().replace(/,$/, ""))
    .filter(line => line.startsWith("/"))
    .map(line => Function(`return ${line};`)());
}

function matchesAny(patterns, text) {
  return patterns.some(pattern => pattern.test(text));
}

test("metadata uses release distribution and top-level pages only", () => {
  const releaseUrl =
    "https://github.com/kelesmert/unwall/releases/latest/download/Unwall.user.js";

  assert.equal(metadataValue("version"), "0.1.11");
  assert.equal(metadataValue("updateURL"), releaseUrl);
  assert.equal(metadataValue("downloadURL"), releaseUrl);
  assert.equal(metadataValue("run-at"), "document-start");
  assert.match(script, /^\/\/ @noframes$/m);
  assert.match(script, /^\/\/ @grant\s+unsafeWindow$/m);
  assert.doesNotMatch(
    script,
    /raw\.githubusercontent\.com\/kelesmert\/unwall\/main\/Unwall\.user\.js/
  );
});

test("sensitive hosts are guarded from automatic detection", () => {
  for (const host of [
    "paypal.com",
    "coinbase.com",
    "mail.google.com",
    "accounts.google.com",
    "login.microsoftonline.com"
  ]) {
    assert.match(script, new RegExp(`"${host.replace(/\./g, "\\.")}"`));
  }

  assert.match(script, /function isAutomaticDetectionAllowed\(\)/);
  assert.match(script, /if \(!manual && !isAutomaticDetectionAllowed\(\)\)/);
  assert.match(
    script,
    /function startObserver[\s\S]+if \(!isAutomaticDetectionAllowed\(\)\)/
  );
});

test("in-page UI uses closed shadow DOM", () => {
  assert.match(script, /attachShadow\(\{ mode: "closed" \}\)/);
  assert.doesNotMatch(script, /host\.shadowRoot/);
  assert.match(script, /state\.cardShadow\?\.querySelector/);
});

test("debug globals are reduced to a minimal reload controller", () => {
  assert.doesNotMatch(script, /__antiAdblockCleaner/);
  assert.doesNotMatch(script, /scanNow:\s*\(\) => scan/);
  assert.doesNotMatch(script, /diagnostics:\s*logDiagnostics/);
  assert.doesNotMatch(script, /restoreLast:/);
  assert.match(script, /Object\.defineProperty\(window, INSTANCE_KEY/);
  assert.match(script, /enumerable: false/);
});

test("observer and scroll-lock hardening hooks are present", () => {
  assert.match(script, /OBSERVER_SCAN_COOLDOWN_MS/);
  assert.match(script, /OBSERVER_MUTATION_BATCH_LIMIT/);
  assert.match(script, /DELAYED_SCAN_OFFSETS_MS/);
  assert.match(script, /function mutationBatchLooksInteresting/);
  assert.match(script, /function startDelayedScans/);
  assert.match(script, /function stopDelayedScans/);
  assert.match(script, /POST_CLEAN_UNLOCK_WATCH_MS/);
  assert.match(script, /TRACKED_SCROLL_LISTENER_LIMIT/);
  assert.match(script, /TRACKED_SCROLL_LISTENER_WINDOW_MS/);
  assert.match(script, /SCROLL_LOCK_EVENT_TYPES/);
  assert.match(script, /function setupScrollListenerTracker/);
  assert.match(script, /function captureScrollHandlerProperties/);
  assert.match(script, /function getSuspiciousScrollLockListeners/);
  assert.match(script, /function removeTrackedScrollLockListeners/);
  assert.match(script, /function rollbackScrollUnlockChanges/);
  assert.match(script, /function verifyScrollIsFree/);
  assert.match(script, /function unlockScrollAfterWallRemoval/);
  assert.match(script, /function startPostCleanUnlockWatch/);
  assert.match(
    script,
    /if \(!result\.scrollFree\)[\s\S]+rollbackScrollUnlockChanges/
  );
});

test("ignored signatures are bounded", () => {
  assert.match(script, /IGNORED_SIGNATURE_LIMIT/);
  assert.match(script, /ignoredSignatureQueue/);
  assert.match(script, /while \(state\.ignoredSignatureQueue\.length > IGNORED_SIGNATURE_LIMIT\)/);
});

test("site preference UI exposes one remembered removal action", () => {
  assert.match(script, /remember: "Remember removal"/);
  assert.match(script, /function showAutoConfirm\(detection\)/);
  assert.match(script, /formattedAutoConfirmText/);
  assert.match(script, /rememberRemovalButton/);
  assert.match(script, /rememberRemoval: true/);
  assert.match(script, /state\.siteMode === MODES\.auto/);
  assert.doesNotMatch(script, /createCheckbox/);
  assert.doesNotMatch(script, /rememberChecked/);
  assert.doesNotMatch(script, /MODES\.remember/);
  assert.doesNotMatch(script, /Remember detection on this site/);
});

test("inline gate action signal avoids documentation-only false positives", () => {
  const inlineGateActionPattern =
    regexLiteralValue("inlineGateActionPattern");

  assert.doesNotMatch(
    "Unwall detects anti-adblock access walls and removes them only with user approval.",
    inlineGateActionPattern
  );
  assert.match(
    "Please, disable Ad-block or antibanner for this site.",
    inlineGateActionPattern
  );
  assert.match(
    script,
    /function looksLikeInlineGate[\s\S]+strongNoticeEvidence[\s\S]+!hasInlineGateActionSignal\(element\)[\s\S]+!strongNoticeEvidence/
  );
});

test("localized anti-adblock patterns cover action phrasing without broad ad mentions", () => {
  const en = regexArrayValues("en");
  const tr = regexArrayValues("tr");
  const ru = regexArrayValues("ru");
  const ja = regexArrayValues("ja");

  assert.match(script, /fallbackPatternLanguages = \["en", "tr", "ru", "ja"\]/);
  assert.match(script, /flatMap\(patternLanguage => antiAdblockPatternSets/);

  assert.ok(
    matchesAny(
      en,
      "It looks like you are using an ad blocker. Please allow ads on this site."
    )
  );
  assert.ok(
    matchesAny(
      tr,
      "Reklam engelleyici kullandığınız anlaşılıyor. Lütfen sitemizde reklamlara izin verin."
    )
  );
  assert.ok(
    matchesAny(
      ru,
      "Похоже, вы используете блокировщик рекламы. Пожалуйста, разрешите рекламу на сайте."
    )
  );
  assert.ok(
    matchesAny(
      ja,
      "弊社サイトにおいて広告ブロッカーを無効にすることをどうぞご検討ください。"
    ),
    "the wall wording observed on jp.reuters.com must match"
  );
  assert.ok(
    matchesAny(ja, "広告ブロッカーを無効にして続ける"),
    "the wall's call-to-action button must match"
  );

  assert.equal(
    matchesAny(
      en,
      "This article explains how ad blockers affect advertising markets."
    ),
    false
  );
  assert.equal(
    matchesAny(
      tr,
      "Bu yazı reklam ekonomisini ve reklam engelleyici yazılımları anlatır."
    ),
    false
  );
  assert.equal(
    matchesAny(
      ru,
      "Статья рассказывает, как блокировщики рекламы влияют на рынок."
    ),
    false
  );
  assert.equal(
    matchesAny(
      ja,
      "この記事は広告ブロッカーの利用が広告市場に与える影響を解説します。"
    ),
    false
  );
  assert.equal(
    matchesAny(ja, "広告ブロッカー検出技術の仕組みについて"),
    false
  );
});

test("every supported language has a full message block", () => {
  const languages = ["en", "tr", "ru", "ja"];

  const keysFor = language => {
    const marker = `    ${language}: {`;
    const start = script.indexOf(marker);

    assert.notEqual(start, -1, `${language} message block should exist`);

    const end = script.indexOf("\n    }", start);
    return [
      ...script.slice(start, end).matchAll(/^ {6}([a-zA-Z]+):/gm)
    ].map(match => match[1]);
  };

  const reference = keysFor("en");

  assert.ok(reference.length > 40, "the English block should be the reference");
  assert.match(script, /\["en", "tr", "ru", "ja"\]\s*\.includes\(language\)/);

  for (const language of languages.slice(1)) {
    assert.deepEqual(
      keysFor(language).slice().sort(),
      reference.slice().sort(),
      `${language} must define exactly the same message keys as en`
    );
  }
});

test("vendor fingerprinting stays inside the project's scope", () => {
  const listFor = name => {
    const match = script.match(
      new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n  \\];`)
    );

    assert.ok(match, `${name} should exist`);

    return match[1]
      .split("\n")
      .map(line => line.trim().replace(/,$/, ""))
      .filter(line => line.startsWith("/"))
      .map(line => Function(`return ${line};`)());
  };

  const attributePatterns = listFor("wallVendorAttributePatterns");
  const textPatterns = listFor("wallVendorTextPatterns");
  const matchesAttribute = value =>
    attributePatterns.some(pattern => pattern.test(value));
  const matchesText = value =>
    textPatterns.some(pattern => pattern.test(value));

  for (const vendor of ["freestar", "ad-shield", "blockthrough", "admiral"]) {
    assert.ok(
      matchesAttribute(`${vendor}-overlay`),
      `${vendor} should be recognised in attributes`
    );
  }

  // Paywall, sign-in and newsletter vendors are out of scope: recognising them
  // would push Unwall into removing overlays it does not remove.
  for (const vendor of ["optinmonster", "unisignin"]) {
    assert.equal(
      matchesAttribute(`${vendor}-modal`),
      false,
      `${vendor} is not an adblock recovery vendor`
    );
  }

  // "admiral" is an ordinary English word, so prose must not trigger it.
  assert.equal(matchesText("The admiral inspected the fleet."), false);
  assert.ok(matchesText("Freestar VRM"));

  // A vendor name may prompt, but must never remove unattended.
  assert.match(script, /function hasPrimaryWallSignal\(detection\)/);
  assert.match(
    script,
    /function canAutoRemove[\s\S]+hasPrimaryWallSignal\(detection\)/
  );
  assert.match(script, /hasVendorSignal && !hasTextSignal && !hasAttributeSignal/);
});

test("the diagnostic trace hook is passive and silent", () => {
  assert.match(script, /function traceSink\(\)/);
  assert.match(script, /function traceEntry\(stage, element, reason/);
  assert.match(script, /TRACE_SINK_LIMIT/);

  // Unwall reads the sink but never creates it, so it adds no page global.
  assert.doesNotMatch(script, /pageWindow\[TRACE_SINK_KEY\]\s*=[^=]/);

  // The hook must not print anything; formatting belongs to the dev harness.
  const traceSection = script.slice(
    script.indexOf("function traceSink()"),
    script.indexOf("function findWarningTextElements")
  );

  assert.doesNotMatch(traceSection, /console\./);
});

test("rejection reasons are available for diagnosis", () => {
  for (const name of [
    "visibilityRejectionReason",
    "popupCandidateRejectionReason",
    "inlineGateRejectionReason",
    "traceWarningRejections"
  ]) {
    assert.match(script, new RegExp(`function ${name}\\(`));
  }

  // isVisible and looksLikeInlineGate stay thin wrappers over the reasons.
  assert.match(
    script,
    /function isVisible\(element\) \{\s*return !visibilityRejectionReason\(element\);/
  );
  assert.match(
    script,
    /function looksLikeInlineGate\(element\) \{\s*return !inlineGateRejectionReason\(element\);/
  );

  // findPopup reports every ancestor it rejects, not only the first.
  assert.match(script, /traceEntry\("popup", current, reason\)/);
  assert.match(script, /popupTerminalRejectionReasons/);
});

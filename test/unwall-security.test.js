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

test("metadata uses release distribution and top-level pages only", () => {
  const releaseUrl =
    "https://github.com/kelesmert/unwall/releases/latest/download/Unwall.user.js";

  assert.equal(metadataValue("version"), "0.1.7");
  assert.equal(metadataValue("updateURL"), releaseUrl);
  assert.equal(metadataValue("downloadURL"), releaseUrl);
  assert.match(script, /^\/\/ @noframes$/m);
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
  assert.match(script, /function mutationBatchLooksInteresting/);
  assert.match(script, /EVENT_HANDLER_RESTORE_MS/);
  assert.match(script, /restoreEventHandlers\(eventHandlers, true\)/);
});

test("ignored signatures are bounded", () => {
  assert.match(script, /IGNORED_SIGNATURE_LIMIT/);
  assert.match(script, /ignoredSignatureQueue/);
  assert.match(script, /while \(state\.ignoredSignatureQueue\.length > IGNORED_SIGNATURE_LIMIT\)/);
});

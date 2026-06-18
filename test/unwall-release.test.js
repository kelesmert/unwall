const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const RELEASE_API_URL =
  "https://api.github.com/repos/kelesmert/unwall/releases/latest";
const ASSET_NAME = "Unwall.user.js";
const SHOULD_CHECK_RELEASE = process.env.CHECK_GITHUB_RELEASE === "1";

async function fetchWithUserAgent(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "unwall-release-integrity-test"
    }
  });

  assert.equal(
    response.ok,
    true,
    `Expected ${url} to return HTTP 2xx, got ${response.status}`
  );

  return response;
}

test(
  "latest GitHub release notes include the uploaded userscript SHA-256",
  {
    skip: SHOULD_CHECK_RELEASE
      ? false
      : "Set CHECK_GITHUB_RELEASE=1 to check the live GitHub release."
  },
  async () => {
    const releaseResponse = await fetchWithUserAgent(RELEASE_API_URL);
    const release = await releaseResponse.json();
    const asset = release.assets?.find(item => item.name === ASSET_NAME);

    assert.ok(asset, `Expected latest release to include ${ASSET_NAME}`);
    assert.ok(asset.browser_download_url, "Expected asset download URL");

    const assetResponse = await fetchWithUserAgent(asset.browser_download_url);
    const assetBuffer = Buffer.from(await assetResponse.arrayBuffer());
    const assetHash = crypto
      .createHash("sha256")
      .update(assetBuffer)
      .digest("hex");

    const releaseHashes = [...String(release.body || "").matchAll(/\b[a-f0-9]{64}\b/gi)]
      .map(match => match[0].toLowerCase());

    assert.ok(
      releaseHashes.length > 0,
      "Expected latest release notes to include a SHA-256 checksum"
    );
    assert.ok(
      releaseHashes.includes(assetHash),
      `Expected release notes to include ${assetHash}`
    );
  }
);

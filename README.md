# Unwall

Unwall detects anti-adblock access walls and removes them only with user
approval.

It is designed for visible anti-adblock popups, overlays, blur layers, and
scroll locks. It does not block ads, disable your ad blocker, remove paywalls,
or collect telemetry.

## Recommended Install

Use this method if you want Unwall to run automatically on pages you visit.

1. Install a userscript manager such as
   [Violentmonkey](https://violentmonkey.github.io/),
   [Tampermonkey](https://www.tampermonkey.net/), or
   [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/).
2. Open the userscript:

   https://github.com/kelesmert/unwall/releases/latest/download/Unwall.user.js

3. Confirm installation in your userscript manager.

After installation, browse normally. When Unwall detects an anti-adblock access
wall, it shows a small confirmation card. Choose `Remove` to hide the wall, or
`Ignore` to leave the page unchanged.

Unwall runs only in top-level pages. Automatic detection and automatic removal
are disabled on sensitive sites such as banking, payment, and email/login
domains. You can still run a manual scan from the userscript manager menu.

## Release and Trust Model

The recommended install URL points to the latest GitHub Release asset, not the
raw `main` branch. Maintainers should publish `Unwall.user.js` as a release
asset, sign the release tag, and include a SHA-256 checksum in the release
notes.

Users who want to verify an update can compare the installed file with the
checksum published in the matching GitHub Release. The raw `main` URL is a
development channel for testing unreleased changes and is not recommended for
normal installation.

## One-Time Console Use

Use this method if you do not want to install the userscript permanently.

1. Open the userscript file:

   https://github.com/kelesmert/unwall/releases/latest/download/Unwall.user.js

2. Copy the full file contents.
3. Open the target page.
4. Open your browser developer tools and switch to the Console tab.
5. Paste the code and press Enter.

Console use is temporary. It only affects the current page session, and you need
to run it again after reloading or opening another page. Persistent site
preferences and userscript manager menu commands are only available through a
userscript manager.

The console code is the same `Unwall.user.js` file. The userscript metadata
comments are ignored by the browser console, and Unwall falls back to temporary
in-page memory when manager storage APIs are not available.

## Experimental Unblur Script

`Unblur.user.js` is an experimental companion script for educational testing of
client-side content gates. It asks before making changes and only works when the
content is already present in the page, such as CSS-blurred text, hidden HTML,
embedded article data, or similar client-side markup.

Unblur cannot reveal server-side paywalls. If the remaining article text is not
sent to the browser, the script can only report that no revealable content was
found.

Use Unblur responsibly and only where you have permission to test. You are
responsible for your own use of the script; the author accepts no responsibility
for misuse or for consequences of using it on third-party websites.

## Site Options

Unwall asks before removing an access wall by default.

From the userscript manager menu, you can:

- Scan the current page.
- Turn global detection on or off.
- Remember detection for the current site.
- Enable or disable automatic removal for the current site.
- Forget the current site setting.
- Show diagnostics.

If automatic removal is enabled for a site, Unwall may remove high-confidence
access walls on that site without asking again. Automatic detection and
automatic removal are disabled on sensitive sites and subdomains such as login,
account, billing, checkout, payment, banking, email, and wallet areas.

## Safety and Limits

Unwall is conservative by design. It may not detect every anti-adblock wall, and
some sites may require updates when their page structure changes.

To reduce false positives, Unwall avoids touching video players, login forms,
payment pages, captchas, file uploads, and other sensitive page areas.

Use Unwall responsibly and only where you have permission to test or modify the
page experience. Website terms and local laws may restrict bypassing access
walls; you are responsible for your own use of the script.

## Feedback and Issues

Unwall has not been tested on every website. If it misses an anti-adblock wall,
removes the wrong element, or behaves unexpectedly, please report it:

https://github.com/kelesmert/unwall/issues

When possible, include the website URL, browser name, userscript manager, and a
short description of what happened.

## License

Unwall is licensed under GPL-3.0-or-later. See `LICENSE` for the full license
text.

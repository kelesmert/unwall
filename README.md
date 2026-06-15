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

   https://raw.githubusercontent.com/kelesmert/unwall/main/Unwall.user.js

3. Confirm installation in your userscript manager.

After installation, browse normally. When Unwall detects an anti-adblock access
wall, it shows a small confirmation card. Choose `Remove` to hide the wall, or
`Ignore` to leave the page unchanged.

## One-Time Console Use

Use this method if you do not want to install the userscript permanently.

1. Open the userscript file:

   https://raw.githubusercontent.com/kelesmert/unwall/main/Unwall.user.js

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
access walls on that site without asking again. Automatic removal is disabled on
sensitive subdomains such as login, account, billing, checkout, and payment
areas.

## Safety and Limits

Unwall is conservative by design. It may not detect every anti-adblock wall, and
some sites may require updates when their page structure changes.

To reduce false positives, Unwall avoids touching video players, login forms,
payment pages, captchas, file uploads, and other sensitive page areas.

## Feedback and Issues

Unwall has not been tested on every website. If it misses an anti-adblock wall,
removes the wrong element, or behaves unexpectedly, please report it:

https://github.com/kelesmert/unwall/issues

When possible, include the website URL, browser name, userscript manager, and a
short description of what happened.

## License

Unwall is licensed under GPL-3.0-or-later. See `LICENSE` for the full license
text.

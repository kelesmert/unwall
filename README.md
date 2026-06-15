# Unwall

Unwall is a userscript that detects anti-adblock access walls and removes them
only with user approval.

It is not an ad blocker. It does not disable your ad blocker, remove paywalls,
or collect telemetry.

## What It Does

- Detects visible anti-adblock popups, overlays, blur layers, and scroll locks.
- Asks before changing the page.
- Can remember a site when you choose to enable site-specific detection.
- Can automatically remove high-confidence access walls only on sites you choose.
- Provides an undo action after removal.

## What It Does Not Do

- It does not block ads.
- It does not disable or modify your ad blocker.
- It does not remove paywalls.
- It does not collect analytics or send page data anywhere.
- It does not intentionally interact with login, payment, captcha, or form flows.

## Install

1. Install a userscript manager such as Violentmonkey, Tampermonkey, or another
   compatible manager.
2. Open the raw userscript file:

   https://raw.githubusercontent.com/kelesmert/unwall/main/Unwall.user.js

3. Confirm installation in your userscript manager.

## Usage

Browse normally. When Unwall detects an anti-adblock access wall, it shows a
small confirmation card.

Choose `Remove` to hide the wall, or `Ignore` to leave the page unchanged.

Site-specific options are available from your userscript manager menu:

- Scan this page now
- Turn global detection on or off
- Remember detection for this site
- Enable or disable automatic removal for this site
- Forget this site setting
- Show diagnostics

## Site Preferences

By default, Unwall only asks before removing an access wall.

If you choose to remember a site, Unwall watches that site for longer on future
visits. If you enable automatic removal for a site, Unwall may remove
high-confidence access walls on that site without asking again.

Automatic removal is disabled on sensitive subdomains such as login, account,
billing, checkout, payment, and similar areas.

## Limitations

Unwall is conservative by design. It may not detect every anti-adblock wall, and
some sites may change their page structure in ways that require updates.

To reduce false positives, Unwall avoids touching video players, login forms,
payment pages, captchas, file uploads, and other sensitive page areas.

## License

Unwall is licensed under GPL-3.0-or-later. See `LICENSE` for the full license
text.

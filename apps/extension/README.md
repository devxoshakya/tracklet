# Tracklet Chrome extension

One-click tracking: open a Jira ticket, click the Tracklet icon, pick
Development or Support, and the tracker is created in your Tracklet app.

Chrome **Manifest V3** (FR-EXT-01), no build step, no dependencies.

## Load it

1. Edit **`config.js`** — set `serverOrigin` (the Tracklet API) and
   `webOrigin` (the Tracklet web app). Defaults point at local dev
   (`http://localhost:8787` / `http://localhost:3000`).
2. Visit `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select this `apps/extension` folder.
4. Sign in to the Tracklet web app once (Google) — the popup shares the
   browser session (FR-EXT-04); no cookies are copied or stored.
5. Open any Jira ticket tab (`…/browse/DEV-101`) and click the icon.

## Permissions (FR-EXT-10)

| Permission | Why |
| --- | --- |
| `activeTab` | Read the **active tab URL only** when you open the popup (FR-EXT-05). No page DOM, no Jira/GitHub APIs (FR-EXT-03). |
| `host_permissions` | Exactly one origin: your Tracklet API, so credentialed requests work (FR-EXT-02). |

## Layout

- `manifest.json` / `config.js` — declaration + the two allowed origins
- `popup.html` / `popup.css` / `popup.js` — the popup (states: sign-in, form,
  duplicate confirm, success, errors — FR-EXT-06..08)
- `lib/parse.js` — verbatim copy of the app's Jira URL parser
- `tools/make-icons.ts` — regenerates the PNG icons (`bun tools/make-icons.ts`)
- `tools/pack.ts` — self-check, then zip the loadable files into
  `apps/web/public/extension.zip` — the download behind the web app's
  avatar-menu "Install Chrome extension" button. Re-run after changes (and
  point `config.js` at the production origins before packing for a deploy)
- `tools/check-extension.ts` — self-check: manifest references + parser parity
  with `packages/db/src/urls.ts` (`bun tools/check-extension.ts`)

If `packages/db/src/urls.ts` ever changes, re-run the parity check — it fails
loudly when the mirror drifts.

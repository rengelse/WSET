# WSET v1.4.4-rc.49 – Visual Template Gallery & Live Preview

Base: rc.48. Existing Mal 01 rc.28.1, workspace, project metadata and publication contracts unchanged. No new commercial templates.

## Features
- Malbibliotek is an independent main-navigation page, accessible even when no website is open. All regular library entry points route there. The previous dialog remains a compatibility fallback for older UI harnesses.
- Grid of actual homepage screenshots from ZIPs, grouped by metadata category, search, pagination (12 entries per page), version labels, sync, folder reveal, import, Preview and Use template. Version and digest identify cached screenshots; changed/removed entries invalidate caches. Periodic catalogue refresh (5 s).
- Preview dialog: optional static screenshots (desktop, tablet, mobile, full homepage), scrollable display, live mode with 1280/768/390 CSS-pixel viewports, page/language selector, local browsing where supported. Fixed desktop viewport may need horizontal scrolling on small WSET windows. Old archives lacking new images stay valid; missing screenshots show a placeholder. Mal 01 rc.28.1 has desktop/mobile only.
- Live preview creates a temporary copy of the verified archive, not a managed project. Same editor-owned renderer registry; separate disposable loopback origin; read-only public asset allowlist; no editor bridge, PHP, network API, external assets or Smart Assistant. Existing project/session is not changed. Browser JavaScript can run only inside a sandboxed iframe; no Node, same-origin or privileged API. Frame navigation is restricted in Electron, forms/network connections denied via CSP. Live preview is a local design demonstration, not a production web server. The gallery can show unsupported designs as screenshots but cannot activate them.
- Sessions serialize opening/closing, clean staged files on normal close, switch and normal quit; abnormal process termination may leave scratch files. Source ZIP is never rewritten. Project creation remains the existing explicit confirmation flow.

## Files
New: `designer/core/template-gallery-preview.mjs`, `designer/ui/template-gallery.js`, `designer/ui/template-gallery.css`, `tests/template-gallery-rc49.test.mjs`, `tests/template-gallery-rc49-browser.py`, `tests/template-gallery-rc49-live.mjs`.
Modified: `designer/core/folder-template-library.mjs`, `designer/core/template-library.mjs`, `designer/main.cjs`, `designer/preload.cjs`, `designer/ui/index.html`, `designer/ui/app.js`, `package.json`, `README.md`, `TEMPLATE-CONTRACT-v1.md`.

## Testing
- Node core suite: 147 pass, 0 fail, 5 skipped with matching rc.28 legacy project/template fixtures. New rc.49 suite separately passed 5/5 using actual rc.28.1 ZIP, including every published route, CSS, denial of private paths, unsupported renderers, cleanup and no project creation.
- Chromium gallery test: actual Mal 01 images, navigation into gallery, search/category, unsupported mode, device widths, page-selection URL, sync, explicit project creation and view widths 1400/1040/960; mock IPC. Actual HTML/CSS rendered separately at mobile width. Browser environment blocks direct localhost navigation, so end-to-end iframe navigation and Electron navigation interception are NOT verified. Direct HTTP server tests use Node fetch.
- Windows/Electron, actual deployment, production Astro build and external server integrations not verified. Node test version 22.16.0 is below project minimum 22.23.4.

## Installation
`npm install` then `npm run designer`. Open Malbibliotek from the main menu. Keep existing Mal 01 rc.28.1 in Templates. Select Forhåndsvis, switch Skjermbilde/Interaktiv and choose PC/Nettbrett/Mobil. Bruk mal creates a project only after confirmation.
- Full suite: 149 passed, 4 failed due to missing historical Smart Assistant ZIPs / standalone CBPM Website source, 9 skipped. rc.48 dashboard Chromium regression passed.

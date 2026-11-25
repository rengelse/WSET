# WSET v1.4.4-rc.51 – Template Compatibility & Content Mapping

Base: rc.50 FULL SOURCE. Scope: read-only compatibility and stable-ID content mapping, no switch or redesign.

## Changes
- `designer/core/template-compatibility.mjs`: v1 mapping report, preservation plan, rendering and saved-binding checks, referenced media comparison, explicit warnings and blockers.
- `designer/core/folder-template-library.mjs`: verified exact target ZIP digest and asset index; no project extraction for analysis.
- `designer/main.cjs`, `designer/preload.cjs`: authorized IPC for the active project, snapshot and change guard.
- `designer/ui/template-gallery.js`, `designer/ui/app.js`, `designer/ui/index.html`: report entry from gallery when an existing project is open.
- `designer/ui/template-compatibility.js` / `.css`: scoped report dialog, searchable grouped results, status filter, dirty-project notice.
- `tests/template-compatibility-rc51.test.mjs`, `tests/template-compatibility-rc51-browser.py`: targeted core and browser checks.
- `package.json`, README, contract documentation and version labels updated.

## Usage
`npm install`, `npm run designer`. Open an existing project, select Malbibliotek, then Kontroller kompatibilitet on a template card. No changes to existing archives required. Only WSET-owned approved production renderers are supported; other designs may be catalogued but are blocked for mapping verification. Technical alternative renderer tested but not installed in production.

## Verification
- `npm run test:core`: 155 passed, 0 failed, 10 skipped (165 total).
- `npm test`: 157 passed, 4 failed, 14 skipped (175 total). All four failures are ENOENT for the historical Smart Assistant ZIP fixtures or separate CBPM-Website source directory.
- `WSET_TEST_TEMPLATE_ZIP=<actual Mal 01 rc.28.1 ZIP> node --test tests/template-compatibility-rc51.test.mjs`: 6/6 passed. Source and target bytes preserved; hidden content, languages, missing sections, saved overrides, media conflicts, unsupported category/renderers and stale digests checked.
- Chromium with mocked Electron IPC: report entry, key/digest call, search/filter, unsaved state, responsive dialog (1400/1040/960), closing without project creation, no-project state passed.
- Node v22.16.0 used for tests, below manifest minimum 22.23.4. Actual Windows/Electron, production Astro build, live FTP/SFTP and external module integration not verified. Report checks registered renderer and referenced assets, not full target production output or all unreferenced files. No automatic transfer, remapping, backup or rollback yet; rc.52 must verify full candidate and resolve all reviews before activating.

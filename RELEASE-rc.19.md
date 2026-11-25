# WSET v1.4.4-rc.19 – Workspace Stability

Baseline: rc.18 FULL SOURCE. Target: reported blank workspace/preview when leaving and returning to Nettsider, and overlapping preview toolbar controls. The exact Windows failure has not been reproduced with a real Electron instance.

## Changes
- `designer/ui/app.js`: keep the active project independent of area navigation, keep a per-project working context in memory and localStorage, restore selected page/section/record, language, device, inspector tab, tree state, preview mode and scroll. Show the workspace before waiting for template texts, guard stale async navigation and project responses, and explicitly set canvas visibility. Reuse an unchanged preview only if its bridge confirmed readiness; otherwise load the proper editor route again. Provide a refresh hint if readiness is missing. No automatic website opening at application startup: the previous explicit Fortsett redigering workflow remains.
- `designer/preview/bridge.js`: local preview ping/ready handshake; only matching URL/origin/source accepted by parent. Never exported.
- `designer/ui/property-manager.js`: don't redraw the shared inspector when the property workspace is hidden.
- `designer/ui/index.html` / `style.css`: separate text preview-mode button from fixed-width icon controls, wrapping toolbar, remove grid-track transition during navigation, blue add-section action and remove redundant inline instructions.
- `package.json`, `README.md`: update version.

## Verification
- `npm run test:core`: 6/6 passed.
- `npm test`: 8 passed, 4 failed (ENOENT: external CBPM source and Assistant archives not present), 4 skipped. Not a fully green integration suite.
- `node --check` for changed JavaScript passed.
- Optional `python tests/workspace-rc19-browser.py`: passed with actual renderer/CSS in Chromium, simulated IPC/storage/iframe transport; navigation round trips, dirty state, selection, scroll, preview reload/recovery and toolbar width at 1600/1200/1040 px checked. Requires Python Playwright and Chromium, not a WSET runtime dependency. Browser navigation in this environment is restricted; the harness uses set_content with CSP omitted solely for testing. Real Windows/Electron, actual preview rendering and real local project data remain to be verified.
- Engine, export generator, Electron main/preload and website/assistant source files unchanged.

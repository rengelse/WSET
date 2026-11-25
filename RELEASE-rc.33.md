# rc.33 – Property Workspace Integration

Baseline: rc.32 FULL SOURCE. Eiendommer has three tabs: Eiendomsregister, Nye annonser, XML-kilder. The standalone XML navigation entry and its Overview shortcut were removed. Existing XML catalogue, website engine, published design, image library and publication code are unchanged.

## Scope and data
- Collapsible tree, category-specific form, previous/next, draft selector and explicit save/delete. The standard global save also commits pending draft input. Drafts have an immutable UUID-based ID and shorter generated WSET reference from first save, with a collision check in the draft collection. This is not yet the complete source identity/collision contract for publishing.
- Inputs match the existing `property-xml.mjs` reader: `type`, `price`, `currency`, `price_freq`, `town`, `province`, `country`, `location_detail`, `location.latitude/longitude`, `beds`, `baths`, `surface_area.built/plot`, `pool`, `energy_rating.consumption/emissions`, `features`, `desc` by project language. Incomplete data is allowed in local drafts; numeric range/format checks run on save. The tree checks whether selected fields are filled, not publication validity.
- Local authoring-only `propertyDrafts` version 1 in project/website.json. Existing editor history, save and backup mechanics are reused. Full editable project ZIP carries drafts; template ZIP excludes them (and also strips draft data from a template on import). No XML is generated, no local feed changes, no draft counts are added to the imported property register. The future XML output remains the authoritative published listing source.
- Images, interactive map, publication validation, generated XML, own-listing register integration, listing preview, sales status/badges and server transfer remain future work. Their unfinished sections explain this rather than presenting mock functionality. No automatic translation. Native window close with an unsaved local form has a beforeunload guard, not tested in Windows. A dirty draft must be saved or discarded before switching workspace. The compact layout intentionally omits a permanent summary and progress percentage.

## Verification
- `npm run test:core`: 51 passed, 0 failed, 2 skipped (existing optional tests).
- `npm test`: 53 passed, 4 failed due to missing external CBPM/Smart Assistant fixtures, 6 skipped.
- `tests/property-drafts-rc33-browser.py`: actual core-backed draft save and selection, form/tree navigation, source and register tabs, widths 1040/1200/1600, navigation back to Nettsider; Chromium, simulated IPC. Test used supplied CBPM rc.27 project data. Browser harnesses updated for 8 navigation areas and 3 property tabs.
- `tests/property-drafts-rc33-project-check.mjs`: actual project save/reopen, full ZIP round-trip, template exclusion, unchanged local feed inventory and property settings.
- Property workspace and navigation regression harnesses passed. Node 22.16.0 in container is below requested 22.23.4. Windows/Electron, real Astro publication and final XML/PHP compatibility are not verified for this foundation release.

## Changed implementation files
`designer/ui/property-drafts.js`, `property-manager.js`, `app.js`, `index.html`, `style.css`; `designer/core/property-drafts.mjs`, `editor-operations.mjs`, `project-archive.mjs`; `designer/main.cjs`, package version/test scripts, README and tests. No imported website source files changed. New UI strings are Norwegian; full EN/ES UI localization remains outstanding.

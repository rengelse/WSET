# WSET v1.4.4-rc.25 — Property Workspace Redesign

Base: rc.24. This is a complete source ZIP, not a Windows installer.

## Changes
- Properties uses a dedicated full-width workspace; the website tree and global inspector are hidden in this area only. The project navigation and editor's previous workspace are retained.
- Four main tabs: Eiendomsregister, Boligkategorier, XML-kilder, Webhotell.
- Local property register: New and Existing folder tabs with actual counts, reference/location/type search, exact type and city filters over the full catalogue, list/card view, pagination and category-specific XML import. Select a property to open a closable details panel with facts, images and multilingual descriptions. Kyero feeds do not expose a dedicated title, so the display label combines property type and city. No invented publication status: local XML records remain read-only.
- XML sources: list of imported files, category, count, modified time and import actions; existing image-folder access; XML/image errors; link to server update settings. Remote configuration and remote register remain separate. No new XML generator or FTP functionality.
- Existing category configuration and category preview reused; existing remote administrator forms, staging, approval, save, status and archive commands retained. Remote record edits protected from navigation without confirmation. Existing wrong one-ZIP/automatic install wording corrected.
- Local catalogue return value extended additively with per-folder counts and filter choices. Parser and feed storage unchanged. The existing loopback image route uses the OS path separator for containment checks. Local image references use that route; external HTTPS thumbnails are loaded by the browser with no-referrer, using a placeholder on failure. Editor CSP permits HTTPS images only, not external scripts or arbitrary connections. No external image download/persistence is added.
- Existing website rendering/typography, CBPM template, project format, public export code and Smart Assistant remain unchanged. No new CBPM project import is required.

## Verification
- All 27 core tests passed using the existing CBPM rc.23 project fixture (including two new tests: real XML filtering/counts/pagination and local image route with rejected out-of-folder paths).
- Full suite with existing site fixture: 34 passed, 3 failed; all 3 are missing Smart Assistant archive dependencies (older rc.15 and rc.16 modules not supplied). No skips.
- Chromium property workspace harness passed with mock IPC: category counts, import category argument, search/filter/pagination, detail/card modes, source list, category form, connection, remote draft protection, leaving/returning to website, layout at 1600/1200/1040 px.
- Existing rc.19 browser navigation regression passed (9 area round trips, retained project, page/section/language/device and dirty state). Browser harnesses use simulated IPC; no real server or external image hosts were contacted.
- Windows/Electron runtime, actual provider XML import via native file chooser, actual remote administration and external images over real network remain to be tested. English/Spanish UI strings added for main controls, not a full localization audit. Local source filenames/status and facts reflect the XML, not a verified live website. The existing remote register remains a separate server-wide list.

## Files modified
`package.json`, `README.md`, `designer/ui/index.html`, `designer/ui/style.css`, `designer/ui/property-manager.js`, `designer/ui/app.js`, `designer/ui/app-i18n.js`, `designer/core/local-property-catalog.mjs`, `designer/core/preview-server.mjs`, and the two new property-workspace tests. Website engine, website generator, main/preload IPC, XML parser and persistence unchanged.

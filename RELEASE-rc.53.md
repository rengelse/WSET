# WSET v1.4.4-rc.53 – Template Version Management & Updates

Base: WSET Editor rc.52. No website templates, publication contract, module architecture or project data schema changes.

## Behaviour
- `Templates/` remains the source of truth, including subfolders. The original ZIP files are not modified. The gallery defaults to one newest valid archive per template ID; All versions and version-specific search expose the other archives. New projects can still be created from older versions.
- Numeric core version and numeric prerelease tokens are compared without lexical errors (`rc.100 > rc.29 > rc.28.10 > rc.28.1`); final release sorts above prerelease with identical core. Existing v1 grammar is retained: dots and hyphens are prerelease token delimiters, textual tokens are case-sensitive and lexical, numeric tokens precede textual ones. Equal-precedence aliases are not recommended automatically. This is the WSET v1 comparison policy, not a new version grammar or strict SemVer parser.
- Updates must have the same template ID, engine and contract, and strictly greater version precedence. A different template is a separate switch, a downgrade of the same template requires a previous local backup via rollback. No same-version overwrite/reinstall. Newer archives with unsupported renderer or conflicting content are not recommended. A valid lower newer version may be recommended if a higher version is conflicted/unsupported. Existing duplicate-content checks still apply. Incomplete folder scan suppresses recommendations and blocks fresh mapping.
- Mine nettsteder shows available updates and includes an update filter. Gallery shows active version, recommended target, and update-only filter. The dashboard rechecks approximately every 5 seconds when idle and not displaying a dialog, updating only changed update statuses. Project registry is still read locally. The main process supplies version assessments; renderer does not guess order from strings.
- Update action opens the existing compatibility report and rc.52 candidate/transaction path; exact archive key and digest are revalidated. Native confirmation, explicit checklist approval, isolated production build and full original-directory backup remain required. History records `kind: update` with source/target descriptors. Rollback restores previous content/design and backs up current work. No automatic activation or webhotel upload. Existing custom styles/assets remain as in rc.52.
- A catalogued candidate is not a guarantee that its content/renderer/build is compatible. rc.52 conservative blocking of removed code and changed server code remains. No migration of incompatible server code, manual binding mapper or release-note manifest. Backups remain beside projects, not centralized. Only Mal 01 production renderer is available.

## Changed files
- `designer/core/template-versions.mjs` (new): version comparison, recommendation and update guard.
- `designer/core/folder-template-library.mjs`, `template-library.mjs`: version ordering and conflict reporting; incomplete scan handling.
- `designer/core/template-switching.mjs`: update intent and history kind; reuse transactional guard.
- `designer/main.cjs`, `preload.cjs`: catalogue/dashboard assessment and update intent.
- `designer/ui/template-gallery.js/.css`, `project-dashboard.js/.css`, `template-compatibility.js`, `app.js`: version filters, status, update flow and history labels.
- `tests/template-versions-rc53.test.mjs`, `tests/template-versions-rc53-browser.py`: automated core and Chromium tests.
- `package.json`, `designer/ui/index.html`, `README.md`: version and documentation.

## Test commands
`npm run test:core`, `npm test`. Optional fixture environment: `WSET_TEST_TEMPLATE_ZIP` (legacy rc.28), `WSET_TEST_PROJECT_ZIP` (rc.28), `WSET_TEST_SWITCH_TEMPLATE_ZIP` (Mal 01 rc.28.1). `python tests/template-versions-rc53-browser.py` (requires Playwright and Chromium).

Actual Mal 01 archive is used in folder and transaction tests. Test target rc.100 is a temporary fixture, not a delivered template. Transaction build callback is simulated; actual Windows/Electron and full Astro production build are not verified (local Node 22.16.0, project requires >=22.23.4). Chromium tests simulate Electron IPC.

Results: 172 core passes, 0 failures, 5 skipped; 7/7 new rc.53 tests. Full suite: 174 passed, 4 failed, 9 skipped (four ENOENT errors for historical Smart Assistant module archives and separate website source). Chromium: new version management test plus gallery rc.49, lifecycle rc.50, compatibility rc.51 and switching rc.52 browser regressions passed using mocked IPC. The initial core run used rc.28.1 for the legacy rc.44 fixture that explicitly expects rc.28; corrected the fixture selection and reran successfully.

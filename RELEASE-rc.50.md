# WSET v1.4.4-rc.50 – Project Lifecycle & Progress Tracking

Base: rc.49 FULL SOURCE. No changes to templates, website renderers, project archive contract, website content, or two-ZIP publication structure.

## Project administration
- Mine nettsteder → Fremdrift: manual lifecycle status, target delivery date, customer approval (including approved date), and notes (max 8000 characters).
- Seven manual checkpoints: brand, pages, media, languages, legal, modules, server. Each can be pending, done, or not applicable. Technical validation and customer approval are separate computed points. Progress = completed/applicable points, rounded to integer percent. Customer approval is excluded when marked not required; technical validation is always applicable. Published is a manual project status, not an automatic declaration of successful deployment. Archived is a status only; no folder is moved or deleted.
- Technical validation uses the existing canonical validator on saved/migrated project data. The validation records a saved website.json digest, errors/warnings, and timestamp. A changed JSON invalidates the check; external asset changes need a fresh check. Warnings do not fail canonical validation. Unsaved editor content and actual remote server behavior are not checked. Notes, dates, and state are not inferred from a legacy project.
- Dashboard cards display status, progress, due date, approval, last successful export and website transfer, and the last operation if unsuccessful. Status filtering and deadline sorting are available. Previous search, view, open/copy/export and domain filters remain. Status-oriented counts replace the former dashboard summary counts.

## History
- Completed website ZIP generation is recorded as export; direct website/New/Existing server jobs are recorded when the transfer queue actually terminates. Errors, cancellation and unexpected skips are differentiated. Preservation of existing private files and identical images is an expected skip. The server transfer callback captures the original project scope and saves only event ID, timestamp, type, outcome, saved JSON digest (website/export), and counts. No server passwords or transfer paths. A failed local history write is reported without pretending a transfer did not occur.
- History starts in rc.50; earlier operations, manual FTP uploads, manually deployed ZIPs and failed/cancelled ZIP generation are not retroactively logged. Full transfer completion does not prove that the live site is reachable or works. Change indicator compares only saved website.json plus the active editor dirty flag; it is not a full asset/XML/module/server diff. User can refresh the project dashboard to see newly recorded operations.
- Local admin metadata stays in `.wset-local-project.json`, outside editable ZIP and deployment archives. Legacy projects initialize with empty checklist and not-started status; website data untouched. Project registry retains identity/path/date only; local metadata remains source of truth. Project copies start with fresh administrative data as in rc.48. No change to server credentials.

## Files
New `designer/core/project-lifecycle.mjs`, `tests/project-lifecycle-rc50.test.mjs`, `tests/project-lifecycle-rc50-browser.py`. Updated `designer/core/{workspace,project-dashboard,server-manager}.mjs`, `designer/{main,preload}.cjs`, `designer/ui/{index.html,project-dashboard.js,project-dashboard.css}`, `tests/server-publication-rc42.test.mjs`, `package.json`, README and this release note.

## Verified in local Linux test environment
- Targeted tests: 25 passed, 0 failed, including actual Mal 01 rc.28.1; 6 new lifecycle tests and 1 new server completion callback test included.
- Core tests: 154 passed, 0 failed, 5 skipped (legacy Mal 01 rc.28 and project rc.28 provided). The historical rc.44 fixture assumes legacy rc.28 metadata, so the core run uses the actual legacy archive rather than rc.28.1; latest archive tested separately above.
- Full suite: 156 passed, 4 failed, 9 skipped. All four failures are ENOENT for historical Smart Assistant ZIPs and separate CBPM Website source directory. No claims of passing those tests.
- Chromium: lifecycle dialog, approval, checklist, computed progress, history, status filtering, deadline sorting, list/grid, widths 1400/1040/960; simulated Electron IPC. Real server transport is simulated in Node tests.
- Node 22.16.0 used, below package minimum 22.23.4. Windows/Electron, real FTP/SFTP and full Astro production generation not verified here. The existing website package code is unchanged.

Next: rc.51 – Template Compatibility & Content Mapping. No new design templates in rc.50.

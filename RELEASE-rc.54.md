# WSET Editor 1.4.4-rc.54 – Multi-template Quality Assurance

## Scope
Source baseline: rc.53 FULL SOURCE. No commercial design template, no redesign, no new production renderer. Existing project, template, module and two-ZIP formats remain unchanged.

## Findings and changes
1. Publication validation previously checked the root index, minimum resources and property configuration; full static route and structural validation was only used in the switch-specific path or during design overrides. The generator now checks all expected static page/language routes, language and main shell, and ordinary page structure against the active trusted renderer before post-processing. It rejects unexpected static index routes. The PHP property catalogue is checked separately, including stale HTML masking PHP. Hidden property PHP catalogue routes are rejected. The admin endpoint remains available when the catalogue is hidden.
2. Public/private separation: reject additional private source directory segments in the public archive. When Assistant is disabled, reject public Assistant API/assets and private Assistant runtime code; the existing disabled `app/assistant/status.php` sentinel and directory are intentionally allowed.
3. Verify every public archive file against the SHA-256 sidecar manifest and embedded manifest before and after post-processing. Typography export now updates the embedded manifest too. Detect changes to saved website JSON or template identity while the runner executes. These are consistency checks, not a cryptographic signature or a sandbox for user-approved npm builds.
4. Propagate an explicitly supplied internal renderer registry consistently through project loading/copying, archive import/export, folder-library validation/creation/staging, preview, publication and switch/rollback. Production still defaults to the fixed editor-owned registry; no ZIP metadata or renderer IPC supplies an executable adapter. A second adapter is used only in the test suite. Existing page graph, markup and engine constraints are retained. Centralized publication validation replaces the redundant switch-only structural check. Reload after switch/rollback uses the source snapshot, so in-memory migration changes are still marked for saving.
5. Legacy archive test expected a fixed rc.28 identity even for rc.28.1 descriptor-bearing archives; now verifies declared metadata or legacy package-version fallback. Historical module integration cases report missing fixtures as explicit skips. `WSET_REQUIRE_INTEGRATION=1` makes missing required historical integration fixtures fail instead of skip. The original integration assertions are retained. The split-project test uses the same strict option.

## Actual verification (2026-11-25)
- Node 22.16.0 (below declared >=22.23.4). No installed Astro/Electron or Sharp used for these tests.
- Full `npm test` with actual Mal 01 rc.28.1 archive, project rc.28 archive and extracted rc.28 source: **192 tests, 185 pass, 0 fail, 7 skipped**.
- New rc.54 QA tests: **5/5 pass**. Negative checks cover missing/extra routes, wrong language, stale PHP/HTML collision, private files, disabled module runtime, inconsistent hashes and embedded manifest.
- Real source technical second-design test: copy Mal 01 with a different template ID and hero class in actual renderer source/CSS; only the explicit test registry supports it. Library imports both archives, production registry rejects the technical one, candidate preview serves its actual hero class, the existing source content is preserved through switch, isolated offline rendering + genuine packaging scripts, roundtrip project ZIP import, and rollback. The original template ZIP remains unchanged. This is an offline source build, not an Astro production build. Test-only files are generated in a temporary directory and are not installed in the production catalogue.
- Independent actual Mal 01 source offline build: 143 static routes across 11 enabled languages after saving migrated content; `verify:offline` passed local assets/routes; actual contact/property staging in demo/disabled mode and package-manual-site scripts produced 196 public files and 19 private entries. Both ZIPs and manifest passed the new checks. Property PHP route and Assistant-off rejection are also tested separately with technical fixtures. No live PHP catalogue or Assistant-on build was performed here.
- Seven skips: five external published/module integration fixtures (two original Assistant identity cases and three historical module cases); two real image conversion cases requiring Sharp. Missing fixtures are not passes. No Windows/Electron, real FTP/SFTP, Astro 7 production build or browser UI rerun in rc.54. Earlier browser checks are not counted as new verification.

## Reproduce (PowerShell)
Extract the editor release. Extract the actual rc.28 website project archive into a separate source folder. Adjust paths to your local archive/source locations.

```powershell
npm install
$env:WSET_TEST_TEMPLATE_ZIP = 'D:\WSET\Templates\CBPM-WSET-MAL-rc.28.1-Library-Previews.zip'
$env:WSET_TEST_SWITCH_TEMPLATE_ZIP = $env:WSET_TEST_TEMPLATE_ZIP
$env:WSET_TEST_PROJECT_ZIP = 'D:\WSET\CBPM-WSET-PROSJEKT-rc.28-Subpage-Hero-Alignment.zip'
$env:WSET_TEST_SITE_ROOT = 'D:\WSET\QA\CBPM-Website'
$env:WSET_TEST_WEBSITE = $env:WSET_TEST_SITE_ROOT
npm run test:qa
npm test
npm run designer
```
For strict historical module integration, provide `WSET_TEST_OLD_MODULE_ZIP` and `WSET_TEST_MODULE_ZIP` and run `$env:WSET_REQUIRE_INTEGRATION='1'; npm run test:integration`. Additional original identity fixtures use `WSET_TEST_IDENTITY_MODULE` and `WSET_TEST_PUBLIC_ZIP`.

## Remaining platform limits / next release gate
- Only `property.mediterranean-premium` is a production registered renderer. Future renderer adapters must be explicitly reviewed and registered in the editor. No independent signed renderer installer is implemented. The content/section schema, markup contract, publication layout and engine are still CBPM Astro v1. These are deliberate compatibility boundaries, not unrestricted arbitrary-HTML support.
- Multi-template switching was verified with a technical second renderer and actual offline source/package scripts; not yet between two commercial designs, or with full Astro production building.
- Malbytte continues to block unresolved missing bindings and incompatible server-code changes; original local assets and design overrides are retained. Manual content remapping and optional typography reset are not implemented.
- Verify actual Windows/Electron operation, production Astro build, Assistant enabled/disabled with real module packages, dynamic property catalogue and real hosting before declaring production-ready. The next design can then be developed alongside its trusted adapter; no commercial templates shipped in rc.54.

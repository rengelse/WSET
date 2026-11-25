# rc.44 – Template Foundation & Contract

Base: WSET 1.4.4-rc.43.1. No public design, website renderer, property engine, assistant or publication code changes.

- New `designer/core/template-contract.mjs`: validate declarative template identities, legacy fallback, explicit runtime support gate.
- `project-archive.mjs`: resolve and compare archive and sidecar metadata; persist on import/export without changing archive format or existing file safety checks.
- `project-storage.mjs`: expose template metadata when opening a project; existing content save and Save As semantics remain.
- `main.cjs`, `ui/app.js`, `ui/index.html`: expose/display active identity instead of inferring Mal 01 from section types.
- `tests/template-contract-rc44.test.mjs`: schema, malformed inputs, unsupported identity, conflicting metadata, real rc.28 project/template import, copy and roundtrip.
- `TEMPLATE-CONTRACT-v1.md`: contract scope and deferred functionality.

## Verification
Node v22.16.0 (below the declared >=22.23.4; Windows Electron and production build not run).
Core suite with real project and template ZIP: 115 pass, 0 fail, 5 skipped (optional fixtures/dependencies). Full suite with extracted real rc.28 website source and both ZIP fixtures: 123 pass, 3 fail due to missing historical Smart Assistant module ZIPs, 4 skipped (optional fixtures/dependencies). All six rc.44 tests passed. Actual renderer compatibility and existing project/template archive roundtrip tests passed. No test failures were suppressed. Full production Astro build and Windows UI verification remain outstanding.

Reproduce on Windows (PowerShell; use real paths):

```powershell
npm install
$env:WSET_TEST_PROJECT_ZIP = 'C:\path\CBPM-WSET-PROSJEKT-rc.28-Subpage-Hero-Alignment.zip'
$env:WSET_TEST_TEMPLATE_ZIP = 'C:\path\CBPM-WSET-MAL-rc.28.zip'
npm run test:core
npm run designer
```

For the wider suite, set WSET_TEST_WEBSITE and WSET_TEST_SITE_ROOT to an extracted rc.28 website root. Historical assistant integration tests also need their original module fixtures (see tests/module-integration.test.mjs).

Next: rc.45 categorized template library. No template switching or renderer selection is enabled in rc.44.

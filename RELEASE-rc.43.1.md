# WSET v1.4.4-rc.43.1 – Project ZIP Import Compatibility

Hotfix based on the supplied rc.43 Legal, Footer & Global Content FULL SOURCE. No website template, editor layout, publishing or assistant changes.

## Fix
The supplied CBPM-WSET-PROSJEKT-rc.27 archive has 120 ZIP records: 17 explicit directory records and 103 files (including wset-project.json). Previously the reader rejected every directory record. The shared archive reader now validates safe empty directory metadata and discards it; it continues to reconstruct necessary parent directories from validated file paths. Empty directories are not preserved. Invalid paths, private namespaces, symlinks, nonempty directory records, duplicate paths, file/directory conflicts and inconsistent path case/local header names are rejected. Existing file integrity, size limits, project manifest and staging validation remain in place. No code is executed during project import.

## Verification
- Actual supplied CBPM rc.27 ZIP imported successfully; all 102 non-manifest files compared byte for byte.
- Re-export and re-import: normalized project data equal; 11 languages retained.
- `npm run test:core` with supplied project fixtures: 109 passed, 0 failed, 5 skipped.
- `node --test tests/split-project-archives.test.mjs` with supplied website fixture: 6 passed, 0 failed.
- New archive tests: 6 passed, included in core count. Use WSET_TEST_PROJECT_ZIP for real ZIP test and WSET_TEST_WEBSITE for extracted project fixture.
- Node 22.16.0 in this environment (below declared project engine minimum); Windows/Electron and actual Smart Assistant module import not exercised in this hotfix.

## Installation
Extract FULL SOURCE in a separate folder; use `npm install` and `npm run designer`. Import the original project ZIP unchanged. No new dependencies. Do not import the editor FULL SOURCE archive as a website project. Existing project copies are not overwritten by the import.

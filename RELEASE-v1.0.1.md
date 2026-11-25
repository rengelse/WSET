# WSET v1.0.1 – Installer Path Validation Fix

Baseline: v1.0.0. The installer reported an invalid dedicated program folder on Windows. The previous NSIS `GetFullPathName` instruction could return an empty string when it could not resolve a directory. Replaced it with checked Win32 `GetFullPathNameW` lexical normalization for both expected and requested paths, including not-yet-existing directories. Reject empty, failed, truncated or mismatched paths; display both paths on rejection. Existing owner marker, junction and workspace guards remain in place, with additional Settings/System guards. The actual path mismatch on the reported PC is not yet confirmed.

No changes to project creation, updater, application ID, workspace, templates, modules or publication. Program installation stays separate from all user data; do not delete the old installation or workspace to work around the error. If an unexpected installation location is shown, stop and report both paths.

## Verification
Node tests with actual CBPM template/project archives: 206 passed, 0 failed, 13 skipped, total 219. New source-level regression checks verify the installer guard and version consistency. Node 22.16.0 in test environment. Windows NSIS compilation, actual install/reinstall and automatic GitHub update not tested here; Windows smoke script remains available for disposable VM testing. This is a candidate fix pending actual Windows confirmation.

## Build and publish
Extract in a separate source directory. `npm install`, `npm run dist`. Install `dist/WSET-Setup-1.0.1.exe` manually (internal rc.57 version compares higher). Confirm application launches, workspace path and all projects remain available. After successful local verification, publish a normal GitHub release with tag `v1.0.1`, title `WSET v1.0.1 – Installer Path Validation Fix` and exactly the three distribution files: EXE, EXE.blockmap and latest.yml. The next automatic update test can use v1.0.2 if v1.0.1 becomes the first installed public version. Do not publish an incomplete build.

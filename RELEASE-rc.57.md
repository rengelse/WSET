# WSET 1.4.4-rc.57 – Automatic Updates & Silent Installation

Base: rc.56.1. Application update only; template/project/storage architecture remains unchanged. No source or release assets are uploaded automatically. No GitHub Actions.

## Build and release (Windows)

1. Use supported Node.js >=22.23.4. Run `npm install`, `npm test`, `npm run dist` in the source directory.
2. `dist/` must contain `WSET-Setup-1.4.4-rc.57.exe`, `WSET-Setup-1.4.4-rc.57.exe.blockmap`, `latest.yml`. The distribution script verifies all three.
3. Install rc.57 manually (first updater-capable version). On GitHub `rengelse/WSET`, publish a normal release tagged `v1.4.4-rc.57`, not a draft or GitHub prerelease. Mark as latest. Upload only the three files. RC is part of the version; there is one channel.
4. For acceptance test publish rc.58 after building it, and test the update from installed rc.57, using a disposable workspace copy before real customer data.

## Behavior

Checks at startup (2.5 s after UI load), every 30 min and on request via Programinnstillinger > Programoppdateringer. The top bar displays installed version and a clickable indicator if newer version available. Release notes are rendered as plain text. GitHub latest release API identifies the published normal release and validates exact tag/asset names/URLs; the version-specific HTTPS GitHub Releases folder is passed to electron-updater 6.8.12 (generic feed, latest.yml). Manifest version, single installer filename, SHA-512 field and size are checked. electron-updater validates downloaded bytes. Full installer download is intentional in this version; differential download not tested/enabled; blockmap remains part of release contract. No credentials needed. No automatic download, install-on-quit or downgrade. Dev mode does not update.

Before update, UI attempts to flush current text/context/language changes; pending property drafts must be saved or the user must cancel. Main process prompts for save/discard/cancel of dirty project; a failed save stops download. During update, project mutations and server actions through IPC are blocked; active operations, prepared template switch, export, workspace migration, remote property session or translation preload prevent start. Workspace location must not overlap installation/runtime directories. Approval is required even for a clean project. On success updater is called with `quitAndInstall(true,true)` (v6 API). Resume marker stored outside workspace under Electron runtime; only exact target version, matching workspace and project ID/path allowed; restored project is read without running feed reconciliation. If restore fails, open normally from Mine nettsteder. Normal workspace scans and editor writes (including user-approved saves) remain normal app operations, not installer operations.

Existing NSIS fixed install dir and workspace safeguards retained. No template or module updates or webhost publish during application update. No signature certificate supplied; hash checks establish integrity relative to the published manifest, not independent publisher authenticity. Secure GitHub account and use code signing before public production distribution.

## Verification

209 passed / 0 failed / 7 skipped (216 total) using supplied project rc.28, template rc.28.1 and extracted project as source; 8 new updater tests passed. Tests simulate GitHub, electron-updater and installer; no actual installer launch or Electron UI execution. Node v22.16.0 environment; npm registry lookup EAI_AGAIN, so dependency installation, packaged EXE, actual update and Windows restart not verified. Missing historic Smart Assistant archives, published archive and Sharp explain skipped tests.

## Windows acceptance criteria (rc.58)

- Verify no update installed by closing rc.57; cancel prompt leaves version unchanged.
- Check manual and automatic detection, notes, progress. Test no project, clean project, unsaved change save/discard/cancel, and failed save. Ensure busy transfer/malbytte/migration block install.
- Test network interruption, invalid manifest, corrupt installer, and retry. Check application remains usable when download fails.
- Compare SHA-256 files for all workspace directories before/after installer (with editor closed; exclude intentional saves/normal app cache writes). Verify same project ID, data, templates, modules, backups, credentials and server settings. Check active project reopens; published sites untouched.
- Test actual Windows NSIS restart and first launch. Recovery from interrupted installer and code signing remain rc.58/production qualification tasks. Keep the previous installer and a workspace backup for test safety.

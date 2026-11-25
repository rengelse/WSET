# WSET Editor 1.4.4-rc.55 — Unified Workspace & Storage Architecture

Baseline: rc.54 remains unchanged. No changes to the website design, renderer contract, template metadata or public/private publication formats.

## Workspace

One selected root, default `Documents/WSET` (existing rc.54 workspace root retained on migration):

```
WSET/
  Projects/<project>/
  Templates/<category>/<template>.zip
  Modules/
  Backups/<project-id>/Content/
  Backups/<project-id>/.wset-switch-<id>/original/
  Exports/<project-id>/
  Archive/<project>/
  Settings/workspace.json
  Settings/server-profiles/
  Settings/wset-translation.json
  Settings/ui-preferences.json
  System/Registry/
  System/Cache/
  System/Temp/
  System/Logs/
```

The runtime uses the root-based path service; individual path overrides are no longer available in the normal application. `workspace.mjs` retains the legacy entry point for existing test fixtures, but the Electron startup explicitly uses the unified path model. The registry is rebuilt from Projects and Archive, not old external locations. Corrupt registry JSON is retained under a `.corrupt-*` name. Duplicate project IDs are not silently reassigned in the unified workspace. New projects and project copies live directly under Projects. Opening an external project directory offers a new managed project copy (standard Save As semantics: omits generated files, `.env` and prior backups; new ID). Imported templates remain original ZIPs. Manual export dialogs default to the project-ID folder; a user may explicitly export elsewhere.

## First start and moving

At first start rc.55 asks to copy legacy data into the existing configured root. Legacy template ZIPs, installed module data, project directories and private project files, metadata, export folders, archive, translation settings and server profile files are retained. Old per-project content backups and completed template-switch backups are copied into the central backup area. Earlier copies are not removed. Legacy files are copied without overwriting conflicting target files; source and destination file hashes are checked. Missing stale project references are reported. An interrupted or conflicting migration can leave partial copies in the destination; the source is retained and the new bootstrap pointer is not committed until completion. Do not delete source data before confirming migration. Resolve conflicts manually before retrying. No automatic merging of different module files with identical names.

`Flytt arbeidsområde` copies to an empty directory, checks disk space and SHA-256 inventories, then changes the workspace pointer and restarts WSET. The original is deliberately retained. `Koble til eksisterende` connects to a workspace bearing the rc.55 marker. On another computer encrypted password fields may require re-entry. Existing server profiles are migrated from path-hashed keys to stable project ID keys. Project-relative absolute local profile paths are rebased when moved; externally located keys/paths remain external. Server credentials remain encrypted by Electron safeStorage, never decrypted for migration. Physical archive and restore are explicit actions for inactive projects, not destructive operations; original lifecycle status is preserved. Conflicting target folder names block restore.

## Central storage and exclusions

New content-save backups and complete template-switch backups are stored under Backups by stable project ID. Template transactions retain original same-volume rename and journal recovery, and rollback still makes a new backup. Historical duplicate backups remain where they were if already in a managed project folder; they are not removed. Temporary gallery validation and direct-publication staging are under System/Temp. Build dependencies and Astro output can still be regenerated inside each project folder. During verified workspace relocation, regenerable root-level project caches (`node_modules`, `.astro`, `dist`, `preview-offline`) and System/Cache and System/Temp are excluded; normal nested content directories with the same names are not excluded. Other files are copied. UI preferences and manual task/context state are stored in Settings; old browser localStorage values are migrated once if accessible from the same Electron origin. Old browser storage remains untouched. Electron/Chromium runtime files, the minimal pointer, OS keychain and externally installed Ollama/models are exceptions to the workspace rule. System/Logs contains a migration report, not a full new runtime logging system. Storage overview reports logical file sizes and free disk space; symlinks are not followed. Integrity action reads/hashes durable files and checks registry/library structure; it does not compare with a previously signed external baseline. Network paths, junctions/symlinks and externally changing files are not silently followed or merged; unsupported paths stop migration or relocation.

## Verification

Test environment: Node 22.16.0 (below declared >=22.23.4). Full test run with actual template rc.28.1, actual project rc.28 and extracted project source: 194 passed, 0 failed, 7 skipped (201 total). Seven skips relate to unavailable historical Smart Assistant/module/publication artifacts and Sharp. Nine new rc.55 tests passed, including actual Mal 01 content backups, central template switch and rollback across workspace relocation, simulated build operation, module conflict, migration, profile ID, archive/restore, preferences and registry rebuild. Chromium isolated-dialog test with actual HTML/CSS/JS and mocked IPC passed at 1400, 1040, 960 px; local file navigation was blocked in the environment, so HTML/CSS/JS were loaded into the test harness. Real Windows/Electron startup, Electron restart/credential decryption on Windows, production Astro build, real FTP/SFTP, network volumes and OneDrive are not verified. The integrity check is not a replacement for full acceptance tests. Run `npm install`, `npm test`, `npm run designer` on Windows, keeping rc.54 and originals until verified.

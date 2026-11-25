# WSET v1.4.4-rc.56.1 — Manual GitHub Releases

This corrective release supersedes the distribution instructions in RELEASE-rc.56.md. The rc.56 installer/workspace isolation is retained. No website projects, templates, modules, settings, credentials, project schema or storage paths are modified by this change. No in-app updater is implemented yet (rc.57).

## Build and publish

Use compatible Node (package minimum >=22.23.4; Node 24 LTS recommended) and npm on Windows. Extract the source in a program/source directory separate from the WSET workspace. Use a fresh source directory for each release to avoid stale build artifacts.

```powershell
npm install
npm run dist
```

The command builds a Windows x64 NSIS installer with `--publish never` and automatically verifies its version, manifest path, installer size, SHA-512 digest and presence of a nonempty blockmap. The verifier is read-only and can also be rerun with `npm run verify:release`. `npm run dist:win` remains an alias. `npm run designer` remains the development entrypoint.

Upload **only** these three distribution files from `dist/`:

- `WSET-Setup-1.4.4-rc.56.1.exe`
- `WSET-Setup-1.4.4-rc.56.1.exe.blockmap`
- `latest.yml`

Other electron-builder outputs (such as `win-unpacked/`, debug/config files) are local build products, not release assets. Do not rename the installer or edit latest.yml. There is no separate SHA256SUMS.txt release file. The manifest already contains the SHA-512 of the installer; this is an integrity check, not publisher authentication.

Manually create a release at https://github.com/rengelse/WSET/releases with tag `v1.4.4-rc.56.1`. Use a normal published release (not a draft or GitHub prerelease) and mark the intended release as latest. RC remains part of the SemVer version; all releases use one `latest.yml` feed. The future updater must use this same policy and handle numeric RC versions. Do not upload source, user data, templates or modules. No GitHub Actions, token or automatic publishing is required. No repository changes were made in this task.

## Safety

Permanent app ID `no.rengelse.wset`, executable WSET.exe, one-click per-user NSIS installation under `%LOCALAPPDATA%\Programs\WSET`, and existing bootstrap/workspace separation retained unchanged. The installer guard and app overlap protection remain. The program must never write website data as part of an application update. The packaged smoke check now also checks the embedded feed channel `latest`.

A first manual installer is needed. rc.57 will implement the in-app notification, user-initiated download, save/discard/cancel gate, verification, silent installation and restart. Until authenticity and real Windows update behavior are verified, do not rely on silent installation of unsigned packages. No code-signing certificate is included. The optional `scripts/smoke-install.ps1` remains available for a clean disposable Windows VM only (`-Version 1.4.4-rc.56.1 -DisposableVM`); do not run it on a real existing WSET installation. It tests install/reinstall isolation using fixture data.

## Validation

The targeted packaging tests validate one channel, the exact distribution naming, no publish flag, manifest integrity and the existing path/pointer safety logic. The verifier test uses synthetic installer bytes, not a real Windows executable. The npm registry is inaccessible (EAI_AGAIN); this environment has Node 22.16.0, below the declared minimum. No actual EXE or blockmap or latest.yml has been built here, and no package-lock.json is fabricated. A successful local Windows `npm run dist` and real installation check remain necessary. No changes to the workspace/migration implementation or installer guard were made.

Regression run: 208 tests total, 201 passed, 0 failed, 7 skipped (missing historic module fixtures and Sharp). All 7 packaging tests passed. Actual Mal 01 and rc.28 project fixtures were supplied. Main-process and builder config syntax checks passed.

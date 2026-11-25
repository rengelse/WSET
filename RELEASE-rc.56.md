# WSET v1.4.4-rc.56 — Application Packaging & GitHub Release Foundation

## Scope
Source baseline rc.55, unchanged project and template contracts, no new design or automatic updater. Electron 45.4.1 retained; electron-builder 26.18.0 added. First target Windows x64, per-user NSIS installation. Stable application identity `no.rengelse.wset`, product/executable WSET. Repository `https://github.com/rengelse/WSET.git`. Do not change app ID, product/executable name or install policy between versions without a migration plan.

## Data isolation
- Dedicated default program directory `%LOCALAPPDATA%\Programs\WSET` (NSIS custom guard rejects other destinations, unknown nonempty install folders, common workspace folders and directory junctions at the program/Programs directory). Never store customer data in the install directory. Redirected UserProgramFiles paths are intentionally not supported by this initial policy.
- Workspace remains `Documents/WSET` or the existing user-selected root. Startup and workspace relocation reject overlapping program directories, resolving existing path ancestors first. The normal application can still update its own indexes/cache and save content when requested; the installer does not migrate project content.
- Installed Electron runtime uses `%APPDATA%\WSET`. The first launch reads the previous `Electron` or `wset-editor` pointer if no WSET pointer exists, checks for ambiguous roots, and records the chosen root in the new bootstrap directory. Existing source paths are retained. If older ununified data are found, the existing rc.55 explicit migration flow applies; no new project schema change. Do not run the source and installed app simultaneously against the same workspace.
- Installer excludes arbitrary project archives, environment files, private storage and server profiles. It ships the editor and its bundled compatibility engine/seed, not user templates or projects. No app-data deletion on uninstall; no automatic app launch at end of this first installer. The installer is not a website publisher.
- Machine-bound server credential decryption still needs real Windows verification. Back up the workspace and keep the old source app and bootstrap files until the first installed launch is verified.

## Local Windows build
Use Node 24 LTS (at least the package's declared minimum), npm, and network access. From a clean extracted source directory, not the WSET workspace:

```powershell
npm install
npm test
npm run dist:win
npm run verify:release
```

The expected outputs in `release/`: `WSET-Setup-1.4.4-rc.56-x64.exe`, matching `.exe.blockmap`, `rc.yml` and `SHA256SUMS.txt`. Build with `--publish never` (already part of the npm scripts). `npm run pack:win` builds an unpacked application for diagnostic purposes only. `npm run designer` remains the development entrypoint. Installed app does not need an external Electron or npm to launch, but existing website generation invokes external Node/npm, so compatible Node must remain installed on PATH until a standalone build toolchain is implemented.

## Initial GitHub setup
The source is delivered as a ZIP; nothing has been pushed or released. Review all files before committing to the public repository. The included `.gitignore` excludes common build artifacts, credentials and WSET workspace directories, but is not a substitute for reviewing files. Use a new source-only directory, not the user's workspace. The source is supplied without a dependency lockfile because the npm registry was unavailable in this environment. Run `npm install` locally and commit the generated package-lock.json after reviewing it. CI uses `npm ci` if a lockfile exists; otherwise it generates and uploads a lockfile for review. Do not overwrite an existing repository.

```powershell
git init -b main
git add .
git status --short
git commit -m "WSET v1.4.4-rc.56 release foundation"
git remote add origin https://github.com/rengelse/WSET.git
git push -u origin main
```

If the repository already contains commits, clone/pull and integrate first, never force push. GitHub Actions > `WSET Windows build and draft release` > Run workflow on main. First run with `create_draft=false`. CI installs dependencies, runs all available tests, builds, checks manifest version/installer SHA-512 and size, writes SHA-256 list, and runs the actual silent installer twice on a disposable Windows runner. The installer is also challenged with an invalid `/D` destination, and fixture-workspace hashes and pointer hash are checked before/after. The packaged smoke tests native Sharp, FTP/SFTP dependencies, MapLibre and the embedded GitHub update feed, without opening the workspace. These tests have been configured but not run in this environment. Download artifacts from the completed workflow. Inspect the generated lockfile if needed and commit it before releasing. Run with `create_draft=true` only after successful verification. The separate draft job uses a write-scoped GitHub Actions token and creates a draft only, refusing existing releases and mismatched tags. Publish the approved draft manually. Never embed any GitHub token in the desktop app. The public release feed does not need a client token.

## Release channels and signing
RC versions use an explicit `rc` channel and GitHub prerelease. Stable versions use the default `latest` feed and normal releases. Never upload a stable manifest from an RC build. `verify:release` enforces installer naming and rejects a stable manifest in RC output. The Windows workflow accepts optional signing secrets `WSET_CSC_LINK`, `WSET_CSC_KEY_PASSWORD` and `WSET_UPDATE_SIGN_KEY` (mapped to electron-builder environment variables). Keep certificate/private key outside the repo. No certificate or key supplied or generated in rc.56. Unsigned build output is test-only and may show SmartScreen warnings; a SHA-512 digest alone does not authenticate the publisher. Configure signing, establish trusted publisher/key, and validate authenticity before enabling silent installs. Draft release creation is intentionally not automatic publishing. rc.57 will implement updater channel policy, explicit approval, save/discard/cancel and running-operation guards. rc.58 will verify failure recovery and cross-version update integrity.

## Validation in this environment
- Node v22.16.0 (below declared minimum), npm 10.9.2; dependency install failed with EAI_AGAIN for registry.npmjs.org; no Windows/NSIS toolchain available.
- 208 Node tests: 201 passed, 0 failed, 7 skipped (missing historical assistant fixtures and Sharp). Actual Mal 01 rc.28.1 and project rc.28 supplied to tests, separate extracted website source used where available. New packaging tests: 7/7 passed.
- New tests cover configuration and channels, Windows path overlap, alias resolution on Linux, pointer preservation/ambiguity, blocked pre-migration root, release manifest/size/hash rejection using synthetic bytes. JavaScript syntax and workflow YAML parsing checked. The real installer, Authenticode, embedded update manifest, GitHub Actions, Windows GUI and full Astro build have NOT been executed or verified. No actual installer or lockfile is included; neither has been fabricated. First successful Windows CI build and installation/reinstallation test is a release gate.

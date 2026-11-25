# WSET v1.0.0 – Initial Release / Integrated Project Creation

Baseline: internal v1.4.4-rc.57. First public version series; not an automatic downgrade. Install manually on Windows. Existing WSET workspace, app ID, installation location, templates and module version series remain independent and unchanged.

## Changes
- Integrated WSET-styled project creation dialog from the template gallery, interactive preview and legacy library dialog.
- Required project name, optional customer/domain, configured Projects path and explicit trust confirmation. Metadata is administrative and saved in `.wset-local-project.json` inside the new project, not in website content or exported project archives.
- The archive digest is checked again in the main process before extracting. New project directories use a sanitized name and unique suffix. Existing projects and original template ZIPs are not overwritten.
- Existing unsaved-change confirmation and other native dialogs remain unchanged. No template preview image generation or global UI redesign in this release.

## Verification
- Node tests: 205 passed, 0 failed, 13 skipped (missing integration fixtures and Sharp); actual rc.28 template creation separately passed. Chromium isolated dialog test: required fields, trust checkbox, cancel, submit and three viewport sizes passed with mocked IPC. Node 22.16.0 in test environment; actual Windows installer, Electron integration and GitHub update not verified.
- Build on Windows: `npm install`, `npm test`, `npm run dist`. Upload only `WSET-Setup-1.0.0.exe`, `WSET-Setup-1.0.0.exe.blockmap`, `latest.yml` to a manually published normal GitHub Release with tag `v1.0.0`. No automatic upload. Installer must be tested on a backed-up workspace before publishing. Previous rc.57 compares as newer than 1.0.0, so manual install is mandatory; do not enable downgrade. First automatic update test remains v1.0.0 → v1.0.1.

## GitHub release notes (Norwegian)
Første offisielle WSET-versjon. Inneholder malbibliotek med forhåndsvisning, prosjektadministrasjon, nettsideeditor, samlet arbeidsområde, publisering og grunnlag for manuelle GitHub Releases med brukerinitiert programoppdatering. Ny integrert dialog for opprettelse av nettsteder med prosjektnavn, kunde, domene og kildebekreftelse. Nettsidemaler, prosjekter og moduler har egne versjoner og oppdateres ikke av programinstallasjonen.

# WSET v1.0.2 – Installer Directory Alignment

Baseline: v1.0.1. The user's Windows diagnostic shows the actual selected installation directory is `%LOCALAPPDATA%\Programs\wset-editor`, while the custom NSIS guard required `%LOCALAPPDATA%\Programs\WSET`. The package name is `wset-editor`; the display name, executable name and permanent application ID remain unchanged.

- Align the normal dedicated installation path with `wset-editor` and enforce the package-name invariant in the builder configuration.
- Preserve an existing installation in the old `Programs\WSET` location only when the existing WSET ownership marker is present. No arbitrary installation paths or silent redirections are accepted.
- Keep both program paths excluded from workspace selection, and keep the existing junction, workspace-directory and nonempty-directory checks.
- Align the disposable Windows VM smoke test with the normal install location; add rejection of an unowned legacy target.
- No changes to website data, project creation, template/module content, workspace migration or the GitHub update feed.

## Build and install
Extract into a separate source directory, run `npm install` and `npm run dist`. Close WSET and run `dist/WSET-Setup-1.0.2.exe`. Do not uninstall or delete any existing WSET folders first. Verify that the existing workspace and sites are still available. Publish only after the installation has been confirmed, with tag `v1.0.2` and title `WSET v1.0.2 – Installer Directory Alignment`. Upload only the EXE, EXE.blockmap and latest.yml. No automatic GitHub publication.

## Verification
Nine packaging tests passed. Actual NSIS compilation, Windows installation/reinstallation and automatic update are not verified in this Linux test environment. The regression checks test the source/configuration invariants and workspace path logic, not the actual installer executable.

Full Node regression suite: 208 passed, 0 failed, 12 skipped (220 total), using available CBPM project/template fixtures. Skips include unavailable historical integration archives and dependencies. Node 22.16.0.

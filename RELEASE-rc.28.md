# WSET v1.4.4-rc.28 – Page Tree Consistency

Based on rc.27. UI-only correction: the Eiendommer parent page now uses the same `··· → Synlig` control as other pages. Removed its duplicate always-visible switch. Nybygg and Bruktboliger retain their inline category switches. Hiding the parent disables the child controls without resetting their values. No change to the project format, migration, XML logic, website engine or export logic.

Changed: `designer/ui/app.js`, `designer/ui/style.css` (comment only), `designer/ui/index.html` (version), `package.json` (version), `README.md`, `tests/property-workspace-rc27-browser.py` and this release note.

Verification: Node syntax check passed; `npm run test:core`: 31 passed, 1 skipped, 0 failed. Chromium regression with mocked IPC passed, including no direct parent switch, exactly one parent menu switch, menu-driven disable/enable and preserved category choices. Windows/Electron and live website not tested. Node 22.16.0 in test environment is below the declared minimum 22.23.4. Integration suite not rerun for this UI-only release.

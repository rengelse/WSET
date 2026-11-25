# WSET v1.4.4-rc.26 – Workspace Separation & Cleanup

Based on rc.25. Property workspace contains only local registry and XML sources. Property visibility and navigation move to Nettsider → Eiendommer → Innstillinger; localized category names are under Innhold and use the existing language selector. Project health routes to these settings. Legacy server configuration and code are preserved but the Webhotell tab is removed. No changes to the website engine, XML parser, project format or publication generator.

Verification: 29/29 core tests; full suite 36 passed, 3 failed (missing Smart Assistant fixtures). Chromium workspace test passed with mocked IPC: local register, XML sources, no server calls, moved settings, health shortcut, localized menu labels, independent visibility and navigation, responsive layout. Windows/Electron and live deployment remain unverified.

Deployment note: uploading XML directly to the host does not enable a disabled property page/category in the public export configuration. Enable the intended categories in the website editor and generate/deploy the matching archives. Existing server-side imports and configuration must be preserved. The user-reported live catalogue issue is not yet reproduced against actual deployed archives and XML; it is not claimed fixed by this release.

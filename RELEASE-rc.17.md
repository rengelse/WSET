# WSET Editor v1.4.4-rc.17

First editor-only UI iteration. Dark blue navigation and simplified overview, startup without auto-loading a website, latest project resume, persistent project list without eight-project limit, separate publishing page, XML and Server/FTP placeholder pages. Existing preview selection now reveals the editor panels. Existing site renderer and module/publishing contracts unchanged.

Workspace position (page, section, language, device, selected record) and manual tasks are local to this installation and project path; not included in editable ZIP exports. Existing automatic health checks supply actual local data; no claim of live server verification. Project switching now offers save-and-continue. Cancelling editable ZIP export no longer saves the project first. Full field-level preview mapping, panel resizing, project library removal, separate template catalog and full visual Windows testing remain pending.

Changed: designer/ui/{index.html,app.js,style.css,app-i18n.js}, designer/main.cjs, designer/core/recent-projects.mjs, package.json, README.md, tests/project-library.test.mjs. New navigation/task strings have initial NO/EN/ES dictionary entries; dynamic labels still require localization review.

Tests: new library tests 2/2 passed; full npm test 4 passed, 4 failed on missing external CBPM/Smart Assistant fixtures, 4 skipped. Syntax checks passed for modified JS/CJS. Container Node v22.16.0 is below the package requirement >=22.23.4. Electron/Windows GUI and imported-site integration were not run. No website engine files changed.

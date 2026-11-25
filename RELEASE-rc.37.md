# rc.37 — Universal Translation Engine

## Scope
- Application-local translation service (`designer/core/translation-engine.mjs`) with provider interface and local Ollama adapter. TranslateGemma 4B default, selectable 12B/27B. Explicit model download via Ollama, availability check, test translation. Settings stored under Electron userData, not website data. Fixed loopback endpoint, allowlisted models/languages, no cloud fallback, no shell command constructed from user data.
- Program settings (gear icon) → Oversettelse. Installer Ollama opens the official Windows download page; install/start the runtime separately. Last ned modell explicitly requests Ollama to pull the selected model after confirmation. No model files bundled. Download needs internet; translation itself uses installed local model.
- Eiendommer → Nye annonser → Beskrivelser: select original language, translate missing active languages or all active languages (confirmation before replacing existing translations). Sequential jobs with progress text, explicit errors and partial results retained. Text can be edited manually. Source language is stored as optional draft metadata; Kyero output only contains existing description fields. Project default language still required by current XML validation. Original change warning is session-local, not a persisted review workflow. No new title field introduced.
- Combined location form: address, existing CartoCiudad search, coordinates and on-demand map in one tree node. Address edits refresh the search text.
- No new npm dependencies; website engine, generator and Smart Assistant unchanged. Future provider adapters and Nettsider/Språk translation UI not implemented in this release.

## Verification
- `WSET_TEST_SITE_ROOT=/tmp/w37-cbpm npm run test:core`: 65 pass, 0 fail, 2 skip; includes all 110 ordered language pairs at prompt/validation level, simulated Ollama status/pull/chat, rejection paths and XML output.
- `npm test` without external fixtures: 66 pass, 4 fail (ENOENT for external Smart Assistant/module and website fixtures), 7 skip.
- `tests/translation-rc37-browser.py`: Chromium with real CBPM project content and simulated IPC, translation responses, geocoder and map. Settings, missing translations preserving manual text, draft/save/prepare, address fields, status/badges, and narrow widths pass.
- `tests/translation-rc37-project-check.mjs`: actual CBPM project, multilingual generated XML, source metadata excluded from XML, category export, project/template ZIP round trip pass.
- Existing rc.36 publishing regression with actual CBPM offline build and PHP XML reader stub passes. Not a full Astro or production PHP test.
- Real Ollama/TranslateGemma model execution, translation quality and resource usage, Windows/Electron, and live geocoder/map remain unverified. Ollama not installed in this test environment. New UI labels are primarily Norwegian. Only CBPM's eleven supported languages are implemented in this adapter; other language codes fail explicitly. Model outputs require human verification of text and factual values; no semantic guarantee.

References: https://ollama.com/library/translategemma (prompt/model sizes), https://ai.google.dev/gemma/terms (model terms), https://ollama.com/download/windows (runtime).

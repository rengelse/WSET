# WSET 1.4.4-rc.38 – Translation Workspace Integration

Base: rc.37 FULL SOURCE. No new npm dependencies or website runtime changes.

- Program settings: real Ollama pull NDJSON byte progress, speed and estimated remaining time for discovered layers; final verification via tags; cancellation and closing/reopening the dialog. No claim of full model byte totals before Ollama reports all layers. Test panel collapsed by default, elapsed waiting time, explicit empty-output/HTTP error feedback next to result. Installed model is not proof of successful inference. Request context reduced to 4096 to reduce memory pressure; no measured hardware performance.
- Språk: per-row translate, missing translations and visible filtered entries for the selected source/target. Existing filled translations require confirmation for overwrite. Active entries only for batch, single row can be explicitly selected. Stop after active text. Each completed result uses existing editing history and normal project Save; no automatic publication. Source and target snapshots guard against stale writes. No all-language batch in this release.
- Nettsider: context text panel for structured section/hero/record fields, target language selection and explicit replacement confirmation. Whole localized hero field is translated, not merely its selected fragment. Template occurrence overrides and other unbound fields are not covered; use Språk for catalogued UI texts. Markup and common placeholders are preserved by translating text segments separately, which can reduce linguistic context. Review all output. No translation of property listing titles beyond existing XML contract.
- Local Ollama only, no model assets, credentials or engine runtime in exported site. Property descriptions continue to use existing Kyero fields. No new project format.

## Verification
- `npm run test:core`: 67 passed, 0 failed, 3 skipped (70 total).
- Chromium mock IPC: property editor regression, translation test success and injected failure, simulated download progress with close/reopen; language workspace single-entry translation through actual core, manual edits, undo, JSON export/import, navigation and responsive layout.
- Local model not installed in the test environment. Actual Windows/Electron, live model inference, hardware usage, actual download/cancel and full publishing not verified. The reported empty test result on the user's PC is not reproduced with a real model; improved error output is intended to identify the cause.

## Usage
Extract FULL SOURCE, run `npm install` if required, then `npm run designer`. Ollama and previously downloaded models are reused. Run Test oversettelse; if it fails, retain the exact error. In Windows PowerShell `ollama list` shows installed models, `ollama ps` shows running models; `%LOCALAPPDATA%\Ollama\server.log` is the standard Windows Ollama server log location.

# WSET v1.4.4-rc.36 – Property Status, Badges & Address Search

Base: rc.35 FULL SOURCE. The approved property workspace, three main tabs and listing tree remain unchanged.

## Address search
- Eiendommer → Nye annonser → Beliggenhet → Kart og koordinater: prefill search from address/area, town and province; explicit Search or Enter; choose a result, then populate coordinates and open the map focused on it. Drag the pin or enter coordinates manually.
- CartoCiudad (Instituto Geográfico Nacional / Spain), documented REST `candidates` and `find` methods, no API key. The entered query is sent only when explicitly submitted; search is restricted to Spain, with manual coordinates available elsewhere. Requests use HTTPS, timeout, small result set and session cache. Attribution is visible in the UI. Provider documentation: https://www.cartociudad.es/web/portal/directorio-de-servicios/geoprocesamiento
- Live provider and Windows network behavior have not been verified. Search failures do not erase existing coordinates. Results may be approximate; confirm the pin.

## Sales status and badges
- Shared choices in Nye annonser → Salgsstatus og merking and Eiendomsregister → selected listing → Status: Til salgs, Reservert, Solgt; independent visibility; preset badges Nyhet, Eksklusiv, Anbefalt, Redusert pris. Sold/reserved are derived from status, not a duplicate checkbox. Register supports status filter and list/card marks.
- The Norwegian editor controls and standard public badges use stable codes; public labels are defined for the eleven existing website languages, with English fallback. Custom badge labels/colors are not implemented in this release.
- For an own listing, changes in the authoring editor follow the next explicit prepare operation; draft-only edits are not exported. Register status updates apply directly to the approved listing and synchronize its draft. Hidden listings remain in the local register but are excluded from public catalogue/detail results.
- Project metadata `propertyMarkings` identifies records by source code + external ID, not by address or display reference. The full project ZIP retains metadata, the template ZIP omits it. Source XML is never edited for marking. Status persists when the XML is replaced with the same source filename and same external ID. Reusing or changing a source filename/ID changes the identity. Server-only listings must be imported locally before managing their markings.

## Deployment contract
- WSET adds the backward-compatible PHP metadata reader, card/detail badges and scoped CSS to generated public files. Source template files are not overwritten. Compatibility checked against the supplied CBPM rc.27 project; a structurally incompatible newer runtime produces an explicit error rather than silently dropping support. Initial rollout requires full website generation and both normal publication ZIPs. Existing XML and private settings must be retained.
- Per-category private file: `storage/imports/New/wset-listing-status.json` or `storage/imports/Existing/wset-listing-status.json`. Category export includes the file and tracks it in `WSET-OVERFORING.json`; no new database or XML fields. Files contain the complete WSET-managed category decisions. Existing legacy PHP operator decisions are preserved and still take precedence when they hide a record. Public PHP reads the category metadata dynamically on each catalogue read. Do not upload it under www/.
- Once the rc.36 runtime is deployed, later status/visibility/badge changes need only the corresponding category metadata file (and XML/images if data changed), not another website build. Upload the exported source under its exact filename. When updating metadata only, avoid overwriting newer supplier XML on the server. No FTP connection/automatic transfer is introduced.
- Custom badges, live FTP, Windows end-to-end, live CartoCiudad and actual PHP XMLReader/DOM end-to-end remain outstanding. A full source template refresh is not needed for WSET generation; standalone builds outside WSET do not receive the runtime extension.

## Verified
- `npm run test:core`: 60 passed, 0 failed, 3 skipped.
- `npm test`: 62 passed, 4 failed due to unavailable external Smart Assistant ZIPs, 7 skipped. Node 22.16.0 is older than the declared runtime requirement.
- `tests/property-markings-rc36-browser.py`: passed in Chromium with simulated IPC, map and address service; actual Node editing commands. `tests/property-workspace-rc27-browser.py`: passed.
- `node tests/property-markings-rc36-project-check.mjs <extracted CBPM rc27>`: actual project, offline HTML builder (not Astro) and real stage/package pipeline; validated two ZIPs, public manifest hashes, private metadata, unchanged supplier XML, PHP syntax and actual catalogue metadata/visibility with the XML reader stubbed (PHP DOM/XMLReader unavailable), full project/template ZIP round trip.

# WSET Editor v1.4.4-rc.45 – Template Library & Categories

Basert på rc.44. Ingen endring av nettsidens design, publiseringskontrakt, Smart Assistant eller eiendomssystem. Ingen malbytte i denne versjonen.

## Bruk
- Åpne Malbibliotek fra Prosjekt-menyen eller Mine nettsteder / oversikten uten åpent prosjekt.
- Importer en redigerbar WSET **mal-ZIP**. Vanlig prosjekt-ZIP og publiserings-ZIP avvises i biblioteket (ordinær prosjektimport er uendret).
- Velg kategori eller søk på navn, ID, underkategori eller versjon. Velg en versjon for detaljer og eventuelle PC-/mobilbilder.
- Opprett nytt prosjekt lager en uavhengig lokal kopi og åpner den med eksisterende prosjektflyt, inkludert varsel om ulagrede endringer. Originalmalen beholdes.
- Fjern malversjon krever bekreftelse og fjerner kun biblioteksversjonen. Andre versjoner og opprettede prosjekter beholdes.

Biblioteket lagres under Electron userData/templates, separat fra userData/projects og modules. Det starter tomt; importer medfølgende Mal 01 rc.28.1 eller eldre kompatibel mal. Mal-ID + versjon gir en stabil nøkkel; identisk arkiv er idempotent, samme versjon med andre ZIP-bytes avvises. Ingen automatisk oppgradering. Kategorier er åpne metadata, ikke en fast enum. Katalogisering av andre ID-er krever samme støttede motor og gyldig prosjektdata; disse kan ikke opprette prosjekter før rendererstøtte er implementert. Ingen kjøring av malens kode ved katalogimport. Maler fra ukjente kilder kan inneholde vilkårlig byggeskriptkode; importer bare fra pålitelige kilder.

## Leveranse
- designer/core/template-library.mjs: lokal versjonslagring, validering, statiske forhåndsvisningsbilder, integritetskontroll, prosjektkopiering.
- designer/core/template-contract.mjs, project-archive.mjs, project-storage.mjs: eksplisitt katalogvalideringsbane; vanlig runtime avviser fortsatt andre mal-ID-er.
- designer/main.cjs, preload.cjs: autoriserte IPC-handlere, native dialoger, prosjektbytte med ordinær beskyttelse.
- designer/ui/template-library.{js,css}, app.js, index.html, app-i18n.js: avgrenset bibliotekdialog, innganger, filtre og oversettelser.
- tests/template-library-rc45.test.mjs og tests/template-library-rc45-browser.py: backend- og Chromium-test med simulert IPC.
- Separat Mal 01 rc.28.1: bare malmetadata og to statiske skjermbilder endret; nettstedets pakkeversjon, innhold og kildekode fortsatt rc.28.

## Test
`npm run test:core` og valgfri `python tests/template-library-rc45-browser.py` (Playwright + Chromium). Verifisert med originale rc.28-prosjekt/mal-ZIP-er, medfølgende rc.28.1 og syntetiske andre mal-ID-er. Kjernetest: 121 bestått, 0 feil, 5 hoppet over med rc.28-arkiver som testgrunnlag. Alle seks nye tester bestod også uten eksterne testarkiver. Chromium-test bestod ved 1400, 1040 og 700 px med simulert IPC. Malens offline-smoke: 39 ruter. Malbildene er fra faktisk statisk HTML/CSS gjengitt i Chromium med lokale bildebytes; ikke en live server. Native Electron/Windows, full Astro-produksjonsbygg og ekstern Smart Assistant-integrasjon er ikke verifisert her. Node 22.16.0 i testmiljø, prosjektkrav >=22.23.4.

Neste: rc.46 Dynamic Template Preview, deretter kompatibilitet/kartlegging og sikkert malbytte.

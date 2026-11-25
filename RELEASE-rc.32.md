# WSET Editor v1.4.4-rc.32 – Language Workspace Redesign

Base: rc.31. Godkjent UI-retning: selvstendig språkarbeidsflate, lys flate og blå kontroller, språkoversikt ved siden av oversettelser; egen fane for full bredde. Ved 1040 px stables oversikten og oversettelsene for å unngå horisontal scrolling. Ingen nettside-preview i Språk.

## Funksjoner
- Språkliste med faktiske flagg, navn, kode, aktivstatus og antall utfylte nødvendige tekster. Samlet status summerer aktive målspråk (ikke kildespråket). Ingen maskinoversettelse eller påstand om kontrollert kvalitet.
- Dra og slipp og alternativ flytt opp/ned, opprett utkast, slett språk med eksisterende beskyttelse av kildespråk, rediger navn/undertittel/flaggmetadata.
- Vis referansetekst og rediger målspråk side om side, med søk, side-, innholdstype- og statusfiltre. Faste maltekster grupperes etter faktiske renderer-referanser der de kan identifiseres, øvrige under felles maltekster. Skjulte tekster kan fortsatt redigeres. Oppslag er på eksisterende oversettelsesnøkler, ikke nye gjetninger på tekster.
- Referansespråk for sammenligning er valgbart; endrer ikke prosjektets defaultLanguage, JSON-kildespråk eller språkstatusberegning. Eksisterende `cbpm-language-v1` kontrakt er beholdt.
- Oversettelser bekreftes ved fokusbytte eller lagring; endringskø avventes før navigasjon, prosjektbytte, eksport og angre. Bruk eksisterende lagrings- og historikkmodell.
- Forhåndsvisningens lokale server serverer nå de elleve kjente SVG-flaggene under `assets/flags/`, med avgrenset filbanekontroll. Ingen endring i nettsidens CSS, Astro-mal eller PHP.

## Endrede filer
`designer/ui/language-workspace.js` (ny, selvstendig UI-modul), `designer/core/language-workspace.mjs` (ny, sideklassifisering av eksisterende språkregister), `designer/ui/app.js`, `index.html`, `style.css`, `app-i18n.js`, `designer/core/editor-operations.mjs`, `preview-server.mjs`, `designer/main.cjs`, package.json, README og tester. Gamle grensesnittharness laster den nye UI-modulen. Nettsidemotor, generator, mediemotor og eiendomsmotor er ikke endret. Ingen migrering av eksisterende prosjektformat er påkrevd.

## Verifisering
- `npm run test:core`: 49 bestått, 0 feil, 2 hoppet over (Sharp og ekstern nettstedfixture).
- `npm test`: 51 bestått, 4 feil, 6 hoppet over. De fire feilene er ENOENT for manglende separate Smart Assistant-arkiver / ekstern CBPM-Website-mappe. Ingen av de nye testene feilet.
- Nye kjernetester: språkinnstillinger, rekkefølge, angre, eksisterende språkpakke, redigering gjennom renderer, aktiveringsvern, sideklassifisering, SVG-flaggrute og blokkering av private/ukjente filer.
- Chromium (`language-workspace-rc32-browser.py`) med faktiske data fra CBPM-WSET-PROSJEKT-rc.27 og språkoperasjoner kjørt i den faktiske Node-kjernen; simulert IPC, JSON-dialog og iframe, flaggbilder lastet fra bundlet SVG-data i harness. Søk, filtre, språkvalg, endring/lagring, angre, innstillinger, dra/slipp, import/eksportvalg, navigasjon og 1600/1200/1040 px bestått.
- Chromium-regresjon: workspace-rc19, media-workspace-rc29, property-workspace-rc27 bestått.
- `language-workspace-rc32-project-check.mjs`: lagring, gjenåpning og ZIP-rundtur med faktisk CBPM-prosjekt; språkdata, mediedata og eiendomsinnstillinger bevart.

## Avgrensninger
- Windows/Electron, native fil-dialoger og full Astro-publisering er ikke testet her. Node 22.16.0 i miljøet er eldre enn prosjektets krav >=22.23.4.
- Den eksisterende språkkatalogen er fortsatt grunnlaget. Separate, stedsspesifikke tekstoverstyringer fra WYSIWYG (`templateTexts`, `wsetTextOverrides`) og PHP-eiendomsinnhold er ikke lagt inn som nye oversettelsesnøkler. Slike overstyringer redigeres fortsatt under Nettsider; de kan ha forrang foran katalogteksten. Status betyr utfylt, ikke språklig kontrollert.
- Flaggmetadata kan redigeres; den eksisterende nettsidemalen har faste flagg for kjente språkkoder. Ikke alle dynamiske redigeringsetiketter og bekreftelser er fullt oversatt til editorens EN/ES.
- Nye språk og sletting følger eksisterende valideringsregler. JSON-format, serverpublisering, XML, Smart Assistant og original nettsidedesign er uendret.

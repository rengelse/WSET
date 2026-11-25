# WSET 1.4.4-rc.30 — Media Management & Image Replacement

Grunnlag: rc.29 FULL SOURCE. Ingen endring av nettstedmotor, eksportmotor, XML-parser, serverkode eller fysisk mediestruktur.

## Endringer
- `designer/core/media-references.mjs`: felles, eksplisitt katalog over redigerbare bildeplasseringer for Mal 01; individuelle seksjoner, ansatte, tjenester, prosjekter, før/etter, gallerier, logo/favicon. Bruk av nye prosjektbilder via den eksisterende innholdsmodellen. Ingen vilkårlig tekst- eller HTML-erstatning. Gjenbruker riktig bildevariant per plassering. Støtte for delte bilder og eldre malbilder uten å overskrive filene.
- `designer/core/media-catalog.mjs`: katalog med konkrete plasseringer, kategorisering og beskyttelse mot sletting.
- `designer/core/content-commands.mjs`: samme bildebinding for tjeneste- og prosjektbilder; støtter også JPG/PNG og andre allerede godkjente bildeformater, ikke bare WebP.
- `designer/main.cjs`, `preload.cjs`: autorisert erstatningsdialog, filimport eller valg fra eksisterende katalog, kontroll av prosjekt og innhold før commit. Én historikkoperasjon ved erstatning av registrerte plasseringer. Nye filer importeres med eksisterende bildebehandling. Ubrukt importert bilde kan erstattes fra disk med beholdt katalog-ID. Brukte bilder beholder gammel katalogoppføring og ID; nytt bilde beholder/får egen ID. Originaler og varianter slettes ikke.
- `designer/ui/app.js`, `index.html`, `style.css`: primær Bytt bilde-knapp i Medier, eksplisitt valg av omfang ved flere plasseringer, valg av bildekilde, klikkbare bruksområder, direkte tilgang fra Nettsider. For entydige bildefelt åpnes samme dialog med kun valgt plassering. Tomme eller ukjente bildefelt beholder eksisterende import-/valgfunksjon. Inkluderer direkte bytte av galleribilder.
- `package.json`, `README.md`, nye testfiler.

## Verifisering
- `npm run test:core`: 43 bestått, 0 feil, 1 hoppet over. Reell Sharp-bildeimport og originale bytes verifisert med tilgjengelig Sharp 0.34.1 og Node 22.16.0 (leveransen krever Node >=22.23.4 og Sharp ^0.34.5).
- Chromium med simulert IPC: `media-replacement-rc30-browser.py`, `media-workspace-rc29-browser.py`, `workspace-rc19-browser.py`, `property-workspace-rc27-browser.py` bestått.
- Faktisk CBPM rc.27 prosjekt: `node tests/media-replacement-rc30-project-check.mjs <utpakket-prosjekt>` bestått. Reell bildeimport, lagring, gjenåpning, redigerbar ZIP-rundtur, 77 kombinasjoner av side og språk i nettstedets egen renderer. Ingen endring av kildeprosjektet i testen.
- Full testpakke: 45 bestått, 4 feilet med ENOENT for eksterne Smart Assistant-/CBPM-kildepakker, 5 hoppet over.

## Begrensninger
Windows/Electron og faktisk Windows-fildialog, full Astro-publisering og webhotell er ikke testet. Nye UI-tekster følger norsk i rc.29; full EN/ES-oversettelse gjenstår. «Alle plasseringer» betyr alle identifiserte redigerbare referanser i støttet Mal 01-kontrakt, ikke vilkårlige referanser i CSS, PHP, fremmede maler eller hardkodet innhold. Ubrukte malfiler uten redigerbare referanser overskrives ikke. Logo/foto har separate bildebehandlingsprofiler. Eiendomsbilder er ikke del av mediekatalogen eller erstatningsfunksjonen. Ingen migrering av nettsideprosjekt er nødvendig.

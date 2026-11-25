# WSET v1.4.4-rc.24 – Editor UI Refinement

Basert på rc.23 Universal Text Editing. Kun det kontekstavhengige tekst-/knappepanelet er visuelt oppdatert. Nettsiden i midten er eneste live-forhåndsvisning.

## Endringer
- Skrifttype og størrelse med samme kontrollhøyde, kompakt px-enhet og konsistent styling. Størrelse vises med maksimalt én desimal; arvede eller lagrede verdier endres ikke ved visning.
- Samlet formateringslinje, aktive tilstander, verktøytips og fokusmarkeringer.
- Kompakt fargevelger (systemets native fargedialog) med HEX-felt. Ingen ekstra forhåndsvisning.
- Avansert formatering er lukket som standard; åpen tilstand huskes per valgt element i den aktive økten.
- Tekstfelt etter formateringskontroller, kompakt tilbakestilling og retur til hele seksjonen. Beholder knappelenke og knappefarge/avrunding der dette var støttet i rc.23.
- Responsiv, scoped CSS i høyrepanelet. Ingen endringer i prosjektformat, renderer, redigeringskontrakt, publisering eller Eiendommer.

## Testet
- Node v22.16.0: `WSET_TEST_SITE_ROOT=<utpakket CBPM rc.23> npm run test:core`: 25/25 bestått, inkludert 77 side-/språkkombinasjoner i faktisk malrenderer.
- `python tests/contextual-rc22-panel-browser.py`: bestått med Chromium, simulert IPC og iframe-transport. Ny regresjonskontroll for panelbredder 240, 285, 315, 365 og 530 px, kontrollhøyder, rekkefølge, desimalvisning uten skriving, ingen ekstra preview, avansert feltgruppe, formatering, angre/gjør om, tilbakestilling og navigasjon.
- `npm test` uten eksterne testpakker: 26 bestått, 4 feilet, 5 hoppet over. Se eksisterende integrasjonstester: manglende eksterne arkiver; maltesten er hoppet over uten WSET_TEST_SITE_ROOT.
- Node-syntaks og ZIP-integritet kontrollert.
- Full Windows/Electron-kjøring er ikke utført; testmiljøets Node er eldre enn package.json-kravet (>=22.23.4). Reell publisering på webhotell ikke testet i denne runden.

## Bruk
Oppdater bare WSET. Behold eksisterende CBPM rc.23-prosjekt og Smart Assistant-modul. Ingen ny nettside-ZIP kreves. Pakk ut i ny mappe, kjør `npm install` og `npm run designer`.

## Neste område – Eiendommer
Separat UI-revisjon etter godkjenning. Ikke implementert i rc.24. Bevar lokal XML-import, serverregister, kategorier, oppdatering og private serverstier.

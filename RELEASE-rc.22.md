# WSET v1.4.4-rc.22 – Contextual Visual Editor

Bygger på rc.21 FULL SOURCE. Ingen endring i CBPM-motor, malens HTML/CSS, Smart Assistant eller to-ZIP-publiseringsarkitekturen.

## Bruk
- Klikk på en entydig redigerbar tekst i forhåndsvisningen. Høyre panel viser automatisk tekst og relevante formateringskontroller, uten valg av designområde eller fanen Utseende.
- Skrifttype, størrelse, tekstfarge, fet/kursiv/understreking og justering er samlet. Skriftvekt og linjehøyde under Flere tekstinnstillinger. Panelet leser faktisk beregnet CSS fra forhåndsvisningen; ikke-støttede malfonter vises med navn. Individuell formatering gjelder valgt språk og element. Formatering gjelder hele valgt element, ikke et vilkårlig tekstutvalg.
- Endre tekst i panelet og bekreft ved å forlate feltet. Ctrl+S bekrefter også pågående paneltekst før lagring. Dobbeltklikk for direkte tekstredigering beholdes. Endringer lagres i prosjektets eksisterende modell og forhåndsvisningen oppdateres etter bekreftet endring, ikke per tastetrykk. Angre/gjør om beholdes.
- For entydige knapper støttes også bakgrunnsfarge og avrunding. Lenkevalg vises der eksisterende komponent har redigerbart mål. Faste mallenker er ikke omskrevet.
- Tilbakestill formatering fjerner lokale overstyringer og gjenoppretter arvet seksjons/global/malstil uten å endre tekst. Hele seksjonen gir tilgang til eksisterende Innhold/Bilder/Utseende/Innstillinger. Globalt utseende beholdes i Innstillinger. Klikk på bilder bruker eksisterende bildepanel.
- Ved tvetydig tekst eller manglende entydig CSS-kobling brukes den eksisterende seksjonsredigeringen eller et kontekstpanel uten individuell formatering. Ingen vilkårlig HTML/CSS-redigering. Manuell plassering kommer senere.

## Endrede filer
- `designer/ui/app.js`: kontekstpanel, gjenopptak og synkronisering, kontrollert tekstcommit og eventhåndtering.
- `designer/ui/style.css`, `app-i18n.js`, `index.html`: kompakt panel, oversettelsesetiketter og versjon.
- `designer/preview/bridge.js`: entydig elementvalg, faktisk beregnet stil, gjenoppfrisking etter lasting/endrede dimensjoner.
- `designer/core/design-styles.mjs`: validerte individuelle knappestiler, understreking, desimalstørrelse og eksportkontroll. Eksisterende `wsetDesign.version=1` beholdes; ingen påkrevd migrering.
- `tests/contextual-rc22.test.mjs`, `tests/contextual-rc22-panel-browser.py`, `tests/contextual-rc22-browser.py`: nye tester. `tests/inline-rc20-browser.py` oppdatert for nytt panel.
- `package.json`, `README.md`, denne utgivelsesloggen.

## Verifisering
- `npm run test:core`: 20/20 bestått.
- `npm test`: 22 bestått, 4 feilet (ENOENT: manglende separate Smart Assistant- og CBPM-testpakker), 4 hoppet over.
- Node-syntakskontroll av endrede JS/MJS: bestått.
- Chromium: kontekstpanel med reell DOM og beregnet CSS (syntetiske malstiler), simulert IPC/iframe-transport; isolert formatering, skifte av valgt tekst, tekstredigering i panel, angre/gjør om, reset, gjenopptak og seksjons/global tilgang: bestått.
- Chromium: tidligere rc.20 direkte redigering og Escape, rc.20 panel/inline-synkronisering, rc.21 stilpanel, rc.19 navigasjonsregresjon: bestått. Full browser-test med lokal HTTP/iframe blokkert av Chromium-policy ERR_BLOCKED_BY_ADMINISTRATOR i dette miljøet.
- `designer/engines` og `designer/core/website-generator.mjs` byte-identiske med rc.21. Default-design uendret ved ingen nye overstyringer (kjernetest). Eksport-CSS og testarkiv kontrollert. Node i miljøet er 22.16.0, under prosjektets minimum 22.23.4.
- Gjenstår: faktisk Windows/Electron med importert CBPM-prosjekt, reell Astro-generering og live publisering. Test hurtig overgang mellom tekstfelt og formateringskontroller, dobbeltklikk, bytte av språk og enhetsvisning. Ingen påstand om endelig Windows-verifisering.

Start i ny mappe: `npm install`, `npm run designer`.

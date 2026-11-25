# WSET v1.4.4-rc.20 – WYSIWYG Inline Editing

Basis: full source rc.19. Første hybride teksteditor, uten endring av nettsidens design, nettsidemotor eller eksportformat.

## Bruk
- Klikk på innhold i forhåndsvisningen for å velge tilhørende felt/seksjon i redigeringspanelet. Dobbeltklikk på entydig kartlagt tekst for å redigere direkte. Enter / klikk utenfor bekrefter endringen, Escape forkaster pågående tekstredigering. Ctrl+S i direktefeltet bekrefter og lagrer. Vanlig lagring og angre/gjør om benyttes etter bekreftelse. Ingen omlasting per tastetrykk; forhåndsvisningen bygges på nytt etter bekreftet redigering, med eksisterende scrollgjenoppretting.
- Støtter blant annet overskrifter, ingress, brødtekst, identifiserbare knapper, faste Mal 01-tekster, samt entydig kartlagte tjeneste-/prosjekt-/ansatt-/omtaletekster. Hjems sammensatte hero-tittel redigeres del for del, med eksisterende br/em-markup bevart.
- Redigeringspanelets faste tekstfelt ligger nå under Innhold, med semantiske feltnavn og sammenleggbare grupper, eksempelvis Kort 01–04 i Arbeidsflyt. Eksisterende tekstoverstyringer bevares. I tvetydige tilfeller må brukeren fortsatt velge feltet i panelet. Tomme felter og komplekse HTML-tekster kan ikke nødvendigvis velges direkte. Knapper redigeres som tekst, ikke som navigasjon, i redigeringsmodus.
- Direkteredigering bruker samme eksisterende prosjektmodell og historikk; eksisterende publiseringsmotor er uendret. Ingen migrering av prosjektformat nødvendig. Egenskaper som skrifttype, farge, størrelse og fri plassering er **ikke** implementert (planlagt rc.21+).

## Teknisk
`designer/core/inline-editing.mjs` bygger avgrenset målkontrakt fra prosjektet; template-ID knyttet til originalteksten, eksplisitte felt/record-ID-er for øvrig. Endringer valideres på nytt mot gjeldende modell og forventet tidligere verdi før eksisterende kommandoer benyttes. Kun tekst, ikke vilkårlig HTML. Preview-metadata og bro er lokale. Ingen endring i `designer/engines/` eller generatoren. Oppdatert main IPC for semantiske tekstfelt, UI, språkstrenger, versjonsmerking, testpakke. Tester inkluderer `inline-rc20.test.mjs`, `inline-rc20-bridge-browser.py`, `inline-rc20-panel-browser.py` og eksisterende rc.19-navigasjonstest. `inline-rc20-browser.py` er en valgfri ende-til-ende-harness, ikke bestått i dette miljøet på grunn av blokkert HTTP-navigasjon.

## Verifisering og begrensninger
- `npm run test:core`: 11/11 bestått (inkludert fem nye tester av tekstmodell, språk, markup, validering og eksportisolasjon).
- `npm test`: 13 bestått, 4 feilet, 4 hoppet over. Feilene skyldes manglende eksterne CBPM-Website- og Smart Assistant-fixtures. Node i testmiljøet: 22.16.0, prosjekt krever >=22.23.4.
- Chromium DOM-test bestått (ekte generert HTML og lokal preview-bro; ingen nettstedets ekte CSS/ressurser eller Electron). Separat Chromium paneltest bestått (simulert IPC/iframe, faktiske modellkommandoer). rc.19 navigasjonsregresjon bestått med simulert IPC/iframe.
- Ende-til-ende HTTP/iframe-test blokkert av miljøet; full Windows/Electron-kjøring med importert prosjekt, prosjekt-/mal-ZIP-rundtur og faktisk servergenerering ikke verifisert. Test dette før produksjon. Ingen påstand om støtte for vilkårlige HTML-nettsteder eller alle Mal 01-elementer.

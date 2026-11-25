# WSET v1.4.4-rc.21 – Visual Typography & Design

Bygget fra rc.20 FULL SOURCE. WSET, CBPM Website og Smart Assistant er fortsatt separate utviklingsløp.

## Bruk
- Nettsider: velg seksjon, åpne **Utseende**, velg Overskrifter, Brødtekst, Fremhevet tekst eller Knapper. Dette gjelder seksjonen på alle språk.
- Klikk direkte på en entydig identifisert tekst i preview, åpne **Utseende** og velg Valgt tekstelement. Dette gjelder det aktuelle språkets valgte element. Dersom elementet ikke kan identifiseres sikkert (f.eks. enkelte sammensatte overskrifter, duplikattekst eller dynamisk innhold), er seksjonskontrollene fortsatt tilgjengelige.
- Innstillinger → Globalt utseende: velg teksttype. Globale overstyringer gjelder de statiske innholdssidene, alle språk. Header/footer, PHP-genererte eiendomssider og Smart Assistant omfattes ikke i denne versjonen.
- Kontroller: systemskrift/Arial/Georgia/Verdana/Times New Roman/Tahoma, skriftstørrelse, linjehøyde, farge (velger eller HEX), vekt, normal/kursiv, tekstjustering. Knapper kan også få bakgrunnsfarge og avrunding på globalt/seksjonsnivå.
- Tomt felt = arvet verdi. Tilbakestill til standard fjerner overstyringene på valgt nivå. Individuelt → seksjon → globalt → malens CSS. Eksisterende standarddesign endres ikke uten eksplisitt innstilling.
- Dobbeltklikk på tekst og strukturert innholdsredigering fra rc.20 beholdes. Designendringer bruker vanlig lagring og historikk. Ingen fri plassering, tekstutvalgsformatering, fontimport eller enhetsspesifikk typografi i denne versjonen.

## Arkitektur
`project/website.json` får en valgfri `wsetDesign`-struktur med versjon 1, globale teksttyper og side-/seksjons-ID-baserte overstyringer. Individuelle tekster lagres per språk med eksisterende inline-ID. Eldre prosjekter trenger ingen migrering før de bruker funksjonen. Bare validerte, avgrensede stilverdier kan bli CSS; ingen vilkårlig CSS eller font-URL-er. Seksjonsrekkefølge beregnes fra prosjektets aktuelle graf. Hvis et tekstelement ikke lenger kan identifiseres entydig, brukes ingen individuell regel fremfor å velge et vilkårlig element. Endring av kildeteksten gjennom oversettelsesverktøyet kan endre identiteten til enkelte maltekster; da må individuell formatering velges på nytt.

`designer/core/design-styles.mjs` er felles CSS-generator for preview og eksport. Preview bruker lokal CSS under eksisterende CSP. WSET etterbehandler det ferdige offentlige ZIP-arkivet etter den eksisterende Astro-byggingen: legger stilregler til eksisterende `assets/css/styles.css`, avgrenser dem til de faktiske statiske HTML-sidene, og oppdaterer tilhørende filmetadata i publiseringsmanifestet. Ingen endring i 02-UTENFOR-WWW.zip, serverkode, prosjektets Astro-kildekode eller Smart Assistant. Hvis seksjonsstrukturen eller identifisert tekststi i eksporten avviker fra preview, avbrytes tilpasset eksport med feil. Uten designoverstyringer er den opprinnelige eksportbanen uendret. Kildepakken `designer/engines/` er uendret fra rc.20.

## Endrede filer
- Ny: `designer/core/design-styles.mjs`
- `designer/core/editor-operations.mjs`, `preview-editor-map.mjs`, `preview-server.mjs`, `project-archive.mjs`, `website-generator.mjs`
- `designer/preview/bridge.js`
- `designer/ui/app.js`, `index.html`, `style.css`, `app-i18n.js`
- `package.json`, `README.md`, denne utgivelsesnotisen
- `tests/design-rc21.test.mjs`, `tests/design-rc21-browser.py`, `tests/inline-rc20-fixture.mjs`

## Verifisert i container
- Node v22.16.0 (eldre enn deklarert >=22.23.4): `npm run test:core` 17/17 bestått.
- `npm test`: 19 bestått, 4 feil (manglende separate CBPM-/Smart Assistant-kildefiler), 4 hoppet over (manglende nettstedfixture).
- Chromium: ny designpaneltest med ekte modell/renderer og simulert IPC, faktisk beregnet CSS på valgt tekst, nabotekst, presist klikkmål, global/individuell/seksjonsstil, reset, undo/redo. Tidligere rc.20 DOM- og paneltest og rc.19 navigasjonstest bestått.
- Publiseringstest bruker arkiv bygget fra faktisk WSET-renderer og syntetisk publiseringsmanifest; sammenligner stilregler og filhash, og kontrollerer at PHP forblir uendret. Ingen reell Astro-bygging med separat CBPM-prosjekt eller live webhotell i dette miljøet.
- Syntakskontroll og FULL SOURCE ZIP-integritet.

## Må testes i Windows før produksjon
Importer eksisterende CBPM-prosjekt, endre for eksempel farge og font på «Før ankomst» under Utleie og drift → Arbeidsflyt, lagre/lukk/åpne prosjektet på nytt, kontroller alle enheter og publiser begge ZIP-er til en testmappe. Kontroller virkelig Astro-arkiv og manifest, og sammenlign offentlig side med preview. Eksisterende PHP-/eiendomsfunksjonalitet og Smart Assistant er utenfor designomfanget. Bruk anbefalt Node-versjon. Ingen Windows/Electron-verifikasjon utført her.

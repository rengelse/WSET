# rc.35 — Property XML Generation & Workspace

Bygger på rc.34. Godkjent designreferanse: kategoritre, fokusert skjema, levende annonseoversikt til høyre. Oversikten viser faktisk valgt foto, boligtype/sted, pris, areal og rom. Smale vinduer flytter oversikten under skjemaet. Full forhåndsvisning er fortsatt valgfri. Felter som ikke støttes av eksisterende XML-kontrakt (f.eks. separat annonsetittel) er ikke introdusert. Status og badges kommer i rc.36.

## Arbeidsflyt
- Lagre kladd: lokal redigerbar oppføring, ikke i XML.
- Publisering → Klargjør for publisering: validerer salg, type, sted, provins, land, valuta, positiv pris, kildespråk, minst ett foto og eventuell koordinatpar. Lagrer en godkjent versjon. Endring av kladd alene endrer ikke den klargjorte versjonen; klargjør på nytt.
- Automatisk projeksjon `project/property-feeds/Existing/wset-egne-boliger.xml`; samme Kyero v3-parser som øvrige annonser. Bilder kopieres fra privat kladdområde til `Existing/images/<stabil-ID>/`. Importerte kilder beholdes uendret. ID-er endres ikke.
- Egne klargjorte annonser vises i Bruktboliger, med Rediger-handling som åpner samme annonseeditor.
- Eiendomsregister → Eksporter XML: ZIP med alle lokale XML-kilder i valgt kategori, refererte lokale bilder og `WSET-OVERFORING.json`/`LES-MEG.txt`. Kun `storage/` overføres til kontorot ved siden av webrot. Last opp bilder før XML. Ingen serveroverføring implementert.
- Trekk tilbake: fjern fra generert feed. Når siste egen annonse trekkes tilbake, må tidligere WSET-feed fjernes manuelt fra serveren; parseren støtter ikke tom XML. Overføringsmanifest og instruks angir dette. Fysiske gamle bilder beholdes for sikkerhet; ingen automatisk serversletting.
- Prosjekt-ZIP bevarer kladder, godkjente data og bilder. Mal-ZIP utelater private boligdata.

## Endrede kodeområder
`designer/core/property-owned-feed.mjs`, `property-drafts.mjs`, `project-storage.mjs`, `editor-operations.mjs`, `designer/main.cjs`, `preload.cjs`, `designer/ui/property-drafts.js`, `property-manager.js`, `style.css`, `index.html`, `package.json`, tester og README. Ingen endringer i CBPM-nettsidemalen eller PHP-runtime. Eksisterende publiseringsmotor pakker XML og bilder fra de eksisterende mappene.

## Tester
- Kjernetester: 55 bestått, 0 feil, 3 hoppet over.
- Samlet: 57 bestått, 4 feil grunnet manglende eksterne modul/testarkiver, 7 hoppet over.
- Faktisk CBPM rc.27 prosjekt: klargjøring/lagring, lokal katalog, samlet eksport og prosjekt-/mal-ZIP rundtur bestått. Bilde fra testprosjekt kopiert som fixture, ikke reell ny bildekonvertering.
- Chromium: mock IPC/kart, faktiske Node-operasjoner, bildevalg, koordinater, beskrivelse, levende annonseoversikt, klargjøring, navigasjon, 1040/1200/1600 px bestått.
- Full Windows/Electron, native dialoger, full Astro-bygging, live PHP/XML og overføring ikke testet. PHP-miljø mangler XMLReader/DOM. Ingen status/badges, adresseoppslag eller FTP i denne versjonen.

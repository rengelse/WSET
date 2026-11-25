# WSET Editor v1.4.4-rc.18 – Visual Editor & Workspace

Grunnlag: komplett rc.17 FULL SOURCE. Ingen migrering av eksisterende prosjektformat eller endringer i CBPM-renderer, nettstedets designfiler, nettstedsgenerator eller Smart Assistant-kode.

## Endringer
- Samme hovedmeny før og etter åpning av prosjekt. Oversikt ved tom oppstart, Mine nettsteder som eget område. Prosjektavhengige områder er deaktivert inntil prosjektet åpnes. Sist brukte prosjekt kan åpnes direkte. Prosjektnavn leses fra lagret bedriftsprofil; filsti finnes i prosjektdetaljer.
- Oversikt: kompakte modulkort, nøkkeltall, oppfølging og egne oppgaver. Medietallet omfatter registrerte bibliotekoppføringer (inkludert malbilder; ikke en filsystemverifikasjon). Korrigert feilaktig eksportvarsel før første eksport.
- Nettsider: innholdsvelger, søk i sider/seksjoner, seksjoner under valgt side, sammenleggbar valgt side, sidehandlinger i kontekstmeny, synlige markeringer for skjulte sider. Nettstedsspråk velges i forhåndsvisningens verktøylinje. Publisering/synlighet og avansert redigering samles under Innstillinger i redigeringspanelet. Eksisterende redigeringsoperasjoner beholdes.
- Panelbredder kan justeres med mus eller tastatur og lagres lokalt. Primærknapper har blå farge. Redigeringshjelp og malinformasjon er fjernet fra den permanente sideeditorflaten.
- Lokal forhåndsvisningsbro: klikk på annoterte seksjoner, hero-overskrift/ingress, bilder og gjenkjennelige kort åpner redigeringsområdet. Entydig feltmatch gir fokus. Logo åpner bedriftsprofil. Forhåndsvisningsmodus fjerner markeringsrammer. Ved ukjent/ambivalent element brukes seksjonsredigering, ikke vilkårlig feltendring. Eiendomskatalogen har egen eksisterende forhåndsvisning. Ingen redigeringsbro i offentlig renderer.
- XML – Eiendommer og Server / FTP er fortsatt tomme modulsider.

## Kontroll
- `npm run test:core`: 6/6 bestått. Nye tester dekker prosjektnavn, preview-scriptets isolasjon og levering, feilaktig eksportvarsel.
- `npm test`: 8 bestått, 4 feilet, 4 hoppet over. Fire feil skyldes manglende eksterne rc.15/rc.16 Smart Assistant-ZIP-er og CBPM Website-kildeprosjekt; integrasjonstestene er beholdt uten å skjule feil. Fire arkivtester er hoppet over pga manglende prosjektfixture. `npm run test:integration` kjører de eksisterende integrasjonstestene separat.
- Syntakskontroll av endrede JavaScript-filer bestått. Node 22.16.0 i testmiljøet, eldre enn deklarert minimum 22.23.4.
- Nettleserbasert UI-røykprøve kunne ikke startes (ERR_BLOCKED_BY_ADMINISTRATOR på lokal forhåndsvisning). Windows/Electron og faktisk importert CBPM-prosjekt er ikke funksjonstestet i denne leveransen. Visuell paritet med importert prosjekt må kontrolleres i Windows.

## Avgrensninger
- Feltspesifikk direktevalg er første implementasjon for eksisterende CBPM-kompatibilitetsmotor, ikke generell DOM-redigering for vilkårlige nettsteder. Flere bildeplasser med samme kilde eller ukjent felt kan kreve manuelt valg i panelet. Ingen generell felt-ID-kontrakt for alle fremtidige nettsidemotorer er implementert.
- Oppstartsoversikten viser sist brukte prosjekt; detaljert modulstatus, oppgaver og kontrollpunkter beregnes etter at prosjektet er åpnet. Huskeliste og arbeidskontekst er lokale på PC-en.
- Innholdsendringer kan fortsatt kreve full preview-reload. Full renderingoptimalisering, søk på enkeltoppføringer og komplett språkrevisjon er ikke fullført.
- Full source, ikke Windows-installer. Pakk ut i en ny mappe, `npm install`, `npm run designer`. Eksisterende prosjekt og separat modulbibliotek kan benyttes uten ny import hvis tilgjengelige.

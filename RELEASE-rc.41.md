# WSET v1.4.4-rc.41 – Server & FTP Manager

## Omfang
Bygget fra rc.40, uten endring i nettstedmotoren eller prosjektets innholdsformat. Godkjent minimalistisk WinSCP-inspirert design: tre faner, to likeverdige paneler, kompakt tilkoblingslinje, sammenleggbar overføringskø. Ingen permanent høyrekolonne eller hurtigpublisering.

## Installasjon
Kjør `npm install` og `npm run designer`. Nye avhengigheter: ssh2 1.17.0 og basic-ftp 6.2.6. Modellfiler og tidligere Ollama-innstillinger er uendret. Kildepakken inkluderer ikke node_modules eller Windows-installer. Nye protokollbiblioteker kunne ikke lastes ned i testmiljøet (npm DNS/EAI_AGAIN). Versjoner og offentlige API-er kontrollert mot pakkedokumentasjon; faktisk npm-installasjon og protokolltest gjenstår.

## Funksjoner
- Tilkoblingsprofiler per lokal prosjektmappe, med eget profilsett uten aktivt prosjekt. Test, rediger, slett, koble til/fra. Passord og SSH-nøkkelfrase krypteres med Electron safeStorage (Windows DPAPI); lagring avvises hvis sikker kryptering ikke er tilgjengelig. Alternativt beholdes passord kun i gjeldende prosjektøkt. Privat nøkkel leses fra valgt fil ved tilkobling, ikke kopiert til prosjektet.
- SFTP med SHA256-vertsnøkkelkontroll, eksplisitt førstegangsgodkjenning og avvisning ved nøkkelendring. FTPS med eksplisitt/implisitt TLS og sertifikatvalidering. Ukryptert FTP krever særskilt bekreftelse. FTP/FTPS bruker passiv modus.
- Lokal og ekstern filnavigering, valg av lokal mappe, absolutte stier, tilbake/frem/opp, flervalg, drag/drop mellom panelene og piltaster for overføring (knapper med pil).
- Opprette og endre navn på mapper/filer, slette filer og tomme mapper etter eksplisitt bekreftelse. Ingen rekursiv sletting.
- Rekursiv overføring av valgte mapper/filer. Sekvensiell kø med bytes, hastighet og ETA; avbryt og nytt forsøk av siste jobb etter ny bekreftelse. Filstørrelse kontrolleres på midlertidig og ferdig fil. Symbolske lenker og spesialfiler hoppes over. Eksisterende mål hoppes over som standard. Erstatning må velges eksplisitt i kontekstmeny. Ved SFTP-erstatning brukes OpenSSH POSIX rename; hvis serveren ikke støtter dette, feiler erstatningen uten å slette eksisterende mål først. FTP-serverens rename-semantikk avgjør om erstatning støttes. Lokal ikke-overskrivende overføring bruker hardlink (kan feile på filsystem uten støtte).
- Jobben fortsetter ved navigering til andre arbeidsområder. Prosjektbytte og lukking blokkeres under aktiv jobb. Ved avbrudd kobles serveren fra; midlertidig fil på server kan måtte fjernes manuelt etter avbrudd, og dette rapporteres ved mislykket opprydding. Nytt forsøk gjentar siste valgte sett og konfliktpolicy, ikke bytevis resume. Historikk lagres i lokale programdata etter jobben.

## Sikkerhet og avgrensning
Ingen automatisk synkronisering, speiling, sletting, ZIP-utpakking, direkte publisering, backup eller checksum-verifikasjon. Størrelseskontroll er ikke en innholdsintegritetskontroll. Konfliktkontroll foretas før overføring og før ferdig navn, men ved FTP er det ikke en transaksjonell sperre mot samtidige endringer fra andre klienter. Private serverdata må fortsatt holdes utenfor webrot av brukeren. Profiler lagres lokalt per prosjektmappe og følger ikke ZIP-eksport. Brukeren må verifisere verts­nøkkel mot webhotellet før godkjenning. Ekte webhotelltest i separat testmappe anbefales før produksjonsbruk. rc.42 blir kobling til publiseringsmanifest og XML-eksport; rc.43 differensiell overføring og backup.

## Verifisering
- `npm run test:core`: 84 bestått, 0 feil, 3 hoppet over (87 totalt).
- `npm test`: 86 bestått, 4 feil på grunn av manglende eksterne Smart Assistant ZIP/testprosjekt (ENOENT), 7 hoppet over (97 totalt).
- Åtte nye kjernetester med ekte lokal fil-I/O og simulert ekstern transport: validering, kryptering/isolasjon (testkryptering, ikke Windows DPAPI), rekursiv overføring, konflikt/erstatning, størrelsesfeil, avbrudd/nytt forsøk, filoperasjoner og mock-protokollkonfigurasjon/vertsnøkkel.
- `python tests/server-workspace-rc41-browser.py`: bestått i Chromium med simulert IPC. Profilopprettelse og test, navigering, flervalg, kø/historikk, kontekstmeny og fire vindusbredder (1600, 1366, 1200, 1040).
- Syntakskontroll av main/preload/renderer/kjerne: bestått.
- IKKE testet: ekte SFTP, FTPS eller FTP-server, Electron/Windows, faktisk DPAPI, drag/drop med native Electron, full Astro-publisering. Ingen produksjonsserver ble tilkoblet.

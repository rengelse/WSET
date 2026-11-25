# WSET Editor v1.0.2 – Installer Directory Alignment

WSET starter tomt, uten forhåndsåpnet CBPM-nettsted. Importer `CBPM-WSET-PROSJEKT-rc.16.zip` eller en tidligere gyldig prosjekt-ZIP.

## Første oppstart i Windows
1. Pakk ut editorens FULL-SOURCE ZIP i en egen mappe.
2. Kjør `npm install` og `npm run designer` (Node.js 22.23.4+).
3. Importer redigerbart CBPM-prosjekt / mal fra ZIP. Dette er *ikke* publiseringsarkivet.
4. Rediger nettstedet. Aktiver eventuelt AI-chat i prosjektets innstillinger.
5. Åpne **Generer nettside**. Hvis AI-chat er PÅ, velg **Importer / oppdater modul-ZIP …** og åpne den selvstendige Smart Assistant-ZIP-en.
6. WSET validerer ZIP, ID, versjon, filintegritet og kompatibilitet. Den sist importerte, godkjente modulversjonen blir valgt. Du trenger ikke importere den på nytt ved hver eksport.
7. Klikk **Generer 2 ZIP-filer**. WSET bygger nettstedet og aktiv modul til `01-WWW.zip` og `02-UTENFOR-WWW.zip`. Begge pakkes ut manuelt på webhotellet; ingen installer eller PHP-oppsettskript.

Hvis AI-chat er AV er modulen valgfri og skal ikke publiseres. Er AI PÅ uten godkjent modul, stopper eksporten med en forklaring. Ved feilaktig modulimport beholdes den forrige versjonen.

## Hvor lagres modulene?
Under WSETs lokale brukerprofil: `…/wset-editor/modules/smart-assistant/versions/`. Modulene er **ikke en del av nettstedprosjektet** og importeres separat. Prosjekt-/mal-ZIP inneholder det redigerbare nettstedet, men ikke Smart Assistant-kilden. Ved flytting til en annen PC må modulen importeres som egen ZIP.

## Migrering fra rc.15
Hvis du allerede har redigert et rc.15-prosjekt, ta backup og pakk ut `CBPM-rc15-til-rc16-EKSTERN-MODUL-ADAPTER-PATCH.zip` i selve prosjektmappen. Den erstatter bare integrasjons-/eksportadaptere, *ikke* `project/website.json`, XML, bilder eller design. Importer deretter Smart Assistant-ZIP i rc.16-editoren.

Hvis du starter nytt, importer `CBPM-WSET-PROSJEKT-rc.16.zip` direkte.

## Eiendommer i rc.28
Eiendomsregisteret har egne faner for Nybygg og Bruktboliger, med søk, filtre, paginering og liste-/kortvisning. Eiendommer hadde Eiendomsregister og XML-kilder; rc.33 legger til Nye annonser. Hovedsidens synlighet styres fra samme meny (··· → Synlig) som øvrige sider. Nybygg og Bruktboliger har egne AV/PÅ-brytere direkte i sidetreet Nettsider → Eiendommer; menypunkt og menynavn redigeres i høyrepanelet. Begge kategoriene er PÅ som standard uavhengig av lokale XML-filer. Lokale XML-annonser er skrivebeskyttede. Server / FTP støtter manuell filoverføring fra rc.41. Automatisk kobling til eiendomseksport kommer senere. Se RELEASE-rc.27.md.

## Prosjekt og publisering
- **Prosjekt-ZIP**: redigerbar kildekode, sider, bilder, XML og prosjektinnstillinger. Modulens egen kode følger ikke med.
- **Mal-ZIP**: redigerbar kildekode og eksempelinnhold, uten importerte XML og lokale boligbilder.
- **Publisering**: to separate manuelle ZIP-er. New XML: eksterne HTTPS-bildeadresser; Existing XML: lokale bilder i private `storage/imports/Existing/images/<ID>/`.

## Sikkerhet og begrensninger
Importer bare moduler fra kilder du stoler på: modulens PHP/JS vil bli publisert. Importen kjører ingen modulskript, avviser utrygge ZIP-stier og kontrollerer innholdet ved eksport. Nettstedprosjektet kjører sin **fast godkjente** byggeprosess, ikke modulens egne skript.

Dette er FULL SOURCE, ikke en ferdig Windows-installer. Full Electron/Astro-kjøring på Windows og live webhotelltest gjenstår; Se RELEASE-rc.41.md for verifiseringsstatus for denne utgivelsen.

## Medier i rc.29
Medier er en selvstendig arbeidsflate med dynamisk katalog, virtuelle kategorier, søk, filtre, liste/kort og bildeinformasjon. Nye originaler lagres fortsatt i `project/media/originals/`, med bildevarianter i `public/assets/`. Eksisterende malfiler beholdes på plass; XML-boligbilder er ikke del av katalogen.

## Bildebytte i rc.30
Velg et bilde i Medier og trykk Bytt bilde. Velg én eller flere registrerte plasseringer, eller alle, og velg ny fil fra PC-en eller et eksisterende kompatibelt bibliotekbilde. Bruksområdene er klikkbare. Fra Nettsider byttes bare det valgte bildefeltet. Originalene beholdes og endringene kan angres. Ingen ny nettsidemal er nødvendig.

## Medier i rc.31
Bildebytte bruker en kompakt dialog med visuell kildevelger og miniatyrbilder. «Fjern bilde» åpner en dialog som forklarer eventuelle avhengigheter og lar brukeren fjerne en valgfri bildetilknytning eller fjerne et ubenyttet bilde fra biblioteket. Filene beholdes for angre og prosjektkompatibilitet. Se RELEASE-rc.31.md for begrensninger.

## Språk i rc.32
Språkoversikt og oversettelser har en egen arbeidsflate. Velg språk, endre rekkefølge og synlighet, sammenlign originaltekst og oversettelse, filtrer og importer/eksporter samme JSON-format. Se RELEASE-rc.32.md for verifisering og begrensninger.

## Nye annonser i rc.33
Åpne Eiendommer → Nye annonser. Velg kategori i treet, fyll ut felter, og lagre kladden. Kladden er lokal og følger med redigerbar prosjekt-ZIP, men ikke mal-ZIP. Kart, boligbilder, salgsstatus, merking og XML-generering ferdigstilles i senere faser. Se RELEASE-rc.33.md.

## Annonseeditor i rc.34
Bruk Eiendommer → Nye annonser. Bilder importeres fra PC, ordnes i galleriet og merkes som foto eller plantegning. Første foto er hovedbildet. WebP-filer ligger privat i `project/property-draft-images/`; de inngår ikke i Medier, XML-registeret eller mal-ZIP. Kart og koordinater støtter manuell registrering og valgfritt nettkart (MapLibre/OpenFreeMap). Kjør `npm install` på nytt for kartavhengigheten. Forhåndsvis annonse viser lokale kladddata i valgt språk. XML-generering og publisering kommer i rc.35. Se RELEASE-rc.34.md.

## XML og annonseoversikt i rc.35
Klargjør egne annonser under Nye annonser → Publisering. Samlet Kyero v3 XML oppdateres ved lagring. Eksporter XML fra Eiendomsregister for valgt kategori; ZIP inneholder XML, refererte private boligbilder og overføringsmanifest. Se RELEASE-rc.35.md.

## Salgsstatus, merker og adressesøk i rc.36
Bruk Nye annonser → Beliggenhet → Kart og koordinater for eksplisitt adressesøk i Spania (CartoCiudad). Velg riktig treff; koordinater og kart oppdateres. Under Salgsstatus og merking eller Eiendomsregister → Status velger du salgsstatus, standardmerker og individuell synlighet. Status lagres separat fra leverandørens XML. Første gang må hele nettsiden genereres og publiseres med rc.36-runtime; senere kan kategoriens private `wset-listing-status.json` overføres separat. Se RELEASE-rc.36.md for eksakt filstruktur, begrensninger og teststatus.

## Lokal oversettelse (rc.37)
Åpne tannhjulet i toppmenyen → Oversettelse. Installer og start Ollama for Windows om nødvendig (knappen åpner den offisielle nedlastingssiden). Velg TranslateGemma 4B og trykk Last ned modell. Nedlasting krever internett og ca. 3,3 GB modellplass, i tillegg til plass til Ollama og midlertidige filer. 12B og 27B er valgfrie, større modeller. Modellen lastes ikke ned automatisk. Bruk Test oversettelse før du oversetter annonser.

Under Eiendommer → Nye annonser → Beskrivelser velges originalspråk, tekst skrives inn, og Oversett manglende eller Oversett alle startes. Sistnevnte krever bekreftelse hvis eksisterende tekster erstattes. Kontroller resultatet, lagre kladd og klargjør for publisering. XML inneholder ferdige beskrivelser i eksisterende språkfelter. Kildespråket i prosjektet må fortsatt ha en beskrivelse før klargjøring. Ingen tittel-tag er innført uten støtte i Kyero-parseren.

Adresser og koordinater registreres nå samlet under Beliggenhet. Motorinnstillinger lagres i WSETs lokale brukerprofil; WSET sender tekst kun til `127.0.0.1:11434`. Ingen modell, innstillinger, API-nøkler eller oversettelseskode følger med i nettstedets eksport. WSET og Ollama er separate lokale programmer. TranslateGemma er underlagt [Gemma Terms of Use](https://ai.google.dev/gemma/terms); se [Ollamas modellside](https://ollama.com/library/translategemma).

## Oversettelse i rc.38
Modellnedlasting viser faktisk rapportert fremdrift. Testfeltet er sammenleggbart og viser feil ved selve testen. Under Språk kan du oversette enkelttekster, manglende eller viste tekster. Strukturerte tekstfelt i Nettsider har egen oversettelsesknapp. Lagre prosjektet på vanlig måte. Se RELEASE-rc.38.md for omfang og begrensninger.

## Oversettelse i rc.39
Maskinvarevalg (Automatisk, CUDA, Vulkan, CPU), lokal reservekjøring, Keep Alive, valgfri forhåndslasting, ytelsesmåling og øktbuffer er tilgjengelig i programinnstillingene. Språk kan oversette manglende tekster til alle aktive språk og vise permanent oversettelsesstatus. Se RELEASE-rc.39.md for førstegangsoppsett og begrensninger.

## Nettstedinnstillinger i rc.40
Innstillinger er et selvstendig arbeidsområde med kategorier, profil, logo/favikon, globalt utseende, kontakt, SEO og AI-chat. Nye valgfrie bedriftsdata lagres i prosjektet; eksisterende nettsidemal er uendret. Se RELEASE-rc.40.md.

## Server / FTP i rc.41
Installer nye avhengigheter (`npm install`) før `npm run designer`. Åpne Server / FTP → Tilkoblinger og opprett en profil (SFTP anbefales). Velg profil i Filbehandler og koble til. Godkjenn SSH-fingeravtrykk kun etter kontroll mot webhotellets dokumentasjon. FTPS krever gyldig sertifikat. FTP er ukryptert og krever en ekstra advarsel.
Filpanelene støtter flervalg (Ctrl/Shift), dobbeltklikk på mapper, drag/drop mellom paneler, kontekstmeny, manuell opplasting/nedlasting og en sammenleggbar kø. Eksisterende filer hoppes over som standard; eksplisitt erstatning velges fra kontekstmenyen og bekreftes. Avbrudd kan koble fra serveren; koble til på nytt før nytt forsøk. Historikk og krypterte passord lagres i programdata per prosjekt, aldri i prosjektet.
Dette er en generell manuell filbehandler, ikke automatisk publisering. ZIP-filer pakkes ikke ut på serveren. Private filer skal aldri legges i offentlig webrot. Test med ufarlige filer i en separat testmappe før bruk i produksjon. Live SFTP/FTPS/FTP og Windows/Electron gjenstår å verifisere; se RELEASE-rc.41.md.

## AI-chat og identitet i rc.42
Se [RELEASE-rc.42.md](RELEASE-rc.42.md) for bruk, eksportkontrakt og QA-status. Basert på rc.41. Identitetsprofil krever Smart Assistant v1.9.10-module.24 eller nyere kompatibel modul.

## rc.43 – Juridisk og globalt innhold
Se [RELEASE-rc.43.md](RELEASE-rc.43.md) for arbeidsflyt, grenforening, verifisering og begrensninger. Direkte publisering fra den separate rc.42-grenen er flettet inn; se [RELEASE-rc.42-Direct-Publication.md](RELEASE-rc.42-Direct-Publication.md). Assistant Identity er beholdt, med original [RELEASE-rc.42.md](RELEASE-rc.42.md).

## Prosjekt-ZIP-kompatibilitet (rc.43.1)
Trygge, tomme mappeoppføringer i ZIP-indeksen aksepteres nå ved import. Tidligere CBPM rc.27-prosjektarkiv kan importeres direkte uten ompakking. Se RELEASE-rc.43.1.md.

## rc.44 – malstandard
Se `TEMPLATE-CONTRACT-v1.md` og `RELEASE-rc.44.md`. Eldre redigerbare ZIP-er kan fortsatt importeres. Malidentitet lagres i `project/template.json`; aktivt malnavn vises i editoren. Bare Mediterranean Premium er renderbar i rc.44. Malbibliotek og malbytte kommer senere.

## rc.45 – malbibliotek
Åpne Malbibliotek fra Prosjekt-menyen, Mine nettsteder eller tom prosjektoversikt. Importer en mal-ZIP, filtrer på kategori, vis versjoner og opprett en separat prosjektkopi. Biblioteket starter tomt. Se `RELEASE-rc.45.md` og `TEMPLATE-CONTRACT-v1.md`. Malbytte og dynamisk rendering er ikke implementert.

## rc.46 – aktiv renderer
Forhåndsvisning, tekstbinding, typografi, mediebruk og språktilknytning velger en godkjent renderer for prosjektets mal-ID og motor. Ingen vilkårlige Node-moduler importeres fra malarkiver. Se `RELEASE-rc.46.md` og `RENDERER-CONTRACT-v1.md`. Bare Mediterranean Premium er installert som produksjonsrenderer. Malbytte er fortsatt ikke tilgjengelig.

## rc.47 – Arbeidsområde og automatisk malbibliotek
Standard: Dokumenter/WSET. Åpne Arbeidsområde fra Oversikt, Mine nettsteder eller programinnstillinger for å velge hovedmappe og individuelle mapper. Legg mal-ZIP direkte i Templates eller en undermappe; katalogen oppdateres ved oppstart og omtrent hvert femte sekund. Maler valideres uten kodekjøring. Tidligere prosjekter beholdes der de ligger, og Mine nettsteder leser prosjektregisteret fremfor bare historikk. Se `RELEASE-rc.47.md`.

## rc.48 – Mine nettsteder
Prosjektoversikten leser arbeidsområdets permanente prosjektregister og viser kort- eller listevisning, søk, filter og sortering. Prosjektinformasjon (navn, kunde, domene) lagres lokalt i prosjektets `.wset-local-project.json` og påvirker ikke nettstedets innhold eller serverprofiler. Forsidebildet hentes fra det lagrede prosjektet; dette er ikke en full nettsideforhåndsvisning. Bruk Detaljer, Mer, Oppdater og Nytt nettsted fra Mine nettsteder. Se `RELEASE-rc.48.md` for avgrensning og tester.

## rc.49 – Visuelt malbibliotek
Malbibliotek er et eget hovedmenypunkt og kan åpnes uten et aktivt prosjekt. Forsidebilder hentes fra validerte mal-ZIP i arbeidsområdets Templates-mappe; bruk kategori, søk, Forhåndsvis og Bruk mal. Forhåndsvisning støtter lagrede PC-, nettbrett-, mobil- og fullsidebilder (dersom de finnes) samt skrivebeskyttet interaktiv visning med godkjent renderer. En separat midlertidig kopi og loopback-server brukes uten registrering i Projects. Serverbaserte funksjoner og eksterne ressurser er ikke aktive i galleriet. Se `RELEASE-rc.49.md` for kontrakt, sikkerhet, tester og avgrensninger.

## rc.50 – Prosjektoppfølging
Åpne Mine nettsteder → Fremdrift. Prosjektstatus, leveringsdato, kundegodkjenning, sjekkliste og notater lagres lokalt per prosjekt. Fremdriften regnes fra relevante kontrollpunkter, kundegodkjenning og siste tekniske validering av lagret nettsted. Fullført ZIP-eksport er ikke det samme som publisering. Direkte serveroverføringer registreres ved avslutning av jobben. Se `RELEASE-rc.50.md` for avgrensning og testresultater.

## rc.51 – Malkompatibilitet
Åpne eksisterende prosjekt, gå til Malbibliotek og velg **Kontroller kompatibilitet** på en mal. Rapporten kartlegger prosjektdata, side-/seksjons-ID-er, språk, lagrede tekstbindinger, typografi og refererte mediefiler. Prosjektet og ZIP-filen endres ikke. Ustøttede renderere, manglende bindinger og filkonflikter rapporteres eksplisitt. Malbytte er ikke implementert ennå. Se TEMPLATE-CONTENT-MAPPING-v1.md.

## rc.52 – Sikkert malbytte
Lagre prosjektet, åpne Malbibliotek → Kontroller kompatibilitet → Klargjør malbytte. Se kandidatens innhold, gjennomgå filendringer og godkjenn. WSET kjører full lokal produksjonseksport i separat byggemappe før aktivering. Tilbakefør mal viser lokale sikkerhetskopier. Se RELEASE-rc.52.md.

## rc.53 – Malversjoner og kontrollerte oppdateringer
Legg en nyere mal-ZIP med samme mal-ID i arbeidsområdets Templates-mappe. Malbibliotek og Mine nettsteder oppdager den ved neste synkronisering. Malbiblioteket viser nyeste per mal som standard; velg Alle versjoner for eldre arkiver. Velg Kontroller oppdatering, lagre prosjektet, gjennomgå kartlegging og kandidat, og godkjenn lokal produksjonsbygging. Ingen automatisk installasjon eller publisering. Tidligere versjoner gjenopprettes via Tilbakefør mal. Se RELEASE-rc.53.md.

## rc.54 – Multi-template Quality Assurance
- `npm run test:qa` kontrollerer ruter, offentlig/privat eksport, manifest og en teknisk alternativ renderer. Sett `WSET_TEST_TEMPLATE_ZIP` til faktisk Mal 01 rc.28.1 for full ende-til-ende-test. Se `RELEASE-rc.54.md` for resultat, testkommandoer og avgrensninger.
- Malarkiver får ikke installere renderer-kode automatisk. Nye design må benytte støttet, editor-eid rendereradapter; en teknisk alternativ adapter finnes bare i testkoden.
- Publiseringsmotoren kontrollerer alle ordinære sider, språk og PHP-katalogruter før eksport, og kontrollerer filhashene også etter etterbehandling.

## rc.55 – Unified Workspace & Storage Architecture
One workspace root, explicit verified migration and relocation, archive/restore, central project-ID backups and server settings. See `RELEASE-rc.55.md` before first launch. Keep rc.54 and original data until verified.

## rc.56.1 – Manual GitHub Releases

Run `npm install`, then `npm run dist` on Windows from the source directory. This builds a local Windows x64 installer and verifies the three release assets in `dist/`: `WSET-Setup-1.4.4-rc.56.1.exe`, its `.exe.blockmap`, and `latest.yml`. Upload only these three files manually to https://github.com/rengelse/WSET/releases (tag `v1.4.4-rc.56.1`, normal published release, not a draft or GitHub prerelease). RC is part of the version, not a separate feed. Do not upload the source or workspace. No GitHub Actions or automatic publishing. See `RELEASE-rc.56.1.md` for build instructions and validation limitations. The in-app updater is not yet enabled.

## v1.0.0 – Initial Release / Integrated Project Creation

Create a website from the gallery with project name, optional customer and domain, and explicit source trust. Administrative metadata is local only. Build on Windows with `npm install` and `npm run dist`. Install v1.0.0 manually over the internal rc.57 baseline; do not enable updater downgrades. See RELEASE-v1.0.0.md.

## rc.57 – Automatic Updates & Silent Installation

Run `npm install` and `npm run dist` on Windows. Upload only the EXE, EXE.blockmap and latest.yml to a normal published GitHub release tagged `v1.4.4-rc.57`. The first updater-capable installation must be installed manually. See RELEASE-rc.57.md for verification and the rc.57 → rc.58 acceptance test.

## v1.0.1 – Installer Path Validation Fix

Fix NSIS path validation for clean installs and reinstalls without relaxing the dedicated program folder policy. Build with `npm install` and `npm run dist`. See RELEASE-v1.0.1.md.

## v1.0.2 – Installer Directory Alignment

The default Windows program folder is `%LOCALAPPDATA%\Programs\wset-editor`, matching the package name. An existing owned installation under `Programs\WSET` can remain there. Both folders are forbidden workspace roots. Build with `npm install` and `npm run dist`. See RELEASE-v1.0.2.md.

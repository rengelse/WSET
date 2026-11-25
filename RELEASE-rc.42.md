# WSET Editor v1.4.4-rc.42 – Assistant Identity Management

## Grunnlag
Direkte videreutvikling av opplastet `WSET-Editor-v1.4.4-rc.41-Server-FTP-Manager-FULL-SOURCE.zip`. Dette er ikke en sammenslåing med andre eventuelle rc.42-varianter. Smart Assistant v1.9.10-module.24 forblir en uavhengig modul. Siste CBPM Website-prosjekt er ikke mottatt; rc.27 er brukt som integrasjonsreferanse.

## Bruk
1. Åpne eksisterende prosjekt i den nye WSET Editor-koden etter vanlig lokal installasjon (`npm install`, `npm run designer`). Node-versjonskrav i package.json beholdes.
2. Gå til Innstillinger → AI-chat. Aktiver AI-chat, velg identitet (Smart Assistant, Alba, Luna, Clara, Egendefinert eller Eksisterende / uten profil). Sistnevnte fjerner ny identitetskonfigurasjon og bruker tidligere visningsnavn.
3. Tilpass navn, tone, avatarfarge, profilbilde, skriveindikator og minimum responstid (0–1500 ms). Bruk mediebiblioteket eller last opp eget rasterbilde. Profilene har monogram, ikke medfølgende fotografier. Ved skifte av profil brukes profilens navn, tone og farge; eksisterende avatar, lokale tekster og tidsinnstillinger beholdes.
4. Velg nettstedsspråk. Rediger undertittel, velkomst og maks fire hurtigvalg. Ett hurtigvalg per linje: `knappetekst | melding`. Endre rekkefølge ved å flytte linjer. Standard/reserve, egne valg og eksplisitt skjuling støttes. Bruk `{name}` i velkomstmeldingen. Tomme lokale felter bruker modulens reserve/standard. Automatisk oversettelse av manglende tekster bruker eksisterende oversettelsesmotor; eksisterende oversettelser og eksplisitt skjulte hurtigvalg overskrives ikke.
5. Innstillingssiden viser en forenklet forhåndsvisning; den faktiske modulen vises i nettsideforhåndsvisningen dersom modul er installert. Lagre prosjektet. Importer Smart Assistant v1.9.10-module.24 eller nyere kompatibel versjon via Generer nettside.
6. Generer og publiser de to vanlige ZIP-arkivene. Ingen ekstra distribusjonsfiler på serveren. Identity er offentlig UI-konfigurasjon; den inneholder ikke hemmeligheter eller instruksjoner for samtalemotoren.

## Arkitektur
- `designer/engines/cbpm-astro-v1/lib/assistant-identity.mjs`: eksplisitt `wset-assistant-identity-v1`-validering og editoroperasjoner. Kun tillatte felter eksporteres. Eksisterende prosjekter opt-in, ingen tvungen migrasjon eller endring av navn.
- `designer/core/assistant-publication.mjs`: etterbehandling av den genererte offentlige ZIP-en, oppdaterer eksisterende `wset-smart-assistant-config` i HTML og PHP-boligskall, omsetter avatarens sti fra prosjektets `/assets/` til publisert `/assets/images/`, oppdaterer filhasher og publiseringsmanifest. Gamle moduler stoppes når identitetsprofil er aktivert. Ingen endring i prosjektets Astro-kilde, PHP-motor eller private ZIP av denne funksjonen. Eksisterende WSET eksport- og sikkerhetskontroller beholdes.
- Lokal preview bruker samme valgfrie identitetskontrakt, live API deaktivert. Mediereferanser deltar i eksisterende livssyklus. Undertittel og velkomst inngår i språkregisteret; egen manglende-oversettelse-kommando støtter også hurtigvalg og avviser endrede kilder/mål.
- Server/FTP, eiendomsdata, backend og Smart Assistant-modulens kode er ikke endret. Samtaletone påvirker foreløpig hilsener/velkomst, ikke hele responsmotoren. Ingen ekstern AI-tjeneste.

## Verifisering i dette miljøet
- Node.js v22.16.0 (lavere enn prosjektets deklarerte krav v22.23.4; ingen endring i kravet).
- 9/9 nye automatiske testtilfeller bestått. Faktisk modulimport v1.9.10, HTTP-preview no/en/es, avatar, profilvalg, språk/oversettelsesdata, validering, bakoverkompatibilitet.
- Eksisterende publisert 01-WWW.zip: 154 konfigurasjoner oppdatert i isolert test, korrekte hasher.
- Faktisk rc.27-prosjekt, original offline-renderer og originale staging-/pakkeskript, med teststubber for Astro og MapLibre, injisert test-runner: begge ZIP-arkivene generert og kontrollert; 176 konfigurasjoner, 402 offentlige og 74 private filer, v1.9.10 bekreftet i manifest. Ingen testarkiver leveres til produksjon. Full Astro/Electron/kart/live-test er ikke utført.
- Samlet Node-testsuite: 106 registrerte, 102 bestått, 1 feilet pga. manglende historisk modulfixture `CBPM-Smart-Assistant-v1.8.1-Module-rc.15.zip`, 3 hoppet over (to bildekonverteringstester uten Sharp og én renderer-fixture). Ingen øvrige registrerte feil.
- Nyeste CBPM Website-prosjekt, full Windows Electron UI, visuell nettlesertest, Sharp bildeopplasting/variantgenerering og full Astro-bygg må verifiseres lokalt. Ingen påstander om produksjonsgodkjenning.
- Rc.27-kunnskapseksportens faktiske testresultat: 0 tjenester, 0 ansatte, 7 sider. Eksempelinnholdsfilter beholdt; detaljert tjenesteeksport er ikke endret her. Kontroller siste nettstedprosjekt separat.

## Reproduserbare tester
`npm test` (eldre integrasjonstester trenger sine originale testarkiver). Nye tester: `node --test tests/assistant-identity-rc42.test.mjs`. Valgfri integrasjon med miljøvariablene WSET_TEST_WEBSITE (utpakket nettsted), WSET_TEST_IDENTITY_MODULE (modul-ZIP), WSET_TEST_PUBLIC_ZIP (tidligere offentlig ZIP). Separat kjedetest: `node tests/assistant-identity-rc42-project-check.mjs <utpakket nettsted> <modul.zip>`.

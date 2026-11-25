# WSET v1.4.4-rc.40 – Website Settings Workspace Redesign

Basert på FULL SOURCE rc.39. Kun WSET oppdateres; ingen nye npm-avhengigheter eller endringer i nettstedsmal, PHP-motor, XML eller publiseringskontrakt.

## Arbeidsflate
- Innstillinger i hovedmenyen åpner et selvstendig arbeidsområde med kategorier, redigeringsfelt og høyrekolonne med faktiske logo-/favicon-forhåndsvisninger og lokale kontrollpunkter. Den vanlige nettsideforhåndsvisningen, sidetreet og inspector skjules kun i dette arbeidsområdet.
- Bedriftsprofil, Kontaktinformasjon, Logo og identitet, Globalt utseende, SEO og metadata, Kontaktskjema og AI-chat. Topplisten og kategorilisten bruker samme kategorivalg.
- Kontakt på Bedriftsprofil er en oversikt og snarvei, slik at kontaktfeltene bare har én redigeringsflate. Logo og favicon åpner eksisterende medievalg, opplasting og erstatning; ingen egen mediedatabase.
- Nytt: valgfrie felt for registreringsnummer/CIF, gateadresse, postnummer, by og land på eksisterende `brand`. Ingen antatte kundeopplysninger fylles inn. Feltene lagres i prosjekt og redigerbar ZIP. Dagens mal viser dem ikke automatisk; malens visning kan utvides senere.
- SEO-tittel og SEO-beskrivelse per eksisterende side/språk benytter `page:update`, eksisterende i18n-katalog og renderer. Oversett manglende SEO-tekst til valgt språk med den lokale oversettelsesmotoren; eksisterende tekst beskyttes. Ingen endring i noindex-policy. Sosiale medier, domene, cookie-/samtykkestyring og utvidet SEO er ikke implementert her.
- Kontaktskjemaets demomodus/SMTP og personvernlenke, AI-chat AV/PÅ og navn, logo/identitet og globale typografiinnstillinger er bevart. SMTP-hemmeligheter konfigureres fortsatt på serveren. Programinnstillinger (tannhjul) og oversettelsesmotor er uendret.
- Endringer følger eksisterende prosjektkommandoer og angre/gjør om. Lagring bruker den vanlige prosjektlagringen og sikkerhetskopien. Ingen falske live- eller publiseringsstatuser.
- Nye sentrale UI-tekster er lagt til i eksisterende norsk/engelsk/spansk grensesnittordbok.

## Verifisering
- `npm run test:core`: 76 bestått, 0 feil, 3 hoppet over.
- `npm test`: 78 bestått, 4 feil på grunn av manglende eksterne Smart Assistant ZIP-er / testprosjekt, 7 hoppet over.
- `tests/settings-workspace-rc40-browser.py`: bestått med faktisk CBPM-prosjektdata, simulert IPC og oversettelsesrespons. Kategorier, feltendringer, lagring, angre, SEO, navigasjon og vindusbredder 1600/1366/1200/1040.
- `tests/settings-workspace-rc40-project-check.mjs`: bestått på kopi av CBPM rc.27-prosjekt. Reell lagring/gjenåpning, backup, prosjekt-ZIP, metadata-rendering, uendret HTML og XML-inventar.
- Eksisterende Chromium-regresjoner for Språk og boligeditor bestått med simulert IPC.
- Windows/Electron og native filvalg/opplasting, faktisk lokal modellkjøring og full Astro/netthotell-publisering er ikke testet i dette miljøet.

## Installasjon
Oppdater WSET-kildepakken på vanlig måte og start med `npm run designer`. Eksisterende prosjekter kan åpnes direkte; ikke importer malen på nytt. Server/FTP blir neste utviklingsfase (rc.41).

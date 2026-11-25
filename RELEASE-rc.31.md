# WSET v1.4.4-rc.31 – Media UI & Lifecycle Refinement

Basert på rc.30. Oppdater kun editoren; eksisterende nettstedprosjekter kan beholdes.

## Endringer
- `designer/ui/index.html`, `app.js`, `style.css`: isolerte bildebytte- og fjerningsdialoger med marger, miniatyr av nåværende bilde, visuelt valg av kilde, søkbar miniatyrvelger og valg av plasseringer ved behov. Felles dialog for Nettsider og Medier. Ingen endringer i globale dialogstiler.
- `designer/core/media-references.mjs`, `media-catalog.mjs`, `content-commands.mjs`: fjerning fra én valgfri plassering (ansattportrett, før-/etterbilde, seksjonsgalleri og eksplisitte prosjektgallerier med mer enn ett bilde). Obligatoriske bildeplasser/fallback-plasser kan bare erstattes. Referanse og gammel bildebane verifiseres før endring. Angre/gjør om benytter eksisterende historikk.
- Ubrukte malfiler kan fjernes logisk fra biblioteket ved å registrere banen i `media.workspace.hiddenLegacy`. Filen beholdes på disk og i arkiver. Katalogen viser fortsatt et bilde dersom det igjen er i bruk. `designer/main.cjs` kontrollerer at filen finnes i katalogen og avviser registrerte datareferanser og kjente kildeavhengigheter før fjerning av malfil. Kildekontrollen er konservativ, ikke en garanti for alle dynamiske referanser. Ingen fysisk sletting eller flytting.
- `tests/media-lifecycle-rc31.test.mjs`: tester delte portretter, obligatoriske og valgfrie bildefelt, historikk, sikker fjerning og hardkodede kildeavhengigheter. Oppdaterte Chromium-harness for ny modal og fjerning.

## Verifisering
- `npm run test:core` med utpakket CBPM rc.27: 46 bestått, 0 feil, 1 hoppet over (Sharp ikke installert).
- `npm test` med samme prosjekt: 53 bestått, 3 feil pga manglende eksterne Smart Assistant ZIP-er, 1 hoppet over.
- Chromium med simulert IPC: mediearbeidsflate og felles bildebyttedialog, miniatyrvalg, referansevalg, avvisning av nødvendig bilde, fjerning fra valgt plassering og navigasjon. Testet dialogstørrelse ved 1600x950, 1040x700 og 800x600.
- Manuell Node-integrasjonstest med kopi av CBPM rc.27: lagring, gjenåpning og prosjekt-ZIP-rundtur bevarer metadata for fjernede malbilder og den fysiske filen.
- Node 22.16.0 i testmiljøet; prosjektet krever >=22.23.4. Windows/Electron, native fildialog, reell Sharp-bildeimport og full Astro-publisering er ikke kjørt i denne versjonen. EN/ES-oversettelser av nye kontroller gjenstår.

Nettsidemotor, XML-/eiendomsbilder, publiseringsmotor og fysisk mappestruktur er uendret. Bildesletting er logisk, ikke en diskopprydding. Nødvendige malbilder og bilder med uavklarte avhengigheter skal ikke fjernes. Ved ny import av en fysisk bevart fil benyttes ordinær bildeimport.

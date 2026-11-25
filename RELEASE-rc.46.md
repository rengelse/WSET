# WSET v1.4.4-rc.46 – Dynamic Template Preview

Kildegrunnlag: rc.45 FULL SOURCE. Ingen nye kommersielle maler, ingen endringer i eksisterende malarkiver.

## Endringer
- Felles rendererregister og versjonert adaptergrensesnitt. Mediterranean Premium er flyttet bak egen adapter. Aktiv prosjektidentitet velger renderer; ingen import av vilkårlige Node-moduler fra ZIP.
- Samme renderer-kontekst i forhåndsvisning, tekstbinding, typografi, mediebruk, bildereferanser, språktilknytning og publiseringsetterbehandling. Operasjonell kontekst isoleres mellom samtidige forespørsler.
- Stabil `data-content-ref`-binding av tekstfelt uten krav om Mal 01-kortklasser. Bilde-/postvalg bruker stabile ID-er i nettleserbroen. Adapter leverer bildeplassmetadata til editor. Eiendomsmodulens forhåndsvisning bruker den aktive rendererens sideomramming.
- Kontroll av rendererens grensesnitt, sidesvar og seksjonsidentitet. Ustøttede mal-ID-er avvises uten fallback. Publisering avviser endret malidentitet før bygg. Eksisterende struktur-/tekstbindingskontroll i publiseringsetterbehandling beholdt.
- Oppdatert versjonsnummer og dokumentasjon. Ingen endring i prosjektformatet, publiserings-ZIP-kontrakten, Smart Assistant-motoren eller Mal 01s nettsidefiler.

## Testresultater
- Full `npm test` med rc.28 prosjekt/mal og utpakket Mal 01 rc.28.1 som kildefixture: 144 tester, 137 bestått, 3 feilet, 4 hoppet over. Alle 8 nye rc.46-tester bestått. De 3 feilene er ENOENT for de historiske Smart Assistant-modularkivene rc.15 og rc.16 som ikke er tilgjengelige i miljøet.
- Kjernetester: 130 bestått, 0 feil, 4 hoppet over (egen avsluttende testkjøring). Hoppede tester krever Sharp eller eksterne assistent-/publiseringsarkiver.
- Kontroll av faktisk Mal 01-kilderenderer: 77 side-/språkkombinasjoner, struktur og tekstbinding verifisert.
- Chromium: `template-renderer-rc46-browser.py` og `inline-rc20-bridge-browser.py` bestått. Alternativ kortstruktur, tekstredigering, bildevalg, postfokus og eksisterende Mal 01-redigering. DOM-testene bruker generert HTML, ikke native Electron.
- Node 22.16.0 i miljøet (prosjektkrav >=22.23.4). Faktisk Windows/Electron, full Astro-produksjonsbygg, ekte serverpublisering og ekstern assistentmodul ikke verifisert.

## Avgrensning
rc.46 gir renderer-dispatch og felles kontrakt, ikke ferdig støtte for vilkårlige eksterne renderere. Bare Mal 01 er registrert i produksjon; en teknisk alternativ renderer brukes i tester. Fremtidige design må ha en godkjent adapter. Eksisterende felles datamodell og asset-/markup-kontrakter består. Brukeren kan ikke bytte mal ennå. Neste steg er rc.47 – Template Compatibility & Content Mapping.

Installer: pakk ut i egen mappe, kjør `npm install` og `npm run designer`. Bruk eksisterende Mal 01 rc.28.1 fra rc.45; ikke importer den på nytt hvis den allerede ligger i biblioteket.

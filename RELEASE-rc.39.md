# WSET 1.4.4-rc.39 – Translation Engine Reliability

Basert på rc.38. Ingen nye npm-avhengigheter. Oversettelse skjer fortsatt utelukkende i WSET, lokalt via Ollama. Nettsidemalen og PHP/Astro-runtime er ikke endret.

## Første test (RTX 4050 Laptop)
1. Avslutt den manuelt startede `ollama serve` i PowerShell med Ctrl+C, slik at den gamle modellen ikke opptar GPU-minne. Du trenger ikke avinstallere Ollama eller laste ned modellen på nytt.
2. Start rc.39, åpne Programinnstillinger → Oversettelse. Velg 4B og Vulkan. WSET starter sin egen lokale prosess på en ledig loopback-port og gjenbruker standard Ollama-modellmappe. Dersom en separat Ollama-instans bruker en egendefinert modellmappe, må samme OLLAMA_MODELS være tilgjengelig for WSET.
3. Behold reservekjøring på og Keep Alive på 30 minutter. Test oversettelse to ganger. Testknappen omgår øktbufferen slik at tidsmålingene er reelle.
4. Ved feil: kopier feilmeldingen. Automatisk modus gjenbruker eksisterende lokal Ollama på port 11434 dersom den svarer; eksplisitt modus styrer kun WSETs egen prosess, ikke andre programmer. Ekstern Ollama kan fortsatt oppta GPU-minne. WSET prøver Vulkan og deretter CPU ved gjenkjente maskinvare-/modellfeil; valg av reserve beholdes i økten, mens valgt innstilling lagres på disk. GPU-andel beregnes fra Ollamas rapporterte modellstørrelse og VRAM, ikke fra GPU-utilization. Eksakt GPU-navn og faktisk backend for ekstern Ollama er ikke rapportert av /api/ps.

## Innhold
- Maskinvaremodus, reservekjøring, Keep Alive (5/15/30 min eller uten tidsgrense), valgfri forhåndslasting, manuell modellinnlasting. Innstillinger per PC. Uten tidsgrense kan ekstern Ollama beholde modellen også etter at WSET avsluttes.
- Ollama-målinger av innlastings- og genereringstid, tokens/sekund; øktbuffer (maks 512 identiske vellykkede tekstoversettelser, aldri lagret til disk). Eksisterende sekvensielle jobber bruker samme motor. Overlappende enkeltforespørsler avvises fortsatt; det er ikke en vedvarende global jobbkø.
- Språk: masseoversettelse av manglende aktive tekster på alle aktive målspråk, med bekreftelse, fremdrift, estimat og stopp etter aktiv tekst. Jobb stopper ved feil eller bytte av arbeidsområde/prosjekt. Vanlig lagring kreves. Ingen overskriving av eksisterende oversettelser i massejobben.
- Permanent prosjektmetadata for oversatte/manuelt redigerte/utdaterte tekster i språkeditoren, og tilsvarende status for boligbeskrivelser. Tidligere oversettelser uten kjent originalbaseline markeres utfylt/ikke verifisert; ingen historikk oppdiktet. Eksisterende i18n-format og Kyero XML er uendret. Metadata lagres i redigerbart prosjekt; de er ikke del av i18n-pakker eller XML.

## Teststatus
- 73 kjernetester bestått, 0 feil, 3 hoppet over (før siste små justeringer; kjøres igjen før pakking).
- Full testpakke 75 bestått, 4 feil, 7 hoppet over. De fire feilene skyldes manglende Smart Assistant-pakker og eksternt CBPM-testprosjekt.
- To Chromium-testløp med CBPM rc.27 og simulert IPC/kart/Ollama bestått. Nye maskinvaretester simulerer prosess, miljøvariabler, fallback, API-timing, cache og status. Ingen live Ollama/GPU, Windows/Electron eller Astro/webhotell-test her. Ikke bekreftet at CUDA-feilen på brukerens maskin er løst; Vulkan er verifisert av brukeren i rc.38 ved manuell oppstart.

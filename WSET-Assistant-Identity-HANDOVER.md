# WSET – Assistant Identity & Personality Foundation

Kompatibel modul: Smart Assistant v1.9.10-module.24. Endrer ikke WSET eller CBPM Website i denne leveransen. Kontrakten nedenfor gjelder den nye valgfrie offentlige konfigurasjonen; rc.27 eksporterer den ikke ennå.

## 1. Én modul, flere profiler

`standard` (eksisterende visningsnavn), `alba` (Alba, warm), `luna` (Luna, casual), `clara` (Clara, professional), `custom` (egendefinert). Standard uten ny konfigurasjon er uendret. Forhåndsinnstilte avatarer er monogrammer, ikke portretter. Valgfritt lokalt rasterbilde overstyrer monogrammet. Tonen påvirker velkomst og standardhilsen; kunnskapsmotor, søk, handlinger, API, sikkerhet og andre svar er uendret. Fullstendig kontekstavhengig personlighet er videre utvikling, ikke en funksjon i denne versjonen.

## 2. Kontrakt

Anbefalt prosjektfelt: `site.smartAssistant.identity`, med følgende struktur. Eksporter den som `identity` i eksisterende JSON-script `wset-smart-assistant-config`, sammen med eksisterende felter (name, locale, defaultLocale, welcome, preview, live, endpoint). Behold eksisterende displayName som reserve. Ikke opprett nye API-er, ikke endre modulmanifestets public JS/CSS eller endepunkter.

```json
{
  "schema": "wset-assistant-identity-v1",
  "profile": "alba",
  "name": "Alba",
  "tone": "warm",
  "avatar": "/assets/assistant/alba.webp",
  "accent": "#e9b775",
  "subtitle": { "no": "AI-assistent", "en": "AI assistant", "es": "Asistente de IA" },
  "welcome": { "no": "Hei! Jeg er {name}. Hva kan jeg hjelpe deg med?", "en": "Hi! I’m {name}. How can I help?" },
  "shortcuts": {
    "no": [ { "label": "Se boliger", "message": "Vis boliger nå" }, { "label": "Tjenester", "message": "Hvilke tjenester tilbyr dere?" } ]
  },
  "typing": true,
  "minResponseMs": 850
}
```

Eksempel-URL for avatar er ikke en medfølgende ressurs. Editor må importere og publisere valgt bilde, eller utelate feltet. Alle felter unntatt schema og profile er valgfrie. `name` overstyrer profilens navn. `standard` og `custom` uten navn bruker eksisterende visningsnavn. `tone`: neutral, warm, casual, professional. Navn 70 tegn, undertittel 100, velkomst 500, hurtigvalg label 80/message 200, maksimalt fire per språk. Tekst er ren tekst, ikke HTML. `{name}` erstattes i velkomstmeldingen. `accent` er #RRGGBB for avatar (ikke hele nettstedets fargepalett); automatisk sort/hvit monogramtekst for kontrast. `avatar` må være same-origin root-relativ `/assets/` eller `/uploads/` med png/jpg/jpeg/webp/avif. Ingen query, eksterne URL-er, SVG eller data-URL. Avvis traversal. Ved lastfeil vises monogrammet. `typing`: true som standard. `minResponseMs`: heltall 0–1500, standard 850; false typing setter pause til 0. Pausen er minimum fra start av nettverkskall, ikke et tillegg etter treg respons.

Språk: no/en/es/de/da/fi/fr/nl/pl/sv/ru; nb behandles som no. Lokalisering: aktivt nettstedsspråk → eksplisitt defaultLocale → innebygd profilhilsen eller eksisterende UI-tekst. Manglende shortcuts bruker eksisterende hurtigvalg; eksplisitt [] skjuler dem. Hurtigvalg sender `message` gjennom eksisterende brukerinnsending; label er bare knappetekst. Standardhilsen i samtalen følger samtalespråket; øvrig konfigurert velkomst og hurtigvalg følger sidens språk. Ikke send profil som instruksjoner eller autoritativt felt til API.

## 3. WSET-arbeid som gjenstår

- Bruk nyeste WSET-kilde før implementasjon. I verifisert rc.27 ligger dagens innstillinger i `designer/ui/app.js` under AI-CHAT, og `designer/core/editor-operations.mjs` aksepterer kun enabled/displayName. Utvid validerte editoroperasjoner og prosjektets defaults/migrasjon uten å miste eksisterende navn, språk eller øvrige innstillinger.
- Eksportfunksjonen i rc.27 `designer/engines/cbpm-astro-v1/lib/smart-assistant.mjs` lager eksisterende JSON og escape-er `<`. Legg til validerte `identity` uten å endre sikkerhetsreglene (inkludert `<`-escaping og preview/live/endpoint). Den samme funksjonen finnes også i CBPM-prosjektets motor; undersøk synkronisering i nyeste utgave. Ingen eksport av hemmeligheter.
- UI: velg profil, rediger navn/undertittel/tone/avatar/farge/velkomst/hurtigvalg/timing. Bruk eksisterende medieimport og språkhåndtering, forhåndsvisning, lagring og angre. Ikke endre nettstedets generelle layout. Ikke send skjema eller kalle live API i offline preview. Bruk original modulimport og to ZIP-er ved publisering.
- Migrasjon: ingen identity => eksisterende oppførsel; ukjent schema/profile => legacy fallback. Velg profil først ved aktiv brukerhandling. Ikke hardkod Alba globalt. Ved skifte av profil, bevar samtalekontekst og la lagrede meldinger forbli lesbare; frontend presenterer standardhilsener fra historikken etter nåværende profil.
- Test alle profiler, eget avatarbilde, manglende bilde, språk/fallback, deaktivert assistent, offline preview, publisert modus, eksportfiler og faktiske browser-skjermbilder. Sjekk at alle gamle prosjektinnstillinger og modulens uendrede API fortsatt fungerer. Ikke presentér støtte for full personlighet i fritekst som implementert.

## 4. Leveransestatus

Denne versjonen forbereder mottak og bruk av profilen i Smart Assistant. WSET rc.27 kan importere modulen uten å kjenne det nye feltet, men kan ikke velge preset eller eksportere nye egenskaper før WSET er utvidet. Standardvisningsnavnet kan allerede endres. Avtalte Conversation Context & Language Refinement skyves til neste utviklingsfase; identitetsgrunnlaget prioriteres først etter brukerens ønske.

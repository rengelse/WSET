# WSET Template Contract v1

Status: rc.44 foundation. This is a declarative metadata contract, not a renderer or a template-switch API.

## Descriptor
`project/template.json` (UTF-8 JSON):

```json
{
  "schema": "wset-template-v1",
  "contractVersion": 1,
  "id": "property.mediterranean-premium",
  "name": "Mediterranean Premium",
  "category": "property",
  "subcategory": "property-management",
  "templateVersion": "1.4.4-rc.28",
  "engine": "cbpm-astro-v1"
}
```

- `id`: stable `category.slug` identity, lowercase ASCII; independent of display name and engine. Each slug is 1–64 characters, starting with a letter, followed by letters, numbers or hyphens.
- `name`: nonempty display label, at most 120 characters; no control characters.
- `category`, `subcategory`: same slug rules; categories are open-ended, not an enum.
- `templateVersion`: numeric major.minor.patch with optional prerelease suffix, maximum 80 characters.
- `schema`, `contractVersion`: exact values above. Future versions require explicit compatibility work.
- `engine`: rc.44 supports only `cbpm-astro-v1`. The separate editable-elements contract remains unchanged.

## Storage and compatibility
The descriptor belongs to the editable website source, separate from website.json. Editable project archive format stays at version 1. On export, the descriptor is included as `project/template.json` and duplicated as `template` in `wset-project.json`. Both copies must agree on all contract fields when present. Unknown extension fields are not part of v1 identity; only defined fields are returned by the validator. The sidecar is preserved as a source file when present.

Legacy archives with neither copy infer the Mediterranean Premium identity from the existing supported engine; package.json version is used as an initial template version (0.0.0 if unavailable or invalid). Import persists the inferred descriptor in the new project copy. Opening a legacy directory is read-only with respect to metadata; exporting materializes the descriptor in the ZIP. This legacy inference is appropriate only for the existing Mal 01 family, not a detection mechanism for arbitrary renderers. A manifest-only descriptor is materialized on import. Save As preserves the sidecar when present. Existing source files and website.json are not rewritten by the template migration.

Metadata is not a trust signature. Import does not execute template code. Existing ZIP safety rules remain intact. The runtime explicitly rejects identities other than Mediterranean Premium even if they conform to this schema. No dynamic renderer dispatch, arbitrary engine support, template registry, capabilities, preview images, minimum WSET version negotiation, content mapping or switching are implemented yet. These belong to subsequent increments. Do not use metadata alone to assert rendering compatibility.

The public deployment contract remains unchanged (manual two ZIPs). This file is editable-project metadata, not public site content.

## rc.45 – lokal katalog og valgfrie forhåndsvisningsbilder
Kontraktens identitetsfelter er uendret. Mal-ZIP kan inneholde `project/template-previews/desktop.png` og/eller `project/template-previews/mobile.png`. Maks 2 MiB per bilde, maks 3000 × 3000, PNG-signatur og IHDR kontrolleres. Statiske bilder vises uten å kjøre importert HTML eller JS. Ingen forhåndsvisningsbilder er påkrevd. Bruk ny malversjon når arkivet endres, inkludert bilder. Katalogen aksepterer validerte v1-deskriptorer for andre ID-er med eksisterende prosjektmotor og datamodell, men kun Mediterranean Premium har runtime-støtte i rc.45. Metadata gir ikke i seg selv rendererstøtte. Se RELEASE-rc.45.md.

## rc.46 – renderer runtime
Mal-ID og motor brukes nå til eksakt oppslag i et WSET-eid rendererregister. Malarkivet angir ikke kjørbar kode. Bare Mediterranean Premium er registrert i produksjon; ukjente maler kan fortsatt katalogiseres, men ikke åpnes som prosjekter. Se `RENDERER-CONTRACT-v1.md` for adaptergrensesnitt, sikkerhetsmodell og avgrensning. Arkiv- og metadataformatet er uendret.

### rc.49: Gallery preview assets (optional, backwards compatible)

`project/template-previews/desktop.png`, `tablet.png`, `mobile.png` and `homepage-full.png` are optional raster screenshots of the actual template. Use desktop for the card, full homepage for scrolling, and the matching device image for each device. Existing archives remain valid. Max 2 MiB per image; width up to 3000 px, height up to 16000 px, and 24 megapixels in total per image. Gallery uses a clearly labelled placeholder when a screenshot is missing; it never invents a design image. No additional renderer registration follows from these files. An unsupported template can display its screenshots but cannot start a live preview or create a project. A renderer that supports live preview may show the demo pages using validated staged content without creating a managed project.

### rc.51: Compatibility and content mapping
The existing template descriptor and archive formats are unchanged. WSET now produces a read-only, versioned mapping report against an active project and an exact catalogue ZIP digest. It preserves source model identities and never imports target demo content. See `TEMPLATE-CONTENT-MAPPING-v1.md`. This is not a switching or publication authorization.

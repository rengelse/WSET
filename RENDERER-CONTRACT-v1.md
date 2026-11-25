# WSET Renderer Contract v1 – rc.46

This is the internal trusted renderer interface, separate from the portable, declarative `project/template.json` descriptor. The existing editable-project archive format, template identity schema and two-ZIP deployment contract remain unchanged.

## Selection and security

`designer/core/renderer-runtime.mjs` holds a fixed registry of editor-owned adapters. The exact `(engine, id)` pair in the active project's descriptor selects the adapter. Unknown identities or unsupported contract versions fail explicitly; catalogued templates do not gain execution privileges. A descriptor cannot supply an import path, command, URL or arbitrary function. Project renderer JavaScript is never imported into Electron's Node process by the preview. The existing explicit-trust Astro build process remains separate.

`withTemplateRenderer` establishes operation-local context using AsyncLocalStorage. Electron IPC operations, HTTP preview requests and publication run under that context. Each preview request captures the site, root, module root and descriptor before asynchronous processing. The context also follows cloned project data used in editing, design and language analysis. Direct legacy helper calls without a project context retain the compatibility adapter. Production currently registers only `property.mediterranean-premium`, engine `cbpm-astro-v1`. Future adapters must be explicitly reviewed and registered by WSET development. There is no external renderer installer or signature infrastructure in this release.

## Adapter methods

| Method | Contract |
| --- | --- |
| `renderPage({site,locale,page,annotate})` | Render a full site fragment and return `{html,lang,page,title,description}`. Annotated ordinary sections identify their stable project section IDs. |
| `renderSource({locale,page,data})` | Source page fragment for template text/record binding, using identical layout and source paths. |
| `splitSections(html)` | Return `{before,sections,after}` for direct children of the main element. |
| `sourceSections(page,html)` | Return stable source slot to fragment mapping. |
| `textEntries(fragment)` | Return unique editable source text entries. |
| `renderPropertyPage(site,locale,id,options)` | Return the local property module document. Shared module shell receives `options.renderPage` for the selected template. |

An adapter declares `contractVersion: 1`, `engine`, `id`. Optional data-only `imageSlots` (slot → source → asset key) and `globalImageSlots` (list of asset keys) describe default image bindings. They are exposed as copies via renderer hints; templates cannot inject functions into UI IPC. The legacy adapter lives in `designer/engines/cbpm-astro-v1/renderer.mjs`.

## Shared compatibility requirements

- Existing page graph, `main id="main"`, `data-cbpm-section` preview identifiers, canonical `data-content-ref` field markers and `data-content-id` / `data-team-id` record identifiers remain the v1 markup contract. Stable field markers can be used independently of card classes. Duplicate canonical references are treated as ambiguous for direct text binding.
- Render output must provide the expected fields and a main element. Annotated ordinary sections may not reuse section IDs or return foreign IDs. Editor bridge and text binding markers must not enter publication.
- Existing browser asset entrypoints (`styles.css`, `designer-sections.css`, `site.js`), property runtime and assistant contracts remain fixed in rc.46. Each project owns the bytes of its CSS and browser scripts; those are served by the preview, not imported as Node modules. The same project/engine validation, section types, data model and publication checks remain in force. This is not yet a universal arbitrary-HTML or arbitrary-engine importer.
- Rendered preview, inline source fields, design CSS generation, media usage and language page associations use the selected adapter. Structural checks against actual publication HTML are retained for design/occurrence postprocessing. Publication re-resolves the saved descriptor and rejects a changed identity before executing the build. This is a structural check, not a pixel-equivalence guarantee for all builds.

## Testing a second adapter

`tests/template-renderer-rc46.test.mjs` registers a technical test adapter in a private registry. It changes HTML structure/classes and record element types, and exercises the same editor code. `tests/template-renderer-rc46-browser.py` tests direct text and image selection in Chromium. Neither test adapter is installed in the production registry or catalog. No new commercial design is included.

Content mapping, cross-template compatibility analysis, version-specific adapter selection, switching, rollback and installing independently distributed trusted renderer code remain subsequent work.

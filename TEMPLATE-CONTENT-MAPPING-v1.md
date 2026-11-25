# WSET Template Content Mapping v1 (rc.51)

## Scope and entry point
Open an existing project, then Malbibliotek → Kontroller kompatibilitet. The report includes current in-memory changes (marked as unsaved). It runs in the authorized Electron main process, never from archive code. The target is resolved via the folder library by exact version key and SHA-256 digest. Unknown renderer IDs remain blocked even when their ZIPs are valid. The analysis uses only the WSET-owned renderer registry. The same project and template remain active after the report is closed.

## Report v1
`analyzeTemplateCompatibility({source,target,registry})` returns a JSON-safe report: source/target descriptors, source JSON fingerprint and saved revision, target ZIP digest, dirty flag, `dataPlan`, counts, status and rows (`group`, `id`, `status`, `detail`). `dataPlan.strategy` is `preserve-source`: fields, page/section IDs, slugs, visibility, locale codes, record and media IDs are retained; target demo content never replaces them. These are preservation intentions, not a materialized destination. No target file is installed. `canSwitch` is always false in rc.51.

* `mapped`: exact identity/binding or identical referenced file verified in the relevant test scope.
* `preserve`: keep source data/file as-is; not a promise of complete visual rendering.
* `review`: a decision or additional verification is required (including all publication builds).
* `blocked`: unknown renderer/category migration, failed rendering, missing stored binding, invalid data or missing media.

Page and section checks render a temporary in-memory copy of project data with hidden pages/sections and disabled languages enabled for analysis. Original visibility and routing remain unchanged. The target renderer is used explicitly. Module previews are checked separately. The data model/engine remains cbpm-astro-v1; cross-category mappings are blocked until an explicit migration exists. No fuzzy matching, translation or destructive field conversion.

Legacy template text overrides are checked against exact original text keys. Multiple matches require review; occurrence overrides and individual styles are checked against structural binding IDs. Cross-design matches and individual typography still require confirmation. Missing keys are never discarded. Project-defined data, including unknown top-level fields, is retained in the plan. Global styles remain an explicit choice. File checks cover referenced assets discoverable in the model and renderer media slots, plus registered originals. Equal names with unequal hashes or case are conflicts; preserve the project file. New target-only image references must exist in the target archive. This is not a complete recursive file migration inventory.

## rc.52 integration requirements
Re-run compatibility with current source and exact target archive before any switch. Verify all source files, including unreferenced assets, private XML/own listings and images, local project metadata, backups and module files. Resolve all blockers/reviews explicitly. Construct a separate candidate from validated target source plus preserved project content; do not copy target demo data. Validate the candidate and actual production build/render binding parity. Protect project identity, local server profiles and credentials; never write private data into the public webroot. Only after a user-approved backup and successful validation may atomic activation and rollback be considered. A report from rc.51 is not authorization to modify a project. No imported code may run merely to assess compatibility.

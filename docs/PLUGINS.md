# Plugins

The application is built with plugin extension points in mind, but **no third-party plugins ship in this version** — the architecture, not plugin implementations, is the deliverable. Canvas (below) is the one exception: it shipped as a first-party feature built directly on the same file-based, service-layer pattern a plugin would use.

## What exists today

`backend/app/services/plugin_registry.py` defines:

- A `Plugin` protocol — the interface a future plugin implements (`id`, `name`, `version`, `on_load(ctx)`, `on_unload()`)
- A `PluginContext` dataclass — what a plugin is handed on load (currently a `vault_id` plus `register_command`/`register_panel` hooks; a real implementation would scope filesystem access through `vault_service` rather than open access)
- `PLANNED_PLUGINS` — a static manifest of the plugins Section 34 names as future candidates

The `Plugin` model/table (`backend/app/models.py`) and `GET/POST /api/vaults/{id}/plugins` (see [API.md](API.md#plugins)) let a vault persist an enabled/disabled preference per planned plugin today, and the Settings → Plugins tab exposes that as a toggle list — but toggling one does not load or run any plugin code. It's the seam future work plugs into, wired end-to-end (DB → API → UI) so adding a real plugin later is additive, not a rearchitecture.

## Planned plugins

| Plugin | Purpose |
|---|---|
| Dataview | Query notes/frontmatter like a database |
| Calendar | Calendar view over daily notes |
| Tasks | Aggregate and query checkbox tasks across the vault |
| Kanban | Board view backed by a Markdown note |
| Excalidraw | Hand-drawn style diagrams embedded in notes |
| AI Assistant | Optional AI features — off by default, never a core dependency |
| Git | Version control integration for the vault |
| PDF annotations | Highlight/annotate PDFs stored in the vault, link highlights to notes |
| Web clipper | Browser-extension capture of web pages into the vault |
| Mobile sync / Cloud sync | Sync a vault across devices |

## Canvas

Canvas shipped as a real, first-party feature: `backend/app/services/canvas_service.py` reads/writes `.canvas` files (JSON: `nodes` + `edges`) alongside notes in the vault — same file-based, DB-is-metadata-only pattern as `.md` notes — with routes in `backend/app/routers/canvas.py` and a board UI at `frontend/src/components/Canvas/`. A note card on the board stores a `note_path` reference rather than copying content, so editing the note anywhere updates what the card shows; double-clicking a card opens the real note in the editor. It proves out the pattern a future plugin-provided document type (Kanban, Excalidraw) would follow.

## Future extension points (docs-only, not implemented)

The features below are named explicitly in the product spec as directions to prepare for, with the same instruction repeated for each: build the seam, not the feature. Nothing in this section has runtime code — it exists so a later implementation is additive to the current architecture rather than a rearchitecture. In every case, the guiding constraint carried over from the rest of this app is **local-first, never silent**: no vault content leaves the machine, and no automated system rewrites a note's Markdown, without an explicit user action each time.

### AI / semantic search

Not AI-first — the spec is explicit the core app must work perfectly with zero AI, and nothing here may become a soft dependency for existing features (search, graph, tags all stay purely local-index-driven). If built later, this would be a plugin in the `plugin_registry.py` sense: an opt-in module that reads from `search_service`/`graph_service`/`tag_service` (the existing read APIs) and writes suggestions to a new review surface — never straight to a note file. Candidate features, all opt-in and all requiring an explicit "send this to the AI provider" confirmation before any note content leaves the machine:

- **AI search / natural-language search** — a semantic layer in front of the existing `/search` endpoint, not a replacement for it.
- **Semantic graph edges** — proposed (not auto-created) connections between notes, surfaced as suggestions in a review queue; a user action promotes a suggestion into a real `[[wikilink]]` written into the Markdown.
- **AI link suggestions** — same review-queue pattern; never auto-inserts a link.
- **Knowledge summaries / gap detection** — read-only analysis surfaced in a panel (a natural extension of the existing Knowledge Health dashboard's "recommendations" list), never written back into the note.
- **AI tagging / AI duplicate detection** — the heuristic duplicate detector in `health_service.py` (Jaccard similarity over titles) is the non-AI baseline this would sit next to, not replace; an AI-assisted pass would populate the same `duplicate_candidates` shape so the existing Health UI needs no changes to consume it.

### Web clipper

Scoped as an interface, not a browser extension, since a browser extension isn't practical to ship from this repo. The seam: a vault already accepts a new note via `POST /api/vaults/{id}/notes` with a path and Markdown body, which is exactly what a clipper needs — capture a page, convert to Markdown client-side (e.g. via Readability + Turndown in the extension itself), and POST it in. No new backend endpoint is required to receive a clip; a real implementation would add a dedicated `POST /api/vaults/{id}/clip` only if it needs server-side HTML→Markdown conversion or attachment download that a browser extension can't do itself.

### PDF knowledge

Out of scope for this version — the app stays Markdown-first. The seam for later: `vault_service` already treats non-Markdown files as opaque attachments (see `is_markdown` on tree nodes, used throughout the frontend to distinguish notes from attachments), so a `.pdf` dropped into the vault is already visible in the file tree today. A real implementation would add: a PDF viewer component, a highlight-to-note action that creates a note (or appends to one) containing the highlighted text plus a source reference (`file#page=N`), and an `annotations` sidecar file per PDF (same file-based pattern as `.canvas`) rather than embedding annotation state in the PDF itself.

### Version history / knowledge diff

Out of scope for this version. The constraint that matters most here: whatever versioning scheme is chosen must not break normal filesystem compatibility — a vault is still supposed to be a folder of plain `.md` files a user can open in any other editor, so versioning can't require e.g. a database-only note format. Two directions that satisfy that:

1. **Git-backed** (optional, per-vault) — the vault folder is already just files; `git init`-ing it and committing on save is additive and invisible if the user never asks for history.
2. **App-managed snapshots** — a `.versions/` sidecar directory (or DB-stored diffs, metadata-only) capturing periodic snapshots, in the same spirit as `GraphSnapshot` (`backend/app/models.py`) which already proves out "save a point-in-time JSON blob keyed to a vault" as a pattern.

Either way, "Knowledge Diff" (previous vs. current vs. diff view for an edited note) is a thin UI layer over whichever storage is chosen — a text diff of two Markdown strings — and doesn't need its own backend model beyond picking the two versions to compare.

## Building a real plugin (future work)

A real implementation would need, at minimum:

1. A loader that discovers and imports plugin code (Python entry points on the backend, dynamic `import()` on the frontend) — not present yet.
2. Sandboxing/permission scoping so a plugin can't read/write outside its declared vault, or outside declared API surface — `PluginContext` is the seam for this but isn't enforced yet.
3. Frontend extension points (a command registry, a panel registry) beyond the stubs in `PluginContext`.
4. A plugin manifest format (id, version, permissions requested) — `PLANNED_PLUGINS` is the shape a real manifest would grow from.

None of this blocks core usage — the app is fully functional with zero plugins, matching the priority order the spec sets ("Notes + Links + Backlinks + Graph" first, plugins later).

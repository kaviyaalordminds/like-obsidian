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

## AI Agent

Also shipped as a real, first-party feature — not a plugin, and not a future extension point. A working, tool-using AI agent (Anthropic-backed) lives at `backend/app/services/ai/` behind the strict layering documented in [ARCHITECTURE.md](ARCHITECTURE.md#ai-agent-architecture): `Agent -> Tool Layer -> Knowledge Service -> Vault Service -> files`, with every write tool requiring explicit user confirmation (destructive tools always, regardless of settings) and a durable, local audit log of everything it's done. See [API.md](API.md#ai-agent) for the endpoint surface.

The core app is unaffected by its presence: every existing feature (search, graph, tags, backlinks, health) is purely local-index-driven with zero AI involvement, and the AI panel shows a plain "not configured" state with no degraded behavior anywhere else when no API key is set. This is the "local-first, AI optional" requirement satisfied structurally — the AI code path is additive, not load-bearing.

## Future extension points (docs-only, not implemented)

The features below are named explicitly in the product spec as directions to prepare for, with the same instruction repeated for each: build the seam, not the feature. Nothing in this section has runtime code — it exists so a later implementation is additive to the current architecture rather than a rearchitecture. In every case, the guiding constraint carried over from the rest of this app is **local-first, never silent**: no vault content leaves the machine, and no automated system rewrites a note's Markdown, without an explicit user action each time.

### AI knowledge intelligence — what's shipped vs. still future

The AI Agent itself (chat, tool use, confirmation-gated writes) is real and shipped — see [AI Agent](#ai-agent) above, not a future extension point. So are two of the "AI-flavored" features the spec names, built as **non-AI heuristics** deliberately: zero network cost, work fully offline, and an AI-assisted pass could sit behind the same shape later without changing the frontend.

- **Link/tag suggestions** — shipped: `suggestion_service.py` matches a note's own text against existing note titles and vault tags (word-boundary matching, not embeddings), surfaced as Accept/Ignore rows in the Backlinks panel. Never auto-inserts a link or tag.
- **Duplicate detection** — shipped (pre-existing this build): `health_service.duplicate_candidates()`, Jaccard similarity over title words, with Compare (side-by-side content) and Ignore (client-side dismiss) actions in the Health dashboard. Never auto-merges or auto-deletes.
- **Knowledge gap / topic exploration** — available today through AI Agent chat and quick-prompts ("Find knowledge gaps", "Explore this vault's main topics"), grounded in real tool calls (graph stats, orphans, broken links) rather than invented — but not yet a standing, automatically-refreshed panel the way the Health dashboard's recommendations list is.

Genuinely not built, and the actual future work here — a semantic (embeddings/vector) layer, as opposed to the AI Agent's tool-calling reasoning over structured data it already has:

- **Semantic search** — a vector-similarity layer in front of the existing `/search` endpoint, not a replacement for it (`search_service.py` stays the local-index-driven baseline).
- **Semantic graph edges** — proposed (not auto-created) connections between notes based on content similarity rather than an explicit `[[wikilink]]` or shared tag/folder (the two *structural* relation-edge kinds already shipped — see [GRAPH.md](GRAPH.md#relation-edges-opt-in-layered-on-top-of-the-wikilink-graph)); a user action would promote a suggestion into a real link written into the Markdown, same review-queue pattern as link suggestions today.
- **Embeddings / RAG** — no vector store, no embedding model call anywhere in this codebase. `AIProvider.capabilities` (`ai/provider.py`) already has an `embeddings` flag for exactly this, unset by every provider today.

### Obsidian Local REST API full sync (Mode B)

The connector itself is real and shipped (`obsidian_rest_client.py` — status/auth, list/get/create-or-update/append/delete, mock-tested against the plugin's documented request/response shapes; `routers/obsidian_rest.py` — per-vault config + a real `POST .../test`). What's docs-only is wiring it into full two-way *note* sync as an alternative to Mode A (connecting a vault folder directly, which is the fully-supported path today — see [VAULT.md](VAULT.md#connecting-an-existing-folder-mode-a)). The seam: a Mode B vault would need a parallel `vault_service`-equivalent that reads/writes through `ObsidianRestClient` instead of `pathlib`, since there's no local filesystem to read when Obsidian itself is the only thing with the vault open — `index_service.py`, `graph_service.py`, and everything downstream of them would need an HTTP-backed variant rather than the file-backed one they use today. Not attempted here because it's a second, parallel implementation of most of the backend's read path, not an additive seam.

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

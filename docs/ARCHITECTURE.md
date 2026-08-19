# Architecture

## Guiding rule: Markdown is the source of truth

Every derived view — the file tree, the graph, backlinks, search results, tags — is computed by parsing the actual `.md` files on disk. Nothing that can be reliably derived from Markdown is duplicated into the database. If the database and the filesystem ever disagreed, the filesystem wins, because the database simply doesn't hold that data to disagree with.

The database (SQLite by default; point `DATABASE_URL` at Postgres for production) holds only:

- `vaults` — name, slug, on-disk folder mapping
- `vault_settings` — appearance/editor/graph/daily-notes/visual-effects preferences, as JSON
- `templates` — template name → path pointer (the template content itself is a `.md` file)
- `activities` — a lightweight audit trail of create/rename/move/delete/save operations, and the source data for the Activity/Timeline page
- `plugins` — per-vault enabled/disabled flags for the plugin registry
- `collections` — saved dynamic filter queries (a name + a `NoteFilter` JSON blob); re-evaluated against the live index every time the collection is opened, so results are never stale
- `graph_snapshots` — a named, restorable point-in-time capture of graph state (filters + zoom + selection + layout + mode) as JSON

Canvas boards (`.canvas` files) are deliberately **not** a database table — like notes, a canvas is a file in the vault (see [PLUGINS.md](PLUGINS.md#canvas)), keeping the "filesystem is the source of truth" rule intact for anything that qualifies as vault content rather than app preference/metadata.

See [`backend/app/models.py`](../backend/app/models.py).

## Backend layers

```
routers/        FastAPI endpoints — thin, HTTP-shaped wrappers
services/        all real logic lives here, framework-agnostic
  markdown_parser.py    frontmatter / wikilinks / tags / headings — pure parsing, no I/O
  vault_service.py      safe filesystem CRUD (read/write/rename/move/delete/tree)
  index_service.py      in-memory cache of parsed notes per vault, incrementally refreshed
  graph_service.py      derives nodes/edges/backlinks from the index
  search_service.py     derives search results/tag listings from the index
  rename_service.py     plans + applies link rewrites when a note is renamed/moved
  watcher_service.py    watchdog-based external-edit detection, feeds index_service
  template_service.py   {{date}}/{{time}}/{{title}} placeholder rendering
  daily_notes_service.py
  import_export_service.py   zip import (zip-slip guarded) / export
  plugin_registry.py    the plugin interface + static roadmap manifest
  graph_metrics_service.py   degree/stats/cluster/shortest-path computation over a built graph
  health_service.py     broken links, orphans, duplicate-title candidates (Jaccard similarity)
  tag_service.py        tag rename/merge/delete (rewrites Markdown), related-tags co-occurrence
  filter_service.py     the combinable multi-filter engine behind Graph filters and Collections
  canvas_service.py     read/write/create/delete `.canvas` files (same file-based pattern as notes)
security.py       safe_join() — the one function every filesystem path passes through
```

Every one of these new services is a pure function of the same `IndexService` the original graph/search/backlinks services read from — none introduce a second source of truth, and none cache anything beyond what `IndexService` already caches. `GET /graph/stats`, `/graph/clusters`, `/health`, `/orphans`, `/broken-links`, `/duplicates` are all computed fresh on every request for that reason: the spec's "never hardcoded, never fake" requirement for graph/health numbers is satisfied structurally, not by a rule someone has to remember to follow.

### Why an IndexService per vault?

Re-walking and re-parsing the whole vault on every request doesn't scale to the "1,000–10,000+ notes" requirement. Each vault gets one `IndexService` (keyed by resolved root path, see `index_service.get_index()`) holding `{path: (mtime, ParsedNote)}`. `refresh()` only re-parses files whose mtime changed; `refresh_path()` updates a single file in place without walking the tree at all. Routers call `refresh_path()` after every write so the index reflects app-driven changes immediately, and `watcher_service` calls the same method when it detects an *external* edit — so both paths converge on one incremental-update primitive.

### The rename race, and why link-rewriting is a two-phase plan/apply

Renaming a note asks "which other notes link to this one?" — a question the `IndexService` answers by looking up the old path as a key. But `watcher_service` is *also* watching the filesystem, and the moment the physical rename hits disk, it fires an async callback that calls `refresh_path()` for the old (now-missing) path, popping it out of the index. If link-rewriting resolved "who references this note" *after* performing the rename, it would race that background thread — sometimes losing, silently skipping the rewrite.

`rename_service.py` avoids the race by splitting into `plan_link_updates()` (reads the index — synchronously, before anything touches disk) and `apply_link_updates()` (does the actual text rewriting, after the rename). Routers always call plan before rename and apply after. See the module docstring and `tests/test_rename_cascade.py` for the concrete failure this avoids.

## Frontend layers

```
store/          Zustand stores — one responsibility each
  vaultStore        known vaults, current vault, file tree
  noteStore         per-path {content, dirty, saveStatus}, debounced autosave
  workspaceStore     tabs, panes (split editor), navigation history
  uiStore           sidebar/modal visibility, editor mode, mainView, focus/zen mode
  settingsStore     theme/editor/graph/daily-notes/visual-effects prefs, localStorage + per-vault sync
  graphStore        graph mode, filters, selection, pin/hide sets, exploration history, open panel
api/client.ts    typed fetch wrapper, one function per endpoint
lib/             pure functions: wikilink transform, tree flatten/resolve, debounce, graph metrics, graph export, ...
components/       organized by feature (Editor, FileExplorer, Graph, Search, Sidebar, Canvas, Health, Tags, Collections, Activity, ...)
```

`mainView` in `uiStore` is what the top navigation (Vault/Notes/Graph/Canvas/Tags/Collections/Activity/Knowledge Health) switches between; each non-editor view (`GlobalGraphPage`, `CanvasPage`, `HealthDashboard`, `TagIntelligencePage`, `CollectionsPage`, `ActivityPage`) is `React.lazy`-loaded from `AppShell.tsx` the same way `GraphView` already was, so the initial bundle only pays for whichever view is opened first.

Note content flows: `NotePane` reads/writes `noteStore`, which debounces `PUT /notes/{path}` calls and exposes a `saving | saved | error` status the UI renders directly — see [docs/DEVELOPMENT.md](DEVELOPMENT.md) for the autosave contract.

### Wikilink rendering

`react-markdown`'s built-in link-URL sanitizer silently strips any `href` scheme it doesn't recognize (a legitimate XSS defense) — which meant a naive `wikilink://Target` href vanished before it ever reached the DOM. The fix (`MarkdownPreview.tsx`) is a `urlTransform` that allowlists the `wikilink://` scheme specifically and defers to `defaultUrlTransform` for everything else, so real links (`http://...`) still get sanitized normally. See `lib/wikilink.ts` for the encode/decode pair and `lib/tree.ts#resolveLinkTarget` for the same shortest-path resolution algorithm as the backend's `IndexService.resolve_link`, reimplemented client-side so preview rendering doesn't round-trip to the server per link.

## Request flow example: opening a note

1. User clicks a file in `FileExplorer` → `workspaceStore.openNote(path)`
2. `NotePane` mounts for that path → `noteStore.loadNote(vaultId, path)` → `GET /api/vaults/{id}/notes/{path}`
3. Backend: `vault_service.read_note()` (safe_join-guarded) → `markdown_parser.parse_note()` → response includes `content`, `frontmatter`, `tags`, `headings`, `links`
4. Editing calls `noteStore.updateContent()` → debounced `PUT` → backend `write_note()` + `index.refresh_path()`
5. `RightSidebar` → `BacklinksPanel` independently calls `GET /backlinks/{path}`, which is `graph_service.backlinks_for()` scanning the same index

No step here touches the database — it's pure filesystem + in-memory index end to end.

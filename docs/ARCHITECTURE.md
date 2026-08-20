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
- `ai_config` — per-vault AI provider settings (provider, model, API key, auto-approve-safe flag); the API key never round-trips back to a client once set
- `ai_actions` — the durable audit log of every tool call the AI agent has made or proposed, independent of the in-memory chat transcript
- `obsidian_connections` — per-vault Obsidian Local REST API connector settings (host/port/API key/TLS), same never-round-trips-the-key rule as `ai_config`

`vaults.external_path` is the one column that changes what "the vault's folder" *means*: when set, `deps.vault_root()` resolves to that path directly instead of `VAULTS_ROOT/slug` — see [VAULT.md](VAULT.md#connecting-an-existing-folder-mode-a) for connecting an existing (e.g. Obsidian) vault folder in place.

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
  suggestion_service.py heuristic (non-AI) link/tag suggestions — matches a note's own text against
                         existing note titles and vault tags; zero network cost, works fully offline
  event_bus.py           process-local pub/sub behind the real-time event stream (below)
  obsidian_rest_client.py   HTTP client for the Obsidian Local REST API plugin (Mode B, below)
  knowledge_service.py   the ONLY gateway the AI Tool Layer is allowed to call — wraps vault_service
                          with the exact same safe operations the HTTP routers use, nothing wider
  ai/                    the AI Agent — see "AI Agent architecture" below
    provider.py            AIProvider abstract base + capability flags
    anthropic_provider.py  the one real provider implementation (Anthropic, streaming)
    mock_provider.py       scripted provider used by every backend AI test — no network in tests
    tools.py                the ~30-tool registry the agent is allowed to call
    context.py              context selection + preview (note/word counts before a big request)
    agent_service.py        the provider<->tool loop, confirmation gate, conversation state
security.py       safe_join() — the one function every filesystem path passes through
```

Every one of these new services is a pure function of the same `IndexService` the original graph/search/backlinks services read from — none introduce a second source of truth, and none cache anything beyond what `IndexService` already caches. `GET /graph/stats`, `/graph/clusters`, `/health`, `/orphans`, `/broken-links`, `/duplicates` are all computed fresh on every request for that reason: the spec's "never hardcoded, never fake" requirement for graph/health numbers is satisfied structurally, not by a rule someone has to remember to follow.

### Why an IndexService per vault?

Re-walking and re-parsing the whole vault on every request doesn't scale to the "1,000–10,000+ notes" requirement. Each vault gets one `IndexService` (keyed by resolved root path, see `index_service.get_index()`) holding `{path: (mtime, ParsedNote)}`. `refresh()` only re-parses files whose mtime changed; `refresh_path()` updates a single file in place without walking the tree at all. Routers call `refresh_path()` after every write so the index reflects app-driven changes immediately, and `watcher_service` calls the same method when it detects an *external* edit — so both paths converge on one incremental-update primitive.

### The rename race, and why link-rewriting is a two-phase plan/apply

Renaming a note asks "which other notes link to this one?" — a question the `IndexService` answers by looking up the old path as a key. But `watcher_service` is *also* watching the filesystem, and the moment the physical rename hits disk, it fires an async callback that calls `refresh_path()` for the old (now-missing) path, popping it out of the index. If link-rewriting resolved "who references this note" *after* performing the rename, it would race that background thread — sometimes losing, silently skipping the rewrite.

`rename_service.py` avoids the race by splitting into `plan_link_updates()` (reads the index — synchronously, before anything touches disk) and `apply_link_updates()` (does the actual text rewriting, after the rename). Routers always call plan before rename and apply after. See the module docstring and `tests/test_rename_cascade.py` for the concrete failure this avoids.

## AI Agent architecture

The AI Agent is real (an Anthropic-backed, tool-using agent — not a stub), and it is layered strictly so it can never bypass the same safety rules an HTTP client is bound by:

```
AI Agent (agent_service.py)
  -> AI Tool Layer (ai/tools.py)
       -> Knowledge Service (knowledge_service.py)
            -> Vault Service (vault_service.py)
                 -> Markdown files
```

`ai/tools.py` never imports `vault_service` or `pathlib` directly — every write tool routes through `knowledge_service.py`, which wraps the exact same safe operations (`safe_join`-guarded read/write/rename/move/delete) the HTTP routers use. This means a bug or a bad model output in the AI layer is bounded by the same path-confinement and validation as a malicious HTTP request would be — there's no separate, wider filesystem surface for the AI to reach through.

Each of the ~30 registered tools is classified `read` / `write` / `destructive` (`Tool.safety` in `ai/tools.py`). `agent_service._agent_loop()` auto-executes `read` tools (and `write` tools when the vault's `auto_approve_safe` setting is on); everything else pauses the loop and returns a `pending_confirmation` event, resumed only by a separate `POST .../ai/confirm` request carrying the user's approve/reject decision. `destructive` tools (currently just `delete_note`) always pause regardless of the auto-approve setting. Every tool call — auto-executed or confirmed — is written to the `ai_actions` table (`_log_action()`), so "what did the AI actually do" is always answerable from durable, local history.

Four of the tools (`graph_focus_node`, `graph_set_mode`, `graph_highlight_nodes`, `graph_show_local_graph`) never touch the vault at all — they return a structured `{command: ...}` payload the frontend's Graph Command API (`frontend/src/lib/graphCommands.ts`) applies to the live Cytoscape view, the same shape a UI button's `onClick` would produce. This is how the agent can drive the graph without ever touching the DOM or a Zustand store directly.

Conversation state (the chat transcript) lives in an in-memory registry (`agent_service._conversations`), not the database — deliberately: it's AI *memory*, not vault *knowledge*, so losing an in-progress chat on a backend restart costs nothing about the vault itself. The `ai_actions` table is the durable record; the transcript is not.

`AIProvider` (`ai/provider.py`) is an abstract base with a `ProviderCapabilities` flag set (`chat`/`reasoning`/`tool_calling`/`embeddings`/`summarization`/`classification`/`vision`), so a future local or OpenAI-compatible provider is a new subclass, not a rearchitecture. `AnthropicProvider` is the one real, network-calling implementation; `MockProvider` (scripted, deterministic turns) is what every backend AI test runs against — no test in this repo makes a real network call.

## Real-time events (SSE)

`event_bus.py` is a process-local, thread-safe pub/sub (`queue.Queue`-based, not `asyncio.Queue` — publishers include both FastAPI's sync-route threadpool and the watchdog file-watcher thread). `GET /api/vaults/{id}/events` (`routers/events.py`) is one long-lived Server-Sent-Events connection per open vault; the frontend (`hooks/useVaultEvents.ts`) opens exactly one `EventSource` per vault and reacts to typed events instead of polling anything.

Every note-mutating router call publishes: `NOTE_CREATED`/`UPDATED`/`DELETED`/`RENAMED`/`MOVED`, plus a real link/tag diff (`LINK_CREATED`/`LINK_REMOVED`/`TAG_CHANGED`, computed by comparing parsed links/tags before and after the write — not a generic "something changed"), plus `GRAPH_UPDATED` and `VAULT_CHANGED` alongside every one of them. The AI agent publishes `AI_ACTION_STARTED`/`AI_ACTION_COMPLETED` around each tool execution. On the frontend, these bump small version counters in `store/eventStore.ts` that components add as effect dependencies (the file tree, the graph view, the AI action log, the Backlinks/Suggestions/Related-notes panel) — so a change made in another tab, by the AI agent, or (once Mode A's file watcher is wired into the bus) directly on disk shows up live, without a manual refresh.

`NOTE_UPDATED` additionally drives `noteStore.syncFromExternal()`: if the note isn't open with unsaved local edits, its content is quietly refreshed; if it *is* dirty, this is a real conflict and surfaces the same dialog described below rather than silently dropping the update.

## Conflict detection (optimistic concurrency, never a silent overwrite)

There is no locking and no CRDT — conflict detection is a simple, honest optimistic-concurrency check. Every note the client has read carries a `modified_at` mtime; every autosave (`PUT /notes/{path}`) sends it back as `expected_mtime`. The router compares it against the file's *current* mtime before writing (`routers/notes.py#save_note`): if they differ by more than a small epsilon, the save is rejected with `409` — carrying the real current note in the response body — instead of overwriting whatever changed it (another tab, Obsidian itself via Mode A, a sync client). Omitting `expected_mtime` forces an unconditional overwrite, which is exactly what the conflict dialog's "Keep Current" action does after the user explicitly chooses it.

`noteStore.ts` tracks a `'conflict'` status per note: the debounced autosave stops retrying once conflicted (so it doesn't hammer the same 409 on every keystroke) until the user picks Keep Current, Use External, or Merge (both versions placed in the editor, clearly marked, for manual reconciliation — nothing merges automatically) in the External-Change-Detected dialog (`components/Editor/ConflictDialog.tsx`).

## Obsidian integration

Two independent connection modes, matching the product spec's Mode A / Mode B split:

- **Mode A — connect an existing folder** (fully implemented): `POST /api/vaults/connect` points a `Vault` row at an arbitrary existing directory via `external_path` instead of scaffolding a new one under `VAULTS_ROOT`. Nothing is copied, moved, or scaffolded — `deps.vault_root()` resolves to that folder directly, so every existing router, the AI tool layer, and `safe_join`'s path-confinement guard extend to it automatically, with no special-casing anywhere else. The connect endpoint also reports whether a `.obsidian/` folder is present (informational only) and refuses to connect a path already inside the app's own managed storage or already connected. This is real, live two-way sync in the plainest possible sense: it's the same folder, read and written in place.
- **Mode B — Obsidian's own Local REST API plugin** (real client, mock-tested; not yet wired into full sync): `obsidian_rest_client.py` is a genuine `httpx`-based client (status/auth check, list/get/create-or-update/append/delete against a running Obsidian instance's HTTP API) verified with `httpx.MockTransport` against the plugin's documented request/response shapes, since no live Obsidian instance is reachable in CI or this sandbox. `routers/obsidian_rest.py` exposes per-vault connection config and a real `POST .../test` that exercises the client end-to-end. Wiring this into full two-way note sync (as an alternative to Mode A) is documented, scoped Tier 2 work — see [PLUGINS.md](PLUGINS.md#obsidian-local-rest-api-full-sync-mode-b).

## Frontend layers

```
store/          Zustand stores — one responsibility each
  vaultStore        known vaults, current vault, file tree
  noteStore         per-path {content, dirty, saveStatus}, debounced autosave
  workspaceStore     tabs, panes (split editor), navigation history
  uiStore           sidebar/modal visibility, editor mode, mainView, focus/zen mode
  settingsStore     theme/editor/graph/daily-notes/visual-effects prefs, localStorage + per-vault sync
  graphStore        graph mode, filters, selection, pin/hide sets, exploration history, open panel
  aiStore           AI chat transcript, streaming state, pending confirmation
  eventStore        version counters bumped by useVaultEvents (below) — effect dependencies, not data
api/client.ts    typed fetch wrapper, one function per endpoint
hooks/useVaultEvents.ts   one EventSource per open vault, dispatches SSE events into the stores above
lib/             pure functions: wikilink transform, tree flatten/resolve, debounce, graph metrics, graph export, ...
components/       organized by feature (Editor, FileExplorer, Graph, Search, Sidebar, Canvas, Health, Tags, Collections, Activity, AI, ...)
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

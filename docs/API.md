# API Reference

Base path: `/api`. All endpoints (other than `/vaults` itself) are scoped under `/vaults/{vault_id}/...` — every request operates on exactly one vault, resolved server-side to a safe on-disk root (see [VAULT.md](VAULT.md#path-safety)). This is a deliberate extension of the task brief's flatter example routes (`GET /api/notes/{path}`, etc.) to support the multi-vault create/open/switch requirement (Section 3) without ambiguity about which vault a bare `{path}` belongs to.

Interactive docs (Swagger UI) are available at `/docs` when the backend is running.

## Health

| Method | Path | |
|---|---|---|
| GET | `/api/health` | `{"status": "ok"}` |

## Vaults

| Method | Path | |
|---|---|---|
| GET | `/api/vaults` | List known vaults, most-recently-opened first |
| POST | `/api/vaults` | `{name, icon?}` → create, scaffolding default folders |
| POST | `/api/vaults/connect` | `{path, name?, icon?}` → connect an existing folder in place (e.g. an Obsidian vault) — see [VAULT.md](VAULT.md#connecting-an-existing-folder-mode-a); nothing is copied or scaffolded |
| GET | `/api/vaults/{id}` | Vault details, incl. `external_path` (null for an app-managed vault) and `is_obsidian_vault` (whether a `.obsidian/` folder is present) |
| POST | `/api/vaults/{id}/open` | Marks opened, starts the file watcher, returns the file tree |
| GET | `/api/vaults/{id}/tree` | File tree without side effects |
| DELETE | `/api/vaults/{id}` | Forgets the vault (files untouched) |

## Notes

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/notes/{path}` | Note content + parsed frontmatter/tags/headings/links (each link carries `block` and `embed`, below) |
| POST | `/api/vaults/{id}/notes` | `{path, content?}` → create |
| PUT | `/api/vaults/{id}/notes/{path}` | `{content, expected_mtime?}` → save (used by autosave). If `expected_mtime` is given and no longer matches the file on disk, `409` instead of overwriting — see [ARCHITECTURE.md](ARCHITECTURE.md#conflict-detection-optimistic-concurrency-never-a-silent-overwrite). Omit it to force an overwrite. |
| DELETE | `/api/vaults/{id}/notes/{path}` | Delete |
| POST | `/api/vaults/{id}/notes/{path}/rename` | `{new_name}` → rename in place, rewrites referencing links |
| POST | `/api/vaults/{id}/notes/{path}/move` | `{destination}` → move, rewrites referencing links |
| GET | `/api/vaults/{id}/notes/{path}/suggestions` | Heuristic (non-AI) link/tag suggestions for this note's own text — `{links: [...], tags: [...]}` |

## Files (attachments)

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/files/{path}` | Serves a non-Markdown file (image, PDF, ...) for rendering an embed. Falls back to a basename search anywhere in the vault if the exact path doesn't exist, since `![[image.png]]` embed targets are usually bare filenames. |

## Folders

| Method | Path | |
|---|---|---|
| POST | `/api/vaults/{id}/folders` | `{path}` → create |
| DELETE | `/api/vaults/{id}/folders/{path}` | Delete (recursive) |
| POST | `/api/vaults/{id}/folders/{path}/rename` | `{new_name}` |
| POST | `/api/vaults/{id}/folders/{path}/move` | `{destination}` — cascades link rewriting to every nested note |

## Search & tags

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/search?q=...` | Ranked results with snippets; `q` starting with `#` searches tags |
| GET | `/api/vaults/{id}/tags` | `{tag: count}` |
| GET | `/api/vaults/{id}/tags/{tag}/notes` | Notes carrying a tag (nested tags included) |
| GET | `/api/vaults/{id}/tags/{tag}/related` | Co-occurring tags, ranked by shared-note count |
| POST | `/api/vaults/{id}/tags/{tag}/rename` | `{new_tag}` → rewrites every inline `#tag` and frontmatter occurrence |
| POST | `/api/vaults/{id}/tags/merge` | `{source, target}` → rewrites `source` occurrences to `target` |
| DELETE | `/api/vaults/{id}/tags/{tag}` | Removes the tag from every note that carries it |

## Graph

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/graph` | Global graph. Query: `include_unresolved`, `include_orphans`, `tag` (repeatable), `folder` |
| GET | `/api/vaults/{id}/graph/local/{path}?depth=N` | BFS local graph; `depth` is 1+, or `-1` for "all" |
| GET | `/api/vaults/{id}/backlinks/{path}` | `{backlinks: [...], unlinked_mentions: [...]}` |
| GET | `/api/vaults/{id}/graph/stats` | Live node/edge/cluster/orphan counts, density, most-connected notes |
| GET | `/api/vaults/{id}/graph/clusters` | Computed clusters (`folder` or `connected`-component strategy) |
| POST | `/api/vaults/{id}/graph/path` | `{source, target}` → shortest-path subgraph (nodes + connecting edges); `404` if no path exists |

## Knowledge health

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/health` | Full report: orphan/broken-link/duplicate/empty/large/stale/no-metadata/invalid-properties/missing-attachment counts + recommendations |
| GET | `/api/vaults/{id}/orphans` | Notes with zero incoming or outgoing links |
| GET | `/api/vaults/{id}/broken-links` | Unresolved `[[wikilink]]` targets, with every referencing note (attachment embeds excluded — see missing-attachments below) |
| GET | `/api/vaults/{id}/duplicates` | Candidate duplicate-title pairs, with a similarity score |
| GET | `/api/vaults/{id}/missing-attachments` | `![[embed]]` targets that don't resolve to any file in the vault, with every referencing note |
| GET | `/api/vaults/{id}/invalid-properties` | Notes whose frontmatter block exists but doesn't parse as valid YAML |

## Collections

A collection is a saved `NoteFilter` — re-evaluated against the live index every time it's opened, never a cached result set.

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/collections` | List saved collections |
| POST | `/api/vaults/{id}/collections` | `{name, filter}` → save a `NoteFilter` as a named collection |
| DELETE | `/api/vaults/{id}/collections/{collection_id}` | Delete |
| GET | `/api/vaults/{id}/collections/{collection_id}/notes` | Evaluate a saved collection's filter now, return matching notes |
| POST | `/api/vaults/{id}/collections/preview` | `{filter}` → evaluate a not-yet-saved filter, for a live match count while building the query |

## Graph snapshots

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/graph-snapshots` | List saved graph snapshots |
| POST | `/api/vaults/{id}/graph-snapshots` | `{name, state}` → save filters/zoom/selection/layout/mode as one blob |
| DELETE | `/api/vaults/{id}/graph-snapshots/{snapshot_id}` | Delete |

## Canvas

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/canvas` | List `.canvas` files in the vault |
| POST | `/api/vaults/{id}/canvas` | `{path, name}` → create, seeded with a title text node |
| GET | `/api/vaults/{id}/canvas/{path}` | Read one canvas document (`{nodes, edges}`) |
| PUT | `/api/vaults/{id}/canvas/{path}` | Write a canvas document (debounced autosave from the board UI) |
| DELETE | `/api/vaults/{id}/canvas/{path}` | Delete |

## Activity

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/activity?limit=N` | Recent create/save/delete/rename/move entries, newest first |

## Templates

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/templates` | List |
| POST | `/api/vaults/{id}/templates` | `{name, path, content}` → create (writes the `.md` file too) |
| DELETE | `/api/vaults/{id}/templates/{template_id}` | Delete the registry entry (not the file) |
| POST | `/api/vaults/{id}/templates/{template_id}/apply?title=...` | Renders `{{date}}`/`{{time}}`/`{{title}}` placeholders, returns `{content}` |

## Daily notes

| Method | Path | |
|---|---|---|
| POST | `/api/vaults/{id}/daily-note` | `{folder?, date_format?, template_path?}` → opens or creates today's note, `{path, created}` |

## Settings

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/settings` | `{data: {...}}` — arbitrary JSON blob (theme/editor/graph/daily-notes prefs) |
| PUT | `/api/vaults/{id}/settings` | `{data: {...}}` → shallow-merged into existing settings |

## Plugins

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/plugins` | The static roadmap, with per-vault enabled flags |
| POST | `/api/vaults/{id}/plugins/{plugin_id}/toggle?enabled=bool` | Persist a preference (no plugin code runs — see [PLUGINS.md](PLUGINS.md)) |

## Import / export

| Method | Path | |
|---|---|---|
| POST | `/api/vaults/{id}/import` | multipart `file` (zip) → `{imported_files, count}` |
| GET | `/api/vaults/{id}/export` | Streams a zip of the vault |

## AI Agent

See [ARCHITECTURE.md](ARCHITECTURE.md#ai-agent-architecture) for the layering (`Agent -> Tool Layer -> Knowledge Service -> Vault Service`) and the confirmation flow this API surface implements.

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/ai/config` | `{configured, provider, model, auto_approve_safe}` — `configured` is whether an API key is stored; the key itself never comes back |
| PUT | `/api/vaults/{id}/ai/config` | `{api_key?, provider?, model?, auto_approve_safe?}` → set/update |
| GET | `/api/vaults/{id}/ai/actions?limit=N` | The durable tool-call audit log, newest first |
| POST | `/api/vaults/{id}/ai/context/preview` | `{kind, ...}` (a context selection — note/notes/local_graph/cluster/search_results/folder/vault) → `{note_count, word_count, tags, paths}`, shown to the user before a big request actually sends anything |
| POST | `/api/vaults/{id}/ai/chat` | `{conversation_id, message, context?}` → SSE stream of agent turn events (`text_delta`, `tool_result`, `pending_confirmation`, `error`, `done`) |
| POST | `/api/vaults/{id}/ai/confirm` | `{conversation_id, approved}` → resolves a `pending_confirmation` and resumes the same SSE event stream |

## Real-time events

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/events` | Server-Sent Events, one long-lived connection per open vault. Named events: `NOTE_CREATED`/`UPDATED`/`DELETED`/`RENAMED`/`MOVED`, `LINK_CREATED`/`REMOVED`, `TAG_CHANGED`, `VAULT_CHANGED`, `GRAPH_UPDATED`, `AI_ACTION_STARTED`/`COMPLETED`. Never polled — see [ARCHITECTURE.md](ARCHITECTURE.md#real-time-events-sse). |

## Obsidian Local REST API connector (Mode B)

Config + a real connection test for talking to a *running* Obsidian instance via its Local REST API plugin, as an alternative to connecting a vault folder directly (Mode A, above). See [ARCHITECTURE.md](ARCHITECTURE.md#obsidian-integration).

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/obsidian-rest/config` | `{configured, host, port, use_https, verify_ssl}` — the API key never comes back |
| PUT | `/api/vaults/{id}/obsidian-rest/config` | `{host?, port?, api_key?, use_https?, verify_ssl?}` → set/update |
| POST | `/api/vaults/{id}/obsidian-rest/test` | Makes a real request to the configured Obsidian instance → `{ok, authenticated, service, error}` |

## Errors

Standard FastAPI/Pydantic validation errors (422) plus:

- `400` — path traversal rejected, a rename target containing `/`, or an invalid/already-managed/already-connected path passed to `/vaults/connect`
- `404` — vault/note/folder/template/file not found
- `409` — rename/move destination already exists, or a note save's `expected_mtime` no longer matches the file on disk (the response `detail` carries the current note — see [ARCHITECTURE.md](ARCHITECTURE.md#conflict-detection-optimistic-concurrency-never-a-silent-overwrite))
- `413` — import zip exceeds `MAX_IMPORT_ZIP_BYTES`

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
| GET | `/api/vaults/{id}` | Vault details |
| POST | `/api/vaults/{id}/open` | Marks opened, starts the file watcher, returns the file tree |
| GET | `/api/vaults/{id}/tree` | File tree without side effects |
| DELETE | `/api/vaults/{id}` | Forgets the vault (files untouched) |

## Notes

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/notes/{path}` | Note content + parsed frontmatter/tags/headings/links |
| POST | `/api/vaults/{id}/notes` | `{path, content?}` → create |
| PUT | `/api/vaults/{id}/notes/{path}` | `{content}` → save (used by autosave) |
| DELETE | `/api/vaults/{id}/notes/{path}` | Delete |
| POST | `/api/vaults/{id}/notes/{path}/rename` | `{new_name}` → rename in place, rewrites referencing links |
| POST | `/api/vaults/{id}/notes/{path}/move` | `{destination}` → move, rewrites referencing links |

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

## Graph

| Method | Path | |
|---|---|---|
| GET | `/api/vaults/{id}/graph` | Global graph. Query: `include_unresolved`, `include_orphans`, `tag` (repeatable), `folder` |
| GET | `/api/vaults/{id}/graph/local/{path}?depth=N` | BFS local graph, depth 1–5 |
| GET | `/api/vaults/{id}/backlinks/{path}` | `{backlinks: [...], unlinked_mentions: [...]}` |

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

## Errors

Standard FastAPI/Pydantic validation errors (422) plus:

- `400` — path traversal rejected, or a rename target containing `/`
- `404` — vault/note/folder/template not found
- `409` — rename/move destination already exists
- `413` — import zip exceeds `MAX_IMPORT_ZIP_BYTES`

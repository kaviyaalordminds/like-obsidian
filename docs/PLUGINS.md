# Plugins

The application is built with plugin extension points in mind, but **no plugins ship in this version** — Section 34 of the spec is explicit that the architecture, not the plugin implementations, is the deliverable here.

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
| Canvas | Free-form spatial board for notes and cards (see below) |

## Canvas

Canvas is explicitly out of scope as a primary feature for this version (Section 35), but the architecture doesn't block it: a canvas is fundamentally a note-like artifact (positioned cards referencing notes/images, connections between them) that could be stored as its own file type under the vault and indexed the same way notes are. No canvas-specific code exists yet.

## Building a real plugin (future work)

A real implementation would need, at minimum:

1. A loader that discovers and imports plugin code (Python entry points on the backend, dynamic `import()` on the frontend) — not present yet.
2. Sandboxing/permission scoping so a plugin can't read/write outside its declared vault, or outside declared API surface — `PluginContext` is the seam for this but isn't enforced yet.
3. Frontend extension points (a command registry, a panel registry) beyond the stubs in `PluginContext`.
4. A plugin manifest format (id, version, permissions requested) — `PLANNED_PLUGINS` is the shape a real manifest would grow from.

None of this blocks core usage — the app is fully functional with zero plugins, matching the priority order the spec sets ("Notes + Links + Backlinks + Graph" first, plugins later).

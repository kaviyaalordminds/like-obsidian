# Vault

A vault is a folder of Markdown files and attachments — nothing more. The app never invents structure you don't already have; it scaffolds a starting layout on creation and otherwise mirrors whatever is on disk.

## On-disk layout

Every vault created through the app gets:

```
MyVault/
├── Notes/
├── Daily Notes/
├── Templates/
├── Attachments/
└── Welcome.md
```

These are just conventions, not requirements — folders can be renamed, moved, deleted, or ignored. A vault imported from a zip keeps whatever structure the zip had (see [Import/export](#importexport) below).

## Where vaults live

All vaults live under one root directory, `VAULTS_ROOT` (default `./vaults`, relative to the backend process; override via env var — see [SETUP.md](SETUP.md)). Each known vault is a subfolder named after a slug derived from its display name (`"My Vault"` → `my-vault`), with collisions disambiguated (`my-vault-2`).

The app's database (`vaults` table) is just a lookup: `id → {name, slug, icon, external_path}`. Deleting a vault from the app's list (`DELETE /api/vaults/{id}`) never deletes the folder — it's a "forget," not a "destroy." The folder remains a fully independent, directly-usable Markdown vault; you can re-import it, open it with any other tool, or point another instance of this app at `VAULTS_ROOT` and it reappears as an importable folder.

A vault with `external_path` set (below) doesn't live under `VAULTS_ROOT` at all — `deps.vault_root()` resolves to that path directly instead.

## Connecting an existing folder (Mode A)

`POST /api/vaults/connect` with `{path, name?, icon?}` points a `Vault` row at an arbitrary existing directory instead of scaffolding a new one — the way to work with a vault that already exists, most commonly an existing Obsidian vault. Nothing is copied, moved, or scaffolded: the folder is read and written exactly where it already is, so there is never a second, duplicate copy of anyone's notes, and normal Obsidian usage of the same folder (including a second, simultaneously-running Obsidian instance) keeps working — see [Conflicts](#conflicts-across-editors) below for what happens when both write to the same note near-simultaneously.

The endpoint:

- requires an absolute, existing directory path
- refuses to connect a path already inside the app's own managed `VAULTS_ROOT` (that would just alias an existing or future internal vault under a second, redundant row)
- refuses to connect a path already connected as another vault
- reports `is_obsidian_vault: true` when a `.obsidian/` folder is present — informational only, connecting doesn't require it and behaves the same either way

Once connected, the vault behaves identically to an app-created one in every other respect: same file watcher, same graph/search/health computation, same AI tool access (still confined to that one folder via `safe_join`) — because `vault_root()` is the only place that knows the difference, and every other router calls it the same way regardless.

## Obsidian's own Local REST API (Mode B)

An alternative, not-yet-fully-wired connection path for talking to a *running* Obsidian instance over its Local REST API community plugin's HTTP API, rather than reading its vault folder directly. `backend/app/services/obsidian_rest_client.py` is a real client (status/auth check, list/get/create-or-update/append/delete) verified against the plugin's documented request/response shapes with `httpx.MockTransport`, since no live Obsidian instance is reachable in this environment; `PUT /api/vaults/{id}/obsidian-rest/config` + `POST .../test` (Settings → Obsidian tab) let you configure and verify a real connection today. Wiring this connector into full two-way note sync, as an alternative to Mode A, is documented Tier 2 work — see [PLUGINS.md](PLUGINS.md#obsidian-local-rest-api-full-sync-mode-b).

## Conflicts across editors

Two things can change the same note near-simultaneously once a vault is connected via Mode A: another tab of this app, or Obsidian itself (or any other editor / sync client) writing to the same folder. `PUT /notes/{path}` accepts an `expected_mtime`; if the file's real mtime has since moved on, the save is rejected (`409`, carrying the current on-disk content) instead of silently overwriting it. The editor then shows an External-Change-Detected dialog — Keep Current / Use External / Merge / Cancel — never a silent overwrite either way. See [ARCHITECTURE.md](ARCHITECTURE.md#conflict-detection-optimistic-concurrency-never-a-silent-overwrite).

## Path safety

Every filesystem operation the API performs is scoped to one vault's resolved root directory via `security.safe_join()`. A client sends a vault ID and a *relative* path — never an absolute filesystem path — and `safe_join`:

- strips a leading `/` (so a client-supplied absolute-looking path is treated as vault-relative, not as an escape attempt)
- resolves `..` segments and rejects the request (`400`) if the resolved path lands outside the vault root

This means the API can never be made to read or write outside the selected vault, regardless of what path a client sends. See `backend/tests/test_vault_service.py` for the traversal tests.

## Vault operations

| Action | How |
|---|---|
| Create | `POST /api/vaults` — scaffolds the default folders + `Welcome.md` |
| Connect existing folder | `POST /api/vaults/connect` — see [Connecting an existing folder](#connecting-an-existing-folder-mode-a) below |
| List / switch | `GET /api/vaults`, then `POST /api/vaults/{id}/open` (also starts the file watcher for that vault) |
| Create folder / note | `POST /api/vaults/{id}/folders`, `POST /api/vaults/{id}/notes` |
| Rename / move | `POST .../rename`, `POST .../move` — rewrites every referencing `[[wikilink]]` automatically (see [MARKDOWN.md](MARKDOWN.md#rename-and-move-behavior)) |
| Delete | `DELETE` on the note/folder endpoint |
| Search | `GET /api/vaults/{id}/search?q=...` |

## Import/export

- **Export** (`GET /api/vaults/{id}/export`) zips the vault's files exactly as they are on disk (dotfiles excluded). The result is a standard folder-in-a-zip — usable independently of this app.
- **Import** (`POST /api/vaults/{id}/import`, multipart `file`) extracts a zip into the target vault, preserving its internal structure literally — no "guess and strip a wrapper folder" heuristic, because that guess is inherently ambiguous (a vault can legitimately have a single top-level folder) and would silently break export→import round-trips. If your zip has one top-level folder, that folder appears one level deep in the vault after import; re-`export` and you get back exactly what you imported.
- Extraction is zip-slip guarded: any entry whose path would resolve outside the vault (`../`, absolute paths) is skipped.

See `backend/tests/test_import_export.py` for the round-trip and zip-slip tests.

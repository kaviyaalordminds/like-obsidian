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

The app's database (`vaults` table) is just a lookup: `id → {name, slug, icon}`. Deleting a vault from the app's list (`DELETE /api/vaults/{id}`) never deletes the folder — it's a "forget," not a "destroy." The folder remains a fully independent, directly-usable Markdown vault; you can re-import it, open it with any other tool, or point another instance of this app at `VAULTS_ROOT` and it reappears as an importable folder.

## Path safety

Every filesystem operation the API performs is scoped to one vault's resolved root directory via `security.safe_join()`. A client sends a vault ID and a *relative* path — never an absolute filesystem path — and `safe_join`:

- strips a leading `/` (so a client-supplied absolute-looking path is treated as vault-relative, not as an escape attempt)
- resolves `..` segments and rejects the request (`400`) if the resolved path lands outside the vault root

This means the API can never be made to read or write outside the selected vault, regardless of what path a client sends. See `backend/tests/test_vault_service.py` for the traversal tests.

## Vault operations

| Action | How |
|---|---|
| Create | `POST /api/vaults` — scaffolds the default folders + `Welcome.md` |
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

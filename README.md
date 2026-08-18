# Like-Obsidian

A Markdown-based personal knowledge management and graph visualization app — an independent, original-UI alternative inspired by the core mechanics of Obsidian: **Vault → Markdown → Links → Backlinks → Graph → Knowledge exploration.**

This is **not** an AI assistant. It's a local-first note-taking and graph tool. AI is an optional, disabled-by-default plugin slot for the future (see [docs/PLUGINS.md](docs/PLUGINS.md)), never a core feature.

## Core features

- Markdown notes stored as real `.md` files on disk (the vault is the source of truth — see [docs/VAULT.md](docs/VAULT.md))
- `[[wikilinks]]`, `[[Note|Alias]]`, `[[Folder/Note#Heading]]`, resolved vs. unresolved rendering, click-to-create
- Automatic backlinks and unlinked mentions (nothing to maintain by hand)
- Interactive knowledge graph — global and per-note local graph, both derived live from the vault (see [docs/GRAPH.md](docs/GRAPH.md))
- Full vault search (title/content/tags/folder) and a quick switcher
- CodeMirror-based editor with edit / split / preview modes and a formatting toolbar
- Tags, YAML frontmatter, daily notes, templates
- File explorer with drag-and-drop, rename/move that rewrites referencing links automatically
- Import/export (zip), vault create/open/switch
- Command palette, configurable-looking settings (appearance/editor/graph/daily notes/templates/hotkeys/plugins/vault)
- Dark/light themes, restrained "subtle futuristic" visual style
- A file watcher that picks up edits made outside the app with no restart needed
- Plugin-ready architecture (interface + registry; no plugins ship yet — see [docs/PLUGINS.md](docs/PLUGINS.md))

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS v4, CodeMirror 6, Cytoscape.js, Zustand, Lucide icons
- **Backend:** FastAPI + SQLAlchemy (SQLite by default, Postgres-ready) + Alembic + `watchdog`
- **Source of truth:** the Markdown files on disk. The database only stores app metadata (known vaults, settings, templates, activity log) — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start

See [docs/SETUP.md](docs/SETUP.md) for full instructions. In short:

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8123

# Frontend (separate shell)
cd frontend
npm install
npm run dev
```

Open the printed Vite URL (default `http://localhost:5173`), create a vault, and start writing.

## Documentation

| Doc | Covers |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, source-of-truth rule, request flow |
| [docs/VAULT.md](docs/VAULT.md) | Vault concept, on-disk layout, safety model |
| [docs/MARKDOWN.md](docs/MARKDOWN.md) | Supported Markdown, wikilinks, tags, frontmatter |
| [docs/GRAPH.md](docs/GRAPH.md) | How nodes/edges are derived, local vs. global graph, performance |
| [docs/API.md](docs/API.md) | REST endpoint reference |
| [docs/PLUGINS.md](docs/PLUGINS.md) | Plugin interface and the planned-plugin roadmap |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Project layout, running tests, contributing |
| [docs/SETUP.md](docs/SETUP.md) | Environment variables, first-run setup, troubleshooting |

## Testing

```bash
# Backend: 55 tests covering parsing, links, backlinks, graph, search, tags,
# frontmatter, indexing, the file watcher, import/export, and rename-cascade
cd backend && source .venv/bin/activate && pytest

# Frontend: unit tests for the pure client-side logic (wikilink transform,
# link resolution, graph filtering, debounce, note naming)
cd frontend && npm test
```

Both suites are green; see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for what each covers and how to extend them.

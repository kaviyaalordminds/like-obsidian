# Setup

## Requirements

- Python 3.11+
- Node.js 20+ (tested on 22)
- No external services required for local dev — SQLite is the default database

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head              # applies the initial schema (auto-runs anyway on startup via init_db(), but explicit is fine)
uvicorn app.main:app --reload --port 8123
```

Health check: `curl http://127.0.0.1:8123/api/health` → `{"status":"ok"}`.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VAULTS_ROOT` | `./vaults` | Directory under which all vaults are created |
| `DATABASE_URL` | `sqlite:///./data/app.db` | SQLAlchemy URL. Point at Postgres in production: `postgresql+psycopg://user:pass@host/db` |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed origins |
| `MAX_IMPORT_ZIP_BYTES` | `209715200` (200MB) | Import upload size cap |

### Switching to Postgres

1. `export DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/like_obsidian`
2. `pip install psycopg[binary]` (already in `requirements.txt`)
3. `alembic upgrade head`
4. Start the server as normal — no code changes needed; the schema is Postgres-compatible SQLAlchemy throughout.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173` by default; Vite proxies `/api/*` to `http://127.0.0.1:8123` (see `vite.config.ts`) so the backend must be running on that port for the dev server to work end-to-end. Override the target in `vite.config.ts` if your backend runs elsewhere.

## First run

1. Open the frontend URL — you'll land on a "Create your first vault" screen.
2. Create a vault (name only; the folder is scaffolded automatically under `VAULTS_ROOT`).
3. Create a note (`Ctrl/Cmd+N`, or the file explorer's "new note" button), link to another note with `[[Note Name]]`, and watch the backlink appear on the target note and the graph update.

## Troubleshooting

- **Frontend requests 404/fail:** confirm the backend is actually running on port 8123 and `vite.config.ts`'s proxy target matches.
- **"No space left" / import fails silently:** check `MAX_IMPORT_ZIP_BYTES` and available disk under `VAULTS_ROOT`.
- **Vault list won't stop loading / flicker on the welcome screen:** this was an actual bug during development (an unmount/remount loop between the loading state and the vault-switcher modal causing hundreds of duplicate `GET /api/vaults` calls) — fixed by keeping the modal mounted across loading-state transitions. If you see runaway network activity on that screen after modifying `AppShell.tsx`, check that no modal it owns gets unmounted by a loading-state branch switch.
- **A `[[wikilink]]` renders as plain unstyled text with no click behavior:** almost certainly `react-markdown`'s default URL sanitizer stripping a non-allowlisted scheme — see `MarkdownPreview.tsx`'s `urlTransform` and [ARCHITECTURE.md](ARCHITECTURE.md#wikilink-rendering) if you're modifying that code path.

# Development

## Project layout

```
backend/
  app/
    main.py, config.py, database.py, models.py, schemas.py, security.py, deps.py
    routers/      one module per resource, thin
    services/     all logic — see ARCHITECTURE.md
  tests/           pytest, 55 tests
  alembic/          migrations
frontend/
  src/
    store/         Zustand stores
    api/client.ts   typed fetch wrapper
    lib/            pure logic (has its own vitest suite under lib/__tests__)
    components/     by feature area
docs/               this documentation set
```

## Running the app locally

See [SETUP.md](SETUP.md). tl;dr: `uvicorn app.main:app --reload --port 8123` in `backend/` (with the venv active), `npm run dev` in `frontend/`.

## Tests

### Backend — `cd backend && source .venv/bin/activate && pytest`

55 tests across:

| File | Covers |
|---|---|
| `test_markdown_parser.py` | frontmatter, wikilinks (incl. alias/heading/code-fence exclusion), tags, headings, title fallback (incl. the tag-line-vs-heading regression) |
| `test_vault_service.py` | CRUD, path traversal (both `../` and leading-slash neutralization), tree building (incl. the root-path `""` regression) |
| `test_graph_and_backlinks.py` | resolved/unresolved edges, orphan filtering, local-graph depth, backlinks, unlinked mentions |
| `test_search_and_tags.py` | title/content/tag search, snippets, tag counts, nested tags |
| `test_frontmatter.py` | parse/serialize round-trip, body preservation |
| `test_indexing_and_watcher.py` | incremental refresh (unchanged files skipped), deleted-file cleanup, link resolution priority, the file watcher detecting an external edit |
| `test_rename_cascade.py` | link rewriting on rename: basic, alias-preserving, heading-preserving, folder-qualified-style-preserving, unrelated-links-untouched |
| `test_import_export.py` | export contents, import structure preservation, zip-slip rejection, export→import round-trip |
| `test_api.py` | end-to-end through the FastAPI app: vault scaffolding, note CRUD, path traversal via the API, graph/backlinks reflecting live notes, rename-via-API updating referencing notes, search, daily notes, import/export round-trip |

Run a single file: `pytest tests/test_rename_cascade.py -v`.

### Frontend — `cd frontend && npm test`

23 tests for the pure client-side logic: `lib/wikilink.ts` (transform/scheme detection), `lib/tree.ts` (flatten, link resolution incl. the ambiguous-basename shortest-path tiebreak), `lib/graph.ts` (isolated-node filtering), `lib/debounce.ts`, `lib/noteCreation.ts` (unique-name generation).

Component-level UI is not unit-tested (no React Testing Library suites for e.g. `NotePane`) — that layer was verified through real end-to-end browser testing during development (Playwright, driving the actual running app) rather than jsdom component tests, which is how several real bugs were caught (see below). Extending automated coverage there — golden-path Playwright specs kept in the repo and run in CI — is the natural next step if this becomes a maintained project.

### Also run before committing

```bash
cd backend && source .venv/bin/activate && pytest
cd frontend && npm run lint && npx tsc -b --noEmit && npm test && npm run build
```

## Bugs found during development (and how they were caught)

Worth knowing if you're extending this codebase — these were real, not hypothetical:

1. **Index never picked up new files.** `invalidate_path()` only removed a cache entry; nothing re-populated it, so newly created notes were invisible to search/graph/backlinks until an unrelated full refresh happened. Fixed by replacing it with `refresh_path()`, which re-parses (or drops) exactly one path in place.
2. **Rename-cascade race against the file watcher.** Resolving "who links to this note" *after* performing the rename raced the watcher thread, which invalidates the old path asynchronously the moment the move hits disk. Fixed by splitting into `plan_link_updates()` (before the rename) / `apply_link_updates()` (after). Caught via automated pytest flakiness across parallel test runs, not a single deterministic failure — reproducing it required understanding *why* it was intermittent, not just that it was.
3. **Import zip wrapper-stripping heuristic broke round-trip fidelity.** A "strip the single top-level folder" guess for imported zips is inherently ambiguous with a vault that legitimately has one top-level folder, and export never adds a wrapper — so export→import wasn't idempotent. Fixed by preserving zip structure literally.
4. **`build_tree`'s root node had `path="."` instead of `""`.** `Path.relative_to()` of a path against itself yields `Path('.')`, not empty — inconsistent with every other API that treats `""` as vault-root. The frontend's tree renderer keyed off `path === ''` to flatten the root, so the whole vault rendered as a single nested "root" folder in the file explorer. Caught by actually opening the app in a browser and looking at the file tree, not by any unit test (the bug was in the seam between two layers that individually looked correct).
5. **Infinite request loop on the welcome screen.** `AppShell` showed a full-screen "loading" state whenever `vaultStore.loading` was true, which unmounted the Welcome screen — and the `VaultSwitcherModal` living inside it. Its `useEffect(() => { if (open) loadVaults() }, [open])` re-fired on every remount, which set `loading: true` again, which unmounted it again — hundreds of `GET /api/vaults` calls per second (`ERR_INSUFFICIENT_RESOURCES` in the browser). Fixed by keeping modals mounted at the shell's top level across all loading/empty/loaded branches instead of nesting them inside a conditionally-rendered branch. Caught by watching real network traffic during Playwright-driven testing.
6. **`wikilink://` hrefs silently stripped by `react-markdown`.** Its default URL sanitizer only allowlists a handful of "safe" schemes and blanks the `href` for anything else — every wikilink rendered as a plain non-clickable span with no visible error. Fixed with a custom `urlTransform` that allowlists the internal scheme and defers to the default sanitizer otherwise. Took the longest to isolate: the DOM inspection tools kept showing correct-looking markup until the actual `href` attribute was dumped directly.
7. **Tag-only lines misread as note titles.** The title-fallback heading detector used `line.startswith("#")`, which also matches a tag line like `#AI #Technology` — a note with no real heading got titled `"AI #Technology"`. Fixed by requiring the proper heading pattern (hash(es) + whitespace).

The throughline: several of these were only visible by actually running the full stack and clicking through it, not from types or unit tests in isolation — which is why the phase-by-phase verification in this project always included a real browser pass, not just `pytest`/`tsc` green.

## Conventions

- Backend: services own logic, routers stay thin HTTP adapters; every filesystem path goes through `security.safe_join()`.
- Frontend: one Zustand store per concern (don't reach into another store's internals — call its exported actions); pure logic lives in `lib/` so it's unit-testable without mounting React.
- No comments explaining *what* code does — only *why*, where the reasoning isn't obvious from the code itself (see the repo's existing docstrings/comments for the style).

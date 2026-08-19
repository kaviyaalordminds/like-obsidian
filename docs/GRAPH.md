# Graph

The knowledge graph is never stored — it's recomputed from the parsed vault on every request (`graph_service.py`). Nodes = notes (+ unresolved-link placeholders); edges = resolved wikilinks.

## Data model

```python
GraphNode:
  id: str            # the note's vault-relative path, or "unresolved:<target>"
  path: str | None    # None for unresolved nodes
  title: str
  type: "note" | "unresolved"
  tags: list[str]
  folder: str
  updated_at: float | None   # mtime

GraphEdge:
  source: str
  target: str
  type: "internal-link"
```

Every note in the index becomes a node. For each link in each note, `IndexService.resolve_link()` is tried; a resolved link becomes a `note → note` edge, an unresolved one becomes a `note → unresolved:<target>` edge plus a synthetic unresolved node (so the graph visually distinguishes "links to a real note" from "links to nothing yet," matching the resolved/unresolved wikilink rendering in the editor).

## Global graph

`GET /api/vaults/{id}/graph` — the whole vault. Query params:

| Param | Effect |
|---|---|
| `include_unresolved` | include/exclude unresolved-link placeholder nodes |
| `include_orphans` | include/exclude notes with zero connections |
| `tag` (repeatable) | keep only nodes carrying at least one of the given tags |
| `folder` | keep only nodes under the given folder (recursive) |

The frontend (`GlobalGraphPage.tsx`) additionally does client-side text search/highlighting and an "isolated nodes" toggle without extra requests, since the full node/edge set is already in memory once fetched.

Controls exposed: zoom/pan/drag (native to Cytoscape), search, filter by folder/tag/orphans/unresolved, show/hide arrows and labels, node size and link-distance sliders (force layout parameters), focus-current-note, reset view. Double-clicking a node opens that note; single-click is reserved for graph interaction (drag/select) so it doesn't fight Cytoscape's own click handling.

## Local graph

`GET /api/vaults/{id}/graph/local/{path}?depth=N` (`build_local_graph`) — BFS outward from one note up to `depth` hops, following edges in **both directions** (a note's outgoing links and its backlinks both count as one hop), matching Obsidian's local-graph semantics. `depth=-1` is accepted as shorthand for "all" (mapped server-side to a large sentinel, `ALL_DEPTH`, so the BFS still terminates naturally at the graph's real diameter rather than looping). Rendered in the right sidebar's "Local graph" tab with a depth selector (1/2/3/All).

## Visualization modes

`GlobalGraphPage` renders through a single Cytoscape instance with a swappable stylesheet + layout, so switching modes never loses selection, filters, or pan/zoom state:

| Mode | Layout | Look |
|---|---|---|
| Classic | `cose` (force-directed) | Plain nodes/edges, closest to a conventional graph view |
| Neural | `cose` | Softer glow styling, thinner edges |
| Radial | `concentric`, ranked by BFS distance from the focused/root node | Rings radiating outward by hop distance |
| Cinematic | `cose` | Dark styling with a rotating-ring SVG overlay tracking the selected node's `renderedPosition()`, halo/glow on selection, connected nodes brighten and unrelated nodes dim |

Node size is never hardcoded: `degreeToRadius()` (`frontend/src/lib/graph.ts`) computes each node's on-screen size from its real link + backlink count (`computeDegrees()`), written into Cytoscape as a precomputed `data(size)` field (canvas-rendered stylesheets can't evaluate function-valued mappers reliably across `react-cytoscapejs` prop diffs, so sizing is computed once in JS rather than in the Cytoscape style rules). Dimming (search miss, filtered-out, or de-emphasized-on-selection) is the same pattern: a boolean `dimmed` data field toggled from JS, matched by a `node[?dimmed]` selector.

## Filtering, HUD, minimap, and other panel-level features

- **Filter engine** (`graph_service`/`filter_service` + `GraphFilterPanel.tsx`) — folder, tag, date range, note type, link-count, backlink-count, orphan-only, pinned-only, unresolved-only, daily-notes-only, attachments — all combinable with AND.
- **HUD** (`GraphHUD.tsx`) — node/edge/cluster/orphan counts, density, average connections, and a "most connected" list, all sourced from `GET /api/vaults/{id}/graph/stats` (`graph_metrics_service.compute_stats`) — never hardcoded.
- **Minimap** (`GraphMinimap.tsx`) — a small overview canvas tracking the main viewport's `extent()`/`boundingBox()`, click-to-pan.
- **Clusters** — `GET /api/vaults/{id}/graph/clusters` (`compute_clusters`, folder- or connected-component-strategy).
- **Knowledge Path** — `POST /api/vaults/{id}/graph/path` (`shortest_path`, BFS) finds the shortest chain of links between two notes and returns it as a subgraph (nodes + connecting edges only) for the UI to highlight; `404` if the two notes aren't connected.
- **Snapshots** — `GraphSnapshot` (DB model) saves filters + zoom + selection + layout + mode as one named, restorable JSON blob per vault.
- **Export** — PNG (Cytoscape's native `cy.png()`), JSON (raw node/edge data), and SVG (hand-built from node/edge positions, since Cytoscape has no native SVG export) — see `frontend/src/lib/graphExport.ts`.
- **Scan Network** — a staggered reveal animation over the real current node/edge set (not a canned animation); has a reduced-motion fallback that reveals immediately.
- **Presentation mode** — fullscreen, chrome hidden, for walking through a graph live.

All animation (cinematic rings, scan reveal, selection pulses) is gated by two independent settings — `effects.enabled` (visual effects on/off) and reduced-motion — both under Settings → Visual Effects, and both also respect `prefers-reduced-motion` by default.

## Backlinks

`GET /api/vaults/{id}/backlinks/{path}` returns two lists:

- `backlinks` — every note with a `[[wikilink]]` that resolves to this note, with the raw link text as context
- `unlinked_mentions` — every note whose body contains this note's title as plain text, but without a wikilink (a nudge toward a link you might have missed) — notes already linked are excluded

Both are recomputed from the index on every request; nothing is cached beyond the index itself, so editing a note and revisiting a backlink panel always reflects the current state.

## Performance

At vault sizes in the thousands of notes, rebuilding the entire graph from scratch on every keystroke would be unusable. The design avoids that at two levels:

1. **Incremental indexing** (`IndexService`) — graph/search/backlinks all read from the same in-memory `{path: ParsedNote}` cache, which itself only re-parses files whose mtime changed (`refresh()`) or a single targeted path (`refresh_path()`), never the whole vault, on a normal edit/save/rename. See [ARCHITECTURE.md](ARCHITECTURE.md) for how this interacts with the file watcher.
2. **Lazy-loaded graph UI** — Cytoscape.js is a sizeable dependency most sessions never touch. Both `GlobalGraphPage` and the local-graph sidebar tab are `React.lazy`-loaded, so opening the app doesn't pay that cost until a graph view is actually opened (see the `frontend/vite build` chunk split: `GraphView` is its own ~140KB-gzipped chunk, separate from the ~350KB main bundle).

Graph *construction* itself (`build_graph`) is O(notes + links) per call — no N² work — since resolution is a hash-map lookup, not a scan.

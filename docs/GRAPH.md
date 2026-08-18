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

`GET /api/vaults/{id}/graph/local/{path}?depth=N` (`build_local_graph`) — BFS outward from one note up to `depth` hops (1–5), following edges in **both directions** (a note's outgoing links and its backlinks both count as one hop), matching Obsidian's local-graph semantics. Rendered in the right sidebar's "Local graph" tab with a depth selector (1/2/3).

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

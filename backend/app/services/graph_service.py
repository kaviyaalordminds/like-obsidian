"""Derives the knowledge graph (nodes/edges) purely from parsed Markdown.

Per Section 24/42, no relationship is stored separately — every node and
edge here is recomputed from the IndexService cache, which itself is kept
current by incremental re-parsing (index_service.py) and the file watcher
(watcher_service.py).
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

from app.services.index_service import IndexService


@dataclass
class GraphNode:
    id: str
    path: str | None
    title: str
    type: str  # "note" | "unresolved"
    tags: list[str] = field(default_factory=list)
    folder: str = ""
    created_at: float | None = None
    updated_at: float | None = None
    word_count: int = 0
    status: str | None = None


@dataclass
class GraphEdge:
    source: str
    target: str
    type: str = "internal-link"


@dataclass
class Graph:
    nodes: list[GraphNode]
    edges: list[GraphEdge]


def _folder_of(path: str) -> str:
    parts = path.rsplit("/", 1)
    return parts[0] if len(parts) > 1 else ""


def build_graph(
    index: IndexService,
    *,
    include_unresolved: bool = True,
    include_orphans: bool = True,
    tag_filter: list[str] | None = None,
    folder_filter: str | None = None,
) -> Graph:
    notes = index.all_notes()
    nodes: dict[str, GraphNode] = {}
    edges: list[GraphEdge] = []
    linked_ids: set[str] = set()

    for path, indexed in notes.items():
        parsed = indexed.parsed
        status = parsed.frontmatter.get("status") if isinstance(parsed.frontmatter, dict) else None
        nodes[path] = GraphNode(
            id=path,
            path=path,
            title=parsed.title,
            type="note",
            tags=parsed.tags,
            folder=_folder_of(path),
            created_at=indexed.ctime or None,
            updated_at=indexed.mtime,
            word_count=len(parsed.body.split()),
            status=str(status) if status else None,
        )

    for path, indexed in notes.items():
        for link in indexed.parsed.links:
            resolved = index.resolve_link(link.target, path)
            if resolved:
                edges.append(GraphEdge(source=path, target=resolved))
                linked_ids.add(path)
                linked_ids.add(resolved)
            elif include_unresolved:
                unresolved_id = f"unresolved:{link.target}"
                if unresolved_id not in nodes:
                    nodes[unresolved_id] = GraphNode(
                        id=unresolved_id,
                        path=None,
                        title=link.target,
                        type="unresolved",
                    )
                edges.append(GraphEdge(source=path, target=unresolved_id, type="internal-link"))
                linked_ids.add(path)
                linked_ids.add(unresolved_id)

    result_nodes = list(nodes.values())

    if tag_filter:
        wanted = set(tag_filter)
        result_nodes = [n for n in result_nodes if wanted.intersection(n.tags)]
    if folder_filter:
        result_nodes = [n for n in result_nodes if n.folder == folder_filter or n.folder.startswith(folder_filter + "/")]
    if not include_orphans:
        result_nodes = [n for n in result_nodes if n.id in linked_ids]

    kept_ids = {n.id for n in result_nodes}
    result_edges = [e for e in edges if e.source in kept_ids and e.target in kept_ids]

    return Graph(nodes=result_nodes, edges=result_edges)


def relation_edges(
    graph: Graph,
    kinds: set[str],
    *,
    max_group_size: int = 40,
) -> list[GraphEdge]:
    """Compute extra, opt-in relationship edges layered on top of the base
    wikilink graph (Part 8/PART9): notes sharing a tag ("tag-relation") or
    living in the same folder ("folder-relation"). Groups larger than
    `max_group_size` are skipped — an all-pairs edge set for a 500-note tag
    would be ~125k edges, which helps no one and would choke rendering, so
    those groups are reported as skipped rather than silently truncated."""
    edges: list[GraphEdge] = []
    notes = [n for n in graph.nodes if n.type == "note"]

    if "tag-relation" in kinds:
        by_tag: dict[str, list[str]] = {}
        for n in notes:
            for tag in n.tags:
                by_tag.setdefault(tag, []).append(n.id)
        for members in by_tag.values():
            if len(members) < 2 or len(members) > max_group_size:
                continue
            for i in range(len(members)):
                for j in range(i + 1, len(members)):
                    edges.append(GraphEdge(source=members[i], target=members[j], type="tag-relation"))

    if "folder-relation" in kinds:
        by_folder: dict[str, list[str]] = {}
        for n in notes:
            if n.folder:
                by_folder.setdefault(n.folder, []).append(n.id)
        for members in by_folder.values():
            if len(members) < 2 or len(members) > max_group_size:
                continue
            for i in range(len(members)):
                for j in range(i + 1, len(members)):
                    edges.append(GraphEdge(source=members[i], target=members[j], type="folder-relation"))

    return edges


def build_local_graph(index: IndexService, root_path: str, depth: int = 1) -> Graph:
    """BFS out from `root_path` up to `depth` hops, following links in both
    directions (outgoing links and backlinks) like Obsidian's local graph."""
    full = build_graph(index, include_unresolved=True, include_orphans=True)
    adjacency: dict[str, set[str]] = {n.id: set() for n in full.nodes}
    for e in full.edges:
        adjacency.setdefault(e.source, set()).add(e.target)
        adjacency.setdefault(e.target, set()).add(e.source)

    if root_path not in adjacency:
        return Graph(nodes=[], edges=[])

    visited = {root_path}
    queue = deque([(root_path, 0)])
    while queue:
        node_id, d = queue.popleft()
        if d >= depth:
            continue
        for neighbor in adjacency.get(node_id, ()):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, d + 1))

    node_by_id = {n.id: n for n in full.nodes}
    nodes = [node_by_id[i] for i in visited if i in node_by_id]
    edges = [e for e in full.edges if e.source in visited and e.target in visited]
    return Graph(nodes=nodes, edges=edges)


def backlinks_for(index: IndexService, target_path: str) -> list[dict]:
    notes = index.all_notes()
    results = []
    for path, indexed in notes.items():
        if path == target_path:
            continue
        for link in indexed.parsed.links:
            resolved = index.resolve_link(link.target, path)
            if resolved == target_path:
                results.append(
                    {
                        "path": path,
                        "title": indexed.parsed.title,
                        "context": link.raw,
                    }
                )
                break
    return results


def unlinked_mentions_for(index: IndexService, target_title: str, target_path: str) -> list[dict]:
    """Notes that mention the target's title as plain text without a wikilink
    (Obsidian's "unlinked mentions" section)."""
    notes = index.all_notes()
    needle = target_title.lower()
    results = []
    for path, indexed in notes.items():
        if path == target_path:
            continue
        linked_targets = {index.resolve_link(l.target) for l in indexed.parsed.links}
        if target_path in linked_targets:
            continue
        if needle in indexed.parsed.body.lower():
            results.append({"path": path, "title": indexed.parsed.title})
    return results

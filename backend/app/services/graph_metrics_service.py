"""Derived graph statistics — HUD numbers, node importance, clusters, and
shortest-path lookups (Sections 7, 16, 18, 21). Everything here is computed
fresh from the current Graph object; nothing is cached or hard-coded, so the
HUD can never show stale or fake numbers.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

from app.services.graph_service import Graph, GraphNode


@dataclass
class NodeDegree:
    id: str
    in_degree: int = 0
    out_degree: int = 0

    @property
    def total(self) -> int:
        return self.in_degree + self.out_degree


def compute_degrees(graph: Graph) -> dict[str, NodeDegree]:
    degrees = {n.id: NodeDegree(id=n.id) for n in graph.nodes}
    for e in graph.edges:
        if e.source in degrees:
            degrees[e.source].out_degree += 1
        if e.target in degrees:
            degrees[e.target].in_degree += 1
    return degrees


@dataclass
class GraphStats:
    node_count: int
    edge_count: int
    cluster_count: int
    orphan_count: int
    density: float  # 0..1, edges relative to a fully-connected graph
    avg_connections: float
    most_connected: list[dict] = field(default_factory=list)


def compute_stats(graph: Graph, clusters: list["Cluster"], top_n: int = 5) -> GraphStats:
    n = len(graph.nodes)
    e = len(graph.edges)
    degrees = compute_degrees(graph)
    orphan_count = sum(1 for d in degrees.values() if d.total == 0)
    max_edges = n * (n - 1) / 2 if n > 1 else 1
    density = min(e / max_edges, 1.0) if max_edges else 0.0
    avg_connections = (2 * e / n) if n else 0.0

    ranked = sorted(degrees.values(), key=lambda d: d.total, reverse=True)[:top_n]
    node_by_id = {n.id: n for n in graph.nodes}
    most_connected = [
        {"id": d.id, "title": node_by_id[d.id].title, "connections": d.total}
        for d in ranked
        if d.total > 0 and d.id in node_by_id
    ]

    return GraphStats(
        node_count=n,
        edge_count=e,
        cluster_count=len(clusters),
        orphan_count=orphan_count,
        density=round(density, 4),
        avg_connections=round(avg_connections, 2),
        most_connected=most_connected,
    )


@dataclass
class Cluster:
    id: str
    label: str
    node_ids: list[str]


def compute_clusters(graph: Graph, strategy: str = "folder") -> list[Cluster]:
    """Groups nodes into clusters. "folder" groups by top-level folder (the
    vault's own human-authored organization — not a guess); "connected"
    groups by connected component (nodes reachable from each other via any
    edge, undirected), which surfaces genuinely isolated knowledge islands
    regardless of folder placement."""
    if strategy == "connected":
        return _connected_component_clusters(graph)
    return _folder_clusters(graph)


def _folder_clusters(graph: Graph) -> list[Cluster]:
    groups: dict[str, list[str]] = {}
    for node in graph.nodes:
        key = (node.folder or "").split("/")[0] or "(root)"
        if node.type == "unresolved":
            key = "(unresolved)"
        groups.setdefault(key, []).append(node.id)
    return [
        Cluster(id=f"folder:{label}", label=label, node_ids=ids)
        for label, ids in sorted(groups.items(), key=lambda kv: -len(kv[1]))
    ]


def _connected_component_clusters(graph: Graph) -> list[Cluster]:
    adjacency: dict[str, set[str]] = {n.id: set() for n in graph.nodes}
    for e in graph.edges:
        adjacency.setdefault(e.source, set()).add(e.target)
        adjacency.setdefault(e.target, set()).add(e.source)

    visited: set[str] = set()
    clusters: list[Cluster] = []
    for node in graph.nodes:
        if node.id in visited:
            continue
        component: list[str] = []
        queue = deque([node.id])
        visited.add(node.id)
        while queue:
            current = queue.popleft()
            component.append(current)
            for neighbor in adjacency.get(current, ()):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        node_by_id = {n.id: n for n in graph.nodes}
        label = node_by_id[component[0]].title if len(component) == 1 else f"Cluster ({len(component)} notes)"
        clusters.append(Cluster(id=f"component:{component[0]}", label=label, node_ids=component))

    clusters.sort(key=lambda c: -len(c.node_ids))
    return clusters


def shortest_path(graph: Graph, source_id: str, target_id: str) -> list[GraphNode] | None:
    """BFS shortest path (undirected — a link in either direction counts as
    a connection) between two node ids. Returns None if no path exists."""
    if source_id == target_id:
        node = next((n for n in graph.nodes if n.id == source_id), None)
        return [node] if node else None

    adjacency: dict[str, set[str]] = {n.id: set() for n in graph.nodes}
    for e in graph.edges:
        adjacency.setdefault(e.source, set()).add(e.target)
        adjacency.setdefault(e.target, set()).add(e.source)

    if source_id not in adjacency or target_id not in adjacency:
        return None

    parents: dict[str, str | None] = {source_id: None}
    queue = deque([source_id])
    while queue:
        current = queue.popleft()
        if current == target_id:
            break
        for neighbor in adjacency.get(current, ()):
            if neighbor not in parents:
                parents[neighbor] = current
                queue.append(neighbor)

    if target_id not in parents:
        return None

    path_ids: list[str] = []
    cursor: str | None = target_id
    while cursor is not None:
        path_ids.append(cursor)
        cursor = parents[cursor]
    path_ids.reverse()

    node_by_id = {n.id: n for n in graph.nodes}
    return [node_by_id[i] for i in path_ids if i in node_by_id]

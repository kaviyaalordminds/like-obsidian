from app.services import graph_metrics_service, graph_service
from app.services.index_service import IndexService
from tests.conftest import write


def _index(tmp_vault):
    idx = IndexService(tmp_vault)
    idx.refresh(force=True)
    return idx


def test_compute_degrees_counts_in_and_out(tmp_vault):
    write(tmp_vault, "A.md", "[[B]] [[C]]")
    write(tmp_vault, "B.md", "[[C]]")
    write(tmp_vault, "C.md", "# C")
    idx = _index(tmp_vault)
    graph = graph_service.build_graph(idx, include_unresolved=False)
    degrees = graph_metrics_service.compute_degrees(graph)

    assert degrees["A.md"].out_degree == 2
    assert degrees["A.md"].in_degree == 0
    assert degrees["C.md"].in_degree == 2
    assert degrees["C.md"].out_degree == 0


def test_compute_stats_reflects_real_graph(tmp_vault):
    write(tmp_vault, "A.md", "[[B]]")
    write(tmp_vault, "B.md", "# B")
    write(tmp_vault, "Orphan.md", "lonely")
    idx = _index(tmp_vault)
    graph = graph_service.build_graph(idx, include_unresolved=False, include_orphans=True)
    clusters = graph_metrics_service.compute_clusters(graph)
    stats = graph_metrics_service.compute_stats(graph, clusters)

    assert stats.node_count == 3
    assert stats.edge_count == 1
    assert stats.orphan_count == 1
    assert stats.avg_connections == round(2 * 1 / 3, 2)


def test_folder_clusters_group_by_top_level_folder(tmp_vault):
    write(tmp_vault, "AI/Machine Learning.md", "x")
    write(tmp_vault, "AI/Deep Learning.md", "x")
    write(tmp_vault, "Programming/Python.md", "x")
    idx = _index(tmp_vault)
    graph = graph_service.build_graph(idx, include_unresolved=False, include_orphans=True)
    clusters = graph_metrics_service.compute_clusters(graph, strategy="folder")
    labels = {c.label: set(c.node_ids) for c in clusters}

    assert labels["AI"] == {"AI/Machine Learning.md", "AI/Deep Learning.md"}
    assert labels["Programming"] == {"Programming/Python.md"}


def test_connected_component_clusters_find_islands(tmp_vault):
    write(tmp_vault, "A.md", "[[B]]")
    write(tmp_vault, "B.md", "# B")
    write(tmp_vault, "Island.md", "no links")
    idx = _index(tmp_vault)
    graph = graph_service.build_graph(idx, include_unresolved=False, include_orphans=True)
    clusters = graph_metrics_service.compute_clusters(graph, strategy="connected")

    sizes = sorted(len(c.node_ids) for c in clusters)
    assert sizes == [1, 2]


def test_shortest_path_finds_multi_hop_route(tmp_vault):
    write(tmp_vault, "AI.md", "[[Machine Learning]]")
    write(tmp_vault, "Machine Learning.md", "[[Neural Networks]]")
    write(tmp_vault, "Neural Networks.md", "[[Deep Learning]]")
    write(tmp_vault, "Deep Learning.md", "# DL")
    idx = _index(tmp_vault)
    graph = graph_service.build_graph(idx, include_unresolved=False, include_orphans=True)

    path = graph_metrics_service.shortest_path(graph, "AI.md", "Deep Learning.md")
    assert [n.id for n in path] == ["AI.md", "Machine Learning.md", "Neural Networks.md", "Deep Learning.md"]


def test_shortest_path_returns_none_when_unreachable(tmp_vault):
    write(tmp_vault, "A.md", "no links")
    write(tmp_vault, "B.md", "also no links")
    idx = _index(tmp_vault)
    graph = graph_service.build_graph(idx, include_unresolved=False, include_orphans=True)
    assert graph_metrics_service.shortest_path(graph, "A.md", "B.md") is None


def test_shortest_path_same_node(tmp_vault):
    write(tmp_vault, "A.md", "x")
    idx = _index(tmp_vault)
    graph = graph_service.build_graph(idx, include_unresolved=False, include_orphans=True)
    path = graph_metrics_service.shortest_path(graph, "A.md", "A.md")
    assert [n.id for n in path] == ["A.md"]

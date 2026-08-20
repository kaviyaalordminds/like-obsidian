from app.services import graph_service
from app.services.index_service import IndexService
from tests.conftest import write


def _index(tmp_vault):
    idx = IndexService(tmp_vault)
    idx.refresh(force=True)
    return idx


def test_graph_resolves_links_and_flags_unresolved(tmp_vault):
    write(tmp_vault, "Notes/AI.md", "[[Machine Learning]] and [[Nonexistent]]")
    write(tmp_vault, "Notes/Machine Learning.md", "# ML")
    idx = _index(tmp_vault)
    graph = graph_service.build_graph(idx)

    node_ids = {n.id for n in graph.nodes}
    assert "Notes/AI.md" in node_ids
    assert "Notes/Machine Learning.md" in node_ids
    unresolved = [n for n in graph.nodes if n.type == "unresolved"]
    assert len(unresolved) == 1
    assert unresolved[0].title == "Nonexistent"

    edge_pairs = {(e.source, e.target) for e in graph.edges}
    assert ("Notes/AI.md", "Notes/Machine Learning.md") in edge_pairs


def test_graph_ignores_attachment_embeds_but_links_note_transclusions(tmp_vault):
    write(tmp_vault, "A.md", "![[missing-diagram.png]] and ![[B]]")
    write(tmp_vault, "B.md", "# B")
    idx = _index(tmp_vault)
    graph = graph_service.build_graph(idx)

    unresolved = [n for n in graph.nodes if n.type == "unresolved"]
    assert unresolved == []  # the image embed must not become a fake "unresolved" node

    edge_pairs = {(e.source, e.target) for e in graph.edges}
    assert ("A.md", "B.md") in edge_pairs  # a note transclusion is still a real link


def test_graph_excludes_orphans_when_requested(tmp_vault):
    write(tmp_vault, "Notes/A.md", "[[B]]")
    write(tmp_vault, "Notes/B.md", "# B")
    write(tmp_vault, "Notes/Orphan.md", "no links here")
    idx = _index(tmp_vault)

    with_orphans = graph_service.build_graph(idx, include_orphans=True)
    assert any(n.title == "Orphan" for n in with_orphans.nodes)

    without_orphans = graph_service.build_graph(idx, include_orphans=False)
    assert not any(n.title == "Orphan" for n in without_orphans.nodes)


def test_local_graph_depth_limits_hops(tmp_vault):
    write(tmp_vault, "A.md", "[[B]]")
    write(tmp_vault, "B.md", "[[C]]")
    write(tmp_vault, "C.md", "[[D]]")
    write(tmp_vault, "D.md", "# D")
    idx = _index(tmp_vault)

    depth1 = graph_service.build_local_graph(idx, "A.md", depth=1)
    assert {n.id for n in depth1.nodes} == {"A.md", "B.md"}

    depth2 = graph_service.build_local_graph(idx, "A.md", depth=2)
    assert {n.id for n in depth2.nodes} == {"A.md", "B.md", "C.md"}


def test_backlinks_are_derived_automatically(tmp_vault):
    write(tmp_vault, "AI.md", "# AI")
    write(tmp_vault, "ML.md", "See [[AI]]")
    write(tmp_vault, "NN.md", "Also [[AI]]")
    idx = _index(tmp_vault)

    backlinks = graph_service.backlinks_for(idx, "AI.md")
    paths = {b["path"] for b in backlinks}
    assert paths == {"ML.md", "NN.md"}


def test_backlinks_update_when_note_changes(tmp_vault):
    write(tmp_vault, "AI.md", "# AI")
    write(tmp_vault, "ML.md", "See [[AI]]")
    idx = _index(tmp_vault)
    assert len(graph_service.backlinks_for(idx, "AI.md")) == 1

    write(tmp_vault, "ML.md", "No link anymore")
    idx.refresh_path("ML.md")
    assert len(graph_service.backlinks_for(idx, "AI.md")) == 0


def test_unlinked_mentions(tmp_vault):
    write(tmp_vault, "Artificial Intelligence.md", "# Artificial Intelligence")
    write(tmp_vault, "Other.md", "This mentions Artificial Intelligence without a link.")
    idx = _index(tmp_vault)
    mentions = graph_service.unlinked_mentions_for(idx, "Artificial Intelligence", "Artificial Intelligence.md")
    assert any(m["path"] == "Other.md" for m in mentions)

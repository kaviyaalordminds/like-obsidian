from app.services import canvas_service
from app.services.canvas_service import CanvasDocument, CanvasEdge, CanvasNode


def test_create_and_read_canvas_round_trip(tmp_vault):
    canvas_service.create_canvas(tmp_vault, "Canvas/Map", "My Map")
    doc = canvas_service.read_canvas(tmp_vault, "Canvas/Map.canvas")
    assert len(doc.nodes) == 1
    assert doc.nodes[0].text == "My Map"


def test_write_canvas_persists_note_cards_and_edges(tmp_vault):
    doc = CanvasDocument(
        nodes=[
            CanvasNode(id="n1", type="note", note_path="A.md", x=0, y=0),
            CanvasNode(id="n2", type="note", note_path="B.md", x=300, y=0),
        ],
        edges=[CanvasEdge(id="e1", from_node="n1", to_node="n2", label="relates to")],
    )
    canvas_service.write_canvas(tmp_vault, "Canvas/Map.canvas", doc)

    reloaded = canvas_service.read_canvas(tmp_vault, "Canvas/Map.canvas")
    assert len(reloaded.nodes) == 2
    assert reloaded.nodes[0].note_path == "A.md"
    assert reloaded.edges[0].label == "relates to"


def test_list_canvases_finds_all_canvas_files(tmp_vault):
    canvas_service.create_canvas(tmp_vault, "A", "A")
    canvas_service.create_canvas(tmp_vault, "Sub/B", "B")
    canvases = canvas_service.list_canvases(tmp_vault)
    assert set(canvases) == {"A.canvas", "Sub/B.canvas"}


def test_delete_canvas_removes_file(tmp_vault):
    canvas_service.create_canvas(tmp_vault, "Temp", "Temp")
    canvas_service.delete_canvas(tmp_vault, "Temp.canvas")
    assert canvas_service.list_canvases(tmp_vault) == []


def test_canvas_does_not_duplicate_note_content(tmp_vault):
    """A note-card only stores the referenced note's path, not its body —
    editing the note anywhere must not require touching the canvas file."""
    doc = CanvasDocument(nodes=[CanvasNode(id="n1", type="note", note_path="A.md")], edges=[])
    canvas_service.write_canvas(tmp_vault, "Map.canvas", doc)
    raw = (tmp_vault / "Map.canvas").read_text()
    assert "note_path" in raw
    assert "body" not in raw and "content" not in raw

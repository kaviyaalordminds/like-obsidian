"""Canvas 2.0 (Section 25): a canvas is a `.canvas` JSON file living inside
the vault next to the notes it references — not a database table, and not a
copy of note content. A note-card stores only the referenced note's path;
opening it reads the live note, so editing the note anywhere (canvas or
editor) never desyncs the two.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

from fastapi import HTTPException

from app.security import safe_join
from app.services import vault_service

CANVAS_SUFFIX = ".canvas"


@dataclass
class CanvasNode:
    id: str
    type: str  # "note" | "text" | "group"
    x: float = 0
    y: float = 0
    width: float = 240
    height: float = 120
    note_path: str | None = None  # for type == "note"
    text: str | None = None  # for type == "text" / "group" label
    color: str | None = None


@dataclass
class CanvasEdge:
    id: str
    from_node: str
    to_node: str
    label: str | None = None


@dataclass
class CanvasDocument:
    nodes: list[CanvasNode] = field(default_factory=list)
    edges: list[CanvasEdge] = field(default_factory=list)


def _to_dict(doc: CanvasDocument) -> dict:
    return {
        "nodes": [asdict(n) for n in doc.nodes],
        "edges": [asdict(e) for e in doc.edges],
    }


def _from_dict(data: dict) -> CanvasDocument:
    nodes = [CanvasNode(**n) for n in data.get("nodes", [])]
    edges = [CanvasEdge(**e) for e in data.get("edges", [])]
    return CanvasDocument(nodes=nodes, edges=edges)


def list_canvases(root: Path) -> list[str]:
    root = root.resolve()
    return sorted(
        str(p.relative_to(root).as_posix())
        for p in root.rglob(f"*{CANVAS_SUFFIX}")
        if not any(part.startswith(".") for part in p.relative_to(root).parts)
    )


def read_canvas(root: Path, rel_path: str) -> CanvasDocument:
    target = safe_join(root, rel_path)
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Canvas not found: {rel_path}")
    try:
        data = json.loads(target.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Canvas file is not valid JSON") from exc
    return _from_dict(data)


def write_canvas(root: Path, rel_path: str, doc: CanvasDocument) -> Path:
    if not rel_path.endswith(CANVAS_SUFFIX):
        rel_path = rel_path + CANVAS_SUFFIX
    target = safe_join(root, rel_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(_to_dict(doc), indent=2), encoding="utf-8")
    return target


def create_canvas(root: Path, rel_path: str, name: str) -> Path:
    doc = CanvasDocument(nodes=[CanvasNode(id="origin", type="text", x=0, y=0, text=name)], edges=[])
    return write_canvas(root, rel_path, doc)


def delete_canvas(root: Path, rel_path: str) -> None:
    vault_service.delete_path(root, rel_path)

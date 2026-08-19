from __future__ import annotations

from pydantic import BaseModel, Field


class VaultCreate(BaseModel):
    name: str
    icon: str = "📓"


class VaultOut(BaseModel):
    id: str
    name: str
    slug: str
    icon: str
    created_at: str
    last_opened_at: str

    model_config = {"from_attributes": True}


class TreeNodeOut(BaseModel):
    name: str
    path: str
    type: str
    is_markdown: bool = False
    modified_at: float | None = None
    size: int | None = None
    children: list["TreeNodeOut"] = Field(default_factory=list)


TreeNodeOut.model_rebuild()


class NoteOut(BaseModel):
    path: str
    title: str
    content: str
    frontmatter: dict
    tags: list[str]
    headings: list[dict]
    links: list[dict]
    modified_at: float | None = None


class NoteWrite(BaseModel):
    content: str


class NoteCreate(BaseModel):
    path: str
    content: str = ""


class RenameRequest(BaseModel):
    new_name: str


class MoveRequest(BaseModel):
    destination: str


class FolderCreate(BaseModel):
    path: str


class GraphNodeOut(BaseModel):
    id: str
    path: str | None
    title: str
    type: str
    tags: list[str]
    folder: str
    created_at: float | None = None
    updated_at: float | None = None
    word_count: int = 0
    status: str | None = None


class GraphEdgeOut(BaseModel):
    source: str
    target: str
    type: str


class GraphOut(BaseModel):
    nodes: list[GraphNodeOut]
    edges: list[GraphEdgeOut]


class SearchResultOut(BaseModel):
    path: str
    title: str
    folder: str
    score: float
    snippets: list[str]
    matched_tags: list[str]


class TemplateCreate(BaseModel):
    name: str
    path: str
    content: str = ""


class DailyNoteRequest(BaseModel):
    folder: str = "Daily Notes"
    date_format: str = "%Y-%m-%d"
    template_path: str | None = None


class ImportResult(BaseModel):
    imported_files: list[str]
    count: int


class SettingsOut(BaseModel):
    data: dict


class SettingsUpdate(BaseModel):
    data: dict


# --- Tags ---


class TagRenameRequest(BaseModel):
    new_tag: str


class TagMergeRequest(BaseModel):
    tags: list[str]
    into: str


# --- Graph metrics / clusters / path ---


class GraphStatsOut(BaseModel):
    node_count: int
    edge_count: int
    cluster_count: int
    orphan_count: int
    density: float
    avg_connections: float
    most_connected: list[dict]


class ClusterOut(BaseModel):
    id: str
    label: str
    node_ids: list[str]


class PathRequest(BaseModel):
    source: str
    target: str


# --- Knowledge health ---


class HealthReportOut(BaseModel):
    orphan_count: int
    broken_link_count: int
    duplicate_count: int
    unused_tag_count: int
    empty_note_count: int
    large_note_count: int
    old_note_count: int
    no_metadata_count: int
    recommendations: list[str]


# --- Collections ---


class CollectionCreate(BaseModel):
    name: str
    filter: dict = Field(default_factory=dict)


class CollectionOut(BaseModel):
    id: str
    name: str
    filter: dict
    created_at: str

    model_config = {"from_attributes": True}


# --- Graph snapshots ---


class SnapshotCreate(BaseModel):
    name: str
    state: dict = Field(default_factory=dict)


class SnapshotOut(BaseModel):
    id: str
    name: str
    state: dict
    created_at: str

    model_config = {"from_attributes": True}


# --- Canvas ---


class CanvasNodeIn(BaseModel):
    id: str
    type: str
    x: float = 0
    y: float = 0
    width: float = 240
    height: float = 120
    note_path: str | None = None
    text: str | None = None
    color: str | None = None


class CanvasEdgeIn(BaseModel):
    id: str
    from_node: str
    to_node: str
    label: str | None = None


class CanvasWrite(BaseModel):
    nodes: list[CanvasNodeIn]
    edges: list[CanvasEdgeIn]


class CanvasCreate(BaseModel):
    path: str
    name: str


# --- Activity ---


class ActivityOut(BaseModel):
    id: str
    note_path: str
    action: str
    detail: str
    created_at: str

    model_config = {"from_attributes": True}

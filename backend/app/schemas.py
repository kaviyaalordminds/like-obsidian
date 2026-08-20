from __future__ import annotations

from pydantic import BaseModel, Field


class VaultCreate(BaseModel):
    name: str
    icon: str = "📓"


class VaultConnect(BaseModel):
    """Connects an existing folder on disk as a vault (Part 56, Mode A) —
    e.g. an existing Obsidian vault. Nothing is copied or moved; the app
    reads and writes the folder in place."""

    path: str
    name: str | None = None
    icon: str = "📁"


class VaultOut(BaseModel):
    id: str
    name: str
    slug: str
    icon: str
    created_at: str
    last_opened_at: str
    external_path: str | None = None
    is_obsidian_vault: bool = False

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
    # The mtime the client last read for this note (Part 56 conflict
    # detection). When set and the file on disk has since changed to a
    # different mtime, the save is rejected with 409 instead of silently
    # overwriting an edit made elsewhere (another tab, Obsidian itself, a
    # sync client). Omit it to force an unconditional overwrite.
    expected_mtime: float | None = None


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


# --- AI Agent ---


class AIConfigIn(BaseModel):
    api_key: str | None = None
    provider: str | None = None
    model: str | None = None
    auto_approve_safe: bool | None = None


class AIConfigOut(BaseModel):
    configured: bool
    provider: str
    model: str
    auto_approve_safe: bool


class AIChatRequest(BaseModel):
    conversation_id: str
    message: str
    context: dict | None = None  # Part 40/41: {kind, paths} — see ai router


class AIConfirmRequest(BaseModel):
    conversation_id: str
    approved: bool


class AIActionOut(BaseModel):
    id: str
    conversation_id: str
    tool_name: str
    tool_input: dict
    safety: str
    status: str
    summary: str
    result: str
    created_at: str

    model_config = {"from_attributes": True}


# --- Obsidian Local REST API connector (Mode B) ---


class ObsidianConnectionIn(BaseModel):
    host: str | None = None
    port: int | None = None
    api_key: str | None = None
    use_https: bool | None = None
    verify_ssl: bool | None = None


class ObsidianConnectionOut(BaseModel):
    configured: bool
    host: str
    port: int
    use_https: bool
    verify_ssl: bool


class ObsidianTestResult(BaseModel):
    ok: bool
    authenticated: bool = False
    service: str = ""
    error: str | None = None

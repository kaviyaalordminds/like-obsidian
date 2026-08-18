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
    updated_at: float | None = None


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

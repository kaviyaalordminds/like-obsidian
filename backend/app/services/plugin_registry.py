"""Plugin-ready architecture (Section 34).

Defines the interface a future plugin implements and a static manifest of
planned-but-not-yet-built plugins. Real plugin loading (dynamic import,
sandboxing, frontend extension points) is intentionally out of scope for
this version — this module is the seam future work plugs into.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


class Plugin(Protocol):
    """Interface every plugin must implement."""

    id: str
    name: str
    version: str

    def on_load(self, ctx: "PluginContext") -> None: ...
    def on_unload(self) -> None: ...


@dataclass
class PluginContext:
    """What a plugin is handed on load: read-only vault access plus hooks to
    register commands/panels. A real implementation would expose scoped
    vault_service calls here instead of open filesystem access."""

    vault_id: str
    register_command: callable
    register_panel: callable


PLANNED_PLUGINS = [
    {"id": "dataview", "name": "Dataview", "description": "Query notes/frontmatter like a database."},
    {"id": "calendar", "name": "Calendar", "description": "Calendar view over daily notes."},
    {"id": "tasks", "name": "Tasks", "description": "Aggregate and query checkbox tasks across the vault."},
    {"id": "kanban", "name": "Kanban", "description": "Board view backed by a Markdown note."},
    {"id": "excalidraw", "name": "Excalidraw", "description": "Hand-drawn style diagrams embedded in notes."},
    {"id": "ai", "name": "AI Assistant", "description": "Optional AI features, off by default."},
    {"id": "git", "name": "Git", "description": "Version control integration for the vault."},
    {"id": "canvas", "name": "Canvas", "description": "Free-form spatial board for notes and cards."},
]

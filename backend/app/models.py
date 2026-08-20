from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Vault(Base):
    """Application-level record of a known vault. The vault's actual content
    lives entirely on disk under `path`; this row only tracks where it is."""

    __tablename__ = "vaults"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    icon: Mapped[str] = mapped_column(String(16), default="📓")
    # Set only for a vault connected from an existing folder on disk (Part
    # 56, Mode A) — e.g. an existing Obsidian vault. When null, the vault's
    # files live under the app's own managed VAULTS_ROOT/slug instead. Either
    # way `vault_root()` is the one place that resolves it, so nothing else
    # needs to know which kind a given vault is.
    external_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    settings: Mapped["VaultSettings"] = relationship(
        back_populates="vault", uselist=False, cascade="all, delete-orphan"
    )
    templates: Mapped[list["Template"]] = relationship(
        back_populates="vault", cascade="all, delete-orphan"
    )
    activities: Mapped[list["Activity"]] = relationship(
        back_populates="vault", cascade="all, delete-orphan"
    )
    plugins: Mapped[list["Plugin"]] = relationship(
        back_populates="vault", cascade="all, delete-orphan"
    )
    collections: Mapped[list["Collection"]] = relationship(
        back_populates="vault", cascade="all, delete-orphan"
    )
    graph_snapshots: Mapped[list["GraphSnapshot"]] = relationship(
        back_populates="vault", cascade="all, delete-orphan"
    )
    ai_config: Mapped["AIConfig"] = relationship(
        back_populates="vault", uselist=False, cascade="all, delete-orphan"
    )
    ai_actions: Mapped[list["AIAction"]] = relationship(
        back_populates="vault", cascade="all, delete-orphan"
    )
    obsidian_connection: Mapped["ObsidianConnection"] = relationship(
        back_populates="vault", uselist=False, cascade="all, delete-orphan"
    )


class VaultSettings(Base):
    """Per-vault settings: appearance, editor, graph, daily-notes, hotkeys..."""

    __tablename__ = "vault_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    vault_id: Mapped[str] = mapped_column(ForeignKey("vaults.id"), unique=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)

    vault: Mapped[Vault] = relationship(back_populates="settings")


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    vault_id: Mapped[str] = mapped_column(ForeignKey("vaults.id"))
    name: Mapped[str] = mapped_column(String(255))
    path: Mapped[str] = mapped_column(String(1024))  # relative path inside vault
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    vault: Mapped[Vault] = relationship(back_populates="templates")


class Activity(Base):
    """Lightweight audit trail of file operations, useful for undo/history UI."""

    __tablename__ = "activities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    vault_id: Mapped[str] = mapped_column(ForeignKey("vaults.id"))
    note_path: Mapped[str] = mapped_column(String(1024))
    action: Mapped[str] = mapped_column(String(32))  # create|rename|move|delete|save
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    vault: Mapped[Vault] = relationship(back_populates="activities")


class Plugin(Base):
    """Registry row for the plugin-ready architecture (Section 34)."""

    __tablename__ = "plugins"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    vault_id: Mapped[str] = mapped_column(ForeignKey("vaults.id"))
    plugin_id: Mapped[str] = mapped_column(String(128))  # e.g. "dataview"
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    config: Mapped[dict] = mapped_column(JSON, default=dict)

    vault: Mapped[Vault] = relationship(back_populates="plugins")


class Collection(Base):
    """A saved query/filter (Section 37) — dynamically re-evaluated against
    the live index on every read, never a stored list of note paths."""

    __tablename__ = "collections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    vault_id: Mapped[str] = mapped_column(ForeignKey("vaults.id"))
    name: Mapped[str] = mapped_column(String(255))
    filter: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    vault: Mapped[Vault] = relationship(back_populates="collections")


class GraphSnapshot(Base):
    """A saved graph exploration view (Section 20): filters, zoom, selection,
    layout and visualization mode. Reopening one re-runs the same query
    against the live graph rather than replaying stored positions verbatim,
    so it never goes stale relative to the vault."""

    __tablename__ = "graph_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    vault_id: Mapped[str] = mapped_column(ForeignKey("vaults.id"))
    name: Mapped[str] = mapped_column(String(255))
    state: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    vault: Mapped[Vault] = relationship(back_populates="graph_snapshots")


class AIConfig(Base):
    """Per-vault AI provider configuration. `api_key` is stored server-side
    only — every response schema that returns this row omits it, so the key
    never round-trips back to the client after it's set (Part 40/57: the AI
    layer is opt-in and its credentials stay local, never exposed further
    than they need to be)."""

    __tablename__ = "ai_config"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    vault_id: Mapped[str] = mapped_column(ForeignKey("vaults.id"), unique=True)
    provider: Mapped[str] = mapped_column(String(32), default="anthropic")
    api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str] = mapped_column(String(64), default="claude-opus-5")
    auto_approve_safe: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    vault: Mapped[Vault] = relationship(back_populates="ai_config")


class AIAction(Base):
    """Durable, transparent log of every AI tool call (Part 42) — reads and
    writes alike, so "what did the AI actually do" is always answerable
    from the vault's own local history, never trust-me-bro. `status` tracks
    the write-tool confirmation lifecycle; read tools are logged already
    `executed` since they run immediately."""

    __tablename__ = "ai_actions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    vault_id: Mapped[str] = mapped_column(ForeignKey("vaults.id"))
    conversation_id: Mapped[str] = mapped_column(String(36))
    tool_name: Mapped[str] = mapped_column(String(64))
    tool_input: Mapped[dict] = mapped_column(JSON, default=dict)
    safety: Mapped[str] = mapped_column(String(16))  # read | write | destructive
    status: Mapped[str] = mapped_column(String(16))  # executed | pending | approved | rejected | error
    summary: Mapped[str] = mapped_column(Text, default="")
    result: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    vault: Mapped[Vault] = relationship(back_populates="ai_actions")


class ObsidianConnection(Base):
    """Per-vault config for the Obsidian Local REST API connector (Part 56,
    Mode B) — talks to a *running* Obsidian instance over HTTPS instead of
    this vault's own folder on disk. `api_key` never round-trips back to the
    client once set, same as `AIConfig.api_key`."""

    __tablename__ = "obsidian_connections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    vault_id: Mapped[str] = mapped_column(ForeignKey("vaults.id"), unique=True)
    host: Mapped[str] = mapped_column(String(255), default="127.0.0.1")
    port: Mapped[int] = mapped_column(default=27124)
    api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    use_https: Mapped[bool] = mapped_column(Boolean, default=True)
    verify_ssl: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    vault: Mapped[Vault] = relationship(back_populates="obsidian_connection")

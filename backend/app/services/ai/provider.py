"""AIProvider abstraction (Part 45).

The application must never be hard-wired to one AI vendor. Every concrete
provider (Anthropic today; Ollama/OpenAI-compatible/Gemini are documented
future seams — see docs/PLUGINS.md) implements this same interface and
declares which capabilities it actually supports, so callers can detect an
unavailable capability rather than assuming every provider does everything.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Iterator


@dataclass
class ProviderCapabilities:
    chat: bool = False
    reasoning: bool = False
    tool_calling: bool = False
    embeddings: bool = False
    summarization: bool = False
    classification: bool = False
    vision: bool = False


@dataclass
class ToolCall:
    id: str
    name: str
    input: dict


@dataclass
class AgentEvent:
    """One increment of a streamed provider turn. `type` is one of:
    "text_delta" (partial assistant text), "tool_call" (the model wants to
    invoke a tool), or "message_stop" (the turn is over — `stop_reason` and
    `raw_content` let the caller append the exact assistant turn to history,
    which the API requires verbatim for multi-turn tool use)."""

    type: str
    text: str | None = None
    tool_call: ToolCall | None = None
    stop_reason: str | None = None
    raw_content: list = field(default_factory=list)
    error: str | None = None


class AIProvider(ABC):
    id: str
    capabilities: ProviderCapabilities

    @abstractmethod
    def stream_turn(self, *, system: str, messages: list[dict], tools: list[dict]) -> Iterator[AgentEvent]:
        """Stream one assistant turn. Yields text_delta events as they
        arrive, then any tool_call events, then exactly one message_stop."""
        ...

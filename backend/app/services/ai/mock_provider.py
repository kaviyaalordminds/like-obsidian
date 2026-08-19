"""Deterministic offline provider — no network calls, used by the test
suite so AI agent tests never depend on a live API key or the internet.

Behavior is driven entirely by a caller-supplied script of responses, so
tests can assert exact tool-calling sequences without any model
nondeterminism.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

from .provider import AgentEvent, AIProvider, ProviderCapabilities, ToolCall


@dataclass
class ScriptedTurn:
    text: str = ""
    tool_calls: list[tuple[str, dict]] | None = None  # [(tool_name, input), ...]


class MockProvider(AIProvider):
    id = "mock"
    capabilities = ProviderCapabilities(chat=True, reasoning=False, tool_calling=True)

    def __init__(self, script: list[ScriptedTurn]):
        self._script = list(script)
        self._call_index = 0

    def stream_turn(self, *, system: str, messages: list[dict], tools: list[dict]) -> Iterator[AgentEvent]:
        if self._call_index >= len(self._script):
            yield AgentEvent(type="message_stop", stop_reason="end_turn", raw_content=[])
            return
        turn = self._script[self._call_index]
        self._call_index += 1

        if turn.text:
            yield AgentEvent(type="text_delta", text=turn.text)

        raw_content = []
        if turn.text:
            raw_content.append({"type": "text", "text": turn.text})

        for i, (name, tool_input) in enumerate(turn.tool_calls or []):
            call_id = f"mock_tool_{self._call_index}_{i}"
            yield AgentEvent(type="tool_call", tool_call=ToolCall(id=call_id, name=name, input=tool_input))
            raw_content.append({"type": "tool_use", "id": call_id, "name": name, "input": tool_input})

        stop_reason = "tool_use" if turn.tool_calls else "end_turn"
        yield AgentEvent(type="message_stop", stop_reason=stop_reason, raw_content=raw_content)

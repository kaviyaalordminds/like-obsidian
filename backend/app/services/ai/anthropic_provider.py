"""Real Anthropic connector — the one production AIProvider implementation.

Uses a manual streaming loop (not the SDK's beta tool_runner) because the
agent needs to pause the loop entirely between a proposed write-tool call
and the user's confirmation, which happens as a *separate* HTTP request;
the tool_runner assumes it owns the whole loop end-to-end in one call.
"""
from __future__ import annotations

from typing import Iterator

import anthropic

from .provider import AgentEvent, AIProvider, ProviderCapabilities, ToolCall


class AnthropicProvider(AIProvider):
    id = "anthropic"
    capabilities = ProviderCapabilities(
        chat=True, reasoning=True, tool_calling=True, summarization=True, classification=True, vision=True
    )

    def __init__(self, api_key: str, model: str = "claude-opus-5"):
        self._client = anthropic.Anthropic(api_key=api_key)
        self.model = model

    def stream_turn(self, *, system: str, messages: list[dict], tools: list[dict]) -> Iterator[AgentEvent]:
        kwargs = {"model": self.model, "max_tokens": 8000, "system": system, "messages": messages}
        if tools:
            kwargs["tools"] = tools
        try:
            with self._client.messages.stream(**kwargs) as stream:
                for event in stream:
                    if event.type == "content_block_delta" and event.delta.type == "text_delta":
                        yield AgentEvent(type="text_delta", text=event.delta.text)
                final = stream.get_final_message()
        except anthropic.APIError as exc:
            yield AgentEvent(type="message_stop", error=str(exc))
            return

        for block in final.content:
            if block.type == "tool_use":
                yield AgentEvent(type="tool_call", tool_call=ToolCall(id=block.id, name=block.name, input=block.input))

        yield AgentEvent(
            type="message_stop",
            stop_reason=final.stop_reason,
            raw_content=[b.model_dump() for b in final.content],
        )

"""Agent orchestration (Part 24/27/40): runs the provider <-> tool loop,
auto-executing read tools and pausing before any write/destructive tool
until a separate, explicit confirmation request approves or rejects it.

Conversations live in memory, keyed by a conversation_id the frontend
holds — this is AI *memory*, not vault *knowledge* (Part 39): losing an
in-progress chat on a backend restart loses nothing about the vault
itself, so a DB table would only add durability nothing here needs. The
`AIAction` row it writes on every tool call is the durable, real audit
trail (Part 42).
"""
from __future__ import annotations

import json
import threading
from dataclasses import dataclass, field
from typing import Iterator

from sqlalchemy.orm import Session

from app import models
from .provider import AIProvider
from .tools import TOOLS_BY_NAME, ToolContext, anthropic_tool_defs

SYSTEM_PROMPT = (
    "You are a local knowledge assistant embedded in a Markdown note-taking app. "
    "You can search, read, and analyze the user's vault, and — with their explicit "
    "confirmation — create, edit, rename, move, or delete notes. Always ground answers "
    "in tool results, never invent notes, links, or statistics that don't come from a "
    "tool call. When asked to change the vault, propose the specific action and let the "
    "confirmation flow handle approval; don't claim an action succeeded until its tool "
    "result says so."
)

MAX_TOOL_ROUNDS = 12


@dataclass
class PendingToolCall:
    tool_use_id: str
    tool_name: str
    tool_input: dict
    action_id: str


@dataclass
class Conversation:
    id: str
    vault_id: str
    messages: list[dict] = field(default_factory=list)
    pending: PendingToolCall | None = None


_conversations: dict[str, Conversation] = {}
_lock = threading.Lock()


def get_conversation(conversation_id: str, vault_id: str) -> Conversation:
    with _lock:
        convo = _conversations.get(conversation_id)
        if convo is None or convo.vault_id != vault_id:
            convo = Conversation(id=conversation_id, vault_id=vault_id)
            _conversations[conversation_id] = convo
        return convo


def _truncate(obj: object, limit: int = 6000) -> str:
    text = json.dumps(obj, default=str)
    return text if len(text) <= limit else text[:limit] + "... [truncated]"


def _log_action(ctx: ToolContext, conversation_id: str, tool_name: str, tool_input: dict, safety: str, status: str, summary: str, result: str = "") -> models.AIAction:
    action = models.AIAction(
        vault_id=ctx.vault_id, conversation_id=conversation_id, tool_name=tool_name,
        tool_input=tool_input, safety=safety, status=status, summary=summary, result=result,
    )
    ctx.db.add(action)
    ctx.db.commit()
    ctx.db.refresh(action)
    return action


def _agent_loop(convo: Conversation, ctx: ToolContext, provider: AIProvider, auto_approve_safe: bool) -> Iterator[dict]:
    for _ in range(MAX_TOOL_ROUNDS):
        raw_content: list = []
        stop_reason: str | None = None
        for event in provider.stream_turn(system=SYSTEM_PROMPT, messages=convo.messages, tools=anthropic_tool_defs()):
            if event.type == "text_delta":
                yield {"type": "text_delta", "text": event.text}
            elif event.type == "message_stop":
                if event.error:
                    yield {"type": "error", "error": event.error}
                    return
                stop_reason = event.stop_reason
                raw_content = event.raw_content

        convo.messages.append({"role": "assistant", "content": raw_content})

        tool_uses = [b for b in raw_content if b.get("type") == "tool_use"]
        if stop_reason != "tool_use" or not tool_uses:
            yield {"type": "done"}
            return

        tool_results = []
        for block in tool_uses:
            tool = TOOLS_BY_NAME.get(block["name"])
            if not tool:
                tool_results.append(
                    {"type": "tool_result", "tool_use_id": block["id"], "content": f"Unknown tool: {block['name']}", "is_error": True}
                )
                continue

            needs_confirmation = tool.safety == "destructive" or (tool.safety == "write" and not auto_approve_safe)
            if needs_confirmation:
                action = _log_action(
                    ctx, convo.id, tool.name, block["input"], tool.safety, "pending",
                    summary=f"Proposed {tool.name}({_truncate(block['input'], 200)})",
                )
                convo.pending = PendingToolCall(tool_use_id=block["id"], tool_name=tool.name, tool_input=block["input"], action_id=action.id)
                yield {
                    "type": "pending_confirmation",
                    "action_id": action.id,
                    "tool_name": tool.name,
                    "tool_input": block["input"],
                    "safety": tool.safety,
                }
                return  # one pending action at a time; resume via /confirm

            try:
                result = tool.handler(ctx, block["input"])
                _log_action(ctx, convo.id, tool.name, block["input"], tool.safety, "executed", summary=tool.name, result=_truncate(result))
            except Exception as exc:  # tool errors are reported to the model, not raised
                result = {"error": str(exc)}
                _log_action(ctx, convo.id, tool.name, block["input"], tool.safety, "error", summary=tool.name, result=str(exc))

            tool_results.append({"type": "tool_result", "tool_use_id": block["id"], "content": _truncate(result)})
            yield {"type": "tool_result", "tool_name": tool.name, "tool_input": block["input"], "result": result}

        convo.messages.append({"role": "user", "content": tool_results})

    yield {"type": "error", "error": "Stopped after too many tool-call rounds without finishing."}


def start_turn(convo: Conversation, ctx: ToolContext, provider: AIProvider, user_message: str, auto_approve_safe: bool) -> Iterator[dict]:
    convo.messages.append({"role": "user", "content": user_message})
    yield from _agent_loop(convo, ctx, provider, auto_approve_safe)


def resolve_pending(convo: Conversation, ctx: ToolContext, provider: AIProvider, approved: bool, auto_approve_safe: bool) -> Iterator[dict]:
    pending = convo.pending
    if pending is None:
        yield {"type": "error", "error": "No pending action to resolve."}
        return
    convo.pending = None
    action = ctx.db.get(models.AIAction, pending.action_id)

    if not approved:
        if action:
            action.status = "rejected"
            action.result = "User declined this action."
            ctx.db.commit()
        convo.messages.append(
            {"role": "user", "content": [{"type": "tool_result", "tool_use_id": pending.tool_use_id, "content": "User declined this action.", "is_error": True}]}
        )
        yield {"type": "tool_result", "tool_name": pending.tool_name, "tool_input": pending.tool_input, "result": {"declined": True}}
        yield from _agent_loop(convo, ctx, provider, auto_approve_safe)
        return

    tool = TOOLS_BY_NAME[pending.tool_name]
    try:
        result = tool.handler(ctx, pending.tool_input)
        if action:
            action.status = "executed"
            action.result = _truncate(result)
            ctx.db.commit()
    except Exception as exc:
        result = {"error": str(exc)}
        if action:
            action.status = "error"
            action.result = str(exc)
            ctx.db.commit()

    convo.messages.append(
        {"role": "user", "content": [{"type": "tool_result", "tool_use_id": pending.tool_use_id, "content": _truncate(result)}]}
    )
    yield {"type": "tool_result", "tool_name": pending.tool_name, "tool_input": pending.tool_input, "result": result}
    yield from _agent_loop(convo, ctx, provider, auto_approve_safe)

"""Real-time event stream (Part 55): push, not poll. The frontend opens one
long-lived SSE connection per vault and reacts to typed events instead of
re-fetching the vault tree, graph, or AI action log on a timer.
"""
from __future__ import annotations

import json
import queue
from typing import Iterator

from fastapi import APIRouter, Depends
from starlette.responses import StreamingResponse

from app import models
from app.deps import get_vault
from app.services.event_bus import bus

router = APIRouter(prefix="/api/vaults/{vault_id}/events", tags=["events"])

# Bounds how long a subscriber thread can outlive a client disconnect: a
# blocking `queue.get()` with no timeout can't be interrupted by Starlette's
# cancellation once the client goes away, so we wake up periodically, try to
# yield a heartbeat, and let the failed send unwind the generator instead.
_HEARTBEAT_SECONDS = 15


def _stream(vault_id: str) -> Iterator[str]:
    q = bus.subscribe(vault_id)
    try:
        yield "event: ready\ndata: {}\n\n"
        while True:
            try:
                event = q.get(timeout=_HEARTBEAT_SECONDS)
            except queue.Empty:
                yield ": heartbeat\n\n"
                continue
            yield f"event: {event['type']}\ndata: {json.dumps(event['data'], default=str)}\n\n"
    finally:
        bus.unsubscribe(vault_id, q)


@router.get("")
def stream_events(vault_id: str, vault: models.Vault = Depends(get_vault)):
    return StreamingResponse(_stream(vault.id), media_type="text/event-stream")

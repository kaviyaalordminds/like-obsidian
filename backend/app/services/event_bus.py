"""Process-local pub/sub for real-time vault events (Part 55): every open
SSE connection subscribes with its own bounded queue, so one slow reader
can never block publishers or other subscribers — a full queue just drops
the event for that one subscriber instead of blocking the request that
triggered it.

Thread-safe (`queue.Queue`, not `asyncio.Queue`) because publishers include
both FastAPI's sync-route threadpool workers and the watchdog filesystem
watcher's background thread.

Single-process only: fine for this app's current single-worker deployment.
A multi-worker or multi-process deployment would need a shared broker
(Redis pub/sub, etc.) behind the same publish()/subscribe() shape.
"""
from __future__ import annotations

import queue
import threading
from typing import Any

EVENT_TYPES = {
    "NOTE_CREATED",
    "NOTE_UPDATED",
    "NOTE_DELETED",
    "NOTE_RENAMED",
    "NOTE_MOVED",
    "LINK_CREATED",
    "LINK_REMOVED",
    "TAG_CHANGED",
    "VAULT_CHANGED",
    "GRAPH_UPDATED",
    "AI_ACTION_STARTED",
    "AI_ACTION_COMPLETED",
}


class EventBus:
    def __init__(self) -> None:
        self._subscribers: dict[str, list[queue.Queue]] = {}
        self._lock = threading.Lock()

    def subscribe(self, vault_id: str) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=200)
        with self._lock:
            self._subscribers.setdefault(vault_id, []).append(q)
        return q

    def unsubscribe(self, vault_id: str, q: queue.Queue) -> None:
        with self._lock:
            subs = self._subscribers.get(vault_id)
            if subs and q in subs:
                subs.remove(q)
            if subs is not None and not subs:
                self._subscribers.pop(vault_id, None)

    def publish(self, vault_id: str, event_type: str, data: dict[str, Any]) -> None:
        if event_type not in EVENT_TYPES:
            raise ValueError(f"Unknown event type: {event_type}")
        with self._lock:
            subs = list(self._subscribers.get(vault_id, ()))
        for q in subs:
            try:
                q.put_nowait({"type": event_type, "data": data})
            except queue.Full:
                pass  # a stalled subscriber loses events rather than blocking the publisher

    def subscriber_count(self, vault_id: str) -> int:
        with self._lock:
            return len(self._subscribers.get(vault_id, ()))


bus = EventBus()

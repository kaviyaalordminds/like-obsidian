import pytest
from fastapi.testclient import TestClient

from app.database import init_db
from app.main import app
from app.services.event_bus import EventBus, bus

init_db()
client = TestClient(app)


def test_event_bus_rejects_unknown_event_type():
    bus = EventBus()
    with pytest.raises(ValueError):
        bus.publish("vault-1", "NOT_A_REAL_EVENT", {})


def test_event_bus_delivers_to_subscriber_and_cleans_up():
    bus = EventBus()
    q = bus.subscribe("vault-1")
    assert bus.subscriber_count("vault-1") == 1

    bus.publish("vault-1", "NOTE_CREATED", {"path": "A.md"})
    event = q.get(timeout=1)
    assert event == {"type": "NOTE_CREATED", "data": {"path": "A.md"}}

    bus.unsubscribe("vault-1", q)
    assert bus.subscriber_count("vault-1") == 0


def test_event_bus_only_delivers_to_matching_vault():
    bus = EventBus()
    q1 = bus.subscribe("vault-1")
    q2 = bus.subscribe("vault-2")
    bus.publish("vault-1", "VAULT_CHANGED", {})
    assert q1.get(timeout=1)["type"] == "VAULT_CHANGED"
    assert q2.empty()


def _drain(q, n: int, timeout: float = 2.0) -> list[dict]:
    events = []
    for _ in range(n):
        events.append(q.get(timeout=timeout))
    return events


def test_note_mutations_publish_the_documented_events():
    # Subscribes directly through the same process-global bus the /events
    # SSE route reads from (app.services.event_bus.bus) — this exercises the
    # real integration point (notes router -> event bus) without going
    # through TestClient's HTTP streaming, which buffers a long-lived
    # sync-generator response until it completes rather than delivering it
    # incrementally; the wire-format itself is covered by the AI chat/confirm
    # SSE endpoints already shipped with the same StreamingResponse pattern.
    resp = client.post("/api/vaults", json={"name": "Events Test"})
    vault_id = resp.json()["id"]
    client.post(f"/api/vaults/{vault_id}/open")

    q = bus.subscribe(vault_id)
    try:
        client.post(f"/api/vaults/{vault_id}/notes", json={"path": "A.md", "content": "hello #x [[B]]"})
        events = _drain(q, 5)
        types = [e["type"] for e in events]
        assert "NOTE_CREATED" in types
        assert "GRAPH_UPDATED" in types
        assert "VAULT_CHANGED" in types
        assert "LINK_CREATED" in types
        assert "TAG_CHANGED" in types

        link_events = [e for e in events if e["type"] == "LINK_CREATED"]
        assert any(e["data"]["target"] == "B" for e in link_events)
        tag_event = next(e for e in events if e["type"] == "TAG_CHANGED")
        assert tag_event["data"]["added"] == ["x"]

        # Editing to remove the tag/link should publish the removal side too.
        client.put(f"/api/vaults/{vault_id}/notes/A.md", json={"content": "hello"})
        events = _drain(q, 5)
        types = [e["type"] for e in events]
        assert "NOTE_UPDATED" in types
        assert "LINK_REMOVED" in types
        assert "TAG_CHANGED" in types

        client.delete(f"/api/vaults/{vault_id}/notes/A.md")
        events = _drain(q, 3)
        assert events[0]["type"] == "NOTE_DELETED"
        assert events[0]["data"]["path"] == "A.md"
    finally:
        bus.unsubscribe(vault_id, q)


def test_rename_and_move_publish_note_events():
    resp = client.post("/api/vaults", json={"name": "Events Rename Test"})
    vault_id = resp.json()["id"]
    client.post(f"/api/vaults/{vault_id}/open")
    client.post(f"/api/vaults/{vault_id}/notes", json={"path": "Old.md", "content": "content"})

    q = bus.subscribe(vault_id)
    try:
        client.post(f"/api/vaults/{vault_id}/notes/Old.md/rename", json={"new_name": "New"})
        events = _drain(q, 3)
        rename_event = next(e for e in events if e["type"] == "NOTE_RENAMED")
        assert rename_event["data"] == {"old_path": "Old.md", "new_path": "New.md"}
    finally:
        bus.unsubscribe(vault_id, q)

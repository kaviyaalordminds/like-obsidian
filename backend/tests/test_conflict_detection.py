import time

from fastapi.testclient import TestClient

from app.database import init_db
from app.main import app

init_db()
client = TestClient(app)


def _make_vault(name: str) -> str:
    resp = client.post("/api/vaults", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_save_without_expected_mtime_always_overwrites():
    vid = _make_vault("Conflict Force Save")
    client.post(f"/api/vaults/{vid}/notes", json={"path": "A.md", "content": "v1"})
    resp = client.put(f"/api/vaults/{vid}/notes/A.md", json={"content": "v2"})
    assert resp.status_code == 200
    assert resp.json()["content"] == "v2"


def test_save_with_matching_expected_mtime_succeeds():
    vid = _make_vault("Conflict Matching Mtime")
    created = client.post(f"/api/vaults/{vid}/notes", json={"path": "A.md", "content": "v1"}).json()
    resp = client.put(f"/api/vaults/{vid}/notes/A.md", json={"content": "v2", "expected_mtime": created["modified_at"]})
    assert resp.status_code == 200
    assert resp.json()["content"] == "v2"


def test_save_with_stale_expected_mtime_returns_409_with_current_content():
    vid = _make_vault("Conflict Stale Mtime")
    created = client.post(f"/api/vaults/{vid}/notes", json={"path": "A.md", "content": "original"}).json()
    stale_mtime = created["modified_at"]

    # Simulate an external change (another tab, Obsidian, a sync client)
    # landing on disk after this client last read the note.
    time.sleep(0.05)
    external = client.put(f"/api/vaults/{vid}/notes/A.md", json={"content": "changed externally"})
    assert external.status_code == 200

    resp = client.put(f"/api/vaults/{vid}/notes/A.md", json={"content": "my local edit", "expected_mtime": stale_mtime})
    assert resp.status_code == 409
    body = resp.json()["detail"]
    assert body["content"] == "changed externally"
    assert body["path"] == "A.md"

    # The conflicting save must never have been applied.
    current = client.get(f"/api/vaults/{vid}/notes/A.md")
    assert current.json()["content"] == "changed externally"


def test_conflicted_save_does_not_touch_the_file_at_all():
    vid = _make_vault("Conflict No Side Effects")
    created = client.post(f"/api/vaults/{vid}/notes", json={"path": "A.md", "content": "original"}).json()
    time.sleep(0.05)
    client.put(f"/api/vaults/{vid}/notes/A.md", json={"content": "external edit"})

    before = client.get(f"/api/vaults/{vid}/notes/A.md").json()
    resp = client.put(f"/api/vaults/{vid}/notes/A.md", json={"content": "rejected edit", "expected_mtime": created["modified_at"]})
    assert resp.status_code == 409
    after = client.get(f"/api/vaults/{vid}/notes/A.md").json()
    assert after["content"] == before["content"] == "external edit"
    assert after["modified_at"] == before["modified_at"]

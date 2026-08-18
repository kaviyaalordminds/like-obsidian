from fastapi.testclient import TestClient

from app.database import init_db
from app.main import app

init_db()
client = TestClient(app)


def _create_vault(name: str) -> str:
    resp = client.post("/api/vaults", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_create_open_vault_scaffolds_default_folders():
    vid = _create_vault("Test Vault One")
    resp = client.post(f"/api/vaults/{vid}/open")
    assert resp.status_code == 200
    names = {c["name"] for c in resp.json()["children"]}
    assert {"Notes", "Daily Notes", "Templates", "Attachments"}.issubset(names)


def test_note_create_read_update_delete():
    vid = _create_vault("Test Vault Two")
    client.post(f"/api/vaults/{vid}/open")

    resp = client.post(f"/api/vaults/{vid}/notes", json={"path": "Notes/A.md", "content": "hello"})
    assert resp.status_code == 201
    assert resp.json()["content"] == "hello"

    resp = client.get(f"/api/vaults/{vid}/notes/Notes/A.md")
    assert resp.json()["content"] == "hello"

    resp = client.put(f"/api/vaults/{vid}/notes/Notes/A.md", json={"content": "updated"})
    assert resp.json()["content"] == "updated"

    resp = client.delete(f"/api/vaults/{vid}/notes/Notes/A.md")
    assert resp.status_code == 204
    assert client.get(f"/api/vaults/{vid}/notes/Notes/A.md").status_code == 404


def test_note_path_traversal_rejected():
    vid = _create_vault("Test Vault Three")
    client.post(f"/api/vaults/{vid}/open")
    resp = client.post(f"/api/vaults/{vid}/notes", json={"path": "../../etc/evil.md", "content": "x"})
    assert resp.status_code == 400


def test_graph_and_backlinks_reflect_created_notes():
    vid = _create_vault("Test Vault Four")
    client.post(f"/api/vaults/{vid}/open")
    client.post(f"/api/vaults/{vid}/notes", json={"path": "AI.md", "content": "[[ML]]"})
    client.post(f"/api/vaults/{vid}/notes", json={"path": "ML.md", "content": "# ML"})

    graph = client.get(f"/api/vaults/{vid}/graph").json()
    edge_pairs = {(e["source"], e["target"]) for e in graph["edges"]}
    assert ("AI.md", "ML.md") in edge_pairs

    backlinks = client.get(f"/api/vaults/{vid}/backlinks/ML.md").json()
    assert {b["path"] for b in backlinks["backlinks"]} == {"AI.md"}


def test_rename_note_updates_referencing_notes_via_api():
    vid = _create_vault("Test Vault Five")
    client.post(f"/api/vaults/{vid}/open")
    client.post(f"/api/vaults/{vid}/notes", json={"path": "AI.md", "content": "[[ML]]"})
    client.post(f"/api/vaults/{vid}/notes", json={"path": "ML.md", "content": "# ML"})

    resp = client.post(f"/api/vaults/{vid}/notes/ML.md/rename", json={"new_name": "Machine Learning.md"})
    assert resp.status_code == 200

    updated = client.get(f"/api/vaults/{vid}/notes/AI.md").json()
    assert updated["content"] == "[[Machine Learning]]"


def test_search_endpoint():
    vid = _create_vault("Test Vault Six")
    client.post(f"/api/vaults/{vid}/open")
    client.post(f"/api/vaults/{vid}/notes", json={"path": "Findme.md", "content": "unique-needle-text"})

    resp = client.get(f"/api/vaults/{vid}/search", params={"q": "unique-needle-text"})
    results = resp.json()
    assert results[0]["path"] == "Findme.md"


def test_daily_note_creation():
    vid = _create_vault("Test Vault Seven")
    client.post(f"/api/vaults/{vid}/open")
    resp = client.post(f"/api/vaults/{vid}/daily-note", json={})
    assert resp.status_code == 200
    assert resp.json()["created"] is True

    resp2 = client.post(f"/api/vaults/{vid}/daily-note", json={})
    assert resp2.json()["created"] is False


def test_import_export_roundtrip():
    vid = _create_vault("Test Vault Eight")
    client.post(f"/api/vaults/{vid}/open")
    client.post(f"/api/vaults/{vid}/notes", json={"path": "Notes/Original.md", "content": "roundtrip"})

    export_resp = client.get(f"/api/vaults/{vid}/export")
    assert export_resp.status_code == 200
    assert export_resp.headers["content-type"] == "application/zip"

    vid2 = _create_vault("Test Vault Eight Imported")
    client.post(f"/api/vaults/{vid2}/open")
    import_resp = client.post(
        f"/api/vaults/{vid2}/import",
        files={"file": ("vault.zip", export_resp.content, "application/zip")},
    )
    assert import_resp.status_code == 200
    assert "Notes/Original.md" in import_resp.json()["imported_files"]

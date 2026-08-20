import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import settings
from app.database import init_db
from app.main import app

init_db()
client = TestClient(app)


def _external_folder(obsidian: bool = False) -> Path:
    root = Path(tempfile.mkdtemp(prefix="external-vault-"))
    (root / "Existing.md").write_text("# Existing\n\nAlready here before connecting.\n", encoding="utf-8")
    if obsidian:
        (root / ".obsidian").mkdir()
    return root


def test_connect_existing_folder_reads_its_real_content_without_copying():
    root = _external_folder()
    resp = client.post("/api/vaults/connect", json={"path": str(root)})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["external_path"] == str(root.resolve())
    assert body["is_obsidian_vault"] is False
    vault_id = body["id"]

    note = client.get(f"/api/vaults/{vault_id}/notes/Existing.md")
    assert note.status_code == 200
    assert "Already here before connecting" in note.json()["content"]

    # Nothing was copied into the app's own managed storage.
    assert not (settings.VAULTS_ROOT / body["slug"]).exists()


def test_connect_detects_obsidian_vault():
    root = _external_folder(obsidian=True)
    resp = client.post("/api/vaults/connect", json={"path": str(root)})
    assert resp.status_code == 201, resp.text
    assert resp.json()["is_obsidian_vault"] is True


def test_connect_is_real_two_way_sync_no_duplicate_copy():
    root = _external_folder()
    resp = client.post("/api/vaults/connect", json={"path": str(root)})
    vault_id = resp.json()["id"]

    # Write through the API -> lands directly in the real external folder.
    client.post(f"/api/vaults/{vault_id}/notes", json={"path": "FromApi.md", "content": "written via API"})
    assert (root / "FromApi.md").read_text(encoding="utf-8") == "written via API"

    # An edit made directly on disk (as if from Obsidian itself) is visible
    # through the API too, once re-read — no separate copy to fall out of sync.
    (root / "Existing.md").write_text("# Existing\n\nEdited outside the app entirely.\n", encoding="utf-8")
    note = client.get(f"/api/vaults/{vault_id}/notes/Existing.md")
    assert "Edited outside the app entirely" in note.json()["content"]


def test_connect_rejects_missing_path():
    resp = client.post("/api/vaults/connect", json={"path": "/definitely/does/not/exist/anywhere"})
    assert resp.status_code == 400


def test_connect_rejects_relative_path():
    resp = client.post("/api/vaults/connect", json={"path": "relative/path"})
    assert resp.status_code == 400


def test_connect_rejects_a_file_not_a_directory():
    f = tempfile.NamedTemporaryFile(delete=False, suffix=".md")
    f.close()
    resp = client.post("/api/vaults/connect", json={"path": f.name})
    assert resp.status_code == 400


def test_connect_rejects_duplicate_connection():
    root = _external_folder()
    first = client.post("/api/vaults/connect", json={"path": str(root)})
    assert first.status_code == 201
    second = client.post("/api/vaults/connect", json={"path": str(root)})
    assert second.status_code == 400


def test_connect_rejects_paths_inside_managed_storage():
    inside = settings.VAULTS_ROOT / "some-managed-vault"
    inside.mkdir(parents=True, exist_ok=True)
    resp = client.post("/api/vaults/connect", json={"path": str(inside)})
    assert resp.status_code == 400

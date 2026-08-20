from fastapi.testclient import TestClient

from app import models
from app.database import SessionLocal, init_db
from app.deps import vault_root
from app.main import app

init_db()
client = TestClient(app)


def _make_vault(name: str) -> tuple[str, models.Vault]:
    resp = client.post("/api/vaults", json={"name": name})
    assert resp.status_code == 201, resp.text
    vault_id = resp.json()["id"]
    client.post(f"/api/vaults/{vault_id}/open")
    db = SessionLocal()
    vault = db.get(models.Vault, vault_id)
    return vault_id, vault


def test_get_file_serves_attachment_by_exact_relative_path():
    vid, vault = _make_vault("Files Exact Path")
    root = vault_root(vault)
    (root / "Attachments").mkdir(parents=True, exist_ok=True)
    (root / "Attachments" / "diagram.png").write_bytes(b"fake-png-bytes")

    resp = client.get(f"/api/vaults/{vid}/files/Attachments/diagram.png")
    assert resp.status_code == 200
    assert resp.content == b"fake-png-bytes"


def test_get_file_resolves_bare_basename_anywhere_in_vault():
    vid, vault = _make_vault("Files Basename Resolve")
    root = vault_root(vault)
    (root / "Attachments").mkdir(parents=True, exist_ok=True)
    (root / "Attachments" / "photo.jpg").write_bytes(b"jpeg-bytes")

    resp = client.get(f"/api/vaults/{vid}/files/photo.jpg")
    assert resp.status_code == 200
    assert resp.content == b"jpeg-bytes"


def test_get_file_missing_returns_404():
    vid, _vault = _make_vault("Files Missing")
    resp = client.get(f"/api/vaults/{vid}/files/nope.png")
    assert resp.status_code == 404


def test_get_file_rejects_path_traversal():
    vid, _vault = _make_vault("Files Traversal")
    resp = client.get(f"/api/vaults/{vid}/files/..%2F..%2Fetc%2Fpasswd")
    assert resp.status_code in (400, 404)

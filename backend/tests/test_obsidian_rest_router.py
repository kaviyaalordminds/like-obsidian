from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from app.database import init_db
from app.main import app
from app.services.obsidian_rest_client import ObsidianRestClient

init_db()
client = TestClient(app)


def _make_vault(name: str) -> str:
    resp = client.post("/api/vaults", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_config_defaults_before_anything_is_set():
    vid = _make_vault("Obsidian REST Defaults")
    resp = client.get(f"/api/vaults/{vid}/obsidian-rest/config")
    assert resp.status_code == 200
    body = resp.json()
    assert body["configured"] is False
    assert body["host"] == "127.0.0.1"
    assert body["port"] == 27124


def test_setting_config_never_returns_the_api_key():
    vid = _make_vault("Obsidian REST Config")
    resp = client.put(f"/api/vaults/{vid}/obsidian-rest/config", json={"host": "192.168.1.5", "port": 27125, "api_key": "secret-key"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["configured"] is True
    assert body["host"] == "192.168.1.5"
    assert body["port"] == 27125
    assert "api_key" not in body
    assert "secret-key" not in resp.text


def test_test_connection_without_config_reports_not_configured():
    vid = _make_vault("Obsidian REST No Config")
    resp = client.post(f"/api/vaults/{vid}/obsidian-rest/test")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "not" in body["error"].lower() or "no" in body["error"].lower()


def test_test_connection_succeeds_against_mocked_obsidian():
    vid = _make_vault("Obsidian REST Success")
    client.put(f"/api/vaults/{vid}/obsidian-rest/config", json={"api_key": "test-key"})

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"authenticated": True, "ok": "OK", "service": "Obsidian Local REST API"})

    original_init = ObsidianRestClient.__init__

    def patched_init(self, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        original_init(self, **kwargs)

    with patch.object(ObsidianRestClient, "__init__", patched_init):
        resp = client.post(f"/api/vaults/{vid}/obsidian-rest/test")

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["authenticated"] is True
    assert body["service"] == "Obsidian Local REST API"


def test_test_connection_reports_auth_failure():
    vid = _make_vault("Obsidian REST Auth Fail")
    client.put(f"/api/vaults/{vid}/obsidian-rest/config", json={"api_key": "wrong-key"})

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"message": "Invalid API key"})

    original_init = ObsidianRestClient.__init__

    def patched_init(self, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        original_init(self, **kwargs)

    with patch.object(ObsidianRestClient, "__init__", patched_init):
        resp = client.post(f"/api/vaults/{vid}/obsidian-rest/test")

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "Invalid API key" in body["error"]


def test_test_connection_reports_unreachable_server():
    vid = _make_vault("Obsidian REST Unreachable")
    client.put(f"/api/vaults/{vid}/obsidian-rest/config", json={"api_key": "test-key"})

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")

    original_init = ObsidianRestClient.__init__

    def patched_init(self, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        original_init(self, **kwargs)

    with patch.object(ObsidianRestClient, "__init__", patched_init):
        resp = client.post(f"/api/vaults/{vid}/obsidian-rest/test")

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "Could not reach Obsidian" in body["error"]

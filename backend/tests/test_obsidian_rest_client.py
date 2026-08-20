"""Mock-tested against the Obsidian Local REST API plugin's documented
request/response shapes — there is no live Obsidian instance reachable
from this environment (Part 56, Mode B). `httpx.MockTransport` stands in
for the real server so the client's request construction and response
parsing are exercised for real, without a network dependency.
"""
import httpx
import pytest

from app.services.obsidian_rest_client import ObsidianRestClient, ObsidianRestError


def _client(handler) -> ObsidianRestClient:
    return ObsidianRestClient(api_key="test-key", transport=httpx.MockTransport(handler))


def test_get_status_parses_server_info():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path == "/"
        assert request.headers["authorization"] == "Bearer test-key"
        return httpx.Response(200, json={"authenticated": True, "ok": "OK", "service": "Obsidian Local REST API"})

    with _client(handler) as client:
        info = client.get_status()
        assert info.authenticated is True
        assert info.ok is True
        assert info.service == "Obsidian Local REST API"


def test_get_status_raises_on_bad_auth():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"message": "Invalid API key"})

    with _client(handler) as client:
        with pytest.raises(ObsidianRestError) as exc_info:
            client.get_status()
        assert exc_info.value.status_code == 401
        assert "Invalid API key" in exc_info.value.detail


def test_list_files_parses_vault_listing():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/vault/"
        return httpx.Response(200, json={"files": ["Note.md", "Folder/", "Other.md"]})

    with _client(handler) as client:
        files = client.list_files()
        assert [f.path for f in files] == ["Note.md", "Folder/", "Other.md"]
        assert [f.is_folder for f in files] == [False, True, False]


def test_list_files_nested_folder():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/vault/Folder/"
        return httpx.Response(200, json={"files": ["Nested.md"]})

    with _client(handler) as client:
        files = client.list_files("Folder")
        assert files[0].path == "Nested.md"


def test_get_file_returns_raw_markdown():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/vault/Note.md"
        return httpx.Response(200, text="# Note\n\nContent here.\n")

    with _client(handler) as client:
        content = client.get_file("Note.md")
        assert content == "# Note\n\nContent here.\n"


def test_get_file_missing_raises():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"message": "File not found"})

    with _client(handler) as client:
        with pytest.raises(ObsidianRestError) as exc_info:
            client.get_file("Missing.md")
        assert exc_info.value.status_code == 404


def test_create_or_update_file_sends_put_with_body():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["method"] = request.method
        seen["path"] = request.url.path
        seen["body"] = request.content.decode("utf-8")
        seen["content_type"] = request.headers["content-type"]
        return httpx.Response(204)

    with _client(handler) as client:
        client.create_or_update_file("New.md", "# New\n\nHello.\n")

    assert seen["method"] == "PUT"
    assert seen["path"] == "/vault/New.md"
    assert seen["body"] == "# New\n\nHello.\n"
    assert seen["content_type"] == "text/markdown"


def test_append_to_file_sends_post():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/vault/Note.md"
        assert request.content.decode("utf-8") == "\nmore text"
        return httpx.Response(204)

    with _client(handler) as client:
        client.append_to_file("Note.md", "\nmore text")


def test_delete_file_sends_delete():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "DELETE"
        assert request.url.path == "/vault/Gone.md"
        return httpx.Response(204)

    with _client(handler) as client:
        client.delete_file("Gone.md")


def test_connection_refused_surfaces_as_httpx_error():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Connection refused")

    with _client(handler) as client:
        with pytest.raises(httpx.ConnectError):
            client.get_status()

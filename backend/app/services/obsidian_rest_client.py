"""Client for the Obsidian Local REST API community plugin (Part 56, Mode
B): talks to a *running* Obsidian instance over HTTPS instead of reading
its vault folder directly on disk (Mode A, `vault_root()`/`vault_service`).

There is no live Obsidian instance reachable from this environment, so this
client is verified with `httpx.MockTransport` against the plugin's
documented request/response shapes (see `tests/test_obsidian_rest_client.py`)
rather than against a real server. The `transport` constructor parameter
exists specifically for that — production code never passes it and gets a
real `httpx.Client` making real network calls.
"""
from __future__ import annotations

from dataclasses import dataclass

import httpx


class ObsidianRestError(Exception):
    """Raised for anything the plugin itself reports as a failure: bad auth,
    a missing file, a malformed request. Distinct from httpx's own
    connection-level errors (refused/timeout), which callers see as
    `httpx.HTTPError` and should treat as "Obsidian isn't reachable"."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Obsidian REST API error {status_code}: {detail}")


@dataclass
class ObsidianServerInfo:
    authenticated: bool
    ok: bool
    service: str


@dataclass
class ObsidianFile:
    path: str
    is_folder: bool


class ObsidianRestClient:
    def __init__(
        self,
        *,
        host: str = "127.0.0.1",
        port: int = 27124,
        api_key: str,
        use_https: bool = True,
        verify_ssl: bool = False,
        timeout: float = 10.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        scheme = "https" if use_https else "http"
        base_url = f"{scheme}://{host}:{port}"
        self._client = httpx.Client(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            verify=verify_ssl,
            timeout=timeout,
            transport=transport,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "ObsidianRestClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def _raise_for_status(self, resp: httpx.Response) -> None:
        if resp.status_code >= 400:
            try:
                detail = resp.json().get("message", resp.text)
            except Exception:
                detail = resp.text
            raise ObsidianRestError(resp.status_code, detail)

    def get_status(self) -> ObsidianServerInfo:
        resp = self._client.get("/")
        self._raise_for_status(resp)
        data = resp.json()
        return ObsidianServerInfo(
            authenticated=bool(data.get("authenticated", False)),
            ok=data.get("ok") == "OK" or data.get("status") == "OK",
            service=data.get("service", ""),
        )

    def list_files(self, folder: str = "") -> list[ObsidianFile]:
        path = f"/vault/{folder}" if not folder or folder.endswith("/") else f"/vault/{folder}/"
        resp = self._client.get(path)
        self._raise_for_status(resp)
        entries = resp.json().get("files", [])
        return [ObsidianFile(path=e, is_folder=e.endswith("/")) for e in entries]

    def get_file(self, path: str) -> str:
        resp = self._client.get(f"/vault/{path}")
        self._raise_for_status(resp)
        return resp.text

    def create_or_update_file(self, path: str, content: str) -> None:
        resp = self._client.put(f"/vault/{path}", content=content.encode("utf-8"), headers={"Content-Type": "text/markdown"})
        self._raise_for_status(resp)

    def append_to_file(self, path: str, content: str) -> None:
        resp = self._client.post(f"/vault/{path}", content=content.encode("utf-8"), headers={"Content-Type": "text/markdown"})
        self._raise_for_status(resp)

    def delete_file(self, path: str) -> None:
        resp = self._client.delete(f"/vault/{path}")
        self._raise_for_status(resp)

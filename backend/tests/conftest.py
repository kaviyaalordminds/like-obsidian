from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

# Must run before any `app.*` module is imported (conftest.py is collected
# first), so API integration tests use isolated, disposable storage instead
# of the developer's real ./data and ./vaults directories.
_TEST_ROOT = Path(tempfile.mkdtemp(prefix="like-obsidian-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_ROOT / 'test.db'}"
os.environ["VAULTS_ROOT"] = str(_TEST_ROOT / "vaults")

import pytest


@pytest.fixture()
def tmp_vault(tmp_path: Path) -> Path:
    root = tmp_path / "vault"
    root.mkdir()
    (root / "Notes").mkdir()
    yield root
    shutil.rmtree(root, ignore_errors=True)


def write(root: Path, rel: str, content: str) -> Path:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return p

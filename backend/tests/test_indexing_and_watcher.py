import time

from app.services.index_service import IndexService, get_index
from app.services.watcher_service import VaultWatcherRegistry
from tests.conftest import write


def test_index_incremental_only_reparses_changed_files(tmp_vault):
    write(tmp_vault, "A.md", "first")
    write(tmp_vault, "B.md", "second")
    idx = IndexService(tmp_vault)
    idx.refresh(force=True)

    mtime_a_before = idx.get("A.md").mtime
    mtime_b_before = idx.get("B.md").mtime

    time.sleep(0.05)
    write(tmp_vault, "A.md", "first changed")
    idx.refresh()  # not forced: should skip B.md, re-parse A.md

    assert idx.get("A.md").mtime != mtime_a_before
    assert idx.get("A.md").parsed.body == "first changed"
    assert idx.get("B.md").mtime == mtime_b_before


def test_index_drops_deleted_files_on_refresh(tmp_vault):
    write(tmp_vault, "A.md", "content")
    idx = IndexService(tmp_vault)
    idx.refresh(force=True)
    assert idx.get("A.md") is not None

    (tmp_vault / "A.md").unlink()
    idx.refresh()
    assert idx.get("A.md") is None


def test_resolve_link_prefers_exact_path_over_basename(tmp_vault):
    write(tmp_vault, "Notes/Target.md", "a")
    write(tmp_vault, "Other/Target.md", "b")
    idx = IndexService(tmp_vault)
    idx.refresh(force=True)
    assert idx.resolve_link("Notes/Target") == "Notes/Target.md"


def test_file_watcher_detects_external_edit(tmp_vault):
    write(tmp_vault, "A.md", "original")
    # The watcher looks up its index via the shared get_index() registry, so
    # the test must observe that same instance rather than a private one.
    idx = get_index(tmp_vault)
    idx.refresh(force=True)
    assert idx.get("A.md").parsed.body == "original"

    registry = VaultWatcherRegistry()
    registry.watch(tmp_vault)
    try:
        time.sleep(0.3)  # let the observer thread start
        write(tmp_vault, "A.md", "edited externally")

        deadline = time.time() + 3
        while time.time() < deadline:
            note = idx.get("A.md")
            if note and note.parsed.body == "edited externally":
                break
            time.sleep(0.1)

        assert idx.get("A.md").parsed.body == "edited externally"
    finally:
        registry.stop_all()

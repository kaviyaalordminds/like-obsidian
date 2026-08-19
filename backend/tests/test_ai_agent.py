from fastapi.testclient import TestClient

from app import models
from app.database import SessionLocal, init_db
from app.deps import vault_root
from app.main import app
from app.services.ai import agent_service
from app.services.ai.mock_provider import MockProvider, ScriptedTurn
from app.services.ai.tools import ToolContext
from app.services.index_service import get_index

init_db()
client = TestClient(app)


def _make_vault(name: str) -> tuple[str, ToolContext]:
    resp = client.post("/api/vaults", json={"name": name})
    assert resp.status_code == 201, resp.text
    vault_id = resp.json()["id"]
    client.post(f"/api/vaults/{vault_id}/open")

    db = SessionLocal()
    vault = db.get(models.Vault, vault_id)
    root = vault_root(vault)
    ctx = ToolContext(root=root, index=get_index(root), db=db, vault_id=vault_id)
    return vault_id, ctx


def test_read_tools_operate_on_real_vault_data():
    vault_id, ctx = _make_vault("AI Read Tools")
    client.post(f"/api/vaults/{vault_id}/notes", json={"path": "A.md", "content": "hello #tag [[B]]"})
    client.post(f"/api/vaults/{vault_id}/notes", json={"path": "B.md", "content": "world"})
    ctx.index.refresh(force=True)

    from app.services.ai.tools import TOOLS_BY_NAME

    results = TOOLS_BY_NAME["search_notes"].handler(ctx, {"query": "hello"})
    assert any(r["path"] == "A.md" for r in results)

    note = TOOLS_BY_NAME["read_note"].handler(ctx, {"path": "A.md"})
    assert note["content"] == "hello #tag [[B]]"
    assert "tag" in note["tags"]

    orphans = TOOLS_BY_NAME["find_orphans"].handler(ctx, {})
    # B.md has zero outgoing links but one incoming (from A.md), so it is
    # not an orphan; there is nothing else in this fresh vault that is.
    assert all(o["path"] != "B.md" for o in orphans)


def test_agent_auto_executes_read_tools_without_confirmation():
    vault_id, ctx = _make_vault("AI Auto Read")
    client.post(f"/api/vaults/{vault_id}/notes", json={"path": "Note.md", "content": "content here"})
    ctx.index.refresh(force=True)

    provider = MockProvider([
        ScriptedTurn(tool_calls=[("search_notes", {"query": "content"})]),
        ScriptedTurn(text="Found it."),
    ])
    convo = agent_service.Conversation(id="conv-1", vault_id=vault_id)
    events = list(agent_service.start_turn(convo, ctx, provider, "find my note", auto_approve_safe=False))

    types = [e["type"] for e in events]
    assert "tool_result" in types
    assert types[-1] == "done"
    assert convo.pending is None

    actions = ctx.db.query(models.AIAction).filter_by(vault_id=vault_id).all()
    assert len(actions) == 1
    assert actions[0].tool_name == "search_notes"
    assert actions[0].status == "executed"


def test_agent_pauses_before_write_and_executes_on_approval():
    vault_id, ctx = _make_vault("AI Write Confirm")

    provider = MockProvider([
        ScriptedTurn(tool_calls=[("create_note", {"path": "New.md", "content": "written by AI"})]),
        ScriptedTurn(text="Done."),
    ])
    convo = agent_service.Conversation(id="conv-2", vault_id=vault_id)
    events = list(agent_service.start_turn(convo, ctx, provider, "create a note", auto_approve_safe=False))

    assert events[-1]["type"] == "pending_confirmation"
    assert events[-1]["tool_name"] == "create_note"
    assert convo.pending is not None
    assert not (ctx.root / "New.md").exists()

    pending_action = ctx.db.get(models.AIAction, convo.pending.action_id)
    assert pending_action.status == "pending"

    resume_events = list(agent_service.resolve_pending(convo, ctx, provider, approved=True, auto_approve_safe=False))
    assert resume_events[-1]["type"] == "done"
    assert (ctx.root / "New.md").exists()
    assert (ctx.root / "New.md").read_text() == "written by AI"

    ctx.db.refresh(pending_action)
    assert pending_action.status == "executed"


def test_agent_does_not_execute_when_user_rejects():
    vault_id, ctx = _make_vault("AI Write Reject")

    provider = MockProvider([
        ScriptedTurn(tool_calls=[("create_note", {"path": "Rejected.md", "content": "no"})]),
        ScriptedTurn(text="Okay, not creating it."),
    ])
    convo = agent_service.Conversation(id="conv-3", vault_id=vault_id)
    list(agent_service.start_turn(convo, ctx, provider, "create a note", auto_approve_safe=False))

    resume_events = list(agent_service.resolve_pending(convo, ctx, provider, approved=False, auto_approve_safe=False))
    assert resume_events[-1]["type"] == "done"
    assert not (ctx.root / "Rejected.md").exists()

    actions = ctx.db.query(models.AIAction).filter_by(vault_id=vault_id).all()
    assert actions[0].status == "rejected"


def test_destructive_tool_always_confirms_even_with_auto_approve_safe():
    vault_id, ctx = _make_vault("AI Delete Confirm")
    client.post(f"/api/vaults/{vault_id}/notes", json={"path": "ToDelete.md", "content": "x"})
    ctx.index.refresh(force=True)

    provider = MockProvider([ScriptedTurn(tool_calls=[("delete_note", {"path": "ToDelete.md"})])])
    convo = agent_service.Conversation(id="conv-4", vault_id=vault_id)
    events = list(agent_service.start_turn(convo, ctx, provider, "delete it", auto_approve_safe=True))

    assert events[-1]["type"] == "pending_confirmation"
    assert (ctx.root / "ToDelete.md").exists()


def test_write_tool_auto_executes_when_auto_approve_safe_enabled():
    vault_id, ctx = _make_vault("AI Auto Approve Write")

    provider = MockProvider([
        ScriptedTurn(tool_calls=[("create_note", {"path": "AutoApproved.md", "content": "yes"})]),
        ScriptedTurn(text="Created."),
    ])
    convo = agent_service.Conversation(id="conv-5", vault_id=vault_id)
    events = list(agent_service.start_turn(convo, ctx, provider, "create a note", auto_approve_safe=True))

    assert events[-1]["type"] == "done"
    assert (ctx.root / "AutoApproved.md").exists()


def test_ai_config_roundtrip_never_returns_api_key():
    resp = client.post("/api/vaults", json={"name": "AI Config Vault"})
    vault_id = resp.json()["id"]

    resp = client.get(f"/api/vaults/{vault_id}/ai/config")
    assert resp.json() == {"configured": False, "provider": "anthropic", "model": "claude-opus-5", "auto_approve_safe": False}

    resp = client.put(f"/api/vaults/{vault_id}/ai/config", json={"api_key": "sk-secret-value", "auto_approve_safe": True})
    body = resp.json()
    assert body["configured"] is True
    assert body["auto_approve_safe"] is True
    assert "api_key" not in body
    assert "sk-secret-value" not in resp.text


def test_chat_without_configured_provider_errors():
    resp = client.post("/api/vaults", json={"name": "AI Unconfigured Vault"})
    vault_id = resp.json()["id"]
    resp = client.post(f"/api/vaults/{vault_id}/ai/chat", json={"conversation_id": "c", "message": "hi"})
    assert resp.status_code == 400


def test_graph_command_tools_return_structured_commands_without_touching_vault():
    vault_id, ctx = _make_vault("AI Graph Commands")
    from app.services.ai.tools import TOOLS_BY_NAME

    assert TOOLS_BY_NAME["graph_focus_node"].handler(ctx, {"path": "A.md"}) == {"command": "focus_node", "path": "A.md"}
    assert TOOLS_BY_NAME["graph_set_mode"].handler(ctx, {"mode": "radial"}) == {"command": "set_mode", "mode": "radial"}
    assert "error" in TOOLS_BY_NAME["graph_set_mode"].handler(ctx, {"mode": "not-a-mode"})
    assert TOOLS_BY_NAME["graph_highlight_nodes"].safety == "read"


def test_note_suggestions_route_does_not_collide_with_get_note():
    resp = client.post("/api/vaults", json={"name": "Suggestions Route Vault"})
    vault_id = resp.json()["id"]
    client.post(f"/api/vaults/{vault_id}/open")
    client.post(f"/api/vaults/{vault_id}/notes", json={"path": "RAG.md", "content": "#research RAG basics"})
    client.post(f"/api/vaults/{vault_id}/notes", json={"path": "Draft.md", "content": "About RAG and research."})

    resp = client.get(f"/api/vaults/{vault_id}/notes/Draft.md/suggestions")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert any(s["target_path"] == "RAG.md" for s in body["links"])
    assert any(s["tag"] == "research" for s in body["tags"])

    # The plain note-read route must still work for a path that happens to
    # share a prefix with the suggestions route.
    resp = client.get(f"/api/vaults/{vault_id}/notes/Draft.md")
    assert resp.status_code == 200
    assert resp.json()["path"] == "Draft.md"

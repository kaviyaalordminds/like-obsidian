from __future__ import annotations

import json
from typing import Iterator

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse

from app import models, schemas
from app.database import get_db
from app.deps import get_vault, vault_root
from app.services.ai import agent_service
from app.services.ai.anthropic_provider import AnthropicProvider
from app.services.ai.context import build_context_text, preview
from app.services.ai.provider import AIProvider
from app.services.ai.tools import ToolContext
from app.services.index_service import get_index

router = APIRouter(prefix="/api/vaults/{vault_id}/ai", tags=["ai"])


def _get_config(db: Session, vault_id: str) -> models.AIConfig | None:
    return db.query(models.AIConfig).filter_by(vault_id=vault_id).first()


def _provider_for(config: models.AIConfig) -> AIProvider:
    # Only Anthropic is wired to a real network call today; capability
    # detection (Part 45) is what lets a future local/OpenAI-compatible
    # provider slot in here without changing anything above this line.
    if config.provider == "anthropic":
        return AnthropicProvider(api_key=config.api_key, model=config.model)
    raise HTTPException(status_code=400, detail=f"Unsupported provider: {config.provider}")


def _sse(events: Iterator[dict]) -> Iterator[str]:
    for event in events:
        yield f"data: {json.dumps(event, default=str)}\n\n"
    yield "event: close\ndata: {}\n\n"


@router.get("/config", response_model=schemas.AIConfigOut)
def get_ai_config(vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    config = _get_config(db, vault.id)
    if not config:
        return schemas.AIConfigOut(configured=False, provider="anthropic", model="claude-opus-5", auto_approve_safe=False)
    return schemas.AIConfigOut(
        configured=bool(config.api_key), provider=config.provider, model=config.model, auto_approve_safe=config.auto_approve_safe
    )


@router.put("/config", response_model=schemas.AIConfigOut)
def set_ai_config(payload: schemas.AIConfigIn, vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    config = _get_config(db, vault.id)
    if not config:
        config = models.AIConfig(vault_id=vault.id)
        db.add(config)
    if payload.api_key is not None:
        config.api_key = payload.api_key or None
    if payload.provider is not None:
        config.provider = payload.provider
    if payload.model is not None:
        config.model = payload.model
    if payload.auto_approve_safe is not None:
        config.auto_approve_safe = payload.auto_approve_safe
    db.commit()
    db.refresh(config)
    return schemas.AIConfigOut(
        configured=bool(config.api_key), provider=config.provider, model=config.model, auto_approve_safe=config.auto_approve_safe
    )


@router.get("/actions", response_model=list[schemas.AIActionOut])
def list_actions(vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db), limit: int = 50):
    rows = (
        db.query(models.AIAction)
        .filter_by(vault_id=vault.id)
        .order_by(models.AIAction.created_at.desc())
        .limit(limit)
        .all()
    )
    return rows


@router.post("/context/preview")
def context_preview(payload: dict, vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    result = preview(index, payload.get("kind", "note"), payload)
    return {"note_count": result.note_count, "word_count": result.word_count, "tags": result.tags, "paths": result.paths}


def _tool_context(vault: models.Vault, db: Session) -> ToolContext:
    root = vault_root(vault)
    return ToolContext(root=root, index=get_index(root), db=db, vault_id=vault.id)


@router.post("/chat")
def chat(payload: schemas.AIChatRequest, vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    config = _get_config(db, vault.id)
    if not config or not config.api_key:
        raise HTTPException(status_code=400, detail="No AI provider configured for this vault yet.")

    provider = _provider_for(config)
    convo = agent_service.get_conversation(payload.conversation_id, vault.id)
    ctx = _tool_context(vault, db)

    message = payload.message
    if payload.context:
        index = get_index(vault_root(vault))
        context_text = build_context_text(index, payload.context.get("kind", "note"), payload.context)
        message = f"{context_text}\n\n{payload.message}"

    return StreamingResponse(_sse(agent_service.start_turn(convo, ctx, provider, message, config.auto_approve_safe)), media_type="text/event-stream")


@router.post("/confirm")
def confirm(payload: schemas.AIConfirmRequest, vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    config = _get_config(db, vault.id)
    if not config or not config.api_key:
        raise HTTPException(status_code=400, detail="No AI provider configured for this vault yet.")

    provider = _provider_for(config)
    convo = agent_service.get_conversation(payload.conversation_id, vault.id)
    ctx = _tool_context(vault, db)

    return StreamingResponse(
        _sse(agent_service.resolve_pending(convo, ctx, provider, payload.approved, config.auto_approve_safe)),
        media_type="text/event-stream",
    )

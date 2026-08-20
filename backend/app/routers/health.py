from __future__ import annotations

from fastapi import APIRouter, Depends

from app import models, schemas
from app.deps import get_vault, vault_root
from app.services import health_service, search_service
from app.services.index_service import get_index

router = APIRouter(prefix="/api/vaults/{vault_id}", tags=["health"])


@router.get("/health", response_model=schemas.HealthReportOut)
def knowledge_health(vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    report = health_service.health_report(index, all_declared_tags=list(search_service.all_tags(index).keys()))
    return schemas.HealthReportOut(**report.__dict__)


@router.get("/orphans")
def orphans(vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    return health_service.orphan_notes(index)


@router.get("/broken-links")
def broken_links(vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    return [
        {"target": bl.target, "referenced_from": bl.referenced_from}
        for bl in health_service.broken_links(index)
    ]


@router.get("/duplicates")
def duplicates(vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    return [
        {"a": d.a, "b": d.b, "similarity": d.similarity}
        for d in health_service.duplicate_candidates(index)
    ]


@router.get("/missing-attachments")
def missing_attachments(vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    return [
        {"target": m.target, "referenced_from": m.referenced_from}
        for m in health_service.missing_attachments(index)
    ]


@router.get("/invalid-properties")
def invalid_properties(vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    return health_service.invalid_properties(index)

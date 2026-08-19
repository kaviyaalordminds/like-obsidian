from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import (
    activity,
    ai,
    canvas,
    collections,
    daily_notes,
    folders,
    graph,
    health as health_router,
    import_export,
    notes,
    plugins,
    search,
    settings as settings_router,
    snapshots,
    templates,
    vaults,
)
from app.services.watcher_service import registry as watcher_registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield
    watcher_registry.stop_all()


app = FastAPI(title="Like-Obsidian API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(vaults.router)
app.include_router(notes.router)
app.include_router(folders.router)
app.include_router(search.router)
app.include_router(graph.router)
app.include_router(templates.router)
app.include_router(daily_notes.router)
app.include_router(settings_router.router)
app.include_router(import_export.router)
app.include_router(plugins.router)
app.include_router(health_router.router)
app.include_router(collections.router)
app.include_router(snapshots.router)
app.include_router(canvas.router)
app.include_router(activity.router)
app.include_router(ai.router)

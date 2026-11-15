"""Composition root of the modular monolith: picks an adapter for every port and mounts the modules."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .db import SessionLocal
from .modules.ai.adapters import ClaudeClient, NoLLM
from .modules.analytics import api as analytics_api
from .modules.identity import api as identity_api
from .modules.identity.adapters import DevAuthVerifier, FirebaseAuthVerifier
from .modules.ingestion.adapters import DEFAULT_EXTRACTORS, KeywordTopicClassifier
from .modules.ingestion.service import IngestionService
from .modules.library import api as library_api
from .modules.search.ranker import KeywordRanker
from .modules.search.semantic import SemanticSearch
from .platform.tasks import InlineTaskQueue, ThreadTaskQueue


def create_app() -> FastAPI:
    app = FastAPI(title="ReCall API", version="0.8.0", docs_url="/api/docs", openapi_url="/api/openapi.json")

    # ---- wire adapters to ports ----
    app.state.auth = (DevAuthVerifier() if config.AUTH_PROVIDER == "dev"
                      else FirebaseAuthVerifier(config.FIREBASE_PROJECT_ID))
    app.state.tasks = InlineTaskQueue() if config.TASK_QUEUE == "inline" else ThreadTaskQueue()
    app.state.llm = ClaudeClient(config.ANTHROPIC_API_KEY, config.AI_MODEL) if config.ANTHROPIC_API_KEY else NoLLM()
    app.state.search = SemanticSearch(app.state.llm, fallback=KeywordRanker())
    app.state.ingestion = IngestionService(DEFAULT_EXTRACTORS, KeywordTopicClassifier(), SessionLocal, app.state.llm)
    if app.state.llm.enabled:
        # summaries for items saved before the key was added
        app.state.tasks.enqueue(app.state.ingestion.backfill)

    if config.CORS_ORIGINS:
        app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])

    @app.get("/api/health")
    def health():
        return {"status": "ok", "ai": app.state.llm.enabled}

    app.include_router(identity_api.router, prefix="/api")
    app.include_router(library_api.router, prefix="/api")
    app.include_router(library_api.topics_router, prefix="/api")
    app.include_router(analytics_api.router, prefix="/api")

    # ---- serve the built SPA from the same container ----
    index = config.STATIC_DIR / "index.html"
    if index.exists():
        app.mount("/assets", StaticFiles(directory=config.STATIC_DIR / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            if path.startswith("api/"):
                raise HTTPException(404, "Not found")
            file = (config.STATIC_DIR / path).resolve()
            if path and file.is_file() and config.STATIC_DIR.resolve() in file.parents:
                return FileResponse(file)
            return FileResponse(index)

    return app


app = create_app()

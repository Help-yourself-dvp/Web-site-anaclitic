from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .db import Database
from .parser import import_ai_response

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("FKB_DATA_DIR", ROOT / "data"))
DB_PATH = Path(os.getenv("FKB_DB_PATH", DATA_DIR / "forum_knowledge_base.sqlite3"))
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
database = Database(DB_PATH)
app = FastAPI(title="Forum Knowledge Base", version="0.1.0")
# The service is intended for localhost. This also lets a locally loaded extension
# (whose origin is chrome-extension://...) send explicitly configured sync requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class SyncRequest(BaseModel):
    source: dict[str, Any]
    posts: list[dict[str, Any]] = Field(default_factory=list)
    run: dict[str, Any] | None = None


class ReportRequest(BaseModel):
    report: dict[str, Any]


class ResetRequest(BaseModel):
    source_id: str


class CleanRequest(BaseModel):
    source_id: str
    post_keys: list[str] = Field(default_factory=list)


class RawReportRequest(BaseModel):
    raw: str
    source_id: str = "manual-import"
    topic_id: str = "unknown-topic"


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "forum-knowledge-base", "fts5": database.fts5_available, "database": str(DB_PATH)}


@app.post("/api/sync")
def sync(request: SyncRequest) -> dict[str, Any]:
    database.upsert_source(request.source)
    saved = database.upsert_posts(str(request.source.get("source_id") or ""), request.posts)
    if request.run:
        database.upsert_run(request.run)
    return {"ok": True, "saved_posts": saved, "run_id": request.run.get("run_id") if request.run else None}


@app.post("/api/reports")
def save_report(request: ReportRequest) -> dict[str, Any]:
    database.upsert_report(request.report)
    return {"ok": True, "report_id": request.report.get("report_id"), "qa_count": len(request.report.get("qa_entries") or [])}


@app.post("/api/reset")
def reset(request: ResetRequest) -> dict[str, Any]:
    database.reset_collection(request.source_id)
    return {"ok": True, "source_id": request.source_id}


@app.post("/api/clean")
def clean(request: CleanRequest) -> dict[str, Any]:
    deleted = database.delete_post_keys(request.source_id, request.post_keys)
    return {"ok": True, "source_id": request.source_id, "deleted": deleted}


@app.post("/api/reports/import")
def import_report(request: RawReportRequest) -> dict[str, Any]:
    result = import_ai_response(request.raw, request.source_id, request.topic_id)
    database.upsert_report(result.report)
    return {
        "ok": True,
        "report": result.report,
        "valid_json": result.valid_json,
        "warnings": result.warnings,
        "unrecognized_qa": result.unrecognized_qa,
    }


@app.get("/api/sources")
def sources() -> dict[str, Any]:
    return {"sources": database.list_sources()}


@app.get("/api/posts")
def posts(source_id: str | None = None, limit: int = Query(100, ge=1, le=1000)) -> dict[str, Any]:
    return {"posts": database.list_posts(source_id, limit)}


@app.get("/api/reports")
def reports(source_id: str | None = None, limit: int = Query(50, ge=1, le=500)) -> dict[str, Any]:
    return {"reports": database.list_reports(source_id, limit)}


@app.get("/api/qa")
def qa(source_id: str | None = None, limit: int = Query(100, ge=1, le=500)) -> dict[str, Any]:
    return {"qa": database.list_qa(source_id, limit)}


@app.get("/api/search")
def search(q: str = Query(""), limit: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    return database.search(q, limit)


@app.get("/api/export/json")
def export_json() -> dict[str, Any]:
    return database.export_json()


@app.get("/api/export/markdown", response_class=PlainTextResponse)
def export_markdown() -> PlainTextResponse:
    return PlainTextResponse(
        database.export_markdown(),
        media_type="text/markdown",
        headers={"Content-Disposition": 'attachment; filename="forum-knowledge-base.md"'},
    )


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=500, detail="Не найден static/index.html")
    return FileResponse(index_file)


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def post_identity(post: dict[str, Any]) -> str:
    return str(post.get("post_id") or post.get("fingerprint") or post.get("canonical_post_url") or "unknown")


def post_ref(source_id: str, identity: str) -> str:
    return f"{source_id}|{identity}"


class Database:
    """Небольшой SQLite-слой. Он не загружает внешние URL и хранит только переданные данные."""

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.fts5_available = False
        self.initialize()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS sources (
                    source_id TEXT PRIMARY KEY,
                    source_name TEXT NOT NULL,
                    base_url TEXT NOT NULL,
                    topic_url TEXT NOT NULL,
                    title TEXT NOT NULL,
                    adapter_name TEXT NOT NULL,
                    last_checkpoint_post_id TEXT,
                    last_checkpoint_url TEXT,
                    last_checkpoint_page_url TEXT,
                    recent_known_ids_json TEXT NOT NULL DEFAULT '[]',
                    last_checked_at TEXT,
                    configuration_json TEXT NOT NULL DEFAULT '{}',
                    enabled INTEGER NOT NULL DEFAULT 1,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS posts (
                    source_id TEXT NOT NULL,
                    identity_key TEXT NOT NULL,
                    topic_id TEXT NOT NULL,
                    post_id TEXT,
                    canonical_post_url TEXT NOT NULL,
                    fingerprint TEXT NOT NULL,
                    author TEXT NOT NULL,
                    posted_at TEXT,
                    page_url TEXT NOT NULL,
                    body_text TEXT NOT NULL,
                    quotes_json TEXT NOT NULL,
                    links_json TEXT NOT NULL,
                    reply_to_urls_json TEXT NOT NULL,
                    image_urls_json TEXT NOT NULL,
                    local_image_paths_json TEXT NOT NULL,
                    collected_at TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    PRIMARY KEY (source_id, identity_key),
                    FOREIGN KEY (source_id) REFERENCES sources(source_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS runs (
                    run_id TEXT PRIMARY KEY,
                    source_id TEXT NOT NULL,
                    post_keys_json TEXT NOT NULL,
                    post_count INTEGER NOT NULL,
                    from_posted_at TEXT,
                    to_posted_at TEXT,
                    created_at TEXT NOT NULL,
                    stop_reason TEXT NOT NULL,
                    FOREIGN KEY (source_id) REFERENCES sources(source_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS reports (
                    report_id TEXT PRIMARY KEY,
                    source_id TEXT NOT NULL,
                    topic_id TEXT NOT NULL,
                    period_from TEXT,
                    period_to TEXT,
                    raw_ai_response TEXT NOT NULL,
                    parsed_summary TEXT NOT NULL,
                    structured_facts_json TEXT NOT NULL,
                    qa_entries_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS qa (
                    qa_id TEXT PRIMARY KEY,
                    report_id TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    question TEXT NOT NULL,
                    short_answer TEXT NOT NULL,
                    detailed_answer TEXT NOT NULL,
                    status TEXT NOT NULL,
                    tags_json TEXT NOT NULL,
                    device_topic TEXT NOT NULL,
                    source_post_urls_json TEXT NOT NULL,
                    external_urls_json TEXT NOT NULL,
                    first_seen_at TEXT,
                    updated_at TEXT,
                    confidence_note TEXT NOT NULL,
                    FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_posts_source_date ON posts(source_id, posted_at);
                CREATE INDEX IF NOT EXISTS idx_reports_source_date ON reports(source_id, created_at);
                """
            )
            for table, column in (
                ('sources', 'last_checkpoint_page_url'),
                ('posts', 'reply_to_urls_json'),
            ):
                try:
                    connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} TEXT")
                except sqlite3.OperationalError as error:
                    if "duplicate column name" not in str(error).lower():
                        raise
            try:
                connection.execute(
                    "CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(kind, ref_id UNINDEXED, source_id UNINDEXED, content)"
                )
                self.fts5_available = True
            except sqlite3.OperationalError:
                # Some custom Python builds do not include FTS5. The LIKE fallback remains usable.
                self.fts5_available = False

    @staticmethod
    def _json(value: Any, default: Any) -> str:
        try:
            return json.dumps(value if value is not None else default, ensure_ascii=False)
        except (TypeError, ValueError):
            return json.dumps(default, ensure_ascii=False)

    @staticmethod
    def _loads(value: str, default: Any) -> Any:
        try:
            return json.loads(value)
        except (TypeError, json.JSONDecodeError):
            return default

    def upsert_source(self, source: dict[str, Any]) -> None:
        source_id = str(source.get("source_id") or "").strip()
        if not source_id:
            raise ValueError("source.source_id обязателен")
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO sources (
                    source_id, source_name, base_url, topic_url, title, adapter_name,
                    last_checkpoint_post_id, last_checkpoint_url, last_checkpoint_page_url,
                    recent_known_ids_json, last_checked_at, configuration_json, enabled, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(source_id) DO UPDATE SET
                    source_name=excluded.source_name, base_url=excluded.base_url,
                    topic_url=excluded.topic_url, title=excluded.title,
                    adapter_name=excluded.adapter_name,
                    last_checkpoint_post_id=excluded.last_checkpoint_post_id,
                    last_checkpoint_url=excluded.last_checkpoint_url,
                    last_checkpoint_page_url=excluded.last_checkpoint_page_url,
                    recent_known_ids_json=excluded.recent_known_ids_json,
                    last_checked_at=excluded.last_checked_at,
                    configuration_json=excluded.configuration_json,
                    enabled=excluded.enabled, updated_at=excluded.updated_at
                """,
                (
                    source_id,
                    str(source.get("source_name") or source_id),
                    str(source.get("base_url") or ""),
                    str(source.get("topic_url") or ""),
                    str(source.get("title") or source_id),
                    str(source.get("adapter_name") or "generic-forum"),
                    source.get("last_checkpoint_post_id"),
                    source.get("last_checkpoint_url"),
                    source.get("last_checkpoint_page_url"),
                    self._json(source.get("recent_known_ids"), []),
                    source.get("last_checked_at"),
                    self._json(source.get("configuration"), {}),
                    1 if source.get("enabled", True) else 0,
                    utc_now(),
                ),
            )

    def upsert_posts(self, source_id: str, posts: Iterable[dict[str, Any]]) -> int:
        posts = list(posts)
        inserted_or_updated = 0
        with self.connect() as connection:
            for post in posts:
                identity = post_identity(post)
                connection.execute(
                    """
                    INSERT INTO posts (
                        source_id, identity_key, topic_id, post_id, canonical_post_url,
                        fingerprint, author, posted_at, page_url, body_text, quotes_json,
                        links_json, reply_to_urls_json, image_urls_json, local_image_paths_json, collected_at, content_hash
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(source_id, identity_key) DO UPDATE SET
                        topic_id=excluded.topic_id, post_id=excluded.post_id,
                        canonical_post_url=excluded.canonical_post_url,
                        author=excluded.author, posted_at=excluded.posted_at,
                        page_url=excluded.page_url, body_text=excluded.body_text,
                        quotes_json=excluded.quotes_json, links_json=excluded.links_json,
                        reply_to_urls_json=excluded.reply_to_urls_json,
                        image_urls_json=excluded.image_urls_json,
                        local_image_paths_json=excluded.local_image_paths_json,
                        collected_at=excluded.collected_at, content_hash=excluded.content_hash
                    """,
                    (
                        source_id,
                        identity,
                        str(post.get("topic_id") or "unknown-topic"),
                        post.get("post_id"),
                        str(post.get("canonical_post_url") or post.get("page_url") or ""),
                        str(post.get("fingerprint") or identity),
                        str(post.get("author") or "Неизвестный автор"),
                        post.get("posted_at"),
                        str(post.get("page_url") or ""),
                        str(post.get("body_text") or ""),
                        self._json(post.get("quotes"), []),
                        self._json(post.get("links"), []),
                        self._json(post.get("reply_to_urls"), []),
                        self._json(post.get("image_urls"), []),
                        self._json(post.get("local_image_paths"), []),
                        str(post.get("collected_at") or utc_now()),
                        str(post.get("content_hash") or ""),
                    ),
                )
                if self.fts5_available:
                    ref = post_ref(source_id, identity)
                    connection.execute("DELETE FROM search_fts WHERE kind = 'post' AND ref_id = ?", (ref,))
                    connection.execute(
                        "INSERT INTO search_fts(kind, ref_id, source_id, content) VALUES ('post', ?, ?, ?)",
                        (ref, source_id, f"{post.get('author', '')}\n{post.get('body_text', '')}\n{post.get('canonical_post_url', '')}"),
                    )
                inserted_or_updated += 1
        return inserted_or_updated

    def delete_post_keys(self, source_id: str, post_keys: Iterable[str]) -> int:
        prefix = f'{source_id}:'
        identities = [key[len(prefix):] if key.startswith(prefix) else key for key in post_keys]
        if not identities:
            return 0
        with self.connect() as connection:
            for identity in identities:
                connection.execute('DELETE FROM posts WHERE source_id = ? AND identity_key = ?', (source_id, identity))
                if self.fts5_available:
                    connection.execute(
                        "DELETE FROM search_fts WHERE kind = 'post' AND ref_id = ?",
                        (post_ref(source_id, identity),),
                    )
        return len(identities)

    def reset_collection(self, source_id: str) -> None:
        with self.connect() as connection:
            connection.execute('DELETE FROM runs WHERE source_id = ?', (source_id,))
            connection.execute('DELETE FROM posts WHERE source_id = ?', (source_id,))
            if self.fts5_available:
                connection.execute("DELETE FROM search_fts WHERE source_id = ? AND kind = 'post'", (source_id,))
            connection.execute(
                """
                UPDATE sources SET last_checkpoint_post_id = NULL,
                    last_checkpoint_url = NULL, last_checkpoint_page_url = NULL,
                    recent_known_ids_json = '[]',
                    last_checked_at = NULL, updated_at = ?
                WHERE source_id = ?
                """,
                (utc_now(), source_id),
            )

    def upsert_run(self, run: dict[str, Any]) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO runs (run_id, source_id, post_keys_json, post_count, from_posted_at, to_posted_at, created_at, stop_reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(run_id) DO UPDATE SET
                    post_keys_json=excluded.post_keys_json, post_count=excluded.post_count,
                    from_posted_at=excluded.from_posted_at, to_posted_at=excluded.to_posted_at,
                    created_at=excluded.created_at, stop_reason=excluded.stop_reason
                """,
                (
                    str(run.get("run_id") or ""),
                    str(run.get("source_id") or ""),
                    self._json(run.get("post_keys"), []),
                    int(run.get("post_count") or 0),
                    run.get("from_posted_at"),
                    run.get("to_posted_at"),
                    str(run.get("created_at") or utc_now()),
                    str(run.get("stop_reason") or "unknown"),
                ),
            )

    def upsert_report(self, report: dict[str, Any]) -> None:
        report_id = str(report.get("report_id") or "").strip()
        if not report_id:
            raise ValueError("report.report_id обязателен")
        source_id = str(report.get("source_id") or "manual-import")
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO reports (
                    report_id, source_id, topic_id, period_from, period_to, raw_ai_response,
                    parsed_summary, structured_facts_json, qa_entries_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(report_id) DO UPDATE SET
                    source_id=excluded.source_id, topic_id=excluded.topic_id,
                    period_from=excluded.period_from, period_to=excluded.period_to,
                    raw_ai_response=excluded.raw_ai_response, parsed_summary=excluded.parsed_summary,
                    structured_facts_json=excluded.structured_facts_json,
                    qa_entries_json=excluded.qa_entries_json, created_at=excluded.created_at
                """,
                (
                    report_id,
                    source_id,
                    str(report.get("topic_id") or "unknown-topic"),
                    report.get("period_from"),
                    report.get("period_to"),
                    str(report.get("raw_ai_response") or ""),
                    str(report.get("parsed_summary") or ""),
                    self._json(report.get("structured_facts"), {}),
                    self._json(report.get("qa_entries"), []),
                    str(report.get("created_at") or utc_now()),
                ),
            )
            connection.execute("DELETE FROM qa WHERE report_id = ?", (report_id,))
            connection.execute("DELETE FROM search_fts WHERE kind = 'report' AND ref_id = ?", (report_id,)) if self.fts5_available else None
            connection.execute("DELETE FROM search_fts WHERE kind = 'qa' AND source_id = ? AND ref_id LIKE ?", (source_id, f"{report_id}:%")) if self.fts5_available else None
            if self.fts5_available:
                connection.execute(
                    "INSERT INTO search_fts(kind, ref_id, source_id, content) VALUES ('report', ?, ?, ?)",
                    (report_id, source_id, str(report.get("parsed_summary") or "")),
                )
            for index, entry in enumerate(report.get("qa_entries") or []):
                qa_id = f"{report_id}:{index}"
                connection.execute(
                    """
                    INSERT INTO qa (
                        qa_id, report_id, source_id, question, short_answer, detailed_answer,
                        status, tags_json, device_topic, source_post_urls_json, external_urls_json,
                        first_seen_at, updated_at, confidence_note
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        qa_id,
                        report_id,
                        source_id,
                        str(entry.get("question") or ""),
                        str(entry.get("short_answer") or ""),
                        str(entry.get("detailed_answer") or ""),
                        str(entry.get("status") or "unconfirmed"),
                        self._json(entry.get("tags"), []),
                        str(entry.get("device_topic") or ""),
                        self._json(entry.get("source_post_urls"), []),
                        self._json(entry.get("external_urls"), []),
                        entry.get("first_seen_at"),
                        entry.get("updated_at"),
                        str(entry.get("confidence_note") or ""),
                    ),
                )
                if self.fts5_available:
                    connection.execute(
                        "INSERT INTO search_fts(kind, ref_id, source_id, content) VALUES ('qa', ?, ?, ?)",
                        (qa_id, source_id, f"{entry.get('question', '')}\n{entry.get('short_answer', '')}\n{entry.get('detailed_answer', '')}"),
                    )

    @staticmethod
    def _source_row(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "source_id": row["source_id"],
            "source_name": row["source_name"],
            "base_url": row["base_url"],
            "topic_url": row["topic_url"],
            "title": row["title"],
            "adapter_name": row["adapter_name"],
            "last_checkpoint_post_id": row["last_checkpoint_post_id"],
            "last_checkpoint_url": row["last_checkpoint_url"],
            "last_checkpoint_page_url": row["last_checkpoint_page_url"],
            "recent_known_ids": Database._loads(row["recent_known_ids_json"], []),
            "last_checked_at": row["last_checked_at"],
            "configuration": Database._loads(row["configuration_json"], {}),
            "enabled": bool(row["enabled"]),
        }

    @staticmethod
    def _post_row(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "source_id": row["source_id"],
            "topic_id": row["topic_id"],
            "post_id": row["post_id"],
            "canonical_post_url": row["canonical_post_url"],
            "fingerprint": row["fingerprint"],
            "author": row["author"],
            "posted_at": row["posted_at"],
            "page_url": row["page_url"],
            "body_text": row["body_text"],
            "quotes": Database._loads(row["quotes_json"], []),
            "links": Database._loads(row["links_json"], []),
            "reply_to_urls": Database._loads(row["reply_to_urls_json"], []),
            "image_urls": Database._loads(row["image_urls_json"], []),
            "local_image_paths": Database._loads(row["local_image_paths_json"], []),
            "collected_at": row["collected_at"],
            "content_hash": row["content_hash"],
        }

    @staticmethod
    def _report_row(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "report_id": row["report_id"],
            "source_id": row["source_id"],
            "topic_id": row["topic_id"],
            "period_from": row["period_from"],
            "period_to": row["period_to"],
            "raw_ai_response": row["raw_ai_response"],
            "parsed_summary": row["parsed_summary"],
            "structured_facts": Database._loads(row["structured_facts_json"], {}),
            "qa_entries": Database._loads(row["qa_entries_json"], []),
            "created_at": row["created_at"],
        }

    def list_sources(self) -> list[dict[str, Any]]:
        with self.connect() as connection:
            return [self._source_row(row) for row in connection.execute("SELECT * FROM sources ORDER BY updated_at DESC")]

    def list_posts(self, source_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        limit = max(1, min(int(limit), 1000))
        with self.connect() as connection:
            if source_id:
                rows = connection.execute(
                    "SELECT * FROM posts WHERE source_id = ? ORDER BY COALESCE(posted_at, collected_at) DESC LIMIT ?",
                    (source_id, limit),
                )
            else:
                rows = connection.execute(
                    "SELECT * FROM posts ORDER BY COALESCE(posted_at, collected_at) DESC LIMIT ?",
                    (limit,),
                )
            return [self._post_row(row) for row in rows]

    def list_reports(self, source_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        limit = max(1, min(int(limit), 500))
        with self.connect() as connection:
            if source_id:
                rows = connection.execute("SELECT * FROM reports WHERE source_id = ? ORDER BY created_at DESC LIMIT ?", (source_id, limit))
            else:
                rows = connection.execute("SELECT * FROM reports ORDER BY created_at DESC LIMIT ?", (limit,))
            return [self._report_row(row) for row in rows]

    def list_qa(self, source_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        limit = max(1, min(int(limit), 500))
        with self.connect() as connection:
            if source_id:
                rows = connection.execute("SELECT * FROM qa WHERE source_id = ? ORDER BY updated_at DESC, qa_id DESC LIMIT ?", (source_id, limit))
            else:
                rows = connection.execute("SELECT * FROM qa ORDER BY updated_at DESC, qa_id DESC LIMIT ?", (limit,))
            result = []
            for row in rows:
                result.append(
                    {
                        "qa_id": row["qa_id"],
                        "report_id": row["report_id"],
                        "source_id": row["source_id"],
                        "question": row["question"],
                        "short_answer": row["short_answer"],
                        "detailed_answer": row["detailed_answer"],
                        "status": row["status"],
                        "tags": self._loads(row["tags_json"], []),
                        "device_topic": row["device_topic"],
                        "source_post_urls": self._loads(row["source_post_urls_json"], []),
                        "external_urls": self._loads(row["external_urls_json"], []),
                        "first_seen_at": row["first_seen_at"],
                        "updated_at": row["updated_at"],
                        "confidence_note": row["confidence_note"],
                    }
                )
            return result

    def search(self, query: str, limit: int = 50) -> dict[str, list[dict[str, Any]]]:
        query = query.strip()
        limit = max(1, min(int(limit), 200))
        if not query:
            return {"posts": self.list_posts(limit=limit), "reports": self.list_reports(limit=limit), "qa": self.list_qa(limit=limit)}
        with self.connect() as connection:
            if self.fts5_available:
                tokens = [token for token in re.findall(r"[\w\-]+", query, flags=re.UNICODE) if token]
                match = " AND ".join(f'"{token.replace(chr(34), "")}"*' for token in tokens)
                if match:
                    rows = list(connection.execute("SELECT kind, ref_id FROM search_fts WHERE search_fts MATCH ? LIMIT ?", (match, limit * 3)))
                else:
                    rows = []
            else:
                like = f"%{query}%"
                post_rows = connection.execute(
                    "SELECT * FROM posts WHERE body_text LIKE ? OR author LIKE ? OR canonical_post_url LIKE ? LIMIT ?",
                    (like, like, like, limit),
                )
                report_rows = connection.execute("SELECT * FROM reports WHERE parsed_summary LIKE ? OR raw_ai_response LIKE ? LIMIT ?", (like, like, limit))
                qa_rows = list(connection.execute("SELECT * FROM qa WHERE question LIKE ? OR short_answer LIKE ? OR detailed_answer LIKE ? LIMIT ?", (like, like, like, limit)))
                qa = [
                    {
                        "qa_id": row["qa_id"], "report_id": row["report_id"], "source_id": row["source_id"],
                        "question": row["question"], "short_answer": row["short_answer"], "detailed_answer": row["detailed_answer"],
                        "status": row["status"], "tags": self._loads(row["tags_json"], []), "device_topic": row["device_topic"],
                        "source_post_urls": self._loads(row["source_post_urls_json"], []), "external_urls": self._loads(row["external_urls_json"], []),
                        "first_seen_at": row["first_seen_at"], "updated_at": row["updated_at"], "confidence_note": row["confidence_note"],
                    }
                    for row in qa_rows
                ]
                return {"posts": [self._post_row(row) for row in post_rows], "reports": [self._report_row(row) for row in report_rows], "qa": qa}

            post_refs = {(row["ref_id"]) for row in rows if row["kind"] == "post"}
            report_ids = {row["ref_id"] for row in rows if row["kind"] == "report"}
            qa_ids = {row["ref_id"] for row in rows if row["kind"] == "qa"}
            posts = []
            for ref in post_refs:
                source_id, identity = ref.split("|", 1) if "|" in ref else ("", ref)
                row = connection.execute("SELECT * FROM posts WHERE source_id = ? AND identity_key = ?", (source_id, identity)).fetchone()
                if row:
                    posts.append(self._post_row(row))
            reports = []
            for report_id in report_ids:
                row = connection.execute("SELECT * FROM reports WHERE report_id = ?", (report_id,)).fetchone()
                if row:
                    reports.append(self._report_row(row))
            qa = []
            for qa_id in qa_ids:
                row = connection.execute("SELECT * FROM qa WHERE qa_id = ?", (qa_id,)).fetchone()
                if row:
                    qa.append({
                        "qa_id": row["qa_id"], "report_id": row["report_id"], "source_id": row["source_id"],
                        "question": row["question"], "short_answer": row["short_answer"], "detailed_answer": row["detailed_answer"],
                        "status": row["status"], "tags": self._loads(row["tags_json"], []), "device_topic": row["device_topic"],
                        "source_post_urls": self._loads(row["source_post_urls_json"], []), "external_urls": self._loads(row["external_urls_json"], []),
                        "first_seen_at": row["first_seen_at"], "updated_at": row["updated_at"], "confidence_note": row["confidence_note"],
                    })
            return {"posts": posts[:limit], "reports": reports[:limit], "qa": qa[:limit]}

    def export_json(self) -> dict[str, Any]:
        return {"sources": self.list_sources(), "posts": self.list_posts(limit=1000), "reports": self.list_reports(limit=500), "qa": self.list_qa(limit=500)}

    def export_markdown(self) -> str:
        lines = ["# Forum Knowledge Base — экспорт", "", f"Создано: {utc_now()}", ""]
        for source in self.list_sources():
            lines.extend([f"## {source['title']}", f"Источник: {source['topic_url']}", f"Адаптер: {source['adapter_name']}", ""])
            posts = self.list_posts(source_id=source["source_id"], limit=1000)
            for post in reversed(posts):
                lines.extend([
                    f"### {post['author']} — {post.get('posted_at') or 'дата неизвестна'}",
                    f"[Открыть пост]({post['canonical_post_url']})",
                    "",
                    post["body_text"],
                    "",
                ])
        reports = self.list_reports(limit=500)
        if reports:
            lines.extend(["## Сводки ИИ", ""])
            for report in reports:
                lines.extend([f"### {report['structured_facts'].get('title') or report['report_id']}", f"Дата импорта: {report['created_at']}", "", report["parsed_summary"], ""])
        return "\n".join(lines).strip() + "\n"

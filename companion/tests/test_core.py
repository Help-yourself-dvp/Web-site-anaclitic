from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from companion.fkb_companion.db import Database
from companion.fkb_companion.parser import import_ai_response, validate_ai_response


class CompanionCoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db = Database(Path(self.temp_dir.name) / "test.sqlite3")
        self.source = {
            "source_id": "4pda:1108618", "source_name": "4PDA", "base_url": "https://4pda.to",
            "topic_url": "https://4pda.to/forum/index.php?showtopic=1108618", "title": "Тестовая тема",
            "adapter_name": "4pda", "last_checkpoint_post_id": "1", "last_checkpoint_url": "https://4pda.to/post/1",
            "last_checkpoint_page_url": "https://4pda.to/forum/index.php?showtopic=1108618&st=13260",
            "recent_known_ids": [], "last_checked_at": None, "configuration": {}, "enabled": True,
        }
        self.db.upsert_source(self.source)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def post(self, post_id: str, body: str) -> dict[str, object]:
        return {
            "source_id": self.source["source_id"], "topic_id": "1108618", "post_id": post_id,
            "canonical_post_url": f"https://4pda.to/post/{post_id}", "fingerprint": f"fp-{post_id}",
            "author": "tester", "posted_at": f"2026-08-26T00:0{post_id}:00+00:00",
            "page_url": self.source["topic_url"], "body_text": body, "quotes": [], "links": [], "reply_to_urls": [],
            "image_urls": [], "local_image_paths": [], "collected_at": "2026-08-26T00:00:00+00:00",
            "content_hash": f"hash-{post_id}",
        }

    def test_sqlite_upsert_is_idempotent(self) -> None:
        self.db.upsert_posts(self.source["source_id"], [self.post("1", "старое"), self.post("2", "новое")])
        self.db.upsert_posts(self.source["source_id"], [self.post("2", "новое, уточнено")])
        posts = self.db.list_posts(self.source["source_id"], 10)
        self.assertEqual(len(posts), 2)
        self.assertEqual({post["body_text"] for post in posts}, {"старое", "новое, уточнено"})

    def test_search_and_export(self) -> None:
        self.db.upsert_posts(self.source["source_id"], [self.post("2", "ошибка камеры")])
        result = self.db.search("ошибка")
        self.assertTrue(result["posts"])
        self.assertIn("ошибка камеры", self.db.export_markdown())

    def test_strict_json_and_markdown_fallback(self) -> None:
        payload = {
            "schema_version": "1.0", "report": {
                "title": "Отчёт", "period": {"from": None, "to": None}, "overview": "Коротко",
                "important_news": [], "confirmed_decisions": [], "bugs_and_problems": [], "rumors": [],
                "links": [], "things_to_check": [], "qa": [], "conflicts": [],
            }, "markdown_summary": "## Коротко",
        }
        self.assertTrue(validate_ai_response(payload).valid)
        imported = import_ai_response("## Q&A\nВопрос: Что делать?\nОтвет: Проверить настройки.", "source", "topic")
        self.assertFalse(imported.valid_json)
        self.assertEqual(len(imported.report["qa_entries"]), 1)
        self.assertTrue(imported.warnings)


if __name__ == "__main__":
    unittest.main()

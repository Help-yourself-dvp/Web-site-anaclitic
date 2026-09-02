from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

from .models import ImportResult, ValidationResult

QA_STATUSES = {"confirmed", "probable", "unconfirmed", "outdated", "conflicting"}
SECTIONS = ("important_news", "confirmed_decisions", "bugs_and_problems", "rumors")


def _record(value: Any) -> bool:
    return isinstance(value, dict)


def _extra_fields(value: dict[str, Any], allowed: set[str], path: str, errors: list[str]) -> None:
    for field in value:
        if field not in allowed:
            errors.append(f"{path}.{field} — неизвестное поле.")


def _string(value: Any, path: str, errors: list[str], nullable: bool = False) -> str | None:
    if isinstance(value, str):
        return value
    if nullable and value is None:
        return None
    errors.append(f"{path} должен быть строкой" + (" или null" if nullable else "") + ".")
    return "" if not nullable else None


def _string_array(value: Any, path: str, errors: list[str]) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        errors.append(f"{path} должен быть массивом строк.")
        return []
    return value


def _section_item(value: Any, path: str, errors: list[str]) -> dict[str, Any]:
    if not _record(value):
        errors.append(f"{path} должен быть объектом.")
        return {"title": "", "details": "", "status": "", "source_post_urls": [], "external_urls": []}
    _extra_fields(value, {"title", "details", "status", "source_post_urls", "external_urls"}, path, errors)
    return {
        "title": _string(value.get("title"), f"{path}.title", errors) or "",
        "details": _string(value.get("details"), f"{path}.details", errors) or "",
        "status": _string(value.get("status"), f"{path}.status", errors) or "",
        "source_post_urls": _string_array(value.get("source_post_urls"), f"{path}.source_post_urls", errors),
        "external_urls": _string_array(value.get("external_urls"), f"{path}.external_urls", errors),
    }


def _empty_qa() -> dict[str, Any]:
    return {
        "question": "", "short_answer": "", "detailed_answer": "", "status": "unconfirmed",
        "tags": [], "device_topic": "", "source_post_urls": [], "external_urls": [],
        "first_seen_at": None, "updated_at": None, "confidence_note": "",
    }


def _qa_item(value: Any, path: str, errors: list[str]) -> dict[str, Any]:
    if not _record(value):
        errors.append(f"{path} должен быть объектом.")
        return _empty_qa()
    _extra_fields(value, {"question", "short_answer", "detailed_answer", "status", "tags", "device_topic", "source_post_urls", "external_urls", "first_seen_at", "updated_at", "confidence_note"}, path, errors)
    status = _string(value.get("status"), f"{path}.status", errors) or "unconfirmed"
    if status not in QA_STATUSES:
        errors.append(f"{path}.status имеет недопустимое значение.")
        status = "unconfirmed"
    return {
        "question": _string(value.get("question"), f"{path}.question", errors) or "",
        "short_answer": _string(value.get("short_answer"), f"{path}.short_answer", errors) or "",
        "detailed_answer": _string(value.get("detailed_answer"), f"{path}.detailed_answer", errors) or "",
        "status": status,
        "tags": _string_array(value.get("tags"), f"{path}.tags", errors),
        "device_topic": _string(value.get("device_topic"), f"{path}.device_topic", errors) or "",
        "source_post_urls": _string_array(value.get("source_post_urls"), f"{path}.source_post_urls", errors),
        "external_urls": _string_array(value.get("external_urls"), f"{path}.external_urls", errors),
        "first_seen_at": _string(value.get("first_seen_at"), f"{path}.first_seen_at", errors, nullable=True),
        "updated_at": _string(value.get("updated_at"), f"{path}.updated_at", errors, nullable=True),
        "confidence_note": _string(value.get("confidence_note"), f"{path}.confidence_note", errors) or "",
    }


def validate_ai_response(value: Any) -> ValidationResult:
    errors: list[str] = []
    if not _record(value):
        return ValidationResult(False, None, ["Ответ должен быть JSON-объектом."])
    _extra_fields(value, {"schema_version", "report", "markdown_summary"}, "root", errors)
    if value.get("schema_version") != "1.0":
        errors.append('schema_version должен быть "1.0".')
    if not _record(value.get("report")):
        errors.append("Отсутствует объект report.")
    if not isinstance(value.get("markdown_summary"), str):
        errors.append("markdown_summary должен быть строкой.")
    report = value.get("report")
    if errors or not isinstance(report, dict):
        return ValidationResult(False, None, errors)
    _extra_fields(report, {"title", "period", "overview", "important_news", "confirmed_decisions", "bugs_and_problems", "rumors", "links", "things_to_check", "qa", "conflicts"}, "report", errors)
    period = report.get("period")
    if not _record(period):
        errors.append("report.period должен быть объектом.")
        period = {}
    else:
        _extra_fields(period, {"from", "to"}, "report.period", errors)
    normalized: dict[str, Any] = {
        "title": _string(report.get("title"), "report.title", errors) or "",
        "period": {
            "from": _string(period.get("from"), "report.period.from", errors, nullable=True),
            "to": _string(period.get("to"), "report.period.to", errors, nullable=True),
        },
        "overview": _string(report.get("overview"), "report.overview", errors) or "",
        "important_news": [], "confirmed_decisions": [], "bugs_and_problems": [], "rumors": [],
        "links": [],
        "things_to_check": _string_array(report.get("things_to_check"), "report.things_to_check", errors),
        "qa": [],
        "conflicts": _string_array(report.get("conflicts"), "report.conflicts", errors),
    }
    for section in SECTIONS:
        values = report.get(section)
        if not isinstance(values, list):
            errors.append(f"report.{section} должен быть массивом.")
        else:
            normalized[section] = [_section_item(item, f"report.{section}[{index}]", errors) for index, item in enumerate(values)]
    links = report.get("links")
    if not isinstance(links, list):
        errors.append("report.links должен быть массивом.")
    else:
        for index, item in enumerate(links):
            path = f"report.links[{index}]"
            if not _record(item):
                errors.append(f"{path} должен быть объектом.")
                continue
            _extra_fields(item, {"url", "annotation", "source_post_urls"}, path, errors)
            normalized["links"].append({
                "url": _string(item.get("url"), f"{path}.url", errors) or "",
                "annotation": _string(item.get("annotation"), f"{path}.annotation", errors) or "",
                "source_post_urls": _string_array(item.get("source_post_urls"), f"{path}.source_post_urls", errors),
            })
    qa = report.get("qa")
    if not isinstance(qa, list):
        errors.append("report.qa должен быть массивом.")
    else:
        normalized["qa"] = [_qa_item(item, f"report.qa[{index}]", errors) for index, item in enumerate(qa)]
    if errors:
        return ValidationResult(False, None, errors)
    return ValidationResult(
        True,
        {"schema_version": "1.0", "report": normalized, "markdown_summary": value["markdown_summary"]},
        [],
    )


def _find_json_object(raw: str) -> str | None:
    start = raw.find("{")
    if start < 0:
        return None
    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(raw)):
        char = raw[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return raw[start : index + 1]
    return None


def _extract_human_summary(raw: str, json_text: str | None) -> str:
    marker = re.search(r"(^|\n)\s*---MARKDOWN---\s*(?:\n|$)", raw, re.I)
    if marker:
        return raw[marker.end() :].strip()
    if json_text:
        after_json = raw[(raw.find(json_text) + len(json_text)) :].strip()
        if after_json:
            return after_json
    return ""


HTML_ENTITIES = {"amp": "&", "lt": "<", "gt": ">", "quot": '"', "apos": "'", "nbsp": " "}
_ENTITY_RE = re.compile(r"&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);")
_MARKDOWN_LINK_RE = re.compile(r"^\[([^\]]*)\]\(\s*<?([^)\s>]+)>?[^)]*\)$", re.S)
_ANGLE_RE = re.compile(r"^<(.*)>$", re.S)
_INLINE_URL_RE = re.compile(r"(https?://[^\s\"'<>()\[\],]+)", re.I)
_TRAILING_PUNCT_RE = re.compile(r"[,.;:]+$")

STATUS_ALIASES = {
    "confirmed": "confirmed", "verified": "confirmed", "решено": "confirmed",
    "подтверждено": "confirmed", "подтвержден": "confirmed", "подтверждена": "confirmed",
    "подтверждено пользователями": "confirmed",
    "probable": "probable", "likely": "probable", "вероятно": "probable",
    "возможно": "probable", "частично подтверждено": "probable",
    "unconfirmed": "unconfirmed", "unverified": "unconfirmed", "unknown": "unconfirmed",
    "не подтверждено": "unconfirmed", "неподтверждено": "unconfirmed", "без подтверждения": "unconfirmed",
    "outdated": "outdated", "stale": "outdated", "устарело": "outdated",
    "устаревшее": "outdated", "не актуально": "outdated",
    "conflicting": "conflicting", "disputed": "conflicting", "противоречиво": "conflicting",
    "противоречие": "conflicting", "противоречия": "conflicting",
}

ROOT_FIELDS = ("schema_version", "report", "markdown_summary")
SUMMARY_ALIASES = ("summary", "markdown", "human_summary", "readable_summary")
REPORT_FIELDS = (
    "title", "period", "overview", "important_news", "confirmed_decisions", "bugs_and_problems",
    "rumors", "links", "things_to_check", "qa", "conflicts",
)
SECTION_FIELDS = ("title", "details", "status", "source_post_urls", "external_urls")
LINK_FIELDS = ("url", "annotation", "source_post_urls")
QA_FIELDS = (
    "question", "short_answer", "detailed_answer", "status", "tags", "device_topic",
    "source_post_urls", "external_urls", "first_seen_at", "updated_at", "confidence_note",
)


def _decode_entities(value: str) -> str:
    def replace(match: re.Match[str]) -> str:
        code = match.group(1).lower()
        if code in HTML_ENTITIES:
            return HTML_ENTITIES[code]
        if not code.startswith("#"):
            return match.group(0)
        point = int(code[2:], 16) if code.startswith("#x") else int(code[1:])
        if point < 32 or point > 0x10FFFF:
            return match.group(0)
        return chr(point)

    return _ENTITY_RE.sub(replace, value)


def _clean_url(value: str) -> str:
    url = _decode_entities(value).strip()
    link = _MARKDOWN_LINK_RE.match(url)
    if link:
        url = (link.group(2) or link.group(1) or "").strip()
    url = _decode_entities(url)
    angle = _ANGLE_RE.match(url)
    if angle:
        url = angle.group(1).strip()
    if not re.match(r"^[a-z][a-z0-9+.-]*://", url, re.I):
        inline = _INLINE_URL_RE.search(url)
        if inline:
            url = inline.group(1)
    return _TRAILING_PUNCT_RE.sub("", url)


class _NormalizeStats:
    def __init__(self) -> None:
        self.urls = 0
        self.statuses = 0
        self.conflicts = 0
        self.dropped: list[str] = []


def _normalize_url_list(value: Any, stats: _NormalizeStats) -> list[str]:
    if value is None:
        return []
    items = value if isinstance(value, list) else [value] if isinstance(value, str) else []
    urls: list[str] = []
    for item in items:
        if not isinstance(item, str):
            continue
        cleaned = _clean_url(item)
        if not cleaned:
            continue
        if cleaned != item.strip():
            stats.urls += 1
        if cleaned not in urls:
            urls.append(cleaned)
    return urls


def _normalize_status(value: Any, stats: _NormalizeStats) -> Any:
    if not isinstance(value, str):
        return value
    raw = value.strip()
    key = re.sub(r"[.!?]+$", "", re.sub(r"\s+", " ", raw.lower()))
    mapped = STATUS_ALIASES.get(key)
    if mapped and mapped != raw:
        stats.statuses += 1
        return mapped
    return raw


def _pick_known(source: dict[str, Any], allowed: tuple[str, ...], path: str, stats: _NormalizeStats) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in source.items():
        if key in allowed:
            result[key] = value
        elif len(stats.dropped) < 12:
            stats.dropped.append(f"{path}.{key}")
    return result


def _conflict_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if not isinstance(value, dict):
        return ""
    stats = _NormalizeStats()

    def text(*fields: str) -> str:
        for field in fields:
            item = value.get(field)
            if isinstance(item, str) and item.strip():
                return item.strip()
        return ""

    title = text("title", "name", "topic", "question")
    details = text("description", "details", "text", "note", "comment")
    urls = _normalize_url_list(value.get("source_post_urls", value.get("urls", value.get("source_urls"))), stats)
    body = " — ".join(part for part in (title, details) if part)
    if not body:
        return ""
    return f"{body} (источники: {', '.join(urls)})" if urls else body


def _normalize_ai_answer(value: Any) -> tuple[Any, list[str]]:
    """Приводит ответ ИИ к схеме 1.0: conflicts-строки, чистые URL, статусы, поля вне схемы."""
    if not isinstance(value, dict):
        return value, []
    stats = _NormalizeStats()
    notes: list[str] = []
    root: dict[str, Any] = {field: value[field] for field in ROOT_FIELDS if field in value}
    if not isinstance(root.get("markdown_summary"), str):
        alias = next((key for key in SUMMARY_ALIASES if isinstance(value.get(key), str)), None)
        if alias:
            root["markdown_summary"] = value[alias]
            notes.append(f"markdown_summary взят из поля {alias}.")
    if isinstance(root.get("markdown_summary"), str):
        root["markdown_summary"] = _decode_entities(root["markdown_summary"])
    for key in value:
        if key not in ROOT_FIELDS and key not in SUMMARY_ALIASES and len(stats.dropped) < 12:
            stats.dropped.append(f"root.{key}")

    report_value = root.get("report")
    if isinstance(report_value, dict):
        report = _pick_known(report_value, REPORT_FIELDS, "report", stats)
        if isinstance(report.get("period"), dict):
            report["period"] = _pick_known(report["period"], ("from", "to"), "report.period", stats)
        for section in SECTIONS:
            items = report.get(section)
            if not isinstance(items, list):
                continue
            fixed_items = []
            for item in items:
                if not isinstance(item, dict):
                    fixed_items.append(item)
                    continue
                fixed = _pick_known(item, SECTION_FIELDS, f"report.{section}[]", stats)
                if "status" in fixed:
                    fixed["status"] = _normalize_status(fixed["status"], stats)
                fixed["source_post_urls"] = _normalize_url_list(fixed.get("source_post_urls"), stats)
                fixed["external_urls"] = _normalize_url_list(fixed.get("external_urls"), stats)
                fixed_items.append(fixed)
            report[section] = fixed_items
        links = report.get("links")
        if isinstance(links, list):
            fixed_links = []
            for item in links:
                if not isinstance(item, dict):
                    fixed_links.append(item)
                    continue
                fixed = _pick_known(item, LINK_FIELDS, "report.links[]", stats)
                if isinstance(fixed.get("url"), str):
                    cleaned = _clean_url(fixed["url"])
                    if cleaned != fixed["url"].strip():
                        stats.urls += 1
                    fixed["url"] = cleaned
                fixed["source_post_urls"] = _normalize_url_list(fixed.get("source_post_urls"), stats)
                fixed_links.append(fixed)
            report["links"] = fixed_links
        qa = report.get("qa")
        if isinstance(qa, list):
            fixed_qa = []
            for item in qa:
                if not isinstance(item, dict):
                    fixed_qa.append(item)
                    continue
                fixed = _pick_known(item, QA_FIELDS, "report.qa[]", stats)
                if "status" in fixed:
                    fixed["status"] = _normalize_status(fixed["status"], stats)
                fixed["source_post_urls"] = _normalize_url_list(fixed.get("source_post_urls"), stats)
                fixed["external_urls"] = _normalize_url_list(fixed.get("external_urls"), stats)
                fixed_qa.append(fixed)
            report["qa"] = fixed_qa
        if isinstance(report.get("things_to_check"), str):
            report["things_to_check"] = [report["things_to_check"]]
        if "conflicts" in report:
            conflicts = report["conflicts"]
            items = conflicts if isinstance(conflicts, list) else [conflicts]
            stats.conflicts += sum(1 for item in items if isinstance(item, dict))
            report["conflicts"] = [text for text in (_conflict_text(item) for item in items) if text]
        root["report"] = report

    if stats.conflicts:
        notes.append(f"report.conflicts: {stats.conflicts} объект(а) заменены на строки.")
    if stats.urls:
        notes.append(f"Ссылки очищены от Markdown-обёртки и HTML-экранирования: {stats.urls} шт.")
    if stats.statuses:
        notes.append(f"Статусы приведены к значениям схемы: {stats.statuses} шт.")
    if stats.dropped:
        notes.append(f"Поля вне схемы убраны (исходный ответ сохранён): {', '.join(stats.dropped)}.")
    return root, notes


def _repair_missing_fields(value: Any, human_summary: str) -> tuple[Any, list[str]]:
    if not isinstance(value, dict):
        return value, []
    root = dict(value)
    warnings: list[str] = []

    def note(path: str) -> None:
        if len(warnings) < 30:
            warnings.append(f"Автоматически добавлено поле {path}.")

    def is_missing(value: Any) -> bool:
        return value is None

    def as_string_array(value: Any, path: str) -> list[str] | None:
        if isinstance(value, str):
            return [value.strip()] if value.strip() else []
        if isinstance(value, list) and all(isinstance(item, str) for item in value):
            return value
        return None

    if is_missing(root.get("schema_version")):
        root["schema_version"] = "1.0"
        note("schema_version")
    if is_missing(root.get("markdown_summary")):
        report_value = root.get("report")
        root["markdown_summary"] = human_summary or (report_value.get("overview", "") if isinstance(report_value, dict) else "")
        note("markdown_summary")
    if root.get("markdown_summary") == "" and isinstance(root.get("summary"), str):
        root["markdown_summary"] = root.pop("summary")
        note("markdown_summary (из summary)")
    if not isinstance(root.get("report"), dict):
        return root, warnings
    report = dict(root["report"])
    root["report"] = report
    for field in ("title", "overview"):
        if is_missing(report.get(field)):
            report[field] = ""
            note(f"report.{field}")
    period = report.get("period")
    if not isinstance(period, dict):
        report["period"] = {"from": None, "to": None}
        if is_missing(period):
            note("report.period")
    else:
        period = dict(period)
        if is_missing(period.get("from")):
            period["from"] = None
            note("report.period.from")
        if is_missing(period.get("to")):
            period["to"] = None
            note("report.period.to")
        report["period"] = period
    for section in SECTIONS:
        if is_missing(report.get(section)):
            report[section] = []
            note(f"report.{section}")
            continue
        if not isinstance(report[section], list):
            continue
        fixed_items = []
        for item in report[section]:
            if not isinstance(item, dict):
                fixed_items.append(item)
                continue
            fixed = dict(item)
            defaults = (("title", ""), ("details", ""), ("status", "unconfirmed"), ("source_post_urls", []), ("external_urls", []))
            for field, fallback in defaults:
                value = fixed.get(field)
                if is_missing(value):
                    fixed[field] = fallback
                    note(f"report.{section}[].{field}")
                elif field in ("source_post_urls", "external_urls") and isinstance(value, str):
                    fixed[field] = as_string_array(value, f"report.{section}[].{field}") or fallback
                    note(f"report.{section}[].{field}")
            fixed_items.append(fixed)
        report[section] = fixed_items
    if is_missing(report.get("links")):
        report["links"] = []
        note("report.links")
    elif isinstance(report["links"], list):
        fixed_links = []
        for item in report["links"]:
            if not isinstance(item, dict):
                fixed_links.append(item)
                continue
            fixed = dict(item)
            for field, fallback in (("url", ""), ("annotation", ""), ("source_post_urls", [])):
                value = fixed.get(field)
                if is_missing(value):
                    fixed[field] = fallback
                    note(f"report.links[].{field}")
                elif field == "source_post_urls" and isinstance(value, str):
                    fixed[field] = as_string_array(value, f"report.links[].{field}") or fallback
                    note(f"report.links[].{field}")
            fixed_links.append(fixed)
        report["links"] = fixed_links
    for field in ("things_to_check", "qa", "conflicts"):
        value = report.get(field)
        if is_missing(value):
            report[field] = []
            note(f"report.{field}")
        elif isinstance(value, str):
            report[field] = as_string_array(value, f"report.{field}") or []
            note(f"report.{field}")
    if isinstance(report.get("qa"), list):
        fixed_qa = []
        defaults = (
            ("question", ""), ("short_answer", ""), ("detailed_answer", ""), ("status", "unconfirmed"),
            ("tags", []), ("device_topic", ""), ("source_post_urls", []), ("external_urls", []),
            ("first_seen_at", None), ("updated_at", None), ("confidence_note", ""),
        )
        for item in report["qa"]:
            if not isinstance(item, dict):
                fixed_qa.append(item)
                continue
            fixed = dict(item)
            for field, fallback in defaults:
                value = fixed.get(field)
                if is_missing(value):
                    fixed[field] = fallback
                    note(f"report.qa[].{field}")
                elif field in ("tags", "source_post_urls", "external_urls") and isinstance(value, str):
                    fixed[field] = as_string_array(value, f"report.qa[].{field}") or fallback
                    note(f"report.qa[].{field}")
            fixed_qa.append(fixed)
        report["qa"] = fixed_qa
    return root, warnings


def _markdown_qa(raw: str) -> tuple[list[dict[str, Any]], list[str]]:
    entries: list[dict[str, Any]] = []
    unrecognized: list[str] = []
    current: dict[str, Any] | None = None
    in_qa = False

    def save() -> None:
        nonlocal current
        if not current:
            return
        if current["question"] and (current["short_answer"] or current["detailed_answer"]):
            entries.append(current)
        elif current["question"]:
            unrecognized.append(current["question"])
        current = None

    for line in raw.splitlines():
        heading_match = re.match(r"^#{2,6}\s+(.+)$", line)
        heading = heading_match.group(1).strip() if heading_match else ""
        if heading:
            if re.search(r"q\s*&?\s*a|вопрос|ответы|частые вопросы", heading, re.I):
                save()
                in_qa = True
                continue
            if in_qa and current:
                save()
                current = {**_empty_qa(), "question": heading}
                continue
        if not in_qa:
            continue
        question_match = re.match(r"^(?:[-*]\s*)?(?:вопрос|question)\s*:\s*(.+)$", line, re.I)
        answer_match = re.match(r"^(?:[-*]\s*)?(?:ответ|answer)\s*:\s*(.+)$", line, re.I)
        if question_match:
            save()
            current = {**_empty_qa(), "question": question_match.group(1).strip()}
        elif answer_match:
            if current:
                current["short_answer"] = answer_match.group(1).strip()
                current["detailed_answer"] = current["short_answer"]
            else:
                unrecognized.append(answer_match.group(1).strip())
        elif current and line.strip() and not line.strip().startswith("#"):
            current["detailed_answer"] = f"{current['detailed_answer']}\n{line.strip()}".strip()
    save()
    if in_qa and not entries and not unrecognized:
        unrecognized.append("Раздел Q&A найден, но пары «Вопрос/Ответ» не распознаны.")
    return entries, unrecognized


def import_ai_response(raw: str, source_id: str = "manual-import", topic_id: str = "unknown-topic") -> ImportResult:
    raw = raw.strip()
    warnings: list[str] = []
    payload: dict[str, Any] | None = None
    valid_json = False
    repaired_json = False
    json_text = _find_json_object(raw)
    # Сводка, которую ИИ вынес отдельным блоком после ---MARKDOWN--- или после JSON.
    human_summary = _decode_entities(_extract_human_summary(raw, json_text))
    if json_text:
        try:
            parsed = json.loads(json_text)
            normalized, normalize_notes = _normalize_ai_answer(parsed)
            if isinstance(normalized, dict) and isinstance(normalized.get("markdown_summary"), str):
                json_summary = normalized["markdown_summary"].strip()
                if json_summary:
                    human_summary = human_summary or json_summary
            validation = validate_ai_response(normalized)
            if validation.valid and validation.value:
                payload = validation.value
                valid_json = True
                if normalize_notes:
                    repaired_json = True
                    warnings.append("Формат ответа ИИ автоматически приведён к схеме 1.0.")
                    warnings.extend(normalize_notes[:10])
            else:
                repaired, repair_warnings = _repair_missing_fields(normalized, human_summary)
                repaired_validation = validate_ai_response(repaired)
                if repaired_validation.valid and repaired_validation.value:
                    payload = repaired_validation.value
                    valid_json = True
                    repaired_json = True
                    warnings.append("JSON принят после автоматического приведения полей к схеме 1.0.")
                    warnings.extend(normalize_notes[:5] + repair_warnings[:5])
                else:
                    warnings.append("JSON найден, но не прошёл проверку даже после автоисправления. Сохранена Markdown-сводка.")
                    warnings.extend(repaired_validation.errors[:10])
        except json.JSONDecodeError as exc:
            warnings.append(f"JSON найден, но повреждён: {exc}")
    else:
        warnings.append("В ответе не найден JSON-блок; импортирован как Markdown.")
    markdown_entries, unrecognized = _markdown_qa(human_summary or raw)
    if payload is None:
        payload = {
            "schema_version": "1.0",
            "report": {
                "title": "Импортированная Markdown-сводка", "period": {"from": None, "to": None},
                "overview": human_summary or raw, "important_news": [], "confirmed_decisions": [], "bugs_and_problems": [],
                "rumors": [], "links": [], "things_to_check": [], "qa": markdown_entries, "conflicts": [],
            },
            "markdown_summary": human_summary or raw,
        }
    elif not payload["report"]["qa"] and markdown_entries:
        payload["report"]["qa"] = markdown_entries
        if valid_json:
            warnings.append("Q&A добавлены из отдельной Markdown-сводки.")
    report_id = f"report_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
    qa_entries = [{**entry, "related_report_id": report_id} for entry in payload["report"]["qa"]]
    report = {
        "report_id": report_id,
        "source_id": source_id or "manual-import",
        "topic_id": topic_id or "unknown-topic",
        "period_from": payload["report"]["period"]["from"],
        "period_to": payload["report"]["period"]["to"],
        "raw_ai_response": raw,
        "parsed_summary": human_summary or payload["markdown_summary"] or payload["report"]["overview"],
        "structured_facts": payload["report"],
        "qa_entries": qa_entries,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return ImportResult(report, valid_json, warnings, [] if valid_json else unrecognized, repaired_json)

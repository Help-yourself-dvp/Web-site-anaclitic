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
    human_summary = _extract_human_summary(raw, json_text)
    if json_text:
        try:
            parsed = json.loads(json_text)
            validation = validate_ai_response(parsed)
            if validation.valid and validation.value:
                payload = validation.value
                valid_json = True
            else:
                repaired, repair_warnings = _repair_missing_fields(parsed, human_summary)
                repaired_validation = validate_ai_response(repaired)
                if repaired_validation.valid and repaired_validation.value:
                    payload = repaired_validation.value
                    valid_json = True
                    repaired_json = bool(repair_warnings)
                    warnings.append("JSON принят после безопасного добавления отсутствующих необязательных полей.")
                    warnings.extend(repair_warnings[:10])
                else:
                    warnings.append("JSON найден, но не прошёл строгую проверку. Сохранена обычная Markdown-сводка.")
                    warnings.extend(validation.errors[:10])
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

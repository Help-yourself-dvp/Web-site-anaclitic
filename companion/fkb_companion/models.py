from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ValidationResult:
    valid: bool
    value: dict[str, Any] | None
    errors: list[str]


@dataclass(frozen=True)
class ImportResult:
    report: dict[str, Any]
    valid_json: bool
    warnings: list[str]
    unrecognized_qa: list[str]

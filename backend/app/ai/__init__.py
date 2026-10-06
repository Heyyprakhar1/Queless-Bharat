"""Assistive AI adapter interface.

Translates unstructured natural-language citizen reports into candidate
structured schema observations. Fails soft; non-blocking to core operations.
LLM integration and prompt parsing will be implemented in subsequent milestones per ADR-0004.
"""

from typing import Protocol, runtime_checkable


@runtime_checkable
class AIReportParser(Protocol):
    """Protocol boundary for assistive AI natural-language parsing implementations."""

    pass

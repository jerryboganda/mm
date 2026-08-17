"""Immutable acceptance constants for the authoritative Maternal Mind DOCX."""

from __future__ import annotations

from collections.abc import Iterable
import hashlib
from pathlib import Path
from typing import Final


AUTHORITATIVE_SOURCE_RELATIVE_PATH: Final = Path(
    "Maternal Mind Education Content/BOOK MATERNAL MIND BY DR.FARZANA MUNEER(FINAL).docx"
)
SOURCE_SHA256: Final = "f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605"
BOOK_COUNT: Final = 13
TOPIC_COUNT: Final = 285
MAX_FRAGMENT_UTF8_BYTES: Final = 48 * 1024
EXPECTED_BOOK_IDS: Final = tuple(f"book-mm-{number:02d}" for number in range(1, 14))


def authoritative_source(workspace_root: Path) -> Path:
    """Return the only DOCX accepted as input to the content compiler."""
    return Path(workspace_root) / AUTHORITATIVE_SOURCE_RELATIVE_PATH


def assert_authoritative_source(source: Path) -> Path:
    """Reject missing or altered source bytes before parsing begins."""
    source = Path(source)
    if not source.is_file():
        raise FileNotFoundError(f"Authoritative source does not exist: {source}")

    actual_digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if actual_digest != SOURCE_SHA256:
        raise ValueError(
            "Authoritative source digest mismatch: "
            f"expected {SOURCE_SHA256}, got {actual_digest}"
        )
    return source


def assert_compilation_invariants(
    book_ids: Iterable[str],
    topic_count: int,
) -> None:
    """Enforce the fixed source navigation topology used by every release."""
    actual_book_ids = tuple(book_ids)
    if actual_book_ids != EXPECTED_BOOK_IDS:
        raise ValueError(
            "Book topology mismatch: "
            f"expected {BOOK_COUNT} IDs {EXPECTED_BOOK_IDS}, got {len(actual_book_ids)} IDs "
            f"{actual_book_ids}"
        )
    if topic_count != TOPIC_COUNT:
        raise ValueError(
            f"Topic count mismatch: expected {TOPIC_COUNT}, got {topic_count}"
        )

"""Deterministic topic HTML fragmentation into atomic ReleaseBlocks."""

from __future__ import annotations

from hashlib import sha256
from typing import List
from lxml import html

from .model import ReleaseBlock

MAX_FRAGMENT_UTF8_BYTES: int = 48 * 1024  # 48 KiB safety ceiling for database rows / JSON payloads


def fragment_topic_html(
    html_text: str,
    *,
    source_sha256: str,
    topic_id: str,
    max_bytes: int = MAX_FRAGMENT_UTF8_BYTES,
) -> List[ReleaseBlock]:
    """Fragment topic HTML into deterministic, sized release blocks along top-level element boundaries."""
    if not html_text.strip():
        empty_digest = sha256(b"").hexdigest()
        return [
            ReleaseBlock(
                topic_id=topic_id,
                order=0,
                content="",
                content_sha256=empty_digest,
                source_sha256=source_sha256,
                block_type="document_html",
            )
        ]

    # Parse top-level elements using lxml fragment
    wrapped = f"<div>{html_text}</div>"
    root = html.fragment_fromstring(wrapped, create_parent=False)

    top_level_snippets: List[str] = []
    for child in root:
        snippet = html.tostring(child, encoding="unicode", method="html").strip()
        if snippet:
            top_level_snippets.append(snippet)

    if not top_level_snippets:
        top_level_snippets = [html_text]

    chunks: List[str] = []
    current_chunk: List[str] = []
    current_size = 0

    for snippet in top_level_snippets:
        snippet_bytes = len(snippet.encode("utf-8")) + 1  # newline separator
        if current_chunk and (current_size + snippet_bytes > max_bytes):
            chunks.append("\n".join(current_chunk))
            current_chunk = [snippet]
            current_size = snippet_bytes
        else:
            current_chunk.append(snippet)
            current_size += snippet_bytes

    if current_chunk:
        chunks.append("\n".join(current_chunk))

    blocks: List[ReleaseBlock] = []
    for order, chunk_content in enumerate(chunks):
        content_bytes = chunk_content.encode("utf-8")
        digest = sha256(content_bytes).hexdigest()
        blocks.append(
            ReleaseBlock(
                topic_id=topic_id,
                order=order,
                content=chunk_content,
                content_sha256=digest,
                source_sha256=source_sha256,
                block_type="document_html",
            )
        )

    return blocks

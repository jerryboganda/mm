"""Orchestrator for 100% deterministic, content-addressed book compilation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
from typing import Dict, List, Mapping, Optional, Sequence, Tuple

from .constants import BOOK_COUNT, TOPIC_COUNT, assert_compilation_invariants
from .drawings import DrawingCompiler
from .fragments import fragment_topic_html
from .html_renderer import TopicHtmlRenderer
from .manifest import (
    BookManifestEntry,
    MediaManifestEntry,
    ReleaseManifest,
    TopicManifestEntry,
)
from .media import MediaAsset, inventory_media, materialize_relationship
from .model import ReleaseBlock, TopicDocument
from .package import OOXMLPackage
from .topics import map_topic_documents


@dataclass(frozen=True)
class TopicCompilationResult:
    topic_id: str
    book_id: str
    title: str
    html: str
    blocks: List[ReleaseBlock]
    total_utf8_bytes: int


@dataclass(frozen=True)
class BookCompilationResult:
    source_sha256: str
    manifest: ReleaseManifest
    manifest_sha256: str
    topic_results: List[TopicCompilationResult]
    media_assets: List[MediaAsset]
    sql_script: str


def compile_book(
    package: OOXMLPackage,
    *,
    source_sha256: str,
    source_filename: str,
    output_release_dir: Path,
    output_media_dir: Path,
    media_url_prefix: str = "/uploads/content-images/maternal-mind-book",
    converter_script: Optional[Path] = None,
) -> BookCompilationResult:
    """Run end-to-end compilation of the authoritative DOCX package."""

    # 1. Map navigation hierarchy and topics
    mapping = map_topic_documents(package)
    assert_compilation_invariants(
        book_ids=[b.book_id for b in mapping.books],
        topic_count=len(mapping.topics),
    )

    # 2. Materialize and catalog all media assets
    media_assets: List[MediaAsset] = []
    media_hrefs: Dict[str, str] = {}
    media_entries: List[MediaManifestEntry] = []

    for rel_id, relationship in package.document_relationships.items():
        if relationship.relationship_type.endswith("/image") and relationship.target_part:
            asset = materialize_relationship(
                package,
                rel_id,
                output_media_dir,
                release_digest=source_sha256,
                topic_id="t-mm-media",
                source_path=relationship.source_path,
                converter_script=converter_script,
            )
            media_assets.append(asset)
            # URL exposed to mobile app reader & web
            web_url = f"{media_url_prefix}/{source_sha256}/media/{asset.output_path.name}"
            media_hrefs[rel_id] = web_url

            mime_type = "image/png" if asset.display_extension.lower() == ".png" else "image/jpeg"
            media_entries.append(
                MediaManifestEntry(
                    source_part=asset.source_part,
                    relationship_id=rel_id,
                    target_rel_path=f"{source_sha256}/media/{asset.output_path.name}",
                    sha256=asset.display_sha256,
                    mime_type=mime_type,
                    width=asset.width_px,
                    height=asset.height_px,
                    is_converted_from_emf=not asset.original_bytes_preserved,
                )
            )

    # 3. Setup Drawing compiler and HTML renderer
    drawing_compiler = DrawingCompiler(package, media_hrefs=media_hrefs)
    html_renderer = TopicHtmlRenderer(
        package,
        drawing_compiler=drawing_compiler,
        media_hrefs=media_hrefs,
    )

    # 4. Render and fragment each of the 285 topics
    topic_results: List[TopicCompilationResult] = []
    topic_entries: List[TopicManifestEntry] = []
    total_blocks = 0

    topics_dir = output_release_dir / source_sha256 / "topics"
    topics_dir.mkdir(parents=True, exist_ok=True)

    for topic_doc in mapping.topics:
        topic_id = topic_doc.boundary.topic_id
        book_id = topic_doc.boundary.book_id
        title = topic_doc.title

        topic_html = html_renderer.render_topic(topic_doc, source_sha256=source_sha256)
        blocks = fragment_topic_html(
            topic_html,
            source_sha256=source_sha256,
            topic_id=topic_id,
        )
        total_blocks += len(blocks)
        block_digests = [b.content_sha256 for b in blocks]
        utf8_bytes = len(topic_html.encode("utf-8"))

        topic_results.append(
            TopicCompilationResult(
                topic_id=topic_id,
                book_id=book_id,
                title=title,
                html=topic_html,
                blocks=blocks,
                total_utf8_bytes=utf8_bytes,
            )
        )

        topic_entries.append(
            TopicManifestEntry(
                topic_id=topic_id,
                book_id=book_id,
                title=title,
                block_count=len(blocks),
                block_digests=block_digests,
                total_utf8_bytes=utf8_bytes,
            )
        )

        # Write out per-topic json payload
        topic_json = {
            "topic_id": topic_id,
            "book_id": book_id,
            "title": title,
            "source_sha256": source_sha256,
            "block_count": len(blocks),
            "blocks": [
                {
                    "order": b.order,
                    "content": b.content,
                    "content_sha256": b.content_sha256,
                    "block_type": b.block_type,
                }
                for b in blocks
            ],
        }
        (topics_dir / f"{topic_id}.json").write_text(
            json.dumps(topic_json, indent=2), encoding="utf-8"
        )

    # 5. Build books manifest entries
    book_entries: List[BookManifestEntry] = []
    for book in mapping.books:
        count = sum(1 for t in topic_results if t.book_id == book.book_id)
        book_entries.append(
            BookManifestEntry(
                book_id=book.book_id,
                title=book.title,
                topic_count=count,
            )
        )

    # 6. Generate canonical ReleaseManifest
    manifest = ReleaseManifest(
        source_sha256=source_sha256,
        source_filename=source_filename,
        compiler_version="1.0.0",
        compiled_at=datetime.now(timezone.utc).isoformat(),
        book_count=len(book_entries),
        topic_count=len(topic_results),
        total_block_count=total_blocks,
        total_media_count=len(media_entries),
        books=book_entries,
        topics=topic_entries,
        media=media_entries,
    )

    manifest.write_to_directory(output_release_dir / source_sha256)

    # 7. Generate release SQL script for transactional migration
    sql_script = _generate_release_sql(topic_results, source_sha256=source_sha256)
    (output_release_dir / source_sha256 / "release.sql").write_text(sql_script, encoding="utf-8")

    return BookCompilationResult(
        source_sha256=source_sha256,
        manifest=manifest,
        manifest_sha256=manifest.manifest_sha256(),
        topic_results=topic_results,
        media_assets=media_assets,
        sql_script=sql_script,
    )


def _generate_release_sql(topic_results: Sequence[TopicCompilationResult], *, source_sha256: str) -> str:
    """Generate transactional SQL that updates content_blocks strictly for the 285 topics."""
    lines: List[str] = [
        "-- Transactional book content release script",
        f"-- Source SHA-256: {source_sha256}",
        "-- Strictly scoped to content_blocks for the 285 Maternal Mind topics.",
        "START TRANSACTION;",
        "",
    ]

    for topic in topic_results:
        # Delete existing blocks for this topic
        escaped_topic_id = topic.topic_id.replace("'", "''")
        lines.append(f"DELETE FROM content_blocks WHERE topic_id = '{escaped_topic_id}';")
        for block in topic.blocks:
            escaped_content = block.content.replace("'", "''")
            block_id = f"cb-book-{topic.topic_id}-{block.order}"
            lines.append(
                f'INSERT INTO content_blocks (id, topic_id, type, content, "order") '
                f"VALUES ('{block_id}', '{escaped_topic_id}', 'document_html', '{escaped_content}', {block.order});"
            )
        lines.append("")

    lines.append("COMMIT;")
    lines.append("")
    return "\n".join(lines)

"""Content-addressed release manifest generation and integrity verification."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha256
import json
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence

from .model import ReleaseBlock, TopicDocument


@dataclass(frozen=True)
class BookManifestEntry:
    book_id: str
    title: str
    topic_count: int


@dataclass(frozen=True)
class TopicManifestEntry:
    topic_id: str
    book_id: str
    title: str
    block_count: int
    block_digests: List[str]
    total_utf8_bytes: int


@dataclass(frozen=True)
class MediaManifestEntry:
    source_part: str
    relationship_id: str
    target_rel_path: str
    sha256: str
    mime_type: str
    width: Optional[int] = None
    height: Optional[int] = None
    is_converted_from_emf: bool = False


@dataclass(frozen=True)
class ReleaseManifest:
    source_sha256: str
    source_filename: str
    compiler_version: str
    compiled_at: str
    book_count: int
    topic_count: int
    total_block_count: int
    total_media_count: int
    books: List[BookManifestEntry]
    topics: List[TopicManifestEntry]
    media: List[MediaManifestEntry]

    def to_json_bytes(self) -> bytes:
        data = asdict(self)
        return json.dumps(data, indent=2, sort_keys=True).encode("utf-8")

    def manifest_sha256(self) -> str:
        return sha256(self.to_json_bytes()).hexdigest()

    def write_to_directory(self, release_dir: Path) -> Path:
        release_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = release_dir / "release_manifest.json"
        manifest_path.write_bytes(self.to_json_bytes())
        return manifest_path


def load_release_manifest(manifest_path: Path) -> ReleaseManifest:
    content = json.loads(manifest_path.read_text(encoding="utf-8"))
    books = [BookManifestEntry(**b) for b in content.get("books", [])]
    topics = [TopicManifestEntry(**t) for t in content.get("topics", [])]
    media = [MediaManifestEntry(**m) for m in content.get("media", [])]
    return ReleaseManifest(
        source_sha256=content["source_sha256"],
        source_filename=content["source_filename"],
        compiler_version=content["compiler_version"],
        compiled_at=content["compiled_at"],
        book_count=content["book_count"],
        topic_count=content["topic_count"],
        total_block_count=content["total_block_count"],
        total_media_count=content["total_media_count"],
        books=books,
        topics=topics,
        media=media,
    )

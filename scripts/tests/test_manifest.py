import json
from pathlib import Path
import tempfile
import unittest

from scripts.book_import.manifest import (
    BookManifestEntry,
    MediaManifestEntry,
    ReleaseManifest,
    TopicManifestEntry,
    load_release_manifest,
)


class ManifestTest(unittest.TestCase):
    def test_manifest_serialization_and_deserialization(self):
        manifest = ReleaseManifest(
            source_sha256="abc123source",
            source_filename="test.docx",
            compiler_version="1.0.0",
            compiled_at="2026-08-20T00:00:00Z",
            book_count=1,
            topic_count=1,
            total_block_count=1,
            total_media_count=0,
            books=[BookManifestEntry(book_id="book-1", title="Book 1", topic_count=1)],
            topics=[
                TopicManifestEntry(
                    topic_id="t-1",
                    book_id="book-1",
                    title="Topic 1",
                    block_count=1,
                    block_digests=["block_digest_1"],
                    total_utf8_bytes=100,
                )
            ],
            media=[],
        )

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            written_path = manifest.write_to_directory(tmp_path)
            self.assertTrue(written_path.is_file())

            loaded = load_release_manifest(written_path)
            self.assertEqual(loaded.source_sha256, manifest.source_sha256)
            self.assertEqual(loaded.book_count, 1)
            self.assertEqual(loaded.topic_count, 1)
            self.assertEqual(loaded.topics[0].topic_id, "t-1")


if __name__ == "__main__":
    unittest.main()

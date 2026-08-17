from pathlib import Path
import shutil
import tempfile
import unittest

from scripts.book_import.constants import (
    BOOK_COUNT,
    EXPECTED_BOOK_IDS,
    SOURCE_SHA256,
    TOPIC_COUNT,
    assert_authoritative_source,
    assert_compilation_invariants,
    authoritative_source,
)


class BookSourceContractTest(unittest.TestCase):
    def test_authoritative_source_accepts_the_tracked_docx(self):
        source = authoritative_source(Path.cwd())

        self.assertEqual(assert_authoritative_source(source), source)

    def test_authoritative_source_rejects_a_byte_tampered_copy(self):
        source = authoritative_source(Path.cwd())
        with tempfile.TemporaryDirectory() as temporary_directory:
            tampered = Path(temporary_directory) / source.name
            shutil.copyfile(source, tampered)
            tampered.write_bytes(tampered.read_bytes() + b"\\x00")

            with self.assertRaisesRegex(ValueError, SOURCE_SHA256):
                assert_authoritative_source(tampered)

    def test_compilation_invariants_accept_the_frozen_topology(self):
        self.assertIsNone(
            assert_compilation_invariants(
                EXPECTED_BOOK_IDS,
                TOPIC_COUNT,
            )
        )

    def test_compilation_invariants_reject_changed_book_or_topic_counts(self):
        with self.assertRaisesRegex(ValueError, str(BOOK_COUNT)):
            assert_compilation_invariants(EXPECTED_BOOK_IDS[:-1], TOPIC_COUNT)

        with self.assertRaisesRegex(ValueError, str(TOPIC_COUNT)):
            assert_compilation_invariants(EXPECTED_BOOK_IDS, TOPIC_COUNT - 1)

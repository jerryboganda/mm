from pathlib import Path
import unittest

from scripts.book_import.constants import authoritative_source, assert_authoritative_source
from scripts.book_import.package import OOXMLPackage
from scripts.book_import.topics import map_topic_documents


class FullBookBoundaryTest(unittest.TestCase):
    def test_authoritative_book_has_complete_bookmark_ownership(self):
        source = assert_authoritative_source(authoritative_source(Path.cwd()))
        result = map_topic_documents(OOXMLPackage.from_file(source))

        self.assertEqual(len(result.books), 13)
        self.assertEqual(len(result.topics), 285)
        self.assertEqual(result.unowned_body_nodes, [])
        self.assertEqual(result.multiply_owned_body_nodes, [])
        self.assertEqual(result.toc_anchor_count, 298)
        self.assertEqual(result.books[0].book_id, "book-mm-01")
        self.assertEqual(result.books[-1].book_id, "book-mm-13")
        self.assertEqual(result.topics[0].boundary.topic_id, "t-mm-01-001")
        self.assertEqual(result.topics[-1].boundary.topic_id, "t-mm-13-006")
        self.assertEqual(result.topics[0].boundary.anchor, "_Toc224216107")
        self.assertEqual(result.topics[-1].boundary.anchor, "_Toc224216403")


if __name__ == "__main__":
    unittest.main()

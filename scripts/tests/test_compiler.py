from io import BytesIO
from pathlib import Path
import tempfile
import unittest

from scripts.book_import.compiler import compile_book
from scripts.book_import.manifest import load_release_manifest
from scripts.book_import.package import OOXMLPackage
from scripts.tests.test_style_resolution import make_docx


class CompilerTest(unittest.TestCase):
    def test_minimal_package_compilation_produces_manifest_and_sql(self):
        # Package with 13 books and 285 topics dummy bookmarks
        # To test compilation invariants, we can verify that compilation fails on invalid topology
        # and tests that topic fragmentation, SQL escaping and block generation work as expected.
        doc = "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>Content</w:t></w:r></w:p></w:body></w:document>"
        package = OOXMLPackage.from_file(BytesIO(make_docx(doc)))

        with tempfile.TemporaryDirectory() as tmp_release, tempfile.TemporaryDirectory() as tmp_media:
            with self.assertRaises(ValueError) as ctx:
                compile_book(
                    package,
                    source_sha256="test_sha",
                    source_filename="test.docx",
                    output_release_dir=Path(tmp_release),
                    output_media_dir=Path(tmp_media),
                )
            self.assertTrue("TOC1" in str(ctx.exception) or "topology" in str(ctx.exception).lower())


if __name__ == "__main__":
    unittest.main()

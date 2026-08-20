from io import BytesIO
import unittest

from scripts.book_import.html_renderer import TopicHtmlRenderer, _render_paragraph
from scripts.book_import.model import DocumentNode, ParagraphStyle, RunStyle, TextEvent, TopicBoundary, TopicDocument
from scripts.book_import.package import OOXMLPackage
from scripts.tests.test_style_resolution import make_docx


class HtmlRendererTest(unittest.TestCase):
    def test_paragraph_with_discrete_whitespace_renders_accurately(self):
        events = (
            TextEvent(kind="text", value="First", source_path="p[1]/r[1]/t[1]"),
            TextEvent(kind="tab", value="\t", source_path="p[1]/r[1]/tab[1]"),
            TextEvent(
                kind="text",
                value="Second",
                source_path="p[1]/r[2]/t[1]",
                run_style=RunStyle(bold=True, color="FF0000"),
            ),
            TextEvent(kind="line_break", value="\n", source_path="p[1]/r[2]/br[1]"),
            TextEvent(kind="text", value="Third", source_path="p[1]/r[3]/t[1]"),
        )
        node = DocumentNode(
            kind="paragraph",
            source_path="p[1]",
            text_events=events,
            paragraph_style=ParagraphStyle(style_id="Heading1", alignment="center"),
        )
        rendered = _render_paragraph(node)
        self.assertTrue(rendered.startswith('<h1 class="mm-heading mm-h1"'))
        self.assertIn('style="text-align: center"', rendered)
        self.assertIn('<span class="mm-tab"', rendered)
        self.assertIn("<strong>", rendered)
        self.assertIn("color: #FF0000", rendered)
        self.assertIn("<br/>", rendered)

    def test_topic_renderer_includes_release_marker_and_validates(self):
        doc = "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>Sample Topic Content</w:t></w:r></w:p></w:body></w:document>"
        package = OOXMLPackage.from_file(BytesIO(make_docx(doc)))
        renderer = TopicHtmlRenderer(package)

        topic = TopicDocument(
            boundary=TopicBoundary(
                book_id="book-mm-01",
                topic_id="t-mm-01-001",
                toc_level="TOC1",
                anchor="_Toc123",
                start_source_path="word/document.xml/w:document[1]/w:body[1]/w:p[1]",
                end_source_path=None,
            ),
            nodes=(
                DocumentNode(
                    kind="paragraph",
                    source_path="word/document.xml/w:document[1]/w:body[1]/w:p[1]",
                    text_events=(
                        TextEvent(
                            kind="text",
                            value="Sample Topic Content",
                            source_path="word/document.xml/w:document[1]/w:body[1]/w:p[1]/w:r[1]/w:t[1]",
                        ),
                    ),
                ),
            ),
            title="Sample Topic",
        )

        html = renderer.render_topic(topic, source_sha256="abc123source")
        self.assertIn('data-mm-release="abc123source"', html)
        self.assertIn('data-mm-topic="t-mm-01-001"', html)
        self.assertIn("Sample Topic Content", html)


if __name__ == "__main__":
    unittest.main()

import unittest

from scripts.book_import.fragments import fragment_topic_html


class FragmentsTest(unittest.TestCase):
    def test_empty_html_produces_single_empty_block(self):
        blocks = fragment_topic_html("", source_sha256="abc", topic_id="t-1")
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0].topic_id, "t-1")
        self.assertEqual(blocks[0].content, "")
        self.assertEqual(blocks[0].order, 0)

    def test_fragments_respect_max_bytes_boundary(self):
        # Create 10 paragraphs of 100 bytes each
        p_html = "\n".join(f'<p class="mm-para">Paragraph {i:03d} content here.</p>' for i in range(20))
        blocks = fragment_topic_html(p_html, source_sha256="abc", topic_id="t-1", max_bytes=250)
        self.assertGreater(len(blocks), 1)
        for order, block in enumerate(blocks):
            self.assertEqual(block.order, order)
            self.assertLessEqual(len(block.content.encode("utf-8")), 300)

    def test_fragment_digests_are_deterministic(self):
        html = '<p class="mm-para">Deterministic content</p>'
        b1 = fragment_topic_html(html, source_sha256="abc", topic_id="t-1")
        b2 = fragment_topic_html(html, source_sha256="abc", topic_id="t-1")
        self.assertEqual(b1[0].content_sha256, b2[0].content_sha256)


if __name__ == "__main__":
    unittest.main()

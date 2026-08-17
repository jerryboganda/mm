from __future__ import annotations

from io import BytesIO
import unittest

from scripts.book_import.package import OOXMLPackage
from scripts.book_import.topics import (
    TopicMappingError,
    map_topic_documents,
    map_topics,
)
from scripts.tests.fixtures import make_docx


W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
BOOK_TOPIC_COUNTS = (22,) * 12 + (21,)
TOC_STYLES_XML = f"""<w:styles xmlns:w="{W}">
  <w:style w:type="paragraph" w:styleId="TOC1"/>
  <w:style w:type="paragraph" w:styleId="TOC2"/>
  <w:style w:type="paragraph" w:styleId="TOC3"/>
</w:styles>"""


def boundary_fixture(
    *,
    missing_anchor_at: int | None = None,
    duplicate_anchor_at: tuple[int, int] | None = None,
    unknown_anchor_at: int | None = None,
    extra_hyperlink_at: int | None = None,
    duplicate_bookmark_name: bool = False,
    swap_first_topic_bookmarks: bool = False,
    omit_last_topic: bool = False,
) -> OOXMLPackage:
    """Build the complete 13/285 topology with a recursively nested TOC."""
    toc_entries: list[tuple[str, str, str]] = []
    body_groups: list[list[str]] = []
    bookmark_id = 1
    topic_number = 0

    for book_number, topic_count in enumerate(BOOK_TOPIC_COUNTS, start=1):
        book_anchor = f"book-anchor-{book_number:02d}"
        toc_entries.append(("TOC1", book_anchor, f"BOOK {book_number:02d}"))
        group = [
            f'<w:p><w:bookmarkStart w:id="{bookmark_id}" w:name="{book_anchor}"/>'
            f'<w:r><w:t>BOOK {book_number:02d}</w:t></w:r>'
            f'<w:bookmarkEnd w:id="{bookmark_id}"/></w:p>'
        ]
        bookmark_id += 1
        for topic_in_book in range(1, topic_count + 1):
            topic_number += 1
            anchor = f"topic-anchor-{topic_number:03d}"
            title = "SAME TOPIC TITLE" if topic_number <= 2 else f"TOPIC {topic_number:03d}"
            level = "TOC3" if topic_number % 2 == 0 else "TOC2"
            toc_entries.append((level, anchor, title))
            group.append(
                f'<w:p><w:bookmarkStart w:id="{bookmark_id}" w:name="{anchor}"/>'
                f'<w:r><w:t>{title}</w:t></w:r>'
                f'<w:bookmarkEnd w:id="{bookmark_id}"/></w:p>'
            )
            bookmark_id += 1
            group.append(f'<w:p><w:r><w:t>Body for {anchor}</w:t></w:r></w:p>')
            if topic_number == 1:
                group.append(
                    '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>First topic table</w:t>'
                    '</w:r></w:p></w:tc></w:tr></w:tbl>'
                )
        body_groups.append(group)

    if omit_last_topic:
        toc_entries.pop()
        body_groups[-1] = body_groups[-1][:-2]

    rendered_toc: list[str] = []
    for index, (level, original_anchor, title) in enumerate(toc_entries):
        anchor = original_anchor
        if duplicate_anchor_at is not None and index == duplicate_anchor_at[0]:
            anchor = toc_entries[duplicate_anchor_at[1]][1]
        if unknown_anchor_at == index:
            anchor = "not-a-bookmark"
        anchor_attribute = "" if missing_anchor_at == index else f' w:anchor="{anchor}"'
        extra_hyperlink = (
            '<w:hyperlink w:anchor="second-anchor"><w:r><w:t>SECOND</w:t></w:r></w:hyperlink>'
            if extra_hyperlink_at == index
            else ""
        )
        rendered_toc.append(
            f'<w:p><w:pPr><w:pStyle w:val="{level}"/></w:pPr>'
            f'<w:hyperlink{anchor_attribute}><w:r><w:t>{title}</w:t></w:r></w:hyperlink>'
            f'{extra_hyperlink}</w:p>'
        )

    if swap_first_topic_bookmarks:
        first_group = body_groups[0]
        first_group[1], first_group[4] = first_group[4], first_group[1]

    duplicate_bookmark = (
        f'<w:p><w:bookmarkStart w:id="{bookmark_id}" w:name="topic-anchor-001"/>'
        f'<w:bookmarkEnd w:id="{bookmark_id}"/></w:p>'
        if duplicate_bookmark_name
        else ""
    )
    nested_toc = (
        '<w:sdt><w:sdtContent><w:p><w:r><w:t>Generated contents</w:t></w:r></w:p>'
        '<w:sdt><w:sdtContent>'
        + "".join(rendered_toc)
        + '</w:sdtContent></w:sdt></w:sdtContent></w:sdt>'
    )
    document = (
        f'<w:document xmlns:w="{W}"><w:body>'
        '<w:p><w:r><w:t>COVER MUST BE EXCLUDED</w:t></w:r></w:p>'
        + nested_toc
        + "".join(node for group in body_groups for node in group)
        + duplicate_bookmark
        + '<w:p><w:r><w:t>FINAL TOPIC TAIL</w:t></w:r></w:p>'
        + '<w:sectPr/>'
        + '</w:body></w:document>'
    )
    return OOXMLPackage.from_file(
        BytesIO(make_docx(document, styles_xml=TOC_STYLES_XML))
    )


def duplicate_title_fixture() -> OOXMLPackage:
    return boundary_fixture()


class TopicBoundaryTest(unittest.TestCase):
    def test_nested_toc_maps_books_and_topics_by_sequence(self):
        result = map_topic_documents(boundary_fixture())

        self.assertEqual([book.book_id for book in result.books], [f"book-mm-{i:02d}" for i in range(1, 14)])
        self.assertEqual(len(result.topics), 285)
        self.assertEqual(result.topics[0].boundary.topic_id, "t-mm-01-001")
        self.assertEqual(result.topics[21].boundary.topic_id, "t-mm-01-022")
        self.assertEqual(result.topics[22].boundary.topic_id, "t-mm-02-001")
        self.assertEqual(result.topics[-1].boundary.topic_id, "t-mm-13-021")
        self.assertEqual(result.topics[0].boundary.toc_level, "TOC2")
        self.assertEqual(result.topics[1].boundary.toc_level, "TOC3")
        self.assertEqual(result.toc_anchor_count, 298)

    def test_duplicate_titles_are_mapped_by_unique_bookmark_not_text(self):
        mapping = map_topics(duplicate_title_fixture())

        self.assertNotEqual(mapping[0].anchor, mapping[1].anchor)
        self.assertEqual([m.topic_id for m in mapping[:2]], ["t-mm-01-001", "t-mm-01-002"])

    def test_ownership_excludes_cover_and_generated_toc_and_preserves_events(self):
        result = map_topic_documents(boundary_fixture())
        first = result.topics[0]
        final = result.topics[-1]

        self.assertEqual([node.kind for node in first.nodes], ["paragraph", "paragraph", "table"])
        self.assertEqual(
            [event.value for node in first.nodes for event in node.text_events if event.kind == "text"],
            ["SAME TOPIC TITLE", "Body for topic-anchor-001", "First topic table"],
        )
        self.assertNotIn(
            "COVER MUST BE EXCLUDED",
            [event.value for topic in result.topics for node in topic.nodes for event in node.text_events],
        )
        self.assertEqual(
            [event.value for node in final.nodes for event in node.text_events if event.kind == "text"][-1],
            "FINAL TOPIC TAIL",
        )
        self.assertEqual(result.unowned_body_nodes, [])
        self.assertEqual(result.multiply_owned_body_nodes, [])

    def test_missing_anchor_is_rejected(self):
        with self.assertRaisesRegex(TopicMappingError, r"TOC1.*exactly one hyperlink anchor.*found 0"):
            map_topics(boundary_fixture(missing_anchor_at=0))

    def test_more_than_one_hyperlink_anchor_is_rejected(self):
        with self.assertRaisesRegex(TopicMappingError, r"TOC2.*exactly one hyperlink anchor.*found 2"):
            map_topics(boundary_fixture(extra_hyperlink_at=1))

    def test_duplicate_toc_anchor_is_rejected(self):
        with self.assertRaisesRegex(TopicMappingError, r"Duplicate TOC anchor topic-anchor-001"):
            map_topics(boundary_fixture(duplicate_anchor_at=(2, 1)))

    def test_unknown_anchor_is_rejected(self):
        with self.assertRaisesRegex(TopicMappingError, r"Unknown TOC anchor not-a-bookmark"):
            map_topics(boundary_fixture(unknown_anchor_at=1))

    def test_duplicate_matching_bookmark_start_is_rejected(self):
        with self.assertRaisesRegex(TopicMappingError, r"topic-anchor-001.*matching bookmarkStart.*found 2"):
            map_topics(boundary_fixture(duplicate_bookmark_name=True))

    def test_out_of_order_anchor_is_rejected(self):
        with self.assertRaisesRegex(TopicMappingError, r"out of document order.*topic-anchor-002"):
            map_topics(boundary_fixture(swap_first_topic_bookmarks=True))

    def test_wrong_topic_count_is_rejected(self):
        with self.assertRaisesRegex(TopicMappingError, r"Expected 285 TOC2/TOC3 entries, got 284"):
            map_topics(boundary_fixture(omit_last_topic=True))


if __name__ == "__main__":
    unittest.main()

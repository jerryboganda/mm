from io import BytesIO
from pathlib import Path
import unittest

from scripts.book_import.constants import authoritative_source
from scripts.book_import.numbering import (
    ListParagraph,
    NumberingError,
    NumberingResolver,
    build_list_tree,
    inventory,
    render_list_tree,
)
from scripts.book_import.package import OOXMLPackage
from scripts.tests.fixtures import make_docx


W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def _level(
    ilvl,
    number_format,
    level_text,
    *,
    start=1,
    suffix="space",
    left=720,
    hanging=360,
    restart=None,
):
    restart_xml = "" if restart is None else f'<w:lvlRestart w:val="{restart}"/>'
    return f"""<w:lvl w:ilvl="{ilvl}">
      <w:start w:val="{start}"/><w:numFmt w:val="{number_format}"/>
      <w:lvlText w:val="{level_text}"/><w:suff w:val="{suffix}"/>{restart_xml}
      <w:pPr><w:ind w:left="{left}" w:hanging="{hanging}"/></w:pPr>
    </w:lvl>"""


LEVELS = (
    _level(0, "decimal", "%1."),
    _level(1, "lowerLetter", "%1.%2)"),
    _level(2, "lowerRoman", "%3."),
    _level(3, "upperRoman", "%4."),
    _level(4, "upperLetter", "%5."),
    _level(5, "decimal", "%6."),
    _level(6, "lowerLetter", "%7."),
    _level(7, "lowerRoman", "%8."),
    _level(8, "decimal", "%9."),
)

NUMBERING_XML = f"""<w:numbering xmlns:w="{W}">
  <w:abstractNum w:abstractNumId="10">{''.join(LEVELS)}</w:abstractNum>
  <w:abstractNum w:abstractNumId="11">{_level(0, 'bullet', '•', suffix='tab', left=540, hanging=180)}</w:abstractNum>
  <w:abstractNum w:abstractNumId="12">{_level(0, 'upperLetter', '%1.')}</w:abstractNum>
  <w:num w:numId="20"><w:abstractNumId w:val="10"/></w:num>
  <w:num w:numId="21"><w:abstractNumId w:val="10"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="4"/></w:lvlOverride></w:num>
  <w:num w:numId="22"><w:abstractNumId w:val="11"/></w:num>
  <w:num w:numId="23"><w:abstractNumId w:val="12"/></w:num>
  <w:num w:numId="24"><w:abstractNumId w:val="10"><!-- invalid child ignored by XML model --></w:abstractNumId>
    <w:lvlOverride w:ilvl="1"><w:startOverride w:val="5"/><w:lvl w:ilvl="1">
      <w:start w:val="2"/><w:numFmt w:val="upperRoman"/><w:lvlText w:val="§ %1-(%2)"/>
      <w:suff w:val="nothing"/><w:pPr><w:ind w:left="1440" w:hanging="300"/></w:pPr>
    </w:lvl></w:lvlOverride>
  </w:num>
</w:numbering>"""

STYLES_XML = f"""<w:styles xmlns:w="{W}">
  <w:style w:type="paragraph" w:styleId="ListBase"><w:pPr><w:numPr>
    <w:ilvl w:val="0"/><w:numId w:val="20"/>
  </w:numPr></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListChild"><w:basedOn w:val="ListBase"/></w:style>
</w:styles>"""


def _paragraph(text, *, num_id=None, ilvl=None, style=None):
    style_xml = "" if style is None else f'<w:pStyle w:val="{style}"/>'
    num_xml = ""
    if num_id is not None or ilvl is not None:
        num_id_xml = "" if num_id is None else f'<w:numId w:val="{num_id}"/>'
        ilvl_xml = "" if ilvl is None else f'<w:ilvl w:val="{ilvl}"/>'
        num_xml = f"<w:numPr>{ilvl_xml}{num_id_xml}</w:numPr>"
    return f"<w:p><w:pPr>{style_xml}{num_xml}</w:pPr><w:r><w:t>{text}</w:t></w:r></w:p>"


def _package(paragraphs, *, numbering_xml=NUMBERING_XML, styles_xml=STYLES_XML):
    document = f'<w:document xmlns:w="{W}"><w:body>{"".join(paragraphs)}</w:body></w:document>'
    return OOXMLPackage.from_file(
        BytesIO(make_docx(document, numbering_xml=numbering_xml, styles_xml=styles_xml))
    )


def _list_paragraphs(package):
    resolver = NumberingResolver(package)
    result = []
    for paragraph in package.document.findall(f".//{{{W}}}p"):
        numbering = resolver.resolve_paragraph(paragraph)
        if numbering is None:
            continue
        text = "".join(node.text or "" for node in paragraph.findall(f".//{{{W}}}t"))
        result.append(ListParagraph(package.source_path(paragraph), text, numbering))
    return tuple(result)


def render_numbering_fixture(name):
    if name != "same-level-new-num-id":
        raise AssertionError(f"Unknown hand-authored fixture {name}")
    package = _package(
        (
            _paragraph("First list", num_id="20", ilvl=0),
            _paragraph("Restarted list", num_id="21", ilvl=0),
        )
    )
    return render_list_tree(build_list_tree(_list_paragraphs(package)))


class NumberingResolutionTest(unittest.TestCase):
    def test_resolves_all_supported_formats_and_levels_zero_through_eight(self):
        package = _package(
            tuple(
                _paragraph(f"Level {level}", num_id="20", ilvl=level)
                for level in range(9)
            )
            + (
                _paragraph("Bullet", num_id="22", ilvl=0),
                _paragraph("Upper letter", num_id="23", ilvl=0),
            )
        )

        resolved = [
            NumberingResolver(package).resolve_paragraph(paragraph)
            for paragraph in package.document.findall(f".//{{{W}}}p")
        ]

        self.assertEqual([item.level for item in resolved[:9]], list(range(9)))
        self.assertEqual(
            [item.number_format for item in resolved[:5]],
            ["decimal", "lowerLetter", "lowerRoman", "upperRoman", "upperLetter"],
        )
        self.assertEqual(resolved[9].number_format, "bullet")
        self.assertEqual(resolved[9].level_text, "•")
        self.assertEqual(resolved[10].number_format, "upperLetter")

    def test_level_override_preserves_start_custom_text_suffix_and_indentation(self):
        package = _package((_paragraph("Literal item", num_id="24", ilvl=1),))
        paragraph = package.document.find(f".//{{{W}}}p")

        level = NumberingResolver(package).resolve_paragraph(paragraph)

        self.assertEqual(level.start, 5)
        self.assertEqual(level.number_format, "upperRoman")
        self.assertEqual(level.level_text, "§ %1-(%2)")
        self.assertEqual(level.suffix, "nothing")
        self.assertEqual(level.left_indent_twips, 1440)
        self.assertEqual(level.hanging_indent_twips, 300)

    def test_paragraph_style_numbering_is_inherited_without_direct_num_pr(self):
        package = _package((_paragraph("Styled list", style="ListChild"),))
        paragraph = package.document.find(f".//{{{W}}}p")

        level = NumberingResolver(package).resolve_paragraph(paragraph)

        self.assertEqual(level.num_id, "20")
        self.assertEqual(level.level, 0)
        self.assertEqual(level.number_format, "decimal")

    def test_direct_num_pr_overrides_style_numbering_one_property_at_a_time(self):
        package = _package(
            (
                _paragraph("Direct level", ilvl=1, style="ListChild"),
                _paragraph("Direct definition", num_id="24", style="ListChild"),
            )
        )
        paragraphs = package.document.findall(f".//{{{W}}}p")

        direct_level = NumberingResolver(package).resolve_paragraph(paragraphs[0])
        direct_definition = NumberingResolver(package).resolve_paragraph(paragraphs[1])

        self.assertEqual((direct_level.num_id, direct_level.level), ("20", 1))
        self.assertEqual(
            (direct_definition.num_id, direct_definition.level), ("24", 0)
        )


class ListTreeTest(unittest.TestCase):
    def test_continuation_and_nested_levels_follow_ilvl_and_preserve_text(self):
        literal = "pre-eclamsia  5\u00a0mg/dL & care"
        package = _package(
            (
                _paragraph(literal.replace("&", "&amp;"), num_id="20", ilvl=0),
                _paragraph("Nested one", num_id="20", ilvl=1),
                _paragraph("Nested two", num_id="20", ilvl=1),
                _paragraph("Second parent", num_id="20", ilvl=0),
            )
        )

        tree = build_list_tree(_list_paragraphs(package))

        self.assertEqual(len(tree), 1)
        self.assertEqual(tree[0].level, 0)
        self.assertEqual([item.marker_value for item in tree[0].items], [1, 2])
        self.assertEqual(tree[0].items[0].paragraph.text, literal)
        self.assertEqual(len(tree[0].items[0].children), 1)
        self.assertEqual(
            [item.marker_value for item in tree[0].items[0].children[0].items],
            [1, 2],
        )
        self.assertEqual(
            [item.marker_text for item in tree[0].items[0].children[0].items],
            ["1.a)", "1.b)"],
        )

        html = render_list_tree(tree)
        self.assertIn("pre-eclamsia  5\u00a0mg/dL &amp; care", html)
        self.assertIn('class="list-marker">1.a) ', html)
        self.assertIn('style="list-style-type:decimal;', html)

    def test_num_id_change_does_not_invent_a_deeper_level(self):
        html = render_numbering_fixture("same-level-new-num-id")
        self.assertEqual(html.count("<ol"), 2)
        self.assertNotIn("<ol><li><ol>", html)
        self.assertIn('<ol start="4"', html)

    def test_start_override_and_new_num_id_are_an_explicit_restart(self):
        package = _package(
            (
                _paragraph("One", num_id="20", ilvl=0),
                _paragraph("Two", num_id="20", ilvl=0),
                _paragraph("Four", num_id="21", ilvl=0),
                _paragraph("Five", num_id="21", ilvl=0),
            )
        )

        tree = build_list_tree(_list_paragraphs(package))

        self.assertEqual(len(tree), 2)
        self.assertEqual(
            [[item.marker_value for item in block.items] for block in tree],
            [[1, 2], [4, 5]],
        )
        self.assertEqual([block.start for block in tree], [1, 4])

    def test_bullet_uses_ul_and_retains_literal_marker_suffix_and_indentation(self):
        package = _package((_paragraph("Care", num_id="22", ilvl=0),))

        tree = build_list_tree(_list_paragraphs(package))
        html = render_list_tree(tree)

        self.assertEqual(tree[0].items[0].marker_text, "•")
        self.assertEqual(tree[0].suffix, "tab")
        self.assertIn("<ul", html)
        self.assertIn('class="list-marker">•\t</span>Care', html)
        self.assertIn("margin-left:27pt", html)
        self.assertIn("text-indent:-9pt", html)

    def test_level_jump_creates_only_one_nested_list_and_retains_source_level(self):
        package = _package(
            (
                _paragraph("Level zero", num_id="20", ilvl=0),
                _paragraph("Level eight", num_id="20", ilvl=8),
            )
        )

        tree = build_list_tree(_list_paragraphs(package))
        html = render_list_tree(tree)

        self.assertEqual(tree[0].items[0].children[0].level, 8)
        self.assertEqual(html.count("<ol"), 2)

    def test_lvl_restart_controls_continuation_after_a_parent_item(self):
        restarting_levels = (
            _level(0, "decimal", "%1."),
            _level(1, "lowerLetter", "%2)", restart=1),
        )
        continuing_levels = (
            _level(0, "decimal", "%1."),
            _level(1, "lowerLetter", "%2)", restart=0),
        )
        numbering = f"""<w:numbering xmlns:w="{W}">
          <w:abstractNum w:abstractNumId="1">{''.join(restarting_levels)}</w:abstractNum>
          <w:abstractNum w:abstractNumId="2">{''.join(continuing_levels)}</w:abstractNum>
          <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
          <w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
        </w:numbering>"""

        def child_markers(num_id):
            package = _package(
                (
                    _paragraph("Parent one", num_id=num_id, ilvl=0),
                    _paragraph("Child one", num_id=num_id, ilvl=1),
                    _paragraph("Parent two", num_id=num_id, ilvl=0),
                    _paragraph("Child two", num_id=num_id, ilvl=1),
                ),
                numbering_xml=numbering,
            )
            tree = build_list_tree(_list_paragraphs(package))
            return [
                parent.children[0].items[0].marker_value
                for parent in tree[0].items
            ]

        self.assertEqual(child_markers("1"), [1, 1])
        self.assertEqual(child_markers("2"), [1, 2])


class NumberingFailureTest(unittest.TestCase):
    def test_unknown_num_format_fails_closed_with_numbering_path(self):
        numbering = f"""<w:numbering xmlns:w="{W}"><w:abstractNum w:abstractNumId="1">
          {_level(0, 'chicago', '%1.')}
        </w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num></w:numbering>"""
        package = _package(
            (_paragraph("Unknown", num_id="1", ilvl=0),), numbering_xml=numbering
        )
        paragraph = package.document.find(f".//{{{W}}}p")

        with self.assertRaisesRegex(
            NumberingError,
            r"chicago.*word/numbering\.xml/w:numbering\[1\]/w:abstractNum\[1\]/w:lvl\[1\]/w:numFmt\[1\]",
        ):
            NumberingResolver(package).resolve_paragraph(paragraph)

    def test_unknown_num_id_fails_closed_with_paragraph_path(self):
        package = _package((_paragraph("Unknown", num_id="999", ilvl=0),))
        paragraph = package.document.find(f".//{{{W}}}p")

        with self.assertRaisesRegex(
            NumberingError,
            r"999.*word/document\.xml/w:document\[1\]/w:body\[1\]/w:p\[1\]",
        ):
            NumberingResolver(package).resolve_paragraph(paragraph)

    def test_unknown_suffix_and_placeholder_fail_closed(self):
        bad_suffix = f"""<w:numbering xmlns:w="{W}"><w:abstractNum w:abstractNumId="1">
          {_level(0, 'decimal', '%1.', suffix='comma')}
        </w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num></w:numbering>"""
        bad_placeholder = f"""<w:numbering xmlns:w="{W}"><w:abstractNum w:abstractNumId="1">
          {_level(0, 'decimal', '%0.')}
        </w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num></w:numbering>"""

        with self.assertRaisesRegex(NumberingError, r"suffix comma.*w:suff\[1\]"):
            NumberingResolver(
                _package((_paragraph("Unknown", num_id="1", ilvl=0),), numbering_xml=bad_suffix)
            )
        with self.assertRaisesRegex(NumberingError, r"placeholder.*w:lvlText\[1\]"):
            NumberingResolver(
                _package((_paragraph("Unknown", num_id="1", ilvl=0),), numbering_xml=bad_placeholder)
            )

    def test_override_for_unknown_level_fails_closed_with_override_path(self):
        numbering = f"""<w:numbering xmlns:w="{W}"><w:abstractNum w:abstractNumId="1">
          {_level(0, 'decimal', '%1.')}
        </w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/>
          <w:lvlOverride w:ilvl="4"><w:startOverride w:val="2"/></w:lvlOverride>
        </w:num></w:numbering>"""
        package = _package(
            (_paragraph("Unknown level", num_id="1", ilvl=0),), numbering_xml=numbering
        )

        with self.assertRaisesRegex(NumberingError, r"level 4.*w:lvlOverride\[1\]"):
            NumberingResolver(package)


class RealSourceNumberingInventoryTest(unittest.TestCase):
    def test_authoritative_source_has_ordered_and_unordered_format_inventory(self):
        source = authoritative_source(Path(__file__).resolve().parents[2])
        package = OOXMLPackage.from_file(source)

        result = inventory(package)

        for number_format in ("bullet", "decimal", "lowerRoman", "lowerLetter"):
            with self.subTest(number_format=number_format):
                self.assertGreater(result.format_counts.get(number_format, 0), 0)
        self.assertTrue(all(0 <= level <= 8 for level in result.level_counts))


if __name__ == "__main__":
    unittest.main()

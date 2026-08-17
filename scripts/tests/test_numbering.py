from io import BytesIO
from pathlib import Path
import unittest

from lxml import html as lxml_html

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
    marker_font=None,
    legal=False,
):
    restart_xml = "" if restart is None else f'<w:lvlRestart w:val="{restart}"/>'
    font_xml = (
        ""
        if marker_font is None
        else f'<w:rPr><w:rFonts w:ascii="{marker_font}" w:hAnsi="{marker_font}"/></w:rPr>'
    )
    legal_xml = "<w:isLgl/>" if legal else ""
    return f"""<w:lvl w:ilvl="{ilvl}">
      <w:start w:val="{start}"/><w:numFmt w:val="{number_format}"/>
      <w:lvlText w:val="{level_text}"/><w:suff w:val="{suffix}"/>{restart_xml}{legal_xml}
      <w:pPr><w:ind w:left="{left}" w:hanging="{hanging}"/></w:pPr>
      {font_xml}
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
        numbering = f"""<w:numbering xmlns:w="{W}">
          <w:abstractNum w:abstractNumId="1">
            {_level(0, 'decimal', '%1.')}{_level(1, 'lowerLetter', '%2)')}
          </w:abstractNum>
          <w:abstractNum w:abstractNumId="2">
            {_level(1, 'lowerLetter', '%2)', start=4)}
          </w:abstractNum>
          <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
          <w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
        </w:numbering>"""
        package = _package(
            (
                _paragraph("Parent", num_id="1", ilvl=0),
                _paragraph("First child list", num_id="1", ilvl=1),
                _paragraph("Second child list", num_id="2", ilvl=1),
            ),
            numbering_xml=numbering,
        )

        rendered = render_list_tree(build_list_tree(_list_paragraphs(package)))
        fragment = lxml_html.fragment_fromstring(rendered, create_parent="div")
        child_lists = fragment.xpath("./ol/li/ol")

        self.assertEqual(len(child_lists), 2)
        self.assertEqual(child_lists[1].get("start"), "4")
        self.assertFalse(child_lists[0].xpath("./li/ol"))
        self.assertFalse(child_lists[1].xpath("./li/ol"))

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
        self.assertIn('class="list-marker">•</span>', html)
        self.assertIn(
            'class="list-tab" aria-hidden="true" data-list-suffix="tab" '
            'style="display:inline-block;width:9pt;"></span>Care',
            html,
        )
        self.assertNotIn("\t", html)
        self.assertIn("margin:0 0 0 27pt", html)
        self.assertIn("padding:0", html)
        self.assertIn("text-indent:-9pt", html)

    def test_nested_lists_use_source_relative_indent_and_neutralize_defaults(self):
        numbering = f"""<w:numbering xmlns:w="{W}">
          <w:abstractNum w:abstractNumId="1">
            {_level(0, 'decimal', '%1.', left=720, hanging=360)}
            {_level(1, 'lowerLetter', '%2.', left=1440, hanging=360)}
          </w:abstractNum>
          <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
        </w:numbering>"""
        package = _package(
            (
                _paragraph("Parent", num_id="1", ilvl=0),
                _paragraph("Child", num_id="1", ilvl=1),
            ),
            numbering_xml=numbering,
        )

        rendered = render_list_tree(build_list_tree(_list_paragraphs(package)))
        fragment = lxml_html.fragment_fromstring(rendered, create_parent="div")
        root, child = fragment.xpath(".//ol")

        self.assertEqual(
            root.get("style"),
            "list-style-type:decimal;margin:0 0 0 36pt;padding:0;"
            "text-indent:-18pt;",
        )
        self.assertEqual(
            child.get("style"),
            "list-style-type:lower-alpha;margin:0 0 0 36pt;padding:0;"
            "text-indent:-18pt;",
        )

    def test_omitted_suffix_defaults_to_a_preserved_tab_stop_element(self):
        numbering = f"""<w:numbering xmlns:w="{W}">
          <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0">
            <w:start w:val="1"/><w:numFmt w:val="decimal"/>
            <w:lvlText w:val="%1."/>
            <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
          </w:lvl></w:abstractNum>
          <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
        </w:numbering>"""
        package = _package(
            (_paragraph("Default tab", num_id="1", ilvl=0),),
            numbering_xml=numbering,
        )

        rendered = render_list_tree(build_list_tree(_list_paragraphs(package)))

        self.assertIn('<span class="list-marker">1.</span>', rendered)
        self.assertIn(
            'class="list-tab" aria-hidden="true" data-list-suffix="tab" '
            'style="display:inline-block;width:18pt;"></span>Default tab',
            rendered,
        )
        self.assertNotIn("\t", rendered)

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

    def test_is_lgl_renders_every_placeholder_as_decimal(self):
        numbering = f"""<w:numbering xmlns:w="{W}">
          <w:abstractNum w:abstractNumId="1">
            {_level(0, 'upperRoman', '%1.')}
            {_level(1, 'lowerLetter', '%1.%2)', legal=True)}
          </w:abstractNum>
          <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
        </w:numbering>"""
        package = _package(
            (
                _paragraph("Parent", num_id="1", ilvl=0),
                _paragraph("Legal child", num_id="1", ilvl=1),
            ),
            numbering_xml=numbering,
        )

        tree = build_list_tree(_list_paragraphs(package))

        self.assertTrue(tree[0].items[0].children[0].items[0].paragraph.numbering.legal_numbering)
        self.assertEqual(tree[0].items[0].children[0].items[0].marker_text, "1.1)")


class BulletFontTest(unittest.TestCase):
    def test_all_documented_source_pua_pairs_decode_to_exact_unicode(self):
        cases = (
            ("Symbol", "\uf0ae", "→"),
            ("Symbol", "\uf0b7", "•"),
            ("Wingdings", "\uf076", "❖"),
            ("Wingdings", "\uf0a7", "▪"),
            ("Wingdings", "\uf0d8", "⮤"),
            ("Wingdings", "\uf0e8", "\U0001f869"),
            ("Wingdings", "\uf0f0", "⇨"),
            ("Wingdings", "\uf0fc", "✓"),
        )

        for index, (font, raw_marker, portable_marker) in enumerate(cases, 1):
            numbering = f"""<w:numbering xmlns:w="{W}">
              <w:abstractNum w:abstractNumId="{index}">
                {_level(0, 'bullet', raw_marker, marker_font=font)}
              </w:abstractNum>
              <w:num w:numId="{index}"><w:abstractNumId w:val="{index}"/></w:num>
            </w:numbering>"""
            package = _package(
                (_paragraph("Mapped", num_id=str(index), ilvl=0),),
                numbering_xml=numbering,
            )

            with self.subTest(font=font, raw_marker=f"U+{ord(raw_marker):04X}"):
                resolved = NumberingResolver(package).resolve_paragraph(
                    package.document.find(f".//{{{W}}}p")
                )
                self.assertEqual(resolved.display_level_text, portable_marker)

    def test_symbol_and_wingdings_pua_markers_are_portable_and_retain_metadata(self):
        symbol_bullet = "\uf0b7"
        wingdings_arrow = "\uf0f0"
        numbering = f"""<w:numbering xmlns:w="{W}">
          <w:abstractNum w:abstractNumId="1">
            {_level(0, 'bullet', symbol_bullet, suffix='tab', marker_font='Symbol')}
          </w:abstractNum>
          <w:abstractNum w:abstractNumId="2">
            {_level(0, 'bullet', wingdings_arrow, suffix='tab', marker_font='Wingdings')}
          </w:abstractNum>
          <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
          <w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
        </w:numbering>"""
        package = _package(
            (
                _paragraph("Symbol item", num_id="1", ilvl=0),
                _paragraph("Wingdings item", num_id="2", ilvl=0),
            ),
            numbering_xml=numbering,
        )

        paragraphs = _list_paragraphs(package)
        rendered = render_list_tree(build_list_tree(paragraphs))

        self.assertEqual(paragraphs[0].numbering.level_text, "\uf0b7")
        self.assertEqual(paragraphs[0].numbering.display_level_text, "•")
        self.assertEqual(
            paragraphs[0].numbering.marker_fonts,
            (("ascii", "Symbol"), ("hAnsi", "Symbol")),
        )
        self.assertEqual(paragraphs[1].numbering.display_level_text, "⇨")
        self.assertIn('data-source-marker-codepoints="U+F0B7"', rendered)
        self.assertIn('data-source-marker-font="Symbol"', rendered)
        self.assertIn('class="list-marker"', rendered)
        self.assertIn(">•</span>", rendered)
        self.assertIn(">⇨</span>", rendered)
        self.assertNotIn("\uf0b7", rendered)
        self.assertNotIn("\uf0f0", rendered)

    def test_unknown_pua_font_pair_fails_closed_with_source_paths(self):
        symbol_bullet = "\uf0b7"
        numbering = f"""<w:numbering xmlns:w="{W}">
          <w:abstractNum w:abstractNumId="1">
            {_level(0, 'bullet', symbol_bullet, marker_font='Calibri')}
          </w:abstractNum>
          <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
        </w:numbering>"""

        with self.assertRaisesRegex(
            NumberingError,
            r"U\+F0B7.*Calibri.*word/numbering\.xml/.*/w:lvlText\[1\].*w:rFonts\[1\]",
        ):
            NumberingResolver(
                _package(
                    (_paragraph("Unknown", num_id="1", ilvl=0),),
                    numbering_xml=numbering,
                )
            )


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

    def test_duplicate_singular_numbering_children_fail_with_second_source_path(self):
        level = _level(0, "decimal", "%1.")
        cases = (
            (
                f"""<w:numbering xmlns:w="{W}"><w:abstractNum w:abstractNumId="1">{level}</w:abstractNum>
                <w:num w:numId="1"><w:abstractNumId w:val="1"/><w:abstractNumId w:val="1"/></w:num></w:numbering>""",
                r"Duplicate w:abstractNumId.*w:num\[1\]/w:abstractNumId\[2\]",
            ),
            (
                f"""<w:numbering xmlns:w="{W}"><w:abstractNum w:abstractNumId="1">{level}</w:abstractNum>
                <w:num w:numId="1"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0">
                {level}{level}</w:lvlOverride></w:num></w:numbering>""",
                r"Duplicate w:lvl.*w:lvlOverride\[1\]/w:lvl\[2\]",
            ),
            (
                f"""<w:numbering xmlns:w="{W}"><w:abstractNum w:abstractNumId="1">{level}</w:abstractNum>
                <w:num w:numId="1"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0">
                <w:startOverride w:val="2"/><w:startOverride w:val="3"/></w:lvlOverride></w:num></w:numbering>""",
                r"Duplicate w:startOverride.*w:lvlOverride\[1\]/w:startOverride\[2\]",
            ),
            (
                f"""<w:numbering xmlns:w="{W}"><w:abstractNum w:abstractNumId="1">
                <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/>
                <w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl>
                </w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num></w:numbering>""",
                r"Duplicate w:numFmt.*w:lvl\[1\]/w:numFmt\[2\]",
            ),
        )

        for numbering, message in cases:
            with self.subTest(message=message):
                with self.assertRaisesRegex(NumberingError, message):
                    NumberingResolver(
                        _package(
                            (_paragraph("Duplicate", num_id="1", ilvl=0),),
                            numbering_xml=numbering,
                        )
                    )

    def test_unavailable_placeholder_failure_includes_lvl_text_source_path(self):
        numbering = f"""<w:numbering xmlns:w="{W}">
          <w:abstractNum w:abstractNumId="1">{_level(0, 'decimal', '%2.')}</w:abstractNum>
          <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
        </w:numbering>"""

        with self.assertRaisesRegex(
            NumberingError,
            r"unavailable level 1.*word/numbering\.xml/w:numbering\[1\]/w:abstractNum\[1\]/w:lvl\[1\]/w:lvlText\[1\]",
        ):
            NumberingResolver(
                _package(
                    (_paragraph("Unavailable", num_id="1", ilvl=0),),
                    numbering_xml=numbering,
                )
            )


class RealSourceNumberingInventoryTest(unittest.TestCase):
    def test_authoritative_source_has_ordered_and_unordered_format_inventory(self):
        source = authoritative_source(Path(__file__).resolve().parents[2])
        package = OOXMLPackage.from_file(source)

        result = inventory(package)

        for number_format in ("bullet", "decimal", "lowerRoman", "lowerLetter"):
            with self.subTest(number_format=number_format):
                self.assertGreater(result.format_counts.get(number_format, 0), 0)
        self.assertTrue(all(0 <= level <= 8 for level in result.level_counts))
        self.assertEqual(result.legacy_pua_bullet_count, 7055)
        self.assertEqual(result.legal_numbered_paragraph_count, 65)
        self.assertEqual(result.bullet_marker_counts.get("Symbol|U+F0B7"), 5562)
        self.assertEqual(result.bullet_marker_counts.get("Wingdings|U+F0F0"), 1072)


if __name__ == "__main__":
    unittest.main()

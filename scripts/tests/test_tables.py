from io import BytesIO
from pathlib import Path
from typing import Optional
import unittest

from scripts.book_import.constants import authoritative_source
from scripts.book_import.package import OOXMLPackage
from scripts.book_import import tables as table_module
from scripts.book_import.tables import (
    TableParsingError,
    inventory,
    parse_tables,
    render_table,
)
from scripts.tests.fixtures import make_docx


W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"

NUMBERING_XML = f"""<w:numbering xmlns:w="{W}">
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/><w:suff w:val="space"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/>
      <w:lvlText w:val="%2)"/><w:suff w:val="space"/>
      <w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="7"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>"""


def _package(
    table_xml: str,
    *,
    numbering_xml: str = NUMBERING_XML,
    styles_xml: Optional[str] = None,
) -> OOXMLPackage:
    document = f"""<w:document xmlns:w="{W}" xmlns:wp="{WP}" xmlns:a="{A}">
      <w:body>{table_xml}</w:body>
    </w:document>"""
    return OOXMLPackage.from_file(
        BytesIO(
            make_docx(
                document,
                numbering_xml=numbering_xml,
                **({"styles_xml": styles_xml} if styles_xml is not None else {}),
            )
        )
    )


MERGED_AND_STYLED_TABLE = """<w:tbl>
  <w:tblPr>
    <w:tblCaption w:val="Medication &amp; Dose"/>
    <w:tblW w:w="9000" w:type="dxa"/><w:jc w:val="center"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="8" w:space="0" w:color="112233"/>
      <w:left w:val="single" w:sz="8" w:space="0" w:color="112233"/>
      <w:bottom w:val="single" w:sz="8" w:space="0" w:color="112233"/>
      <w:right w:val="single" w:sz="8" w:space="0" w:color="112233"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="445566"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="445566"/>
    </w:tblBorders>
    <w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar>
  </w:tblPr>
  <w:tblGrid><w:gridCol w:w="2400"/><w:gridCol w:w="3000"/><w:gridCol w:w="3600"/></w:tblGrid>
  <w:tr>
    <w:trPr><w:tblHeader/></w:trPr>
    <w:tc><w:tcPr><w:tcW w:w="5400" w:type="dxa"/><w:gridSpan w:val="2"/>
      <w:shd w:val="clear" w:color="auto" w:fill="CFE2F3"/>
      <w:tcBorders><w:bottom w:val="double" w:sz="12" w:space="0" w:color="AA0000"/></w:tcBorders>
      <w:tcMar><w:top w:w="50" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/>
    </w:tcPr>
      <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>Header &lt;A&gt;</w:t></w:r></w:p>
      <w:p><w:r><w:t>continued</w:t></w:r></w:p>
    </w:tc>
    <w:tc><w:tcPr><w:tcW w:w="3600" w:type="dxa"/></w:tcPr>
      <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>Right</w:t></w:r></w:p>
    </w:tc>
  </w:tr>
  <w:tr>
    <w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/><w:vMerge w:val="restart"/></w:tcPr>
      <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="7"/></w:numPr></w:pPr>
        <w:r><w:t xml:space="preserve">Dose  5 mg</w:t></w:r></w:p>
    </w:tc>
    <w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>
      <w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="7"/></w:numPr></w:pPr>
        <w:r><w:t>first</w:t></w:r></w:p>
    </w:tc>
    <w:tc><w:tcPr><w:tcW w:w="3600" w:type="dxa"/></w:tcPr>
      <w:p><w:r><w:t>Before</w:t><w:drawing><wp:inline><a:graphic><a:graphicData uri="urn:test">
        <a:t>Diagram label</a:t></a:graphicData></a:graphic></wp:inline></w:drawing><w:t>After</w:t></w:r></w:p>
    </w:tc>
  </w:tr>
  <w:tr>
    <w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/><w:vMerge/></w:tcPr><w:p/></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="6600" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>
      <w:p><w:r><w:t>Outer before</w:t></w:r></w:p>
      <w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>
        <w:tblGrid><w:gridCol w:w="2000"/></w:tblGrid>
        <w:tr><w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:t>Nested</w:t></w:r></w:p></w:tc></w:tr>
      </w:tbl>
      <w:p><w:r><w:t>Outer after</w:t></w:r></w:p>
    </w:tc>
  </w:tr>
</w:tbl>"""


class TableStructureTest(unittest.TestCase):
    def test_alternate_content_emits_only_task_2_selected_choice_table(self):
        alternate = f"""<mc:AlternateContent
          xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
          xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">
          <mc:Choice Requires="wps"><w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid>
            <w:tr><w:tc><w:tcPr/><w:p><w:r><w:t>Selected choice</w:t></w:r></w:p></w:tc></w:tr>
          </w:tbl></mc:Choice>
          <mc:Fallback><w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid>
            <w:tr><w:tc><w:tcPr/><w:p><w:r><w:t>Fallback twin</w:t></w:r></w:p></w:tc></w:tr>
          </w:tbl></mc:Fallback>
        </mc:AlternateContent>"""
        package = _package(alternate)

        tables = parse_tables(package)
        selected = inventory(package)
        raw = table_module.raw_physical_inventory(package)

        self.assertEqual(len(tables), 1)
        self.assertEqual(tables[0].text, "Selected choice")
        self.assertNotIn("Fallback twin", tables[0].text)
        self.assertEqual((selected.table_count, selected.row_count, selected.cell_count), (1, 1, 1))
        self.assertEqual((raw.table_count, raw.row_count, raw.cell_count), (2, 2, 2))

    def setUp(self):
        self.package = _package(MERGED_AND_STYLED_TABLE)
        self.table = parse_tables(self.package)[0]

    def test_merged_table_keeps_structure_and_every_cell_text_event(self):
        table = self.table

        self.assertEqual(table.rows[0].cells[0].colspan, 2)
        self.assertEqual(table.rows[1].cells[0].rowspan, 2)
        self.assertTrue(table.rows[2].cells[0].is_vertical_merge_continuation)
        self.assertEqual(table.grid_widths_twips, (2400, 3000, 3600))
        self.assertEqual(
            [(event.kind, event.value) for event in table.text_events],
            [
                ("text", "Header <A>"), ("paragraph_boundary", "\n"),
                ("text", "continued"), ("paragraph_boundary", "\n"),
                ("text", "Right"), ("paragraph_boundary", "\n"),
                ("text", "Dose  5 mg"), ("paragraph_boundary", "\n"),
                ("text", "first"), ("paragraph_boundary", "\n"),
                ("text", "Before"), ("text", "Diagram label"),
                ("text", "After"), ("paragraph_boundary", "\n"),
                ("empty_paragraph", ""), ("paragraph_boundary", "\n"),
                ("text", "Outer before"), ("paragraph_boundary", "\n"),
                ("text", "Nested"), ("paragraph_boundary", "\n"),
                ("text", "Outer after"), ("paragraph_boundary", "\n"),
            ],
        )

    def test_canonical_model_keeps_flat_cells_and_child_document_order(self):
        table = self.table
        canonical = table.canonical

        self.assertEqual((canonical.row_count, canonical.column_count), (3, 3))
        self.assertEqual(len(canonical.cells), 7)
        self.assertEqual(canonical.cells[0].column_span, 2)
        self.assertEqual(canonical.cells[2].row_span, 2)
        self.assertEqual(
            [node.kind for node in canonical.cells[-1].nodes],
            ["paragraph", "table", "paragraph"],
        )
        drawing_paragraph = canonical.cells[4].nodes[0]
        self.assertEqual([child.kind for child in drawing_paragraph.children], ["drawing"])
        self.assertEqual(
            [kind for kind, _ in self.table.rows[1].cells[2].blocks[0].inline_order],
            ["event", "drawing", "event", "event", "event"],
        )

    def test_numbering_headers_caption_and_rendering_metadata_are_preserved(self):
        table = self.table
        header = table.rows[0].cells[0]
        parent_list = table.rows[1].cells[0].blocks[0].canonical.numbering
        child_list = table.rows[1].cells[1].blocks[0].canonical.numbering

        self.assertTrue(table.rows[0].is_header)
        self.assertTrue(header.canonical.is_header)
        self.assertEqual((parent_list.number_format, parent_list.level), ("decimal", 0))
        self.assertEqual((child_list.number_format, child_list.level), ("lowerLetter", 1))
        self.assertEqual(table.caption, "Medication & Dose")
        self.assertEqual(table.width.value, 9000)
        self.assertEqual(table.alignment, "center")
        self.assertEqual(header.width.value, 5400)
        self.assertEqual(header.shading.fill, "CFE2F3")
        self.assertEqual(header.vertical_alignment, "center")
        self.assertEqual(header.margins.top.value, 50)
        self.assertEqual(header.margins.left.value, 80)
        self.assertEqual(header.borders.bottom.style, "double")
        self.assertEqual(header.blocks[0].canonical.paragraph_style.alignment, "center")

    def test_nested_table_is_not_flattened_or_converted_to_an_image(self):
        nested_block = self.table.rows[2].cells[1].blocks[1]

        self.assertEqual(nested_block.kind, "table")
        self.assertEqual(nested_block.nested_table.rows[0].cells[0].text, "Nested")
        self.assertNotIn("img", nested_block.kind)

    def test_drawing_without_a_task_6_renderer_fails_closed_at_its_source_path(self):
        drawing_path = self.table.rows[1].cells[2].blocks[0].canonical.children[0].source_path

        with self.assertRaisesRegex(TableParsingError, drawing_path.replace("[", r"\[").replace("]", r"\]")):
            render_table(self.table)

    def test_drawing_renderer_owns_its_label_without_body_text_duplication(self):
        html = render_table(
            self.table,
            drawing_renderer=lambda _node: "<svg><text>Diagram label</text></svg>",
        )

        self.assertEqual(html.count("Diagram label"), 1)
        self.assertLess(html.index("Before"), html.index("<svg>"))
        self.assertLess(html.index("</svg>"), html.index("After"))


class TableRenderingTest(unittest.TestCase):
    def test_floating_table_reflows_in_place_and_retains_exact_source_geometry(self):
        table_xml = f"""<w:tbl><w:tblPr><w:tblpPr w:leftFromText="120" w:rightFromText="240"
          w:vertAnchor="text" w:horzAnchor="margin" w:tblpXSpec="center" w:tblpY="300"/></w:tblPr>
          <w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid>
          <w:tr><w:tc><w:tcPr/><w:p><w:r><w:t>Floated source</w:t></w:r></w:p></w:tc></w:tr>
        </w:tbl>"""

        html = render_table(parse_tables(_package(table_xml))[0])

        self.assertIn('class="mm-table-scroll mm-table-floating-reflow"', html)
        self.assertIn('data-mm-tblp-vert-anchor="text"', html)
        self.assertIn('data-mm-tblp-y="300"', html)
        self.assertIn('style="clear:both;margin-left:6pt;margin-right:12pt;"', html)
        self.assertIn("Floated source", html)

    def test_row_height_and_row_cell_spacing_render_without_dropping_rule_metadata(self):
        table_xml = f"""<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid>
          <w:tr><w:trPr><w:trHeight w:val="360" w:hRule="atLeast"/>
            <w:tblCellSpacing w:w="20" w:type="dxa"/></w:trPr>
            <w:tc><w:tcPr/><w:p><w:r><w:t>Geometry</w:t></w:r></w:p></w:tc></w:tr>
        </w:tbl>"""
        html = render_table(parse_tables(_package(table_xml))[0])

        self.assertIn("border-spacing:1pt", html)
        self.assertIn('data-mm-row-height-twips="360"', html)
        self.assertIn('data-mm-row-height-rule="atLeast"', html)
        self.assertIn('data-mm-row-cell-spacing-twips="20"', html)
        self.assertIn('style="height:18pt;"', html)

    def test_default_auto_row_height_is_retained_but_not_forced_and_exact_fails_closed(self):
        auto_xml = f"""<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid>
          <w:tr><w:trPr><w:trHeight w:val="300"/></w:trPr>
            <w:tc><w:tcPr/><w:p><w:r><w:t>Auto</w:t></w:r></w:p></w:tc></w:tr></w:tbl>"""
        auto_html = render_table(parse_tables(_package(auto_xml))[0])
        self.assertIn('data-mm-row-height-rule="auto"', auto_html)
        self.assertNotIn('style="height:15pt;"', auto_html)

        exact_xml = auto_xml.replace(
            '<w:trHeight w:val="300"/>',
            '<w:trHeight w:val="300" w:hRule="exact"/>',
        )
        exact_table = parse_tables(_package(exact_xml))[0]
        with self.assertRaisesRegex(TableParsingError, r"exact row height.*w:trHeight\[1\]"):
            render_table(exact_table)

    def test_grid_before_and_after_render_semantic_empty_offset_cells(self):
        table_xml = f"""<w:tbl><w:tblPr/><w:tblGrid>
          <w:gridCol w:w="1000"/><w:gridCol w:w="1000"/><w:gridCol w:w="1000"/>
          </w:tblGrid><w:tr><w:trPr><w:gridBefore w:val="1"/><w:gridAfter w:val="1"/></w:trPr>
            <w:tc><w:tcPr/><w:p><w:r><w:t>Middle</w:t></w:r></w:p></w:tc>
          </w:tr></w:tbl>"""

        html = render_table(parse_tables(_package(table_xml))[0])

        before = '<td class="mm-table-grid-offset" aria-hidden="true" data-mm-grid-before="1"></td>'
        after = '<td class="mm-table-grid-offset" aria-hidden="true" data-mm-grid-after="1"></td>'
        self.assertIn(before + '<td style=', html)
        self.assertIn("Middle</p></td>" + after, html)
        self.assertEqual(parse_tables(_package(table_xml))[0].text, "Middle")

    def test_table_style_borders_cascade_per_side_before_direct_overrides(self):
        styles = f"""<w:styles xmlns:w="{W}"><w:style w:type="table" w:styleId="Grid">
          <w:tblPr><w:tblBorders>
            <w:top w:val="single" w:sz="8" w:space="0" w:color="111111"/>
            <w:left w:val="single" w:sz="8" w:space="0" w:color="222222"/>
          </w:tblBorders></w:tblPr></w:style></w:styles>"""
        table_xml = f"""<w:tbl><w:tblPr><w:tblStyle w:val="Grid"/><w:tblBorders>
          <w:bottom w:val="double" w:sz="12" w:space="0" w:color="333333"/>
        </w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid>
          <w:tr><w:tc><w:tcPr/><w:p/></w:tc></w:tr></w:tbl>"""

        table = parse_tables(_package(table_xml, styles_xml=styles))[0]

        self.assertEqual(table.borders.top.color, "111111")
        self.assertEqual(table.borders.left.color, "222222")
        self.assertEqual(table.borders.bottom.style, "double")

    def test_nested_numbering_in_one_cell_renders_as_nested_semantic_lists(self):
        table_xml = f"""<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="3000"/></w:tblGrid>
          <w:tr><w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>
            <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>Parent</w:t></w:r></w:p>
            <w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>Child</w:t></w:r></w:p>
          </w:tc></w:tr></w:tbl>"""

        html = render_table(parse_tables(_package(table_xml))[0])

        self.assertEqual(html.count("<ol "), 2)
        self.assertRegex(
            html,
            r"<ol [^>]*><li[^>]*>Parent<ol [^>]*><li[^>]*>.*Child</li></ol></li></ol>",
        )

    def test_captioned_table_uses_figure_header_semantics_and_scroll_region(self):
        table_xml = f"""<w:tbl><w:tblPr><w:tblCaption w:val="Exact caption"/>
          <w:tblW w:w="5000" w:type="dxa"/></w:tblPr>
          <w:tblGrid><w:gridCol w:w="2500"/><w:gridCol w:w="2500"/></w:tblGrid>
          <w:tr><w:trPr><w:tblHeader/></w:trPr>
            <w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>H1</w:t></w:r></w:p></w:tc>
            <w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>H2</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr><w:p><w:r><w:t xml:space="preserve"> A  B </w:t></w:r></w:p></w:tc>
            <w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>C</w:t></w:r></w:p></w:tc>
          </w:tr></w:tbl>"""
        table = parse_tables(_package(table_xml))[0]

        html = render_table(table)

        self.assertTrue(html.startswith('<figure class="mm-table-figure">'))
        self.assertIn('<figcaption>Exact caption</figcaption>', html)
        self.assertIn('<div class="mm-table-scroll" role="region" tabindex="0">', html)
        self.assertIn("<thead><tr><th", html)
        self.assertIn("</thead><tbody><tr><td", html)
        self.assertIn(" A  B ", html)
        self.assertNotIn("<img", html)

    def test_uncaptioned_table_does_not_invent_a_figure_or_caption(self):
        table_xml = f"""<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>
          <w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid>
          <w:tr><w:tc><w:tcPr><w:tcW w:w="1000" w:type="dxa"/></w:tcPr><w:p/></w:tc></w:tr>
        </w:tbl>"""

        html = render_table(parse_tables(_package(table_xml))[0])

        self.assertTrue(html.startswith('<div class="mm-table-scroll"'))
        self.assertNotIn("<figure", html)
        self.assertNotIn("<figcaption", html)


class TableFailClosedTest(unittest.TestCase):
    def test_vertical_merge_continuation_without_restart_is_rejected(self):
        table_xml = f"""<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid>
          <w:tr><w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p/></w:tc></w:tr></w:tbl>"""

        with self.assertRaisesRegex(TableParsingError, "continuation.*without.*restart"):
            parse_tables(_package(table_xml))

    def test_mismatched_vertical_merge_grid_span_is_rejected(self):
        table_xml = f"""<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="1000"/><w:gridCol w:w="1000"/></w:tblGrid>
          <w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/><w:vMerge w:val="restart"/></w:tcPr><w:p/></w:tc></w:tr>
          <w:tr><w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p/></w:tc><w:tc><w:tcPr/><w:p/></w:tc></w:tr>
        </w:tbl>"""

        with self.assertRaisesRegex(TableParsingError, "vertical merge.*span"):
            parse_tables(_package(table_xml))

    def test_missing_grid_and_unsupported_cell_child_are_rejected_with_paths(self):
        missing_grid = f"""<w:tbl><w:tblPr/><w:tr><w:tc><w:tcPr/><w:p/></w:tc></w:tr></w:tbl>"""
        with self.assertRaisesRegex(TableParsingError, "tblGrid"):
            parse_tables(_package(missing_grid))

        unsupported = f"""<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid>
          <w:tr><w:tc><w:tcPr/><w:sdt><w:sdtContent><w:p/></w:sdtContent></w:sdt></w:tc></w:tr></w:tbl>"""
        with self.assertRaisesRegex(TableParsingError, r"Unsupported table cell child.*w:sdt\[1\]"):
            parse_tables(_package(unsupported))

    def test_duplicate_singular_properties_are_rejected_at_the_second_path(self):
        table_xml = f"""<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="1000"/></w:tblGrid>
          <w:tr><w:tc><w:tcPr><w:gridSpan w:val="1"/><w:gridSpan w:val="1"/></w:tcPr><w:p/></w:tc></w:tr>
        </w:tbl>"""

        with self.assertRaisesRegex(TableParsingError, r"Duplicate w:gridSpan.*w:gridSpan\[2\]"):
            parse_tables(_package(table_xml))


class RealSourceTableInventoryTest(unittest.TestCase):
    def test_authoritative_source_separates_raw_physical_and_selected_display_inventory(self):
        source = authoritative_source(Path(__file__).resolve().parents[2])
        package = OOXMLPackage.from_file(source)
        raw = table_module.raw_physical_inventory(package)
        result = inventory(package)

        self.assertEqual(
            (raw.table_count, raw.row_count, raw.cell_count),
            (139, 1_110, 4_615),
        )
        self.assertEqual(
            (result.table_count, result.row_count, result.cell_count),
            (136, 1_097, 4_562),
        )
        self.assertEqual(result.empty_table_count, 0)
        self.assertEqual(result.eventless_table_count, 0)
        self.assertEqual(result.horizontal_merged_cell_count, 484)
        self.assertEqual(result.vertical_merge_start_count, 151)
        self.assertEqual(result.vertical_merge_continuation_count, 314)
        self.assertEqual(result.repeated_header_row_count, 2)
        self.assertEqual(result.caption_count, 0)
        self.assertEqual(result.drawing_count, 170)
        self.assertEqual(result.nested_table_count, 0)
        self.assertEqual(result.floating_table_count, 8)
        self.assertEqual(result.row_height_count, 278)
        self.assertEqual(result.row_cell_spacing_count, 6)
        self.assertEqual(result.grid_before_row_count, 0)
        self.assertEqual(result.grid_after_row_count, 4)


if __name__ == "__main__":
    unittest.main()

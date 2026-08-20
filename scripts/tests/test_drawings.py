from __future__ import annotations

from io import BytesIO
from pathlib import Path
import hashlib
import unittest

from lxml import etree

from scripts.book_import.constants import authoritative_source
from scripts.book_import.drawings import (
    DrawingCompiler,
    DrawingTextParagraph,
    UnsupportedDrawingError,
    _line_paint,
    _paint,
    _render_textbox_paragraph,
    _resolve_color,
    _textbox_table_border,
    drawing_inventory,
)
from scripts.book_import.model import ParagraphStyle, RunStyle, TextEvent
from scripts.book_import.geometry import PRESET_GEOMETRIES, compile_custom_geometry, compile_preset_geometry
from scripts.book_import.package import OOXMLPackage
from scripts.book_import.tables import parse_tables, render_table
from scripts.tests.fixtures import make_docx


W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
WPS = "http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
WPG = "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture"

EXPECTED_PRESETS = {
    "straightConnector1", "rect", "line", "downArrow", "rightBracket",
    "bentConnector3", "rightArrow", "leftBracket", "triangle", "upArrow",
    "curvedConnector3", "ellipse", "plus",
}


def _anchor(inner: str, *, x: int, y: int, width: int, height: int, z: int) -> str:
    return f"""<w:drawing><wp:anchor relativeHeight="{z}" behindDoc="0" layoutInCell="1" allowOverlap="1">
      <wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>{x}</wp:posOffset></wp:positionH>
      <wp:positionV relativeFrom="paragraph"><wp:posOffset>{y}</wp:posOffset></wp:positionV>
      <wp:extent cx="{width}" cy="{height}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>
      <wp:docPr id="{z}" name="Object {z}"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="urn:fixture">{inner}</a:graphicData></a:graphic>
    </wp:anchor></w:drawing>"""


def _drawing_package(*, in_table: bool = False) -> OOXMLPackage:
    rectangle = f"""<wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm rot="5400000" flipH="1"><a:off x="0" y="0"/><a:ext cx="1000" cy="500"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>
      <a:ln w="12700"><a:solidFill><a:srgbClr val="0000FF"/></a:solidFill></a:ln></wps:spPr>
      <wps:txbx><w:txbxContent><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Alpha</w:t><w:tab/><w:t>Beta</w:t></w:r></w:p></w:txbxContent></wps:txbx><wps:bodyPr lIns="10" tIns="20" rIns="30" bIns="40"/></wps:wsp>"""
    connector = f"""<wps:wsp><wps:cNvCnPr/><wps:spPr><a:xfrm flipV="1"><a:off x="0" y="0"/><a:ext cx="800" cy="600"/></a:xfrm>
      <a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="6350"><a:solidFill><a:srgbClr val="00AA00"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></wps:spPr><wps:bodyPr/></wps:wsp>"""
    body = _anchor(rectangle, x=100, y=200, width=1000, height=500, z=5) + _anchor(
        connector, x=300, y=400, width=800, height=600, z=9
    )
    if in_table:
        body = f"""<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="2000"/></w:tblGrid><w:tr><w:tc><w:tcPr/>
          <w:p><w:r><w:t>Before</w:t>{body}<w:t>After</w:t></w:r></w:p>
        </w:tc></w:tr></w:tbl>"""
    else:
        body = f"<w:p><w:r><w:t>Before</w:t>{body}<w:t>After</w:t></w:r></w:p>"
    document = f"""<w:document xmlns:w="{W}" xmlns:r="{R}" xmlns:a="{A}" xmlns:wp="{WP}" xmlns:wps="{WPS}" xmlns:wpg="{WPG}" xmlns:pic="{PIC}"><w:body>{body}</w:body></w:document>"""
    return OOXMLPackage.from_file(BytesIO(make_docx(document)))


def _nested_picture_package() -> OOXMLPackage:
    nested_picture = f"""<w:drawing><wp:inline>
      <wp:extent cx="400" cy="200"/><wp:effectExtent l="0" t="0" r="0" b="0"/>
      <wp:docPr id="22" name="Nested picture"/><wp:cNvGraphicFramePr>
        <a:graphicFrameLocks noChangeAspect="1"/>
      </wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="{PIC}"><pic:pic>
        <pic:nvPicPr><pic:cNvPr id="22" name="Nested picture"/><pic:cNvPicPr/></pic:nvPicPr>
        <pic:blipFill><a:blip r:embed="rIdImage"/><a:srcRect l="10000" t="20000" r="30000" b="40000"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
        <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="400" cy="200"/></a:xfrm>
          <a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:ln><a:noFill/></a:ln>
        </pic:spPr>
      </pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>"""
    owner = f"""<wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr>
      <a:xfrm><a:off x="0" y="0"/><a:ext cx="1000" cy="600"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln>
      </wps:spPr><wps:txbx><w:txbxContent><w:p><w:r>{nested_picture}</w:r></w:p></w:txbxContent></wps:txbx>
      <wps:bodyPr lIns="100" tIns="50" rIns="100" bIns="50"/>
    </wps:wsp>"""
    document = f"""<w:document xmlns:w="{W}" xmlns:r="{R}" xmlns:a="{A}" xmlns:wp="{WP}" xmlns:wps="{WPS}" xmlns:wpg="{WPG}" xmlns:pic="{PIC}"><w:body>
      <w:p><w:r>{_anchor(owner, x=25, y=75, width=1000, height=600, z=4)}</w:r></w:p>
    </w:body></w:document>"""
    relationships = """<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/nested.png"/>
    </Relationships>"""
    return OOXMLPackage.from_file(BytesIO(make_docx(
        document,
        relationships_xml=relationships,
        extra_members=(("word/media/nested.png", b"preserved source bytes"),),
    )))


class PresetAndCustomGeometryTest(unittest.TestCase):
    def test_shape_fill_cascade_prefers_explicit_paint_then_respects_fill_ref_index_zero(self):
        owner = etree.fromstring(
            f'''<wps:wsp xmlns:wps="{WPS}" xmlns:a="{A}">
              <wps:style><a:fillRef idx="1"><a:schemeClr val="lt1"/></a:fillRef></wps:style>
            </wps:wsp>'''
        )
        properties = etree.fromstring(
            f'''<wps:spPr xmlns:wps="{WPS}" xmlns:a="{A}">
              <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
            </wps:spPr>'''
        )
        theme = {"accent1": "4472C4", "lt1": "FFFFFF"}

        self.assertEqual(_paint(properties, owner, "fill", theme, False), ("#4472C4", 1.0))

        properties.remove(properties[0])
        self.assertEqual(_paint(properties, owner, "fill", theme, False), ("#FFFFFF", 1.0))

        fill_ref = owner.find(f".//{{{A}}}fillRef")
        assert fill_ref is not None
        fill_ref.set("idx", "0")
        self.assertEqual(_paint(properties, owner, "fill", theme, False), ("none", 0))

    def test_empty_line_uses_its_line_reference_not_the_shape_solid_fill(self):
        owner = etree.fromstring(
            f'''<wps:wsp xmlns:wps="{WPS}" xmlns:a="{A}">
              <wps:style><a:lnRef idx="2"><a:schemeClr val="dk1"/></a:lnRef></wps:style>
            </wps:wsp>'''
        )
        properties = etree.fromstring(
            f'''<wps:spPr xmlns:wps="{WPS}" xmlns:a="{A}">
              <a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:ln/>
            </wps:spPr>'''
        )

        self.assertEqual(
            _line_paint(
                properties,
                owner,
                {"accent1": "4472C4", "dk1": "000000"},
            ),
            ("#000000", 1.0, 12700, None, None),
        )

    def test_drawingml_luminance_offset_is_additive_after_luminance_modulation(self):
        fill = etree.fromstring(
            f'<a:solidFill xmlns:a="{A}"><a:schemeClr val="accent1">'
            '<a:lumMod val="20000"/><a:lumOff val="80000"/>'
            '</a:schemeClr></a:solidFill>'
        )

        color, opacity = _resolve_color(fill, {"accent1": "4472C4"})

        # ECMA-376 luminance offset adds val * 255 after the preceding
        # luminance modulation: 0.2 * accent1 + 0.8 * white = #DAE3F3.
        self.assertEqual((color, opacity), ("#DAE3F3", 1.0))

    def test_all_and_only_the_thirteen_source_presets_compile_to_real_paths(self):
        self.assertEqual(set(PRESET_GEOMETRIES), EXPECTED_PRESETS)
        for preset in sorted(EXPECTED_PRESETS):
            with self.subTest(preset=preset):
                geometry = compile_preset_geometry(
                    preset,
                    width=1200,
                    height=800,
                    adjustments={"adj": 33335, "adj1": 33848, "adj2": 50000},
                    topic_id="t-mm-01-001",
                    source_path=f"word/document.xml/{preset}",
                )
                self.assertGreater(len(geometry.paths), 0)
                self.assertTrue(all(path.d.startswith("M") for path in geometry.paths))
                self.assertEqual((geometry.width, geometry.height), (1200, 800))

    def test_custom_guides_and_all_drawingml_path_commands_map_without_text_inference(self):
        custom = etree.fromstring(f"""<a:custGeom xmlns:a="{A}"><a:avLst><a:gd name="adj" fmla="val 25000"/></a:avLst>
          <a:gdLst><a:gd name="x1" fmla="*/ w adj 100000"/><a:gd name="y1" fmla="+- h 0 x1"/></a:gdLst>
          <a:pathLst><a:path w="1000" h="1000" fill="none"><a:moveTo><a:pt x="0" y="0"/></a:moveTo>
            <a:lnTo><a:pt x="x1" y="y1"/></a:lnTo><a:quadBezTo><a:pt x="500" y="0"/><a:pt x="750" y="250"/></a:quadBezTo>
            <a:cubicBezTo><a:pt x="800" y="300"/><a:pt x="900" y="400"/><a:pt x="1000" y="500"/></a:cubicBezTo>
            <a:arcTo wR="100" hR="200" stAng="0" swAng="5400000"/><a:close/></a:path></a:pathLst>
        </a:custGeom>""")

        geometry = compile_custom_geometry(custom, 2000, 1000, "t-mm-01-001", "word/document.xml/custom[1]")

        self.assertEqual(len(geometry.paths), 1)
        self.assertIn("L 500 750", geometry.paths[0].d)
        self.assertIn("Q", geometry.paths[0].d)
        self.assertIn("C", geometry.paths[0].d)
        self.assertIn("A", geometry.paths[0].d)
        self.assertTrue(geometry.paths[0].d.endswith("Z"))

    def test_unknown_formula_and_path_command_fail_with_topic_and_ooxml_path(self):
        cases = (
            f"""<a:custGeom xmlns:a="{A}"><a:gdLst><a:gd name="x" fmla="mystery 1"/></a:gdLst><a:pathLst/></a:custGeom>""",
            f"""<a:custGeom xmlns:a="{A}"><a:gdLst/><a:pathLst><a:path><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:wobble/></a:path></a:pathLst></a:custGeom>""",
        )
        for xml in cases:
            with self.subTest(xml=xml):
                with self.assertRaisesRegex(UnsupportedDrawingError, r"t-mm-09-009.*word/document\.xml/custom\[7\]"):
                    compile_custom_geometry(etree.fromstring(xml), 100, 100, "t-mm-09-009", "word/document.xml/custom[7]")


class DrawingCompositionTest(unittest.TestCase):
    def test_textbox_uses_source_default_single_line_height_not_svg_css_leading(self):
        paragraph = DrawingTextParagraph(
            source_path="word/document.xml/w:p[1]",
            text_events=(
                TextEvent(
                    kind="text", value="Source line",
                    source_path="word/document.xml/w:p[1]/w:r[1]/w:t[1]",
                    run_style=RunStyle(font_size_half_points=20),
                ),
            ),
            paragraph_style=ParagraphStyle(),
        )

        markup, height = _render_textbox_paragraph(
            paragraph, x=0, y=0, available_width=952_500
        )

        self.assertIn('y="127000"', markup)
        self.assertEqual(height, 127_000)

    def test_textbox_wraps_source_runs_without_concatenating_or_losing_run_styles(self):
        shape = f"""<wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="381000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </wps:spPr><wps:txbx><w:txbxContent><w:p><w:pPr><w:jc w:val="left"/></w:pPr>
          <w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>Alpha Beta </w:t></w:r>
          <w:r><w:rPr><w:i/><w:sz w:val="24"/></w:rPr><w:t>Gamma Delta</w:t></w:r>
        </w:p></w:txbxContent></wps:txbx><wps:bodyPr lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"/></wps:wsp>"""
        document = f"""<w:document xmlns:w="{W}" xmlns:a="{A}" xmlns:wp="{WP}" xmlns:wps="{WPS}"><w:body>
          <w:p><w:r>{_anchor(shape, x=0, y=0, width=952500, height=381000, z=1)}</w:r></w:p>
        </w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document)))

        compiler = DrawingCompiler(package)
        figure = compiler.figures("t-mm-01-001")[0]
        self.assertEqual(figure.objects[0].text_vertical_anchor, "ctr")
        svg = compiler.render_figure(figure)

        self.assertGreaterEqual(svg.count('data-mm-wrapped-line="'), 2)
        self.assertIn('font-weight="700"', svg)
        self.assertIn('font-style="italic"', svg)
        self.assertIn(">Alpha", svg)
        self.assertIn(">Gamma", svg)
        self.assertIn('data-mm-text-anchor="ctr"', svg)

    def test_aligned_anchor_is_resolved_in_its_section_margin_coordinate_space(self):
        shape = f"""<wps:wsp><wps:cNvSpPr/><wps:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="635000" cy="317500"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </wps:spPr><wps:bodyPr/></wps:wsp>"""
        anchored = _anchor(shape, x=0, y=200, width=635000, height=317500, z=2).replace(
            'relativeFrom="column"><wp:posOffset>0</wp:posOffset>',
            'relativeFrom="margin"><wp:align>right</wp:align>',
            1,
        )
        document = f"""<w:document xmlns:w="{W}" xmlns:a="{A}" xmlns:wp="{WP}" xmlns:wps="{WPS}"><w:body>
          <w:p><w:r>{anchored}</w:r></w:p>
          <w:sectPr><w:pgSz w:w="10000" w:h="12000"/><w:pgMar w:left="1000" w:right="2000" w:top="500" w:bottom="500"/></w:sectPr>
        </w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document)))

        figure = DrawingCompiler(package).figures("t-mm-01-001")[0]

        self.assertEqual(figure.objects[0].placement.horizontal_relative_from, "margin")
        self.assertEqual(figure.objects[0].placement.x, 4_445_000)

    def test_nested_inline_picture_crop_geometry_and_aspect_stay_inside_owning_text_box(self):
        compiler = DrawingCompiler(_nested_picture_package(), {"rIdImage": "nested.png"})

        figures = compiler.figures("t-mm-01-001")

        self.assertEqual(len(figures), 1)
        self.assertEqual(len(figures[0].objects), 1)
        owner = figures[0].objects[0]
        self.assertEqual(owner.kind, "text_box")
        self.assertEqual(len(owner.children), 1)
        picture = owner.children[0]
        self.assertEqual(picture.kind, "picture")
        self.assertEqual(picture.placement.kind, "inline")
        self.assertEqual((picture.placement.width, picture.placement.height), (400, 200))
        self.assertEqual((picture.transform.width, picture.transform.height), (400, 200))
        self.assertEqual(picture.transform.width / picture.transform.height, 2)
        self.assertEqual(
            (picture.crop.left, picture.crop.top, picture.crop.right, picture.crop.bottom),
            (0.1, 0.2, 0.3, 0.4),
        )
        self.assertEqual(picture.geometry_name, "ellipse")

        html = compiler.render_figure(figures[0])
        self.assertEqual(html.count("<figure"), 1)
        self.assertEqual(html.count("<image"), 1)
        self.assertEqual(html.count("nested.png"), 1)
        self.assertIn('data-mm-nested-drawing="true"', html)
        self.assertIn("<clipPath", html)

    def test_relative_height_orders_overlapping_anchors_front_to_back_stably(self):
        def rectangle(color: str) -> str:
            return f'''<wps:wsp><wps:cNvSpPr/><wps:spPr>
              <a:xfrm><a:off x="0" y="0"/><a:ext cx="1000" cy="1000"/></a:xfrm>
              <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              <a:solidFill><a:srgbClr val="{color}"/></a:solidFill><a:ln><a:noFill/></a:ln>
            </wps:spPr><wps:bodyPr/></wps:wsp>'''

        # The blue anchor appears first in OOXML but its larger relativeHeight
        # paints in front. Raw sibling order would incorrectly cover it with
        # the later red anchor.
        document = f'''<w:document xmlns:w="{W}" xmlns:a="{A}" xmlns:wp="{WP}" xmlns:wps="{WPS}"><w:body><w:p>
          {_anchor(rectangle("0000FF"), x=0, y=0, width=1000, height=1000, z=9)}
          {_anchor(rectangle("FF0000"), x=0, y=0, width=1000, height=1000, z=1)}
        </w:p></w:body></w:document>'''
        compiler = DrawingCompiler(OOXMLPackage.from_file(BytesIO(make_docx(document))))
        figure = compiler.figures("z-order")[0]

        self.assertEqual([item.z_order for item in figure.objects], [1, 9])
        svg = compiler.render_figure(figure)
        self.assertLess(svg.index('fill="#FF0000"'), svg.index('fill="#0000FF"'))

    def test_anchor_transform_stacking_connector_arrow_color_and_exact_label_events_survive(self):
        compiler = DrawingCompiler(_drawing_package())
        figure = compiler.figures("t-mm-01-001")[0]

        self.assertEqual(len(figure.objects), 2)
        rectangle = next(item for item in figure.objects if item.kind == "text_box")
        connector = next(item for item in figure.objects if item.kind == "connector")
        self.assertEqual((rectangle.placement.kind, rectangle.placement.x, rectangle.placement.y), ("anchor", 100, 200))
        self.assertEqual((rectangle.transform.rotation_degrees, rectangle.transform.flip_h, rectangle.transform.flip_v), (90.0, True, False))
        self.assertEqual((rectangle.fill, rectangle.stroke, rectangle.stroke_width_emu), ("#FF0000", "#0000FF", 12700))
        self.assertEqual([event.value for event in rectangle.text_events], ["Alpha", "\t", "Beta", "\n"])
        self.assertTrue(rectangle.text_events[0].run_style.bold)
        self.assertEqual(rectangle.text_paragraphs[0].paragraph_style.alignment, "center")
        self.assertEqual(rectangle.text_insets, (10, 20, 30, 40))
        self.assertEqual((connector.geometry_name, connector.arrow_end, connector.stroke), ("straightConnector1", "triangle", "#00AA00"))
        self.assertEqual([item.z_order for item in figure.objects], [5, 9])
        self.assertEqual(figure.connection_graph[0].start, (300.0, 1000.0))
        self.assertEqual(figure.connection_graph[0].end, (1100.0, 400.0))

        html = compiler.render_figure(figure)
        self.assertEqual(html.count("<figure"), 1)
        self.assertEqual(html.count("<svg"), 1)
        self.assertEqual(html.count(">Alpha\tBeta</text>"), 1)
        self.assertIn('marker-end="url(#', html)
        self.assertIn('rotate(90', html)
        self.assertLess(html.rindex(">Alpha"), html.rindex("marker-end="))
        # SVG coordinates and DrawingML stroke widths are both EMUs.  A
        # browser must scale them together; vector-effect would make a
        # 12,700-EMU line thousands of CSS pixels wide.
        self.assertNotIn('vector-effect="non-scaling-stroke"', html)

    def test_svg_viewbox_retains_stroke_and_effect_overhang_at_composition_edge(self):
        shape = f"""<wps:wsp><wps:cNvPr id="7" name="edge shape"/><wps:cNvSpPr/>
        <wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000" cy="500"/></a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>
        <a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></wps:spPr>
        <wps:bodyPr/></wps:wsp>"""
        drawing = _anchor(shape, x=100, y=200, width=1000, height=500, z=1).replace(
            '<wp:effectExtent l="0" t="0" r="0" b="0"/>',
            '<wp:effectExtent l="10" t="20" r="30" b="40"/>',
        )
        document = f"""<w:document xmlns:w="{W}" xmlns:a="{A}" xmlns:wp="{WP}" xmlns:wps="{WPS}">
        <w:body><w:p><w:r>{drawing}</w:r></w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document)))

        svg = DrawingCompiler(package).render_figure(
            DrawingCompiler(package).figures("t-mm-01-001")[0]
        )

        # The raw Word layout extent is x=100..1100/y=200..700.  Its painted
        # envelope must include the 6,350-EMU half-stroke and source effect
        # extents, otherwise a viewport begins on the rectangle's fill/stroke.
        self.assertIn('viewBox="-9525 -9525 19050 19050"', svg)

    def test_table_callback_emits_one_whole_composition_and_never_duplicates_labels_as_body_text(self):
        package = _drawing_package(in_table=True)
        compiler = DrawingCompiler(package)
        table = parse_tables(package)[0]

        html = render_table(table, drawing_renderer=compiler.table_renderer("t-mm-01-001"))

        self.assertEqual(html.count("<figure"), 1)
        self.assertEqual(html.count(">Alpha\tBeta</text>"), 1)
        self.assertLess(html.index("Before"), html.index("<figure"))
        self.assertLess(html.index("</figure>"), html.index("After"))
        self.assertEqual(html.count("data-mm-figure-member"), 1)

    def test_group_coordinate_space_is_applied_to_children_without_splitting_the_group(self):
        child = f"""<wps:wsp><wps:cNvPr id="1" name="child"/><wps:cNvSpPr/><wps:spPr><a:xfrm><a:off x="10" y="20"/><a:ext cx="100" cy="200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></wps:spPr><wps:bodyPr/></wps:wsp>"""
        group = f"""<wpg:wgp><wpg:cNvGrpSpPr/><wpg:grpSpPr><a:xfrm rot="10800000" flipV="1"><a:off x="50" y="60"/><a:ext cx="1000" cy="500"/><a:chOff x="0" y="0"/><a:chExt cx="200" cy="250"/></a:xfrm></wpg:grpSpPr>{child}</wpg:wgp>"""
        document = f"""<w:document xmlns:w="{W}" xmlns:a="{A}" xmlns:wp="{WP}" xmlns:wps="{WPS}" xmlns:wpg="{WPG}"><w:body><w:p><w:r>{_anchor(group, x=100, y=200, width=1000, height=500, z=3)}</w:r></w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document)))

        figure = DrawingCompiler(package).figures("t-mm-01-001")[0]

        self.assertEqual(len(figure.objects), 1)
        self.assertEqual(len(figure.objects[0].children), 1)
        transform = figure.objects[0].group_transform
        self.assertEqual((transform.child_offset_x, transform.child_offset_y), (0, 0))
        self.assertEqual((transform.child_width, transform.child_height), (200, 250))
        self.assertEqual((transform.rotation_degrees, transform.flip_v), (180.0, True))
        self.assertEqual(figure.objects[0].children[0].transform.x, 10)


class RealSourceDrawingInventoryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.package = OOXMLPackage.from_file(authoritative_source(Path(__file__).resolve().parents[2]))

    def test_authoritative_drawing_inventory_and_object_digests_are_complete(self):
        result = drawing_inventory(self.package, validate_geometry=True)

        self.assertEqual(result.processing_shape_count, 3_127)
        self.assertEqual(result.text_box_count, 607)
        self.assertEqual(result.picture_count, 294)
        self.assertEqual(result.custom_geometry_count, 3)
        self.assertEqual(set(result.preset_geometry_counts), EXPECTED_PRESETS)
        self.assertEqual(result.unsupported_objects, ())
        self.assertEqual(result.missing_relationships, ())
        self.assertEqual(result.object_count, 3_421)
        self.assertEqual(len(result.object_sha256), result.object_count)
        self.assertEqual(len(set(result.object_sha256)), result.object_count)
        self.assertEqual(result.manifest_sha256, hashlib.sha256(result.manifest_bytes).hexdigest())

    def test_authoritative_textbox_table_and_run_layout_are_not_flattened(self):
        compiler = DrawingCompiler(self.package)
        figure = next(
            figure
            for figure in compiler.figures("t-mm-authoritative-reference")
            if figure.figure_id == "07f9a52ecb2bb275df34b0fe"
        )
        table_owner = next(
            item for item in figure.objects if item.object_id == "2e2187aea70194f97de4"
        )

        self.assertEqual(len(table_owner.text_tables), 1)
        self.assertEqual(table_owner.text_block_order[0][0], "table")
        table = table_owner.text_tables[0]
        self.assertEqual(table.grid_widths_twips, (1413, 709, 708, 591, 987))
        self.assertEqual(len(table.rows), 9)
        self.assertEqual(sum(len(row.cells) for row in table.rows), 45)
        self.assertTrue(
            table.source_path.endswith(
                "/{http://schemas.microsoft.com/office/word/2010/wordprocessingShape}"
                "txbx[1]/w:txbxContent[1]/w:tbl[1]"
            )
        )

        svg = compiler.render_figure(figure)
        self.assertIn('data-mm-textbox-table="true"', svg)
        self.assertEqual(svg.count('data-mm-table-row="'), 9)
        self.assertEqual(svg.count('data-mm-table-cell="'), 45)
        self.assertIn('data-mm-table-grid="1413,709,708,591,987"', svg)
        self.assertIn("<tspan", svg)
        self.assertIn('font-weight="700"', svg)
        self.assertNotIn('font-family="theme:', svg)

        # These source objects respectively carry an explicit luminance-modified
        # solidFill and an idx=0 fillRef.  The former must override its style
        # placeholder while the latter is intentionally unfilled.
        ssc = svg.split('<g data-mm-object-id="53269140ee2fb4ddfa70"', 1)[1]
        self.assertIn('fill="#DAE3F3"', ssc)
        connector = svg.split('<g data-mm-object-id="5940ef21e2e7b7541bb8"', 1)[1]
        self.assertIn('fill="none"', connector)
        self.assertIn('stroke="#4472C4"', connector)

        source_events = tuple(
            event
            for cell in (cell for row in table.rows for cell in row.cells)
            for event in cell.text_events
            if event.kind not in ("paragraph_boundary", "empty_paragraph")
        )
        self.assertEqual(svg.count('data-mm-table-text-event="'), len(source_events))
        self.assertEqual(
            svg.count('data-mm-table-event-kind="line_break"'),
            sum(event.kind == "line_break" for event in source_events),
        )

        borders = tuple(
            (cell, side, _textbox_table_border(table, cell, side))
            for row in table.rows
            for cell in row.cells
            for side in ("top", "right", "bottom", "left")
        )
        resolved = tuple(
            (cell, side, border)
            for cell, side, border in borders
            if border is not None and border.style not in ("nil", "none")
        )
        self.assertEqual(svg.count('data-mm-table-border="'), len(resolved))
        for _cell, _side, border in resolved:
            assert border is not None
            self.assertIn(
                f'data-mm-table-border-width-emu="{(border.size_eighth_points or 4) / 8 * 12700:g}"',
                svg,
            )
            expected_color = "#000000" if border.color in (None, "auto") else "#" + border.color.upper()
            self.assertIn(f'data-mm-table-border-color="{expected_color}"', svg)


if __name__ == "__main__":
    unittest.main()

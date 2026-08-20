from __future__ import annotations

from dataclasses import replace
from io import BytesIO
from pathlib import Path
import tempfile
import unittest

from PIL import Image
from lxml import etree

from scripts.book_import.drawings import DrawingCompiler
from scripts.book_import.visual_reference import (
    ChromiumSvgRenderer,
    FigureReference,
    LibreOfficeReferenceRenderer,
    PdfCompositionMatch,
    PdfFigureTag,
    VisualReferenceError,
    _line_end_extension_emu,
    _source_painted_pixel_bounds,
    _SourceExportLayout,
    _SourceFigureStructure,
    build_pdf_composition_ownership_mask,
    build_libreoffice_figure_references,
    compare_figure_reference,
    compare_pixels,
    crop_pdf_composition_page,
    match_pdf_composition_tags,
    match_libreoffice_html_export,
    rasterize_svg_with_chromium,
    rasterize_svg_batch_with_chromium,
)
from scripts.tests.test_drawings import _drawing_package


SOFFICE = Path(r"C:\Program Files\LibreOffice\program\soffice.com")
NODE = Path(r"C:\Program Files\nodejs\node.exe")
WORKSPACE = Path(__file__).resolve().parents[2]


def _png(pixels: list[tuple[int, int, int, int]], size: tuple[int, int]) -> bytes:
    image = Image.new("RGBA", size)
    image.putdata(pixels)
    buffer = BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


def _reference(*, relationship_order=("rId1", "rId2"), labels="labels", pixels=b"") -> FigureReference:
    return FigureReference(
        figure_id="figure-1",
        relationship_order=relationship_order,
        width_px=3,
        height_px=3,
        label_sha256=labels,
        object_manifest_sha256="objects",
        geometry_sha256="geometry",
        connection_sha256="connections",
        color_sha256="colors",
        pixel_png=pixels,
    )


class PixelComparisonTest(unittest.TestCase):
    def test_small_antialias_difference_is_allowed_only_on_an_edge_pixel(self):
        white = (255, 255, 255, 255)
        black = (0, 0, 0, 255)
        edge_a = (128, 128, 128, 255)
        edge_b = (132, 132, 132, 255)
        compiled = _png([white, white, white, white, edge_a, black, white, black, black], (3, 3))
        reference = _png([white, white, white, white, edge_b, black, white, black, black], (3, 3))

        metrics = compare_pixels(compiled, reference, edge_channel_tolerance=5)

        self.assertEqual(metrics.differing_pixels, 1)
        self.assertEqual(metrics.unapproved_pixels, 0)
        self.assertEqual(metrics.edge_tolerance_pixels, 1)

    def test_interior_or_over_tolerance_pixel_difference_fails_closed(self):
        black = (0, 0, 0, 255)
        compiled = _png([black] * 9, (3, 3))
        changed = list([black] * 9)
        changed[4] = (30, 30, 30, 255)

        with self.assertRaisesRegex(VisualReferenceError, "unapproved pixel"):
            compare_pixels(compiled, _png(changed, (3, 3)), edge_channel_tolerance=5)


class ManifestReferenceTest(unittest.TestCase):
    def test_triangle_tail_end_owns_three_source_line_widths_of_overhang(self):
        line = etree.fromstring(
            b'<a:ln xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            b'w="12700"><a:tailEnd type="triangle"/></a:ln>'
        )
        extension = _line_end_extension_emu(line, 12_700, "word/document.xml/a:ln[1]")
        self.assertEqual(extension, 38_100)
        connector = _SourceExportLayout(
            object_id="tail-triangle", source_path="connector", x_emu=10 * 9525,
            y_emu=10 * 9525, width_emu=20 * 9525, height_emu=10 * 9525,
            z_order=1, depth=0, stroke_width_emu=12_700,
            arrowhead_extent_emu=extension,
        )
        # The envelope includes source stroke and tail arrowhead space; this
        # prevents a viewport/mask from clipping the connector decoration.
        self.assertEqual(
            _source_painted_pixel_bounds(connector, translate_x=0.0, translate_y=0.0),
            (5, 5, 35, 25),
        )

    def test_pdf_mapping_excludes_page_chrome_but_owns_an_untagged_textbox_table(self):
        figure = _SourceExportLayout(
            object_id="figure", source_path="figure", x_emu=0, y_emu=0,
            width_emu=10 * 9525, height_emu=10 * 9525, z_order=1, depth=0,
        )
        second_figure = _SourceExportLayout(
            object_id="figure-two", source_path="figure-two", x_emu=20 * 9525, y_emu=0,
            width_emu=10 * 9525, height_emu=10 * 9525, z_order=2, depth=0,
        )
        table = _SourceExportLayout(
            object_id="table", source_path="table", x_emu=50 * 9525, y_emu=50 * 9525,
            width_emu=10 * 9525, height_emu=10 * 9525, z_order=3, depth=0,
            contains_table=True,
        )
        source = _SourceFigureStructure(
            figure_id="chrome-and-table", relationship_order=(), label_sha256="labels",
            object_manifest_sha256="objects", geometry_sha256="geometry",
            connection_sha256="connections", color_sha256="colors",
            x_emu=0, y_emu=0, width_emu=60 * 9525, height_emu=60 * 9525,
            export_layout=(figure, second_figure, table),
        )
        # On a 150pt/200px page, tag 4 is the source figure at (5, 5), while
        # tag 8 is page chrome at (150, 5), outside every source paint bound.
        tags = (
            PdfFigureTag(ordinal=4, page_index=3, bbox_points=(0.0, 142.5, 7.5, 150.0)),
            PdfFigureTag(ordinal=5, page_index=3, bbox_points=(15.0, 142.5, 22.5, 150.0)),
            PdfFigureTag(ordinal=8, page_index=3, bbox_points=(108.75, 142.5, 116.25, 150.0)),
        )

        match = match_pdf_composition_tags(source, tags, page_height_points=150.0)

        self.assertEqual(match.mapped_object_ids, ("figure", "figure-two"))
        self.assertEqual(match.mapped_tag_ordinals, (4, 5))
        self.assertEqual(match.excluded_tag_ordinals, (8,))
        self.assertEqual(
            match.untagged_object_reasons,
            (("table", "source-textbox-table-unmarked-by-pdf-figure"),),
        )
        mask = build_pdf_composition_ownership_mask(
            source, match, width_px=60, height_px=60
        )
        with Image.open(BytesIO(mask)) as pixels:
            self.assertEqual(pixels.convert("L").getpixel((55, 55)), 255)

        # A tag inside source paint cannot be called page chrome.
        inside = tags[:-1] + (
            PdfFigureTag(ordinal=8, page_index=3, bbox_points=(0.0, 142.5, 7.5, 150.0)),
        )
        with self.assertRaisesRegex(VisualReferenceError, "cannot map"):
            match_pdf_composition_tags(source, inside, page_height_points=150.0)

    def test_pdf_ownership_mask_excludes_foreign_footer_but_never_owned_pixels(self):
        owner = _SourceExportLayout(
            object_id="owner", source_path="owner", x_emu=0, y_emu=0,
            width_emu=10 * 9525, height_emu=10 * 9525, z_order=1, depth=0,
            effect_extent=(9525, 0, 0, 0), stroke_width_emu=12_700,
        )
        nested = _SourceExportLayout(
            object_id="nested", source_path="nested", x_emu=2 * 9525, y_emu=2 * 9525,
            width_emu=3 * 9525, height_emu=3 * 9525, z_order=2, depth=1,
        )
        source = _SourceFigureStructure(
            figure_id="owned", relationship_order=(), label_sha256="labels",
            object_manifest_sha256="objects", geometry_sha256="geometry",
            connection_sha256="connections", color_sha256="colors",
            x_emu=0, y_emu=0, width_emu=10 * 9525, height_emu=10 * 9525,
            export_layout=(owner, nested),
        )
        match = PdfCompositionMatch(
            figure_id="owned", page_index=45, translation_px=(0.0, 0.0),
            crop_box_px=(0, 0, 20, 20), mapped_object_ids=("owner", "nested"),
            mapped_tag_ordinals=(4, 5), untagged_object_reasons=(),
        )
        mask = build_pdf_composition_ownership_mask(
            source, match, width_px=20, height_px=20
        )
        with Image.open(BytesIO(mask)) as pixels:
            self.assertEqual(pixels.convert("L").getpixel((0, 0)), 255)
            self.assertEqual(pixels.convert("L").getpixel((15, 15)), 0)

        white = (255, 255, 255, 255)
        compiler = _png([white] * 400, (20, 20))
        reference_pixels = [white] * 400
        # This blue footer is on the same PDF crop but is not owned by any
        # validated Figure tag/source object, so it cannot fail the figure.
        for x in range(20):
            reference_pixels[15 * 20 + x] = (68, 114, 196, 255)
        reference = _png(reference_pixels, (20, 20))
        metrics = compare_pixels(
            compiler, reference, edge_channel_tolerance=5, ownership_mask_png=mask
        )
        self.assertEqual(metrics.unapproved_pixels, 0)

        # A changed label/table pixel inside the source-owned box remains a
        # hard failure; the mask is never a tolerance relaxation.
        reference_pixels[2 * 20 + 2] = (0, 0, 0, 255)
        with self.assertRaisesRegex(VisualReferenceError, "unapproved pixel"):
            compare_pixels(
                compiler,
                _png(reference_pixels, (20, 20)),
                edge_channel_tolerance=5,
                ownership_mask_png=mask,
            )

        incomplete = replace(match, mapped_object_ids=("owner",), mapped_tag_ordinals=(4,))
        with self.assertRaisesRegex(VisualReferenceError, "incomplete"):
            build_pdf_composition_ownership_mask(
                source, incomplete, width_px=20, height_px=20
            )

    def test_pdf_ownership_mask_does_not_claim_transparent_textbox_anchor_interior(self):
        """A table's paint footprint is not its transparent host anchor."""
        table_owner = _SourceExportLayout(
            object_id="transparent-table", source_path="transparent-table",
            x_emu=0, y_emu=0, width_emu=20 * 9525, height_emu=20 * 9525,
            z_order=1, depth=0, contains_table=True,
            # The independently parsed table starts at the textbox origin and
            # occupies only its first ten pixels.  The lower transparent host
            # area can overlap a PDF footer and must never become owned.
            visible_content_bounds_emu=(0, 0, 20 * 9525, 10 * 9525),
        )
        source = _SourceFigureStructure(
            figure_id="transparent-table", relationship_order=(), label_sha256="labels",
            object_manifest_sha256="objects", geometry_sha256="geometry",
            connection_sha256="connections", color_sha256="colors",
            x_emu=0, y_emu=0, width_emu=20 * 9525, height_emu=20 * 9525,
            export_layout=(table_owner,),
        )
        match = PdfCompositionMatch(
            figure_id="transparent-table", page_index=0, translation_px=(0.0, 0.0),
            crop_box_px=(0, 0, 20, 20), mapped_object_ids=(),
            mapped_tag_ordinals=(),
            untagged_object_reasons=(("transparent-table", "source-textbox-table-unmarked-by-pdf-figure"),),
        )

        mask = build_pdf_composition_ownership_mask(source, match, width_px=20, height_px=20)
        with Image.open(BytesIO(mask)) as pixels:
            owned = pixels.convert("L")
            self.assertEqual(owned.getpixel((10, 5)), 255)
            self.assertEqual(owned.getpixel((10, 15)), 0)

        white = (255, 255, 255, 255)
        compiler = _png([white] * 400, (20, 20))
        footer = [white] * 400
        footer[15 * 20 + 10] = (68, 114, 196, 255)
        self.assertEqual(
            compare_pixels(
                compiler, _png(footer, (20, 20)), edge_channel_tolerance=5,
                ownership_mask_png=mask,
            ).unapproved_pixels,
            0,
        )
        footer[5 * 20 + 10] = (0, 0, 0, 255)
        with self.assertRaisesRegex(VisualReferenceError, "unapproved pixel"):
            compare_pixels(
                compiler, _png(footer, (20, 20)), edge_channel_tolerance=5,
                ownership_mask_png=mask,
            )

    def test_pdf_crop_expands_with_symmetric_source_paint_bounds(self):
        # The raw layout is 10x10px at (10, 10), while its two-pixel source
        # outline paints at (8, 8)..(22, 22).  The independent PDF crop must
        # grow with that viewport rather than rescale it back to 10x10.
        owner = _SourceExportLayout(
            object_id="outlined", source_path="outlined", x_emu=10 * 9525,
            y_emu=10 * 9525, width_emu=10 * 9525, height_emu=10 * 9525,
            z_order=1, depth=0, stroke_width_emu=4 * 9525,
        )
        source = _SourceFigureStructure(
            figure_id="expanded-paint", relationship_order=(), label_sha256="labels",
            object_manifest_sha256="objects", geometry_sha256="geometry",
            connection_sha256="connections", color_sha256="colors",
            x_emu=10 * 9525, y_emu=10 * 9525,
            width_emu=10 * 9525, height_emu=10 * 9525, export_layout=(owner,),
        )
        tags = (
            PdfFigureTag(
                ordinal=1, page_index=0, bbox_points=(7.5, 60.0, 15.0, 67.5)
            ),
        )

        match = match_pdf_composition_tags(source, tags, page_height_points=75.0)

        self.assertEqual(match.translation_px, (0.0, 0.0))
        self.assertEqual(match.crop_box_px, (8, 8, 22, 22))

    def test_pdf_crop_keeps_untagged_nested_picture_pixels_inside_its_owner(self):
        owner = _SourceExportLayout(
            object_id="owner",
            source_path="word/document.xml/w:p[1]/w:drawing[1]/wps:wsp[1]",
            x_emu=0,
            y_emu=0,
            width_emu=952_500,
            height_emu=952_500,
            z_order=1,
            depth=0,
        )
        nested = _SourceExportLayout(
            object_id="nested-picture",
            source_path=(
                "word/document.xml/w:p[1]/w:drawing[1]/wps:wsp[1]/"
                "wps:txbx[1]/w:drawing[1]/pic:pic[1]"
            ),
            x_emu=190_500,
            y_emu=190_500,
            width_emu=95_250,
            height_emu=95_250,
            z_order=0,
            depth=1,
        )
        source = _SourceFigureStructure(
            figure_id="nested-owner",
            relationship_order=("rIdNested",),
            label_sha256="labels",
            object_manifest_sha256="objects",
            geometry_sha256="geometry",
            connection_sha256="connections",
            color_sha256="colors",
            x_emu=0,
            y_emu=0,
            width_emu=952_500,
            height_emu=952_500,
            export_layout=(owner, nested),
        )
        # A 150pt PDF page is 200px at the explicit 96-DPI reference scale.
        # The owner occupies page pixels (0, 50)..(100, 150); Writer keeps the
        # nested picture's marked content inside that single owner tag.
        tags = (
            PdfFigureTag(
                ordinal=7,
                page_index=3,
                bbox_points=(0.0, 37.5, 75.0, 112.5),
            ),
        )

        match = match_pdf_composition_tags(source, tags, page_height_points=150.0)
        page = Image.new("RGBA", (120, 200), (0, 0, 0, 0))
        for y in range(70, 80):
            for x in range(20, 30):
                page.putpixel((x, y), (255, 0, 0, 255))
        page_buffer = BytesIO()
        page.save(page_buffer, "PNG")
        crop = crop_pdf_composition_page(page_buffer.getvalue(), match)

        self.assertEqual(match.page_index, 3)
        self.assertEqual(match.translation_px, (0.0, 50.0))
        self.assertEqual(match.mapped_object_ids, ("owner",))
        self.assertEqual(
            match.untagged_object_reasons,
            (("nested-picture", "nested-content-contained-by-owner:owner"),),
        )
        with Image.open(BytesIO(crop)) as pixels:
            self.assertEqual(pixels.size, (100, 100))
            self.assertEqual(pixels.convert("RGBA").getpixel((20, 20)), (255, 0, 0, 255))

        outside = replace(nested, x_emu=1_000_125)
        with self.assertRaisesRegex(VisualReferenceError, "outside owning PDF crop"):
            match_pdf_composition_tags(
                replace(source, export_layout=(owner, outside)),
                tags,
                page_height_points=150.0,
            )

    def test_html_objects_are_partitioned_by_whole_composition_and_transformed_dimensions(self):
        package = _drawing_package()
        figures = DrawingCompiler(package).figures("t-mm-01-001")

        with tempfile.TemporaryDirectory() as directory:
            export = Path(directory)
            first = _png([(255, 0, 0, 255)], (1, 1))
            second = _png([(0, 255, 0, 255)], (1, 1))
            (export / "first.png").write_bytes(first)
            (export / "second.png").write_bytes(second)
            html_path = export / "reference.html"
            html_path.write_text(
                '<html><body><img src="second.png" name="Shape2" width="1" height="1">'
                '<img src="first.png" name="Shape1" width="1" height="1"></body></html>',
                encoding="utf-8",
            )

            matches = match_libreoffice_html_export(package, figures, html_path)
            references = build_libreoffice_figure_references(
                package, "t-mm-01-001", figures, matches
            )

        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].figure_id, figures[0].figure_id)
        self.assertEqual(len(matches[0].objects), 2)
        self.assertEqual(
            {matched.item.object_id for matched in matches[0].objects},
            {item.object_id for item in figures[0].objects},
        )
        self.assertEqual(matches[0].unmatched_export_objects, ())
        self.assertEqual(len(references), 1)
        self.assertEqual(references[0].figure_id, figures[0].figure_id)
        self.assertEqual((references[0].width_px, references[0].height_px), (1, 1))
        self.assertEqual(Image.open(BytesIO(references[0].pixel_png)).size, (1, 1))
        self.assertEqual(references[0].label_sha256, figures[0].label_sha256)
        self.assertEqual(
            references[0].object_manifest_sha256, figures[0].object_manifest_sha256
        )
        self.assertEqual(references[0].geometry_sha256, figures[0].geometry_sha256)
        self.assertEqual(references[0].connection_sha256, figures[0].connection_sha256)
        self.assertEqual(references[0].color_sha256, figures[0].color_sha256)

    def test_relationship_order_dimensions_labels_objects_geometry_graph_colors_and_pixels_are_all_gates(self):
        pixels = _png([(255, 255, 255, 255)] * 9, (3, 3))
        compiled = _reference(pixels=pixels)
        reference = _reference(pixels=pixels)

        metrics = compare_figure_reference(compiled, reference, reference_tool="LibreOffice 26.2.5.2")

        self.assertEqual(metrics.missing_objects, 0)
        self.assertEqual(metrics.label_differences, 0)
        self.assertEqual(metrics.unapproved_pixels, 0)
        self.assertEqual(metrics.reference_tool, "LibreOffice 26.2.5.2")

        fields = (
            ("relationship_order", ("rId2", "rId1")),
            ("width_px", 4),
            ("label_sha256", "different-labels"),
            ("object_manifest_sha256", "different-objects"),
            ("geometry_sha256", "different-geometry"),
            ("connection_sha256", "different-connections"),
            ("color_sha256", "different-colors"),
        )
        for field, value in fields:
            with self.subTest(field=field):
                changed = FigureReference(**{**reference.__dict__, field: value})
                with self.assertRaisesRegex(VisualReferenceError, field):
                    compare_figure_reference(compiled, changed, reference_tool="LibreOffice 26.2.5.2")

    def test_reference_pixels_and_dimensions_do_not_follow_mutated_compiler_layout(self):
        package = _drawing_package()
        compiler = DrawingCompiler(package)
        figures = compiler.figures("t-mm-01-001")

        with tempfile.TemporaryDirectory() as directory:
            export = Path(directory)
            (export / "first.png").write_bytes(_png([(255, 0, 0, 255)], (1, 1)))
            (export / "second.png").write_bytes(_png([(0, 255, 0, 255)], (1, 1)))
            html_path = export / "reference.html"
            html_path.write_text(
                '<html><body><img src="second.png" name="Shape2" width="1" height="1">'
                '<img src="first.png" name="Shape1" width="1" height="1"></body></html>',
                encoding="utf-8",
            )
            matches = match_libreoffice_html_export(package, figures, html_path)
            reference = build_libreoffice_figure_references(
                package, "t-mm-01-001", figures, matches
            )[0]
            changed_objects = tuple(
                replace(
                    item,
                    placement=replace(item.placement, x=item.placement.x + 95_250),
                    fill="#123456",
                )
                for item in figures[0].objects
            )
            changed_figure = replace(
                figures[0],
                objects=changed_objects,
                x=95_250,
                width=190_500,
                height=95_250,
            )
            reference_after_compiler_mutation = build_libreoffice_figure_references(
                package, "t-mm-01-001", (changed_figure,), matches
            )[0]

        self.assertEqual(reference_after_compiler_mutation.width_px, reference.width_px)
        self.assertEqual(reference_after_compiler_mutation.height_px, reference.height_px)
        self.assertEqual(reference_after_compiler_mutation.pixel_png, reference.pixel_png)

    def test_fixed_html_object_asset_rejects_a_compiler_fill_perturbation(self):
        package = _drawing_package()
        figures = DrawingCompiler(package).figures("t-mm-01-001")
        with tempfile.TemporaryDirectory() as directory:
            export = Path(directory)
            fixed = _png([(255, 0, 0, 255)], (1, 1))
            (export / "first.png").write_bytes(fixed)
            (export / "second.png").write_bytes(_png([(0, 255, 0, 255)], (1, 1)))
            html_path = export / "reference.html"
            html_path.write_text(
                '<html><body><img src="second.png" name="Shape2" width="1" height="1">'
                '<img src="first.png" name="Shape1" width="1" height="1"></body></html>',
                encoding="utf-8",
            )
            matches = match_libreoffice_html_export(package, figures, html_path)
            red_asset = next(
                item.exported.encoded_pixels
                for item in matches[0].objects
                if item.exported.source_file.name == "first.png"
            )

        with self.assertRaisesRegex(VisualReferenceError, "unapproved pixel"):
            compare_pixels(
                _png([(0, 0, 255, 255)], (1, 1)),
                red_asset,
                edge_channel_tolerance=5,
            )

    def test_unmatched_composition_and_empty_reference_tool_fail_closed(self):
        pixels = _png([(255, 255, 255, 255)] * 9, (3, 3))
        compiled = _reference(pixels=pixels)
        unmatched = FigureReference(**{**compiled.__dict__, "figure_id": "other"})

        with self.assertRaisesRegex(VisualReferenceError, "unmatched composition"):
            compare_figure_reference(compiled, unmatched, reference_tool="LibreOffice 26.2.5.2")
        with self.assertRaisesRegex(VisualReferenceError, "reference tool"):
            compare_figure_reference(compiled, compiled, reference_tool="")


class LibreOfficeReferenceRendererTest(unittest.TestCase):
    def test_real_libreoffice_version_and_headless_svg_export_are_recorded(self):
        renderer = LibreOfficeReferenceRenderer(SOFFICE)
        self.assertEqual(
            renderer.version(),
            "LibreOffice 26.2.5.2 cd7284b4cbbfeb507e630c1aac019f4157393acb",
        )
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "reference.svg"
            source.write_text(
                """<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8"><rect width="12" height="8" fill="#123456"/></svg>""",
                encoding="utf-8",
            )
            result = renderer.export(source, Path(directory) / "export", target="pdf")

            self.assertEqual(result.tool_version, renderer.version())
            self.assertEqual(result.output_path.suffix.lower(), ".pdf")
            self.assertGreater(result.output_path.stat().st_size, 0)
            self.assertTrue(result.source_path.samefile(source))


class ChromiumSvgRendererTest(unittest.TestCase):
    def test_real_chromium_raster_is_exact_sized_and_batch_stable(self):
        renderer = ChromiumSvgRenderer(NODE, WORKSPACE)
        receipt = renderer.version()
        self.assertTrue(receipt.startswith("Chromium 1.58.2 "))
        svg = """<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8"><rect width="12" height="8" fill="#123456"/></svg>"""
        thin_connector = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4527 153909"><path d="M 0 0 L 4527 153909" fill="none" stroke="#000000" stroke-width="12700"/></svg>"""
        transparent = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"/>"""

        with tempfile.TemporaryDirectory() as directory:
            rasters = rasterize_svg_batch_with_chromium(
                {
                    "figure-a": (svg, 12, 8),
                    "figure-b": (svg.replace("#123456", "#654321"), 12, 8),
                    "thin-connector": (thin_connector, 1, 16),
                    "transparent": (transparent, 2, 2),
                },
                renderer,
                Path(directory) / "batch",
                batch_size=3,
            )
            self.assertEqual(
                set(rasters),
                {"figure-a", "figure-b", "thin-connector", "transparent"},
            )
            self.assertEqual(Image.open(BytesIO(rasters["figure-a"])).size, (12, 8))
            self.assertNotEqual(rasters["figure-a"], rasters["figure-b"])
            with Image.open(BytesIO(rasters["thin-connector"])) as thin:
                self.assertEqual(thin.size, (1, 16))
                self.assertIsNotNone(thin.convert("RGBA").getbbox())
            with Image.open(BytesIO(rasters["transparent"])) as background:
                self.assertEqual(
                    set(background.convert("RGBA").getdata()),
                    {(255, 255, 255, 255)},
                )
            unchanged_reference = rasters["figure-a"]
            with self.assertRaisesRegex(VisualReferenceError, "unapproved pixel"):
                compare_pixels(
                    rasters["figure-b"],
                    unchanged_reference,
                    edge_channel_tolerance=5,
                )
            self.assertEqual(unchanged_reference, rasters["figure-a"])

            # Browser raster dimensions are source-exact even with a nonzero
            # viewBox; a single render and a true multifile batch agree.
            nonzero_view_box = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="100 200 800 600"><rect x="200" y="300" width="400" height="200" fill="#123456"/></svg>"""
            direct_nonzero = rasterize_svg_with_chromium(
                nonzero_view_box,
                80,
                60,
                renderer,
                Path(directory) / "direct-nonzero",
            )
            bounded_nonzero = rasterize_svg_batch_with_chromium(
                {
                    "padding": (transparent, 2, 2),
                    "nonzero": (nonzero_view_box, 80, 60),
                    # Same dimensions force a genuine multi-file Chromium run;
                    # its presence must not change nonzero's pixels.
                    "nonzero-peer": (
                        nonzero_view_box.replace("#123456", "#654321"),
                        80,
                        60,
                    ),
                },
                renderer,
                Path(directory) / "bounded-nonzero",
                batch_size=2,
            )["nonzero"]
            self.assertEqual(direct_nonzero, bounded_nonzero)
            with Image.open(BytesIO(bounded_nonzero)) as nonzero:
                self.assertEqual(nonzero.size, (80, 60))
                color_bounds = nonzero.convert("RGBA").getchannel("R").point(
                    lambda value: 255 if value == 18 else 0
                ).getbbox()
                self.assertEqual(color_bounds, (10, 10, 50, 30))

    def test_missing_node_or_playwright_is_never_silently_substituted(self):
        with self.assertRaisesRegex(VisualReferenceError, "Node executable"):
            ChromiumSvgRenderer(Path("Z:/missing/node.exe"), WORKSPACE).version()

    def test_missing_or_non_libreoffice_executable_is_never_silently_substituted(self):
        with self.assertRaisesRegex(VisualReferenceError, "LibreOffice executable"):
            LibreOfficeReferenceRenderer(Path("Z:/missing/soffice.com")).version()


if __name__ == "__main__":
    unittest.main()

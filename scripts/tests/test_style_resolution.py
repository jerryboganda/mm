from io import BytesIO
import unittest

from scripts.book_import.package import OOXMLPackage
from scripts.book_import.styles import StyleResolutionError, StyleResolver
from scripts.tests.fixtures import make_docx


W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"

DOCUMENT_XML = f"""<w:document xmlns:w="{W}"><w:body><w:p>
  <w:pPr><w:pStyle w:val="ChildParagraph"/><w:jc w:val="right"/><w:spacing w:after="80"/><w:keepLines/><w:bidi/></w:pPr>
  <w:r><w:rPr><w:rStyle w:val="EmphasisChild"/><w:b w:val="0"/><w:u w:val="double" w:color="00AA00"/><w:vertAlign w:val="superscript"/><w:color w:themeColor="accent1"/><w:rFonts w:ascii="Direct Font"/><w:sz w:val="28"/></w:rPr><w:t>Styled</w:t></w:r>
</w:p></w:body></w:document>"""

STYLES_XML = f"""<w:styles xmlns:w="{W}">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Default Font"/><w:sz w:val="20"/><w:color w:val="101010"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:jc w:val="left"/><w:spacing w:before="120" w:line="240"/><w:keepNext w:val="0"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="BaseParagraph"><w:pPr><w:ind w:left="720" w:right="180" w:firstLine="360"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:color w:val="222222"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ChildParagraph"><w:basedOn w:val="BaseParagraph"/><w:pPr><w:spacing w:before="240"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
  <w:style w:type="character" w:styleId="EmphasisBase"><w:rPr><w:strike/><w:highlight w:val="yellow"/></w:rPr></w:style>
  <w:style w:type="character" w:styleId="EmphasisChild"><w:basedOn w:val="EmphasisBase"/><w:rPr><w:i w:val="0"/></w:rPr></w:style>
</w:styles>"""

THEME_XML = f"""<a:theme xmlns:a="{A}" name="fixture"><a:themeElements><a:clrScheme name="fixture">
  <a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
  <a:accent1><a:srgbClr val="4F81BD"/></a:accent1>
</a:clrScheme><a:fontScheme name="fixture"><a:majorFont><a:latin typeface="Major Face"/></a:majorFont><a:minorFont><a:latin typeface="Minor Face"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>"""


class StyleResolutionTest(unittest.TestCase):
    def setUp(self):
        self.package = OOXMLPackage.from_file(
            BytesIO(make_docx(DOCUMENT_XML, styles_xml=STYLES_XML, theme_xml=THEME_XML))
        )
        self.paragraph = self.package.document.find(f".//{{{W}}}p")
        self.run = self.package.document.find(f".//{{{W}}}r")

    def test_paragraph_style_merges_defaults_ancestry_and_direct_properties(self):
        style = StyleResolver(self.package).resolve_paragraph(self.paragraph)

        self.assertEqual(style.style_id, "ChildParagraph")
        self.assertEqual(style.alignment, "right")
        self.assertEqual(style.left_indent_twips, 720)
        self.assertEqual(style.right_indent_twips, 180)
        self.assertEqual(style.first_line_indent_twips, 360)
        self.assertEqual(style.space_before_twips, 240)
        self.assertEqual(style.space_after_twips, 80)
        self.assertEqual(style.line_spacing, "240")
        self.assertTrue(style.keep_next)
        self.assertTrue(style.keep_lines)
        self.assertEqual(style.direction, "rtl")

    def test_run_style_merges_paragraph_and_character_ancestry_then_direct_formatting(self):
        style = StyleResolver(self.package).resolve_run(self.run, self.paragraph)

        self.assertFalse(style.bold)
        self.assertTrue(style.italic)
        self.assertEqual(style.underline, "double:#00AA00")
        self.assertTrue(style.strike)
        self.assertEqual(style.vertical_align, "superscript")
        self.assertEqual(style.highlight, "yellow")
        self.assertEqual(style.color, "#4F81BD")
        self.assertEqual(style.font_family, "Direct Font")
        self.assertEqual(style.font_size_half_points, 28)

    def test_theme_font_and_theme_color_resolve_to_literal_values(self):
        document = f"""<w:document xmlns:w="{W}"><w:body><w:p><w:r><w:rPr>
          <w:rFonts w:asciiTheme="majorAscii"/><w:color w:themeColor="accent1"/>
        </w:rPr><w:t>X</w:t></w:r></w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document, theme_xml=THEME_XML)))
        run = package.document.find(f".//{{{W}}}r")

        style = StyleResolver(package).resolve_run(run)

        self.assertEqual(style.font_family, "Major Face")
        self.assertEqual(style.color, "#4F81BD")

    def test_true_toggle_in_child_style_reverses_inherited_bold(self):
        styles = f"""<w:styles xmlns:w="{W}">
          <w:style w:type="character" w:styleId="BoldBase"><w:rPr><w:b/></w:rPr></w:style>
          <w:style w:type="character" w:styleId="BoldChild"><w:basedOn w:val="BoldBase"/><w:rPr><w:b/></w:rPr></w:style>
        </w:styles>"""
        document = f"""<w:document xmlns:w="{W}"><w:body><w:p><w:r><w:rPr>
          <w:rStyle w:val="BoldChild"/>
        </w:rPr><w:t>X</w:t></w:r></w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document, styles_xml=styles)))
        run = package.document.find(f".//{{{W}}}r")

        style = StyleResolver(package).resolve_run(run)

        self.assertFalse(style.bold)

    def test_system_theme_color_uses_its_literal_last_color(self):
        system_theme = f"""<a:theme xmlns:a="{A}" name="fixture"><a:themeElements><a:clrScheme name="fixture">
          <a:dk1><a:sysClr val="windowText" lastClr="1A2B3C"/></a:dk1>
        </a:clrScheme></a:themeElements></a:theme>"""
        document = f"""<w:document xmlns:w="{W}"><w:body><w:p><w:r><w:rPr>
          <w:color w:themeColor="dk1"/>
        </w:rPr><w:t>X</w:t></w:r></w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document, theme_xml=system_theme)))
        run = package.document.find(f".//{{{W}}}r")

        style = StyleResolver(package).resolve_run(run)

        self.assertEqual(style.color, "#1A2B3C")

    def test_unresolved_theme_font_is_preserved_without_inference(self):
        document = f"""<w:document xmlns:w="{W}"><w:body><w:p><w:r><w:rPr>
          <w:rFonts w:eastAsiaTheme="minorEastAsia"/>
        </w:rPr><w:t>X</w:t></w:r></w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document, theme_xml=THEME_XML)))
        run = package.document.find(f".//{{{W}}}r")

        style = StyleResolver(package).resolve_run(run)

        self.assertEqual(style.font_family, "theme:minorEastAsia")

    def test_word_theme_color_alias_resolves_to_drawing_scheme_slot(self):
        document = f"""<w:document xmlns:w="{W}"><w:body><w:p><w:r><w:rPr>
          <w:color w:themeColor="background1"/>
        </w:rPr><w:t>X</w:t></w:r></w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document, theme_xml=THEME_XML)))
        run = package.document.find(f".//{{{W}}}r")

        style = StyleResolver(package).resolve_run(run)

        self.assertEqual(style.color, "#FFFFFF")

    def test_underline_kind_without_color_does_not_become_a_color_value(self):
        document = f"""<w:document xmlns:w="{W}"><w:body><w:p><w:r><w:rPr>
          <w:u w:val="single"/>
        </w:rPr><w:t>X</w:t></w:r></w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document)))
        run = package.document.find(f".//{{{W}}}r")

        style = StyleResolver(package).resolve_run(run)

        self.assertEqual(style.underline, "single")

    def test_style_ancestry_cycle_fails_closed_with_style_ids(self):
        styles = f"""<w:styles xmlns:w="{W}">
          <w:style w:type="paragraph" w:styleId="A"><w:basedOn w:val="B"/></w:style>
          <w:style w:type="paragraph" w:styleId="B"><w:basedOn w:val="A"/></w:style>
        </w:styles>"""
        document = f"""<w:document xmlns:w="{W}"><w:body><w:p><w:pPr><w:pStyle w:val="A"/></w:pPr></w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document, styles_xml=styles)))
        paragraph = package.document.find(f".//{{{W}}}p")

        with self.assertRaisesRegex(StyleResolutionError, "A -> B -> A"):
            StyleResolver(package).resolve_paragraph(paragraph)

    def test_unresolved_theme_color_fails_closed_with_element_path(self):
        document = f"""<w:document xmlns:w="{W}"><w:body><w:p><w:r><w:rPr>
          <w:color w:themeColor="accent6"/>
        </w:rPr><w:t>X</w:t></w:r></w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document, theme_xml=THEME_XML)))
        run = package.document.find(f".//{{{W}}}r")

        with self.assertRaisesRegex(
            StyleResolutionError,
            r"accent6.*word/document\.xml/w:document\[1\]/w:body\[1\]/w:p\[1\]/w:r\[1\]/w:rPr\[1\]/w:color\[1\]",
        ):
            StyleResolver(package).resolve_run(run)


if __name__ == "__main__":
    unittest.main()

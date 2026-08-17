from io import BytesIO
import unittest

from scripts.book_import.events import EventExtractionError, extract_events
from scripts.book_import.package import OOXMLPackage, OOXMLPackageError
from scripts.tests.fixtures import (
    EMPTY_DOCUMENT_RELS_XML,
    PACKAGE_RELS_XML,
    make_docx,
    make_docx_members,
)


W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

EXACT_CODE_POINT_DOCUMENT_XML = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W}"><w:body><w:p><w:r>
  <w:t xml:space="preserve"> A  B</w:t><w:tab/><w:t>C</w:t><w:br/><w:t>D E</w:t><w:noBreakHyphen/><w:t>F</w:t><w:softHyphen/><w:t>G</w:t>
</w:r></w:p></w:body></w:document>"""


def parse_fixture_events(source_text: str):
    if source_text != " A  B\tC\nD E‑F­G":
        raise AssertionError("The hand-authored fixture has one exact expected source stream")
    package = OOXMLPackage.from_file(BytesIO(make_docx(EXACT_CODE_POINT_DOCUMENT_XML)))
    return extract_events(package).visible_events[:-1]


class OOXMLTextEventTest(unittest.TestCase):
    def test_text_event_stream_preserves_every_source_code_point(self):
        events = parse_fixture_events(" A  B\tC\nD E‑F­G")
        self.assertEqual(
            [(event.kind, event.value) for event in events],
            [
                ("text", " A  B"),
                ("tab", "\t"),
                ("text", "C"),
                ("line_break", "\n"),
                ("text", "D E"),
                ("no_break_hyphen", "‑"),
                ("text", "F"),
                ("soft_hyphen", "­"),
                ("text", "G"),
            ],
        )

    def test_apparent_typo_and_medical_unit_remain_byte_for_byte_unchanged(self):
        document = f"""<w:document xmlns:w="{W}"><w:body><w:p><w:r>
          <w:t xml:space="preserve">pre-eclamsia  5 mg/dL</w:t>
        </w:r></w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document)))

        event = extract_events(package).visible_events[0]

        self.assertEqual(event.value.encode("utf-8"), "pre-eclamsia  5 mg/dL".encode("utf-8"))

    def test_break_kinds_and_empty_paragraphs_are_explicit(self):
        document = f"""<w:document xmlns:w="{W}"><w:body>
          <w:p><w:r><w:t>A</w:t><w:br w:type="page"/><w:cr/></w:r></w:p><w:p/>
        </w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document)))

        events = extract_events(package).visible_events

        self.assertEqual(
            [(event.kind, event.value) for event in events],
            [
                ("text", "A"),
                ("page_break", "\f"),
                ("line_break", "\n"),
                ("paragraph_boundary", "\n"),
                ("empty_paragraph", ""),
                ("paragraph_boundary", "\n"),
            ],
        )

    def test_hyperlinks_bookmarks_and_paths_follow_document_order(self):
        document = f"""<w:document xmlns:w="{W}" xmlns:r="{R}"><w:body><w:p>
          <w:bookmarkStart w:id="4" w:name="care-plan"/><w:r><w:t>Before</w:t></w:r>
          <w:hyperlink r:id="rId8"><w:r><w:t>WHO</w:t></w:r></w:hyperlink>
          <w:bookmarkEnd w:id="4"/>
        </w:p></w:body></w:document>"""
        relationships = """<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://www.who.int/" TargetMode="External"/>
        </Relationships>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document, relationships_xml=relationships)))

        extracted = extract_events(package)

        self.assertEqual(package.hyperlinks, {"rId8": "https://www.who.int/"})
        self.assertEqual(package.bookmarks[0].name, "care-plan")
        self.assertEqual(
            package.bookmarks[0].start_path,
            "word/document.xml/w:document[1]/w:body[1]/w:p[1]/w:bookmarkStart[1]",
        )
        self.assertEqual(
            package.bookmarks[0].end_path,
            "word/document.xml/w:document[1]/w:body[1]/w:p[1]/w:bookmarkEnd[1]",
        )
        self.assertEqual(extracted.visible_events[1].hyperlink_target, "https://www.who.int/")
        self.assertEqual(
            extracted.visible_events[1].source_path,
            "word/document.xml/w:document[1]/w:body[1]/w:p[1]/w:hyperlink[1]/w:r[1]/w:t[1]",
        )

    def test_final_display_excludes_but_diagnoses_instruction_deleted_and_hidden_text(self):
        document = f"""<w:document xmlns:w="{W}"><w:body><w:p>
          <w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> REF old </w:instrText></w:r>
          <w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Current</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
          <w:del><w:r><w:delText>Removed</w:delText></w:r></w:del>
          <w:r><w:rPr><w:vanish/></w:rPr><w:t>Hidden</w:t></w:r>
          <w:ins><w:r><w:t> Added</w:t></w:r></w:ins>
        </w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document)))

        extracted = extract_events(package)

        self.assertEqual(
            [(event.kind, event.value) for event in extracted.visible_events],
            [("text", "Current"), ("text", " Added"), ("paragraph_boundary", "\n")],
        )
        self.assertEqual(
            [(event.kind, event.value) for event in extracted.structural_diagnostics],
            [
                ("field_instruction", " REF old "),
                ("deleted_text", "Removed"),
                ("hidden_text", "Hidden"),
            ],
        )

    def test_style_inherited_hidden_text_stays_out_of_final_display(self):
        styles = f"""<w:styles xmlns:w="{W}">
          <w:style w:type="character" w:styleId="HiddenEvidence"><w:rPr><w:vanish/></w:rPr></w:style>
        </w:styles>"""
        document = f"""<w:document xmlns:w="{W}"><w:body><w:p>
          <w:r><w:rPr><w:rStyle w:val="HiddenEvidence"/></w:rPr><w:t>Audit only</w:t></w:r>
          <w:r><w:t>Visible</w:t></w:r>
        </w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document, styles_xml=styles)))

        extracted = extract_events(package)

        self.assertEqual(
            [(event.kind, event.value) for event in extracted.visible_events],
            [("text", "Visible"), ("paragraph_boundary", "\n")],
        )
        self.assertEqual(
            [(event.kind, event.value) for event in extracted.structural_diagnostics],
            [("hidden_text", "Audit only")],
        )

    def test_simple_field_instruction_is_diagnosed_while_display_text_is_visible(self):
        document = f"""<w:document xmlns:w="{W}"><w:body><w:p>
          <w:fldSimple w:instr=" DATE "><w:r><w:t>17 August 2026</w:t></w:r></w:fldSimple>
        </w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document)))

        extracted = extract_events(package)

        self.assertEqual(
            [(event.kind, event.value) for event in extracted.visible_events],
            [("text", "17 August 2026"), ("paragraph_boundary", "\n")],
        )
        self.assertEqual(
            [(event.kind, event.value) for event in extracted.structural_diagnostics],
            [("field_instruction", " DATE ")],
        )

    def test_supported_alternate_content_emits_choice_without_fallback_duplication(self):
        document = f"""<w:document xmlns:w="{W}"
          xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
          xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">
          <w:body><w:p><w:r><mc:AlternateContent>
            <mc:Choice Requires="wps"><wps:txbx><w:txbxContent><w:p><w:r><w:t>Choice text</w:t></w:r></w:p></w:txbxContent></wps:txbx></mc:Choice>
            <mc:Fallback><w:p><w:r><w:t>Fallback duplicate</w:t></w:r></w:p></mc:Fallback>
          </mc:AlternateContent></w:r></w:p></w:body>
        </w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document)))

        extracted = extract_events(package)

        self.assertEqual(
            [(event.kind, event.value) for event in extracted.visible_events],
            [
                ("text", "Choice text"),
                ("paragraph_boundary", "\n"),
                ("paragraph_boundary", "\n"),
            ],
        )

    def test_unsupported_revision_display_ambiguity_fails_with_element_path(self):
        document = f"""<w:document xmlns:w="{W}"><w:body><w:p>
          <w:conflictIns><w:r><w:t>Which version?</w:t></w:r></w:conflictIns>
        </w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document)))

        with self.assertRaisesRegex(
            EventExtractionError,
            r"word/document\.xml/w:document\[1\]/w:body\[1\]/w:p\[1\]/w:conflictIns\[1\]",
        ):
            extract_events(package)

    def test_deleted_table_row_fails_closed_at_structural_deletion_path(self):
        document = f"""<w:document xmlns:w="{W}"><w:body><w:tbl><w:tr>
          <w:trPr><w:del w:id="7"/></w:trPr>
          <w:tc><w:p><w:r><w:t>Deleted row</w:t></w:r></w:p></w:tc>
        </w:tr></w:tbl></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document)))

        with self.assertRaisesRegex(
            EventExtractionError,
            r"deleted table row.*word/document\.xml/w:document\[1\]/w:body\[1\]/w:tbl\[1\]/w:tr\[1\]/w:trPr\[1\]/w:del\[1\]",
        ):
            extract_events(package)

    def test_column_break_has_exact_kind_without_becoming_line_break(self):
        document = f"""<w:document xmlns:w="{W}"><w:body><w:p><w:r>
          <w:t>Before</w:t><w:br w:type="column"/><w:t>After</w:t>
        </w:r></w:p></w:body></w:document>"""
        package = OOXMLPackage.from_file(BytesIO(make_docx(document)))

        extracted = extract_events(package)

        self.assertEqual(
            [(event.kind, event.value) for event in extracted.visible_events],
            [
                ("text", "Before"),
                ("column_break", ""),
                ("text", "After"),
                ("paragraph_boundary", "\n"),
            ],
        )


class OOXMLPackageValidationTest(unittest.TestCase):
    def test_zip_member_path_traversal_is_rejected_without_extraction(self):
        archive = make_docx_members((("../word/document.xml", "<document/>"),))
        with self.assertRaisesRegex(OOXMLPackageError, "path traversal"):
            OOXMLPackage.from_file(BytesIO(archive))

    def test_duplicate_relationship_ids_are_rejected(self):
        relationships = """<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="same" Type="urn:one" Target="styles.xml"/>
          <Relationship Id="same" Type="urn:two" Target="numbering.xml"/>
        </Relationships>"""
        with self.assertRaisesRegex(OOXMLPackageError, "Duplicate relationship ID same"):
            OOXMLPackage.from_file(BytesIO(make_docx("<w:document xmlns:w='%s'><w:body/></w:document>" % W, relationships_xml=relationships)))

    def test_missing_internal_relationship_target_is_rejected(self):
        relationships = """<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId9" Type="urn:missing" Target="media/not-there.png"/>
        </Relationships>"""
        with self.assertRaisesRegex(OOXMLPackageError, "missing target word/media/not-there.png"):
            OOXMLPackage.from_file(BytesIO(make_docx("<w:document xmlns:w='%s'><w:body/></w:document>" % W, relationships_xml=relationships)))

    def test_external_image_relationship_is_rejected(self):
        relationships = """<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://example.test/scan.png" TargetMode="External"/>
        </Relationships>"""
        with self.assertRaisesRegex(OOXMLPackageError, "External image relationship rId7"):
            OOXMLPackage.from_file(BytesIO(make_docx("<w:document xmlns:w='%s'><w:body/></w:document>" % W, relationships_xml=relationships)))

    def test_malformed_xml_names_the_package_member(self):
        with self.assertRaisesRegex(OOXMLPackageError, "word/document.xml"):
            OOXMLPackage.from_file(BytesIO(make_docx("<w:document>")))

    def test_malformed_non_document_xml_members_are_rejected(self):
        valid_document = f"<w:document xmlns:w='{W}'><w:body/></w:document>"
        cases = (
            (
                "[Content_Types].xml",
                make_docx_members(
                    (
                        ("[Content_Types].xml", "<Types>"),
                        ("_rels/.rels", PACKAGE_RELS_XML),
                        ("word/document.xml", valid_document),
                        ("word/_rels/document.xml.rels", EMPTY_DOCUMENT_RELS_XML),
                    )
                ),
            ),
            (
                "customXml/item1.xml",
                make_docx(
                    valid_document,
                    extra_members=(("customXml/item1.xml", "<medical-data>"),),
                ),
            ),
        )

        for member_name, archive in cases:
            with self.subTest(member_name=member_name):
                with self.assertRaisesRegex(OOXMLPackageError, member_name.replace("[", r"\[").replace("]", r"\]")):
                    OOXMLPackage.from_file(BytesIO(archive))


if __name__ == "__main__":
    unittest.main()

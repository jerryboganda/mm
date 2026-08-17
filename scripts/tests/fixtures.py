"""Literal, in-memory DOCX fixtures for the OOXML reader tests."""

from __future__ import annotations

from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile


CONTENT_TYPES_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

PACKAGE_RELS_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

EMPTY_DOCUMENT_RELS_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>"""

EMPTY_STYLES_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>"""

EMPTY_NUMBERING_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>"""

EMPTY_FONT_TABLE_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>"""

EMPTY_THEME_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="fixture">
  <a:themeElements><a:clrScheme name="fixture"/></a:themeElements>
</a:theme>"""


def make_docx(
    document_xml: str,
    *,
    relationships_xml: str = EMPTY_DOCUMENT_RELS_XML,
    styles_xml: str = EMPTY_STYLES_XML,
    numbering_xml: str = EMPTY_NUMBERING_XML,
    font_table_xml: str = EMPTY_FONT_TABLE_XML,
    theme_xml: str = EMPTY_THEME_XML,
    extra_members: tuple[tuple[str, str | bytes], ...] = (),
) -> bytes:
    """Package explicit XML strings without asking Word to rewrite them."""
    members: tuple[tuple[str, str | bytes], ...] = (
        ("[Content_Types].xml", CONTENT_TYPES_XML),
        ("_rels/.rels", PACKAGE_RELS_XML),
        ("word/document.xml", document_xml),
        ("word/_rels/document.xml.rels", relationships_xml),
        ("word/styles.xml", styles_xml),
        ("word/numbering.xml", numbering_xml),
        ("word/fontTable.xml", font_table_xml),
        ("word/theme/theme1.xml", theme_xml),
        *extra_members,
    )
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        for member_name, contents in members:
            archive.writestr(member_name, contents)
    return buffer.getvalue()


def make_docx_members(members: tuple[tuple[str, str | bytes], ...]) -> bytes:
    """Create a deliberately non-standard ZIP for fail-closed package tests."""
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        for member_name, contents in members:
            archive.writestr(member_name, contents)
    return buffer.getvalue()

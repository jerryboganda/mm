from __future__ import annotations

from io import BytesIO
from pathlib import Path
import hashlib
import struct
import tempfile
import unittest

from PIL import Image

from scripts.book_import.constants import authoritative_source
from scripts.book_import.media import (
    MediaError,
    inventory_media,
    materialize_relationship,
    sniff_media,
    store_media_bytes,
)
from scripts.book_import.package import OOXMLPackage
from scripts.tests.fixtures import make_docx


W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def _image_bytes(kind: str, mode: str = "RGBA") -> bytes:
    buffer = BytesIO()
    image = Image.new(mode, (3, 2), (10, 20, 30, 40) if mode == "RGBA" else (10, 20, 30))
    image.save(buffer, format=kind)
    return buffer.getvalue()


def _image_package(member_name: str, payload: bytes) -> OOXMLPackage:
    document = f"""<w:document xmlns:w="{W}" xmlns:r="{R}"><w:body><w:p><w:r>
      <w:drawing><a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" r:embed="rIdImage"/></w:drawing>
    </w:r></w:p></w:body></w:document>"""
    relationships = f"""<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rIdImage" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/{member_name}"/>
    </Relationships>"""
    return OOXMLPackage.from_file(
        BytesIO(
            make_docx(
                document,
                relationships_xml=relationships,
                extra_members=((f"word/media/{member_name}", payload),),
            )
        )
    )


class MediaSignatureTest(unittest.TestCase):
    def test_png_signature_overrides_bin_package_suffix_and_preserves_bytes(self):
        payload = _image_bytes("PNG")
        package = _image_package("image.bin", payload)

        with tempfile.TemporaryDirectory() as directory:
            asset = materialize_relationship(
                package,
                "rIdImage",
                Path(directory),
                release_digest="f" * 64,
                topic_id="t-mm-01-001",
                source_path="word/document.xml/test/drawing[1]",
            )

            self.assertEqual(asset.media_kind, "png")
            self.assertEqual(asset.display_extension, ".png")
            self.assertEqual(asset.source_sha256, hashlib.sha256(payload).hexdigest())
            self.assertEqual(asset.display_sha256, asset.source_sha256)
            self.assertTrue(asset.original_bytes_preserved)
            self.assertEqual(asset.output_path.read_bytes(), payload)
            self.assertEqual((asset.width_px, asset.height_px, asset.has_alpha), (3, 2, True))
            self.assertIn(("relationship_id", "rIdImage"), asset.source_relationship)

    def test_jpeg_and_jfif_bytes_are_not_reencoded(self):
        jfif = _image_bytes("JPEG", "RGB")
        self.assertEqual(jfif[6:11], b"JFIF\x00")
        # Remove only the optional APP0/JFIF segment.  The remaining JPEG is
        # independently decodable and proves we do not conflate JPEG and JFIF.
        app0_length = struct.unpack_from(">H", jfif, 4)[0]
        jpeg = jfif[:2] + jfif[4 + app0_length :]

        with tempfile.TemporaryDirectory() as directory:
            jfif_asset = store_media_bytes(
                jfif,
                "word/media/misleading.jpeg",
                Path(directory),
                release_digest="a" * 64,
            )
            jpeg_asset = store_media_bytes(
                jpeg,
                "word/media/misleading.jfif",
                Path(directory),
                release_digest="a" * 64,
            )

            self.assertEqual((jfif_asset.media_kind, jfif_asset.display_extension), ("jfif", ".jfif"))
            self.assertEqual((jpeg_asset.media_kind, jpeg_asset.display_extension), ("jpeg", ".jpeg"))
            self.assertTrue(jfif_asset.original_bytes_preserved)
            self.assertTrue(jpeg_asset.original_bytes_preserved)
            self.assertEqual(jfif_asset.output_path.read_bytes(), jfif)
            self.assertEqual(jpeg_asset.output_path.read_bytes(), jpeg)
            self.assertEqual((jfif_asset.width_px, jfif_asset.height_px, jfif_asset.has_alpha), (3, 2, False))
            self.assertEqual((jpeg_asset.width_px, jpeg_asset.height_px, jpeg_asset.has_alpha), (3, 2, False))

    def test_corrupt_and_polyglot_raster_payloads_are_rejected(self):
        png = _image_bytes("PNG")
        jpeg = _image_bytes("JPEG", "RGB")
        cases = (
            (png[:-7], "truncated PNG"),
            (png + b"PK\x03\x04hidden", "trailing data"),
            (jpeg[:-2], "truncated JPEG"),
            (jpeg + b"<script>alert(1)</script>", "trailing data"),
        )

        for payload, message in cases:
            with self.subTest(message=message):
                with self.assertRaisesRegex(MediaError, message):
                    sniff_media(payload, "word/media/suspect.bin")

    def test_emf_header_and_record_chain_are_validated_before_conversion(self):
        # Header and EOF only: sufficient to test structural validation without
        # asking a non-GDI fixture writer to reinterpret metafile content.
        header = bytearray(108)
        struct.pack_into("<II", header, 0, 1, 108)
        struct.pack_into("<iiii", header, 8, 0, 0, 9, 19)
        struct.pack_into("<iiii", header, 24, 0, 0, 254, 508)
        header[40:44] = b" EMF"
        struct.pack_into("<I", header, 44, 0x00010000)
        struct.pack_into("<I", header, 48, 128)
        struct.pack_into("<I", header, 52, 2)
        struct.pack_into("<H", header, 56, 1)
        eof = struct.pack("<IIIII", 14, 20, 0, 0, 20)
        emf = bytes(header) + eof

        probe = sniff_media(emf, "word/media/vector.emf")

        self.assertEqual((probe.media_kind, probe.display_extension), ("emf", ".png"))
        self.assertEqual((probe.width_px, probe.height_px), (10, 20))
        with self.assertRaisesRegex(MediaError, "EMF byte count"):
            sniff_media(emf + b"polyglot", "word/media/vector.emf")


class RealSourceMediaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.package = OOXMLPackage.from_file(
            authoritative_source(Path(__file__).resolve().parents[2])
        )

    def test_authoritative_media_inventory_is_signature_checked_not_suffix_trusted(self):
        result = inventory_media(self.package)

        self.assertEqual(result.unique_media_parts, 164)
        self.assertEqual(
            result.package_extensions,
            ((".bin", 1), (".emf", 40), (".jfif", 1), (".jpeg", 7), (".jpg", 40), (".png", 75)),
        )
        self.assertEqual(result.detected_formats, (("emf", 40), ("jfif", 48), ("png", 76)))
        self.assertEqual(result.corrupt_parts, ())

    def test_real_emf_is_losslessly_rendered_by_windows_gdiplus_and_validated(self):
        relationships = tuple(
            relationship
            for relationship in self.package.document_relationships.values()
            if relationship.relationship_type.endswith("/image")
            and relationship.target_part is not None
            and relationship.target_part.lower().endswith(".emf")
        )
        self.assertEqual(len(relationships), 40)
        converter = Path(__file__).resolve().parents[1] / "book_import" / "convert_emf.ps1"

        with tempfile.TemporaryDirectory() as directory:
            for relationship in relationships:
                with self.subTest(source_part=relationship.target_part):
                    asset = materialize_relationship(
                        self.package,
                        relationship.relationship_id,
                        Path(directory),
                        release_digest="b" * 64,
                        topic_id="t-mm-real-inventory",
                        source_path=relationship.source_path,
                        converter_script=converter,
                    )

                    self.assertEqual(asset.media_kind, "emf")
                    self.assertEqual(asset.display_extension, ".png")
                    self.assertFalse(asset.original_bytes_preserved)
                    self.assertNotEqual(asset.display_sha256, asset.source_sha256)
                    self.assertGreater(asset.width_px, 0)
                    self.assertGreater(asset.height_px, 0)
                    self.assertTrue(asset.has_alpha)
                    probe = sniff_media(
                        asset.output_path.read_bytes(), str(asset.output_path)
                    )
                    self.assertEqual(probe.media_kind, "png")
                    self.assertEqual(
                        (probe.width_px, probe.height_px),
                        (asset.width_px, asset.height_px),
                    )


if __name__ == "__main__":
    unittest.main()

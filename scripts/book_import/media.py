"""Signature-validated, content-addressed OOXML media handling."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import struct
import subprocess
import tempfile
from typing import Optional, Tuple
import zlib

from PIL import Image, UnidentifiedImageError

from .package import OOXMLPackage, Relationship


class MediaError(ValueError):
    """A package media part cannot be preserved or rendered without guessing."""


@dataclass(frozen=True)
class MediaProbe:
    media_kind: str
    display_extension: str
    width_px: int
    height_px: int
    has_alpha: bool


@dataclass(frozen=True)
class MediaAsset:
    source_part: str
    source_sha256: str
    display_sha256: str
    media_kind: str
    display_extension: str
    output_path: Path
    width_px: int
    height_px: int
    has_alpha: bool
    original_bytes_preserved: bool
    source_relationship: Tuple[Tuple[str, str], ...] = ()


@dataclass(frozen=True)
class MediaInventory:
    unique_media_parts: int
    package_extensions: Tuple[Tuple[str, int], ...]
    detected_formats: Tuple[Tuple[str, int], ...]
    corrupt_parts: Tuple[str, ...]


_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_JPEG_SIGNATURE = b"\xff\xd8\xff"
_EMF_SIGNATURE = b" EMF"


def sniff_media(data: bytes, source_part: str) -> MediaProbe:
    """Identify and fully validate a supported media part from its bytes."""
    if not isinstance(data, bytes):
        raise MediaError(f"Media bytes are required for {source_part}")
    if data.startswith(_PNG_SIGNATURE):
        _validate_png_container(data, source_part)
        width, height, has_alpha = _decode_raster(data, "PNG", source_part)
        return MediaProbe("png", ".png", width, height, has_alpha)
    if data.startswith(_JPEG_SIGNATURE):
        eoi = _jpeg_eoi_offset(data, source_part)
        if eoi < len(data):
            raise MediaError(f"JPEG trailing data (polyglot) at {source_part}")
        width, height, has_alpha = _decode_raster(data, "JPEG", source_part)
        is_jfif = len(data) >= 11 and data[6:11] == b"JFIF\x00"
        return MediaProbe(
            "jfif" if is_jfif else "jpeg",
            ".jfif" if is_jfif else ".jpeg",
            width,
            height,
            has_alpha,
        )
    if len(data) >= 44 and data[40:44] == _EMF_SIGNATURE:
        width, height = _validate_emf_container(data, source_part)
        return MediaProbe("emf", ".png", width, height, True)
    raise MediaError(
        f"Unsupported media signature {data[:16].hex()} at {source_part}"
    )


def store_media_bytes(
    data: bytes,
    source_part: str,
    output_root: Path,
    *,
    release_digest: str,
    converter_script: Optional[Path] = None,
    source_relationship: Tuple[Tuple[str, str], ...] = (),
) -> MediaAsset:
    """Write an immutable source-preserving raster or validated EMF derivative."""
    _validate_digest_path_component(release_digest, "release digest")
    probe = sniff_media(data, source_part)
    source_digest = sha256(data).hexdigest()
    destination_dir = Path(output_root) / release_digest / "media"
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = destination_dir / f"{source_digest}{probe.display_extension}"

    if probe.media_kind == "emf":
        script = Path(converter_script) if converter_script else Path(__file__).with_name("convert_emf.ps1")
        if not script.is_file():
            raise MediaError(f"Windows GDI+ EMF converter is missing: {script}")
        with tempfile.TemporaryDirectory(prefix="mm-emf-") as temporary:
            source_file = Path(temporary) / f"{source_digest}.emf"
            converted_file = Path(temporary) / f"{source_digest}.png"
            source_file.write_bytes(data)
            powershell_bin = shutil.which("pwsh") or shutil.which("powershell") or "powershell"
            command = [
                powershell_bin,
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-File",
                str(script),
                "-SourcePath",
                str(source_file),
                "-OutputPath",
                str(converted_file),
                "-ExpectedSourceSha256",
                source_digest,
            ]
            completed = subprocess.run(
                command,
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
            )
            if completed.returncode != 0:
                detail = (completed.stderr or completed.stdout).strip()
                raise MediaError(
                    f"Windows GDI+ EMF conversion failed for {source_part}: {detail}"
                )
            if not converted_file.is_file():
                raise MediaError(f"EMF converter produced no PNG for {source_part}")
            display_bytes = converted_file.read_bytes()
            try:
                receipt = json.loads(completed.stdout)
            except (json.JSONDecodeError, TypeError) as error:
                raise MediaError(
                    f"Windows GDI+ EMF converter returned no valid receipt for {source_part}"
                ) from error
            if not isinstance(receipt, dict) or receipt.get("renderer") != "Windows GDI+":
                raise MediaError(
                    f"Unexpected EMF renderer receipt for {source_part}: {receipt!r}"
                )
            if receipt.get("sourceSha256") != source_digest:
                raise MediaError(
                    f"EMF converter source digest differs for {source_part}"
                )
            converted_width = receipt.get("width")
            converted_height = receipt.get("height")
            if (
                not isinstance(converted_width, int)
                or isinstance(converted_width, bool)
                or converted_width <= 0
                or not isinstance(converted_height, int)
                or isinstance(converted_height, bool)
                or converted_height <= 0
            ):
                raise MediaError(
                    f"EMF converter returned invalid dimensions for {source_part}: "
                    f"{converted_width!r}x{converted_height!r}"
                )
            display_digest = sha256(display_bytes).hexdigest()
            if receipt.get("outputSha256") != display_digest:
                raise MediaError(
                    f"EMF converter output digest differs for {source_part}"
                )
        display_probe = sniff_media(display_bytes, str(destination))
        if display_probe.media_kind != "png":
            raise MediaError(f"EMF derivative is not PNG for {source_part}")
        if (display_probe.width_px, display_probe.height_px) != (
            converted_width,
            converted_height,
        ):
            raise MediaError(
                f"EMF derivative dimensions differ for {source_part}: "
                f"converter={converted_width}x{converted_height}, "
                f"display={display_probe.width_px}x{display_probe.height_px}"
            )
        if not display_probe.has_alpha:
            raise MediaError(f"EMF derivative lacks an alpha channel for {source_part}")
        original_preserved = False
        final_probe = display_probe
    else:
        display_bytes = data
        original_preserved = True
        final_probe = probe

    _write_once_or_verify(destination, display_bytes)
    return MediaAsset(
        source_part=source_part,
        source_sha256=source_digest,
        display_sha256=sha256(display_bytes).hexdigest(),
        media_kind=probe.media_kind,
        display_extension=probe.display_extension,
        output_path=destination,
        width_px=final_probe.width_px,
        height_px=final_probe.height_px,
        has_alpha=final_probe.has_alpha,
        original_bytes_preserved=original_preserved,
        source_relationship=source_relationship,
    )


def materialize_relationship(
    package: OOXMLPackage,
    relationship_id: str,
    output_root: Path,
    *,
    release_digest: str,
    topic_id: str,
    source_path: str,
    converter_script: Optional[Path] = None,
) -> MediaAsset:
    """Resolve one internal image relationship and preserve its provenance."""
    try:
        relationship = package.document_relationships[relationship_id]
    except KeyError as error:
        raise MediaError(
            f"{topic_id}: unresolved image relationship {relationship_id} at {source_path}"
        ) from error
    _validate_image_relationship(relationship, topic_id, source_path)
    assert relationship.target_part is not None
    data = package.member_bytes(relationship.target_part)
    provenance = (
        ("relationship_id", relationship.relationship_id),
        ("relationship_type", relationship.relationship_type),
        ("relationship_source_path", relationship.source_path),
        ("target_part", relationship.target_part),
        ("drawing_source_path", source_path),
        ("topic_id", topic_id),
    )
    return store_media_bytes(
        data,
        relationship.target_part,
        output_root,
        release_digest=release_digest,
        converter_script=converter_script,
        source_relationship=provenance,
    )


def inventory_media(package: OOXMLPackage) -> MediaInventory:
    """Report every unique image target while signature-validating its bytes."""
    relationships = tuple(
        relationship
        for relationship in package.relationships
        if relationship.relationship_type.endswith("/image")
        and relationship.target_part is not None
    )
    unique_parts = sorted({relationship.target_part for relationship in relationships})
    suffixes = Counter(PurePosixPath(part).suffix.lower() for part in unique_parts)
    formats: Counter[str] = Counter()
    corrupt = []
    for part in unique_parts:
        try:
            formats[sniff_media(package.member_bytes(part), part).media_kind] += 1
        except MediaError:
            corrupt.append(part)
    return MediaInventory(
        unique_media_parts=len(unique_parts),
        package_extensions=tuple(sorted(suffixes.items())),
        detected_formats=tuple(sorted(formats.items())),
        corrupt_parts=tuple(corrupt),
    )


def _validate_image_relationship(
    relationship: Relationship, topic_id: str, source_path: str
) -> None:
    if not relationship.relationship_type.endswith("/image"):
        raise MediaError(
            f"{topic_id}: relationship {relationship.relationship_id} is not an image at {source_path}"
        )
    if relationship.target_mode is not None and relationship.target_mode.lower() == "external":
        raise MediaError(
            f"{topic_id}: external image relationship {relationship.relationship_id} at {source_path}"
        )
    if relationship.target_part is None:
        raise MediaError(
            f"{topic_id}: image relationship {relationship.relationship_id} has no package target at {source_path}"
        )


def _decode_raster(data: bytes, expected_format: str, source_part: str) -> tuple[int, int, bool]:
    try:
        with Image.open(BytesIO(data)) as image:
            if image.format != expected_format:
                raise MediaError(
                    f"Raster decoder disagrees with {expected_format} signature at {source_part}"
                )
            image.load()
            width, height = image.size
            mode = image.mode
            has_alpha = "A" in image.getbands() or "transparency" in image.info
    except MediaError:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise MediaError(f"Corrupt {expected_format} image at {source_part}: {error}") from error
    if width <= 0 or height <= 0:
        raise MediaError(f"Invalid {expected_format} dimensions at {source_part}")
    return width, height, has_alpha


def _validate_png_container(data: bytes, source_part: str) -> None:
    offset = len(_PNG_SIGNATURE)
    saw_header = False
    saw_end = False
    while offset < len(data):
        if len(data) - offset < 12:
            raise MediaError(f"truncated PNG chunk at {source_part}")
        length = struct.unpack_from(">I", data, offset)[0]
        chunk_type = data[offset + 4 : offset + 8]
        chunk_end = offset + 12 + length
        if chunk_end > len(data):
            raise MediaError(f"truncated PNG chunk at {source_part}")
        payload = data[offset + 8 : offset + 8 + length]
        expected_crc = struct.unpack_from(">I", data, offset + 8 + length)[0]
        actual_crc = zlib.crc32(chunk_type)
        actual_crc = zlib.crc32(payload, actual_crc) & 0xFFFFFFFF
        if actual_crc != expected_crc:
            raise MediaError(f"Corrupt PNG CRC at {source_part}")
        if not saw_header:
            if chunk_type != b"IHDR" or length != 13:
                raise MediaError(f"PNG IHDR is missing or invalid at {source_part}")
            saw_header = True
        if chunk_type == b"IEND":
            if length != 0:
                raise MediaError(f"Corrupt PNG IEND at {source_part}")
            saw_end = True
            offset = chunk_end
            break
        offset = chunk_end
    if not saw_end:
        raise MediaError(f"truncated PNG: missing IEND at {source_part}")
    if offset != len(data):
        raise MediaError(f"PNG trailing data (polyglot) at {source_part}")


def _jpeg_eoi_offset(data: bytes, source_part: str) -> int:
    if len(data) < 4 or not data.startswith(b"\xff\xd8"):
        raise MediaError(f"truncated JPEG header at {source_part}")
    offset = 2
    in_scan = False
    while offset < len(data):
        if not in_scan:
            if data[offset] != 0xFF:
                raise MediaError(f"Corrupt JPEG marker at {source_part}")
            while offset < len(data) and data[offset] == 0xFF:
                offset += 1
            if offset >= len(data):
                break
            marker = data[offset]
            offset += 1
        else:
            marker_start = data.find(b"\xff", offset)
            if marker_start < 0:
                break
            offset = marker_start + 1
            while offset < len(data) and data[offset] == 0xFF:
                offset += 1
            if offset >= len(data):
                break
            marker = data[offset]
            offset += 1
            if marker == 0x00 or 0xD0 <= marker <= 0xD7:
                continue
            in_scan = False
        if marker == 0xD9:
            return offset
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            continue
        if offset + 2 > len(data):
            break
        segment_length = struct.unpack_from(">H", data, offset)[0]
        if segment_length < 2 or offset + segment_length > len(data):
            raise MediaError(f"truncated JPEG segment at {source_part}")
        if marker == 0xDA:
            in_scan = True
        offset += segment_length
    raise MediaError(f"truncated JPEG: missing EOI at {source_part}")


def _validate_emf_container(data: bytes, source_part: str) -> tuple[int, int]:
    if len(data) < 88:
        raise MediaError(f"truncated EMF header at {source_part}")
    record_type, header_size = struct.unpack_from("<II", data, 0)
    if record_type != 1 or header_size < 88 or header_size % 4:
        raise MediaError(f"Invalid EMF header record at {source_part}")
    if data[40:44] != _EMF_SIGNATURE:
        raise MediaError(f"Invalid EMF signature at {source_part}")
    declared_bytes, declared_records = struct.unpack_from("<II", data, 48)
    if declared_bytes != len(data):
        raise MediaError(
            f"EMF byte count mismatch at {source_part}: declared {declared_bytes}, actual {len(data)}"
        )
    offset = 0
    count = 0
    last_type = None
    while offset < len(data):
        if len(data) - offset < 8:
            raise MediaError(f"truncated EMF record at {source_part}")
        current_type, size = struct.unpack_from("<II", data, offset)
        if size < 8 or size % 4 or offset + size > len(data):
            raise MediaError(f"Invalid EMF record size at {source_part}")
        count += 1
        last_type = current_type
        offset += size
    if offset != len(data) or count != declared_records or last_type != 14:
        raise MediaError(
            f"Invalid EMF record chain at {source_part}: records={count}/{declared_records}, last={last_type}"
        )
    left, top, right, bottom = struct.unpack_from("<iiii", data, 8)
    # ENHMETAHEADER.rclBounds uses inclusive device bounds.  GDI+ exposes the
    # corresponding bitmap dimensions as the coordinate delta plus one.
    width, height = right - left + 1, bottom - top + 1
    if width <= 0 or height <= 0:
        raise MediaError(f"Invalid EMF bounds at {source_part}")
    return width, height


def _validate_digest_path_component(value: str, label: str) -> None:
    if len(value) != 64 or any(character not in "0123456789abcdefABCDEF" for character in value):
        raise MediaError(f"Invalid {label}: {value!r}")


def _write_once_or_verify(destination: Path, data: bytes) -> None:
    if destination.exists():
        if not destination.is_file() or destination.read_bytes() != data:
            raise MediaError(f"Content-addressed asset collision at {destination}")
        return
    temporary = destination.with_name(f".{destination.name}.{os.getpid()}.tmp")
    try:
        temporary.write_bytes(data)
        os.replace(temporary, destination)
    finally:
        if temporary.exists():
            temporary.unlink()

"""Independent LibreOffice reference export and fail-closed figure comparison."""

from __future__ import annotations

from collections import defaultdict
from bisect import bisect_right
from copy import deepcopy
from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
import json
import math
from pathlib import Path
import re
from statistics import median
import subprocess
from typing import Iterable, Mapping, Optional, Sequence, Tuple
from urllib.parse import unquote, urlparse

from lxml import etree, html
from PIL import Image, ImageDraw, UnidentifiedImageError

from .drawings import A, PIC, W, WPG, WPS, DrawingItem, FigureComposition, _selected_drawings
from .events import extract_events
from .package import OFFICE_REL_NS as R, OOXMLPackage
from .styles import StyleResolver
from .tables import parse_tables


class VisualReferenceError(ValueError):
    """A compiler figure cannot be proven equivalent to its independent reference."""


@dataclass(frozen=True)
class FigureReference:
    figure_id: str
    relationship_order: Tuple[str, ...]
    width_px: int
    height_px: int
    label_sha256: str
    object_manifest_sha256: str
    geometry_sha256: str
    connection_sha256: str
    color_sha256: str
    pixel_png: bytes


@dataclass(frozen=True)
class PixelMetrics:
    width_px: int
    height_px: int
    differing_pixels: int
    unapproved_pixels: int
    edge_tolerance_pixels: int
    maximum_channel_delta: int


@dataclass(frozen=True)
class FigureComparisonMetrics:
    figure_id: str
    reference_tool: str
    missing_objects: int
    label_differences: int
    differing_pixels: int
    unapproved_pixels: int
    edge_tolerance_pixels: int


@dataclass(frozen=True)
class ReferenceExport:
    source_path: Path
    output_path: Path
    tool_version: str
    stdout: str


@dataclass(frozen=True)
class LibreOfficeHtmlObject:
    ordinal: int
    name: str
    source_file: Path
    width_px: int
    height_px: int
    encoded_pixels: bytes


@dataclass(frozen=True)
class MatchedFigureObject:
    item: DrawingItem
    exported: LibreOfficeHtmlObject
    dimension_delta_px: int


@dataclass(frozen=True)
class LibreOfficeFigureMatch:
    figure_id: str
    objects: Tuple[MatchedFigureObject, ...]
    relationship_order: Tuple[str, ...]
    unmatched_export_objects: Tuple[str, ...]
    excluded_non_document_objects: Tuple[str, ...] = ()


@dataclass(frozen=True)
class PdfFigureTag:
    """One independently exported PDF structure-tree figure bounding box."""

    ordinal: int
    page_index: int
    bbox_points: Tuple[float, float, float, float]


@dataclass(frozen=True)
class PdfCompositionMatch:
    """A whole source composition located on one 96-DPI PDF page raster."""

    figure_id: str
    page_index: int
    translation_px: Tuple[float, float]
    crop_box_px: Tuple[int, int, int, int]
    mapped_object_ids: Tuple[str, ...]
    mapped_tag_ordinals: Tuple[int, ...]
    untagged_object_reasons: Tuple[Tuple[str, str], ...]
    excluded_tag_ordinals: Tuple[int, ...] = ()


@dataclass(frozen=True)
class _SourceFigureStructure:
    figure_id: str
    relationship_order: Tuple[str, ...]
    label_sha256: str
    object_manifest_sha256: str
    geometry_sha256: str
    connection_sha256: str
    color_sha256: str
    x_emu: int
    y_emu: int
    width_emu: int
    height_emu: int
    export_layout: Tuple["_SourceExportLayout", ...]


@dataclass(frozen=True)
class _SourceExportLayout:
    object_id: str
    source_path: str
    x_emu: int
    y_emu: int
    width_emu: int
    height_emu: int
    z_order: int
    depth: int
    effect_extent: Tuple[int, int, int, int] = (0, 0, 0, 0)
    stroke_width_emu: int = 0
    arrowhead_extent_emu: int = 0
    contains_table: bool = False
    # A transparent text-box host has no visible paint in its unused anchor
    # interior.  When source OOXML proves the bounds of its visible table/text
    # content, retain that footprint rather than adopting unrelated PDF page
    # chrome which happens to sit behind the anchor rectangle.
    visible_content_bounds_emu: Optional[Tuple[int, int, int, int]] = None


@dataclass(frozen=True)
class _ReferenceSectionLayout:
    page_width: int
    page_height: int
    margin_left: int
    margin_right: int
    margin_top: int
    margin_bottom: int
    column_width: int


def match_pdf_composition_tags(
    source: _SourceFigureStructure,
    tags: Sequence[PdfFigureTag],
    *,
    page_height_points: float,
) -> PdfCompositionMatch:
    """Map one composition by PDF-page position, dimensions, and containment.

    LibreOffice expands a zero-width DrawingML connector to its painted PDF
    stroke bounds.  Eight pixels at 96 DPI is therefore the sole dimension
    allowance here; center placement must still agree within two pixels.  No
    object may be assigned by structure-tree traversal order alone.
    """
    if not tags:
        raise VisualReferenceError(
            f"PDF composition {source.figure_id} has no /Figure tags"
        )
    pages = {tag.page_index for tag in tags}
    if len(pages) != 1:
        raise VisualReferenceError(
            f"PDF composition {source.figure_id} spans pages {sorted(pages)}"
        )
    if not math.isfinite(page_height_points) or page_height_points <= 0:
        raise VisualReferenceError(f"Invalid PDF page height: {page_height_points}")
    page_index = next(iter(pages))
    source_records = tuple(source.export_layout)
    if not source_records:
        raise VisualReferenceError(
            f"PDF composition {source.figure_id} has no source objects"
        )
    tag_records = tuple(
        _pdf_tag_pixel_record(tag, page_height_points) for tag in tags
    )
    hypotheses = []
    for source_index, item in enumerate(source_records):
        source_center, source_size = _source_layout_pixel_record(item)
        for tag_index, (tag_center, tag_size) in enumerate(tag_records):
            dimension_delta = _dimension_delta(source_size, tag_size)
            if dimension_delta <= 8:
                hypotheses.append(
                    (
                        tag_center[0] - source_center[0],
                        tag_center[1] - source_center[1],
                    )
                )
    if not hypotheses:
        raise VisualReferenceError(
            f"PDF composition {source.figure_id} has no dimension-compatible tags"
        )
    # A large composition has one page-local translation, not thousands of
    # unrelated pairwise offsets.  Bucket only the hypothesis search (never
    # the final placement validation): the 0.5px bucket is narrower than the
    # two-pixel placement gate below, and a retained bucket needs agreement
    # from at least two independently positioned source objects.  Small
    # compositions preserve every exact hypothesis so one-object figures stay
    # fail-closed rather than becoming unmatchable.
    if len(source_records) > 8:
        grouped_hypotheses = defaultdict(list)
        for offset_x, offset_y in hypotheses:
            grouped_hypotheses[(round(offset_x * 2), round(offset_y * 2))].append(
                (offset_x, offset_y)
            )
        hypotheses = []
        for offsets in grouped_hypotheses.values():
            if len(offsets) < 2:
                continue
            offsets_x, offsets_y = zip(*offsets)
            hypotheses.append((float(median(offsets_x)), float(median(offsets_y))))
        if not hypotheses:
            raise VisualReferenceError(
                f"PDF composition {source.figure_id} has no repeated page-local translation"
            )

    valid_assignments = {}
    for translation in hypotheses:
        candidates = []
        for source_index, item in enumerate(source_records):
            source_center, source_size = _source_layout_pixel_record(item)
            translated = (
                source_center[0] + translation[0],
                source_center[1] + translation[1],
            )
            for tag_index, (tag_center, tag_size) in enumerate(tag_records):
                dimension_delta = _dimension_delta(source_size, tag_size)
                if dimension_delta > 8:
                    continue
                center_delta = abs(translated[0] - tag_center[0]) + abs(
                    translated[1] - tag_center[1]
                )
                if center_delta <= 2 or _tag_uses_source_paint_overhang(
                    item, tag_center, tag_size, translation
                ):
                    candidates.append(
                        (center_delta, dimension_delta, source_index, tag_index)
                    )
        assigned_source = set()
        assigned_tags = set()
        assignment = []
        for center_delta, dimension_delta, source_index, tag_index in sorted(candidates):
            if source_index in assigned_source or tag_index in assigned_tags:
                continue
            assigned_source.add(source_index)
            assigned_tags.add(tag_index)
            assignment.append(
                (source_index, tag_index, center_delta, dimension_delta)
            )
        excluded_tag_indices = tuple(
            tag_index
            for tag_index, (tag_center, _tag_size) in enumerate(tag_records)
            if tag_index not in assigned_tags
            and _tag_center_is_outside_source_paint_bounds(
                tag_center, source_records, translation
            )
        )
        if len(assigned_tags) + len(excluded_tag_indices) != len(tags):
            continue
        if any(
            item.depth == 0
            and not item.contains_table
            and index not in assigned_source
            for index, item in enumerate(source_records)
        ):
            continue
        signature = tuple(
            sorted((source_index, tag_index) for source_index, tag_index, _, _ in assignment)
        )
        key = (signature, excluded_tag_indices)
        score = (
            round(sum(record[2] for record in assignment), 6),
            sum(record[3] for record in assignment),
        )
        previous = valid_assignments.get(key)
        if previous is None or score < previous[0]:
            valid_assignments[key] = (score, tuple(assignment))
    if not valid_assignments:
        raise VisualReferenceError(
            f"PDF composition {source.figure_id} cannot map every tag and top-level object"
        )
    best_score = min(value[0] for value in valid_assignments.values())
    best = [
        (key, value[1])
        for key, value in valid_assignments.items()
        if value[0] == best_score
    ]
    if len(best) != 1:
        raise VisualReferenceError(
            f"PDF composition {source.figure_id} has {len(best)} ambiguous page-local mappings"
        )
    (signature, excluded_tag_indices), assignment = best[0]
    offsets_x = []
    offsets_y = []
    for source_index, tag_index, _center_error, _dimension_error in assignment:
        source_center, _ = _source_layout_pixel_record(source_records[source_index])
        tag_center, _ = tag_records[tag_index]
        offsets_x.append(tag_center[0] - source_center[0])
        offsets_y.append(tag_center[1] - source_center[1])
    translation = (float(median(offsets_x)), float(median(offsets_y)))
    for source_index, tag_index, _center_error, _dimension_error in assignment:
        source_center, source_size = _source_layout_pixel_record(source_records[source_index])
        tag_center, tag_size = tag_records[tag_index]
        center_delta = abs(source_center[0] + translation[0] - tag_center[0]) + abs(
            source_center[1] + translation[1] - tag_center[1]
        )
        if (
            (center_delta > 2 and not _tag_uses_source_paint_overhang(
                source_records[source_index], tag_center, tag_size, translation
            ))
            or _dimension_delta(source_size, tag_size) > 8
        ):
            raise VisualReferenceError(
                f"PDF object placement differs for {source.figure_id}/"
                f"{source_records[source_index].object_id}"
            )

    assigned_source = {source_index for source_index, _tag_index in signature}
    untagged = []
    for source_index, item in enumerate(source_records):
        if source_index in assigned_source:
            continue
        if item.depth == 0:
            if item.contains_table:
                untagged.append(
                    (item.object_id, "source-textbox-table-unmarked-by-pdf-figure")
                )
                continue
            raise VisualReferenceError(
                f"PDF composition {source.figure_id} omitted top-level object {item.object_id}"
            )
        owner = _nested_layout_owner(source_records, source_index)
        if not _layout_contains(owner, item):
            raise VisualReferenceError(
                f"Nested source object {item.object_id} is outside owning PDF crop "
                f"{owner.object_id}"
            )
        untagged.append(
            (item.object_id, f"nested-content-contained-by-owner:{owner.object_id}")
        )

    # The browser SVG viewport includes source paint overhang (effects,
    # centred strokes, and arrowheads).  Its independent PDF reference crop
    # must use those same source-derived paint bounds; retaining the smaller
    # pre-expansion layout crop would rescale the expanded SVG back into it.
    paint_bounds = tuple(
        _source_painted_pixel_bounds(
            item, translate_x=translation[0], translate_y=translation[1]
        )
        for item in source_records
    )
    left = min(bounds[0] for bounds in paint_bounds)
    top = min(bounds[1] for bounds in paint_bounds)
    right = max(bounds[2] for bounds in paint_bounds)
    bottom = max(bounds[3] for bounds in paint_bounds)
    return PdfCompositionMatch(
        figure_id=source.figure_id,
        page_index=page_index,
        translation_px=translation,
        crop_box_px=(left, top, right, bottom),
        mapped_object_ids=tuple(source_records[index].object_id for index, _ in signature),
        mapped_tag_ordinals=tuple(tags[tag_index].ordinal for _, tag_index in signature),
        untagged_object_reasons=tuple(untagged),
        excluded_tag_ordinals=tuple(tags[index].ordinal for index in excluded_tag_indices),
    )


def crop_pdf_composition_page(page_png: bytes, match: PdfCompositionMatch) -> bytes:
    """Losslessly crop one mapped composition from an independent PDF page."""
    page = _decode_png(page_png, f"LibreOffice PDF page {match.page_index}")
    left, top, right, bottom = match.crop_box_px
    if left < 0 or top < 0 or right > page.width or bottom > page.height:
        raise VisualReferenceError(
            f"PDF composition {match.figure_id} crop {match.crop_box_px} is outside "
            f"page raster {page.size}"
        )
    crop = page.crop((left, top, right, bottom))
    buffer = BytesIO()
    crop.save(buffer, "PNG")
    return buffer.getvalue()


def build_pdf_composition_ownership_mask(
    source: _SourceFigureStructure,
    match: PdfCompositionMatch,
    *,
    width_px: int,
    height_px: int,
) -> bytes:
    """Return a fail-closed source-owned raster mask for one PDF crop.

    A PDF page can contain a header/footer or surrounding body content inside a
    rectangular crop.  Those page artifacts are not figure pixels.  The mask
    is derived solely from the independently re-read OOXML object layout and
    the already-validated one-to-one PDF Figure-tag mapping; every retained
    top-level or nested source object must be accounted for.  It deliberately
    includes stroke/effect overhang and the complete text-box/table extent.
    """
    if match.figure_id != source.figure_id:
        raise VisualReferenceError(
            f"PDF ownership mask figure mismatch: {source.figure_id} != {match.figure_id}"
        )
    if width_px <= 0 or height_px <= 0:
        raise VisualReferenceError(
            f"Invalid PDF ownership mask dimensions: {width_px}x{height_px}"
        )
    if len(match.mapped_object_ids) != len(match.mapped_tag_ordinals):
        raise VisualReferenceError(
            f"PDF ownership mapping length differs for {source.figure_id}"
        )
    if len(set(match.mapped_object_ids)) != len(match.mapped_object_ids):
        raise VisualReferenceError(
            f"PDF ownership mapping duplicates a source object for {source.figure_id}"
        )
    if len(set(match.mapped_tag_ordinals)) != len(match.mapped_tag_ordinals):
        raise VisualReferenceError(
            f"PDF ownership mapping duplicates a Figure tag for {source.figure_id}"
        )
    if len(set(match.excluded_tag_ordinals)) != len(match.excluded_tag_ordinals):
        raise VisualReferenceError(
            f"PDF ownership mapping duplicates an excluded Figure tag for {source.figure_id}"
        )
    if set(match.mapped_tag_ordinals) & set(match.excluded_tag_ordinals):
        raise VisualReferenceError(
            f"PDF ownership mapping both maps and excludes a Figure tag for {source.figure_id}"
        )
    layout_by_id = {item.object_id: item for item in source.export_layout}
    if len(layout_by_id) != len(source.export_layout):
        raise VisualReferenceError(
            f"PDF ownership source layout duplicates an object for {source.figure_id}"
        )
    mapped = set(match.mapped_object_ids)
    untagged = {object_id for object_id, _reason in match.untagged_object_reasons}
    unknown = (mapped | untagged) - set(layout_by_id)
    missing = set(layout_by_id) - mapped - untagged
    if unknown or missing:
        raise VisualReferenceError(
            f"PDF ownership mapping is incomplete for {source.figure_id}: "
            f"unknown={sorted(unknown)}, missing={sorted(missing)}"
        )

    left, top, _right, _bottom = match.crop_box_px
    translate_x, translate_y = match.translation_px
    image = Image.new("L", (width_px, height_px), 0)
    draw = ImageDraw.Draw(image)
    for item in source.export_layout:
        if item.visible_content_bounds_emu is None:
            item_left, item_top, item_right, item_bottom = _source_painted_pixel_bounds(
                item, translate_x=translate_x, translate_y=translate_y
            )
        else:
            content_left, content_top, content_right, content_bottom = item.visible_content_bounds_emu
            item_left = math.floor(content_left / 9525 + translate_x)
            item_top = math.floor(content_top / 9525 + translate_y)
            item_right = math.ceil(content_right / 9525 + translate_x)
            item_bottom = math.ceil(content_bottom / 9525 + translate_y)
        # Pixel-inclusive mask bounds prevent a one-pixel source stroke or
        # anti-aliased text edge from being excluded at the crop boundary.
        draw.rectangle(
            (item_left - left, item_top - top, item_right - left, item_bottom - top),
            fill=255,
        )
    buffer = BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


def _source_painted_pixel_bounds(
    item: _SourceExportLayout,
    *,
    translate_x: float,
    translate_y: float,
) -> Tuple[int, int, int, int]:
    """Independent OOXML layout envelope, including paint overhang."""
    # The raw layout rectangle owns all text, tables, and crop contents.  Its
    # paint envelope additionally retains the independently sourced Word
    # effect extent and half a centred DrawingML outline.
    effect_left, effect_top, effect_right, effect_bottom = item.effect_extent
    half_stroke = item.stroke_width_emu / 2
    arrowhead = item.arrowhead_extent_emu
    left = math.floor(
        (item.x_emu - effect_left - half_stroke - arrowhead) / 9525 + translate_x
    )
    top = math.floor(
        (item.y_emu - effect_top - half_stroke - arrowhead) / 9525 + translate_y
    )
    right = math.ceil(
        (item.x_emu + max(item.width_emu, 1) + effect_right + half_stroke + arrowhead) / 9525
        + translate_x
    )
    bottom = math.ceil(
        (item.y_emu + max(item.height_emu, 1) + effect_bottom + half_stroke + arrowhead) / 9525
        + translate_y
    )
    return left, top, right, bottom


def _source_layout_pixel_record(
    item: _SourceExportLayout,
) -> Tuple[Tuple[float, float], Tuple[int, int]]:
    width = max(1, round(item.width_emu / 9525))
    height = max(1, round(item.height_emu / 9525))
    return (
        (
            (item.x_emu + item.width_emu / 2) / 9525,
            (item.y_emu + item.height_emu / 2) / 9525,
        ),
        (width, height),
    )


def _tag_center_is_outside_source_paint_bounds(
    tag_center: Tuple[float, float],
    records: Sequence[_SourceExportLayout],
    translation: Tuple[float, float],
) -> bool:
    """Whether a PDF Figure tag is provably outside this composition.

    A rectangular PDF page also contains decorations and neighbouring content.
    Such a tag can be excluded only when its centre is outside every
    independently sourced object paint envelope after reversing the candidate
    composition translation.  Tags in or touching the source envelope are
    never silently discarded.
    """
    source_x = tag_center[0] - translation[0]
    source_y = tag_center[1] - translation[1]
    bounds = tuple(
        _source_painted_pixel_bounds(item, translate_x=0.0, translate_y=0.0)
        for item in records
    )
    left = min(item[0] for item in bounds)
    top = min(item[1] for item in bounds)
    right = max(item[2] for item in bounds)
    bottom = max(item[3] for item in bounds)
    return source_x < left or source_x > right or source_y < top or source_y > bottom


def _tag_uses_source_paint_overhang(
    item: _SourceExportLayout,
    tag_center: Tuple[float, float],
    tag_size: Tuple[int, int],
    translation: Tuple[float, float],
) -> bool:
    """Whether a tag extends through a documented source paint envelope.

    This is not a wider centre-placement tolerance.  It accepts only a tag
    whose painted rectangle crosses an otherwise exact source layout edge and
    stays entirely inside the independently parsed effect/stroke/arrowhead
    envelope.  It covers asymmetric arrowheads without turning empty layout
    interior into a matching region.
    """
    if (
        item.effect_extent == (0, 0, 0, 0)
        and item.stroke_width_emu == 0
        and item.arrowhead_extent_emu == 0
    ):
        return False
    tag_left = tag_center[0] - tag_size[0] / 2
    tag_top = tag_center[1] - tag_size[1] / 2
    tag_right = tag_center[0] + tag_size[0] / 2
    tag_bottom = tag_center[1] + tag_size[1] / 2
    raw_left = item.x_emu / 9525 + translation[0]
    raw_top = item.y_emu / 9525 + translation[1]
    raw_right = (item.x_emu + max(item.width_emu, 1)) / 9525 + translation[0]
    raw_bottom = (item.y_emu + max(item.height_emu, 1)) / 9525 + translation[1]
    crosses_layout_edge = (
        tag_left < raw_left
        or tag_top < raw_top
        or tag_right > raw_right
        or tag_bottom > raw_bottom
    )
    if not crosses_layout_edge:
        return False
    paint_left, paint_top, paint_right, paint_bottom = _source_painted_pixel_bounds(
        item, translate_x=translation[0], translate_y=translation[1]
    )
    return (
        tag_left >= paint_left
        and tag_top >= paint_top
        and tag_right <= paint_right
        and tag_bottom <= paint_bottom
    )


def _pdf_tag_pixel_record(
    tag: PdfFigureTag, page_height_points: float
) -> Tuple[Tuple[float, float], Tuple[int, int]]:
    left, bottom, right, top = tag.bbox_points
    if not all(math.isfinite(value) for value in tag.bbox_points):
        raise VisualReferenceError(f"PDF figure tag {tag.ordinal} has non-finite bounds")
    if right < left or top < bottom:
        raise VisualReferenceError(f"PDF figure tag {tag.ordinal} has inverted bounds")
    scale = 96 / 72
    return (
        (
            (left + right) * scale / 2,
            (page_height_points - (bottom + top) / 2) * scale,
        ),
        (
            max(1, round((right - left) * scale)),
            max(1, round((top - bottom) * scale)),
        ),
    )


def _dimension_delta(left: Tuple[int, int], right: Tuple[int, int]) -> int:
    return abs(left[0] - right[0]) + abs(left[1] - right[1])


def _nested_layout_owner(
    records: Sequence[_SourceExportLayout], source_index: int
) -> _SourceExportLayout:
    nested = records[source_index]
    for candidate in reversed(records[:source_index]):
        if candidate.depth == nested.depth - 1:
            return candidate
    raise VisualReferenceError(
        f"Nested source object {nested.object_id} has no owning layout object"
    )


def _layout_contains(owner: _SourceExportLayout, child: _SourceExportLayout) -> bool:
    tolerance = 9525
    return (
        child.x_emu >= owner.x_emu - tolerance
        and child.y_emu >= owner.y_emu - tolerance
        and child.x_emu + child.width_emu <= owner.x_emu + owner.width_emu + tolerance
        and child.y_emu + child.height_emu <= owner.y_emu + owner.height_emu + tolerance
    )


class LibreOfficeReferenceRenderer:
    """Explicit headless LibreOffice adapter; no fallback renderer is permitted."""

    def __init__(self, executable: Path) -> None:
        self.executable = Path(executable)
        self._version: Optional[str] = None

    def version(self) -> str:
        if not self.executable.is_file():
            raise VisualReferenceError(
                f"LibreOffice executable does not exist: {self.executable}"
            )
        completed = subprocess.run(
            [str(self.executable), "--version"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="strict",
            check=False,
        )
        version = (completed.stdout or completed.stderr).strip()
        if completed.returncode != 0 or not version.startswith("LibreOffice "):
            raise VisualReferenceError(
                f"LibreOffice executable version check failed ({completed.returncode}): {version}"
            )
        self._version = version
        return version

    def export(self, source_path: Path, output_directory: Path, *, target: str) -> ReferenceExport:
        source = Path(source_path).resolve()
        if not source.is_file():
            raise VisualReferenceError(f"Reference source does not exist: {source}")
        if target not in ("pdf", "html", "png"):
            raise VisualReferenceError(f"Unsupported LibreOffice reference target: {target}")
        output = Path(output_directory).resolve()
        output.mkdir(parents=True, exist_ok=True)
        profile = output / ".lo-profile"
        profile.mkdir(exist_ok=True)
        version = self.version()
        command = [
            str(self.executable),
            "--headless",
            "--nologo",
            "--nodefault",
            "--nolockcheck",
            "--norestore",
            f"-env:UserInstallation={profile.as_uri()}",
            "--convert-to",
            target,
            "--outdir",
            str(output),
            str(source),
        ]
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="strict",
            check=False,
            timeout=300,
        )
        detail = "\n".join(
            value.strip() for value in (completed.stdout, completed.stderr) if value.strip()
        )
        extension = ".html" if target == "html" else f".{target}"
        exported = output / f"{source.stem}{extension}"
        if completed.returncode != 0 or not exported.is_file() or exported.stat().st_size == 0:
            raise VisualReferenceError(
                f"LibreOffice {target} reference export failed ({completed.returncode}) for {source}: {detail}"
            )
        return ReferenceExport(source, exported, version, detail)


class ChromiumSvgRenderer:
    """Pinned target-class SVG renderer for compiler-pixel verification.

    LibreOffice remains the independent DOCX/PDF reference exporter.  Compiler
    SVG is rendered by Chromium, matching the mobile WebView rendering class
    without comparing a LibreOffice render to itself.
    """

    def __init__(self, node_executable: Path, package_directory: Path) -> None:
        self.node_executable = Path(node_executable)
        self.package_directory = Path(package_directory).resolve()
        self._version: Optional[str] = None

    def version(self) -> str:
        if not self.node_executable.is_file():
            raise VisualReferenceError(
                f"Chromium renderer Node executable does not exist: {self.node_executable}"
            )
        if not (self.package_directory / "node_modules" / "playwright").is_dir():
            raise VisualReferenceError(
                f"Chromium renderer Playwright package does not exist: {self.package_directory}"
            )
        completed = subprocess.run(
            [
                str(self.node_executable),
                "-e",
                (
                    "const {chromium}=require('playwright');"
                    "const fs=require('fs');"
                    "const executable=chromium.executablePath();"
                    "if(!fs.existsSync(executable)) process.exit(12);"
                    "process.stdout.write('Chromium '+require('playwright/package.json').version"
                    "+' '+executable);"
                ),
            ],
            cwd=self.package_directory,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="strict",
            check=False,
            timeout=60,
        )
        version = (completed.stdout or completed.stderr).strip()
        if completed.returncode != 0 or not version.startswith("Chromium "):
            raise VisualReferenceError(
                "Chromium renderer version check failed "
                f"({completed.returncode}): {version}"
            )
        self._version = version
        return version


def match_libreoffice_html_export(
    package: OOXMLPackage,
    figures: Sequence[FigureComposition],
    html_path: Path,
) -> Tuple[LibreOfficeFigureMatch, ...]:
    """Map every LibreOffice body image to one source-owned whole composition."""
    exported = _read_libreoffice_html_objects(Path(html_path))
    ordered_items = _ordered_export_items(package, figures)
    expected_count = sum(len(items) for _, items in ordered_items)
    extra_count = len(exported) - expected_count
    if extra_count < 0:
        raise VisualReferenceError(
            f"LibreOffice HTML is missing {abs(extra_count)} drawing objects: "
            f"expected={expected_count}, exported={len(exported)}"
        )
    excluded: Tuple[LibreOfficeHtmlObject, ...] = ()
    if extra_count:
        # Writer emits repeated section-header graphics once, before body
        # drawings.  They may be excluded only when their dimensions are
        # independently present in a non-document OOXML drawing part.
        excluded = exported[:extra_count]
        allowed = _non_document_drawing_dimensions(package)
        invalid = [
            item for item in excluded
            if not any(
                abs(item.width_px - width) <= 2 and abs(item.height_px - height) <= 2
                for width, height in allowed
            )
        ]
        if invalid:
            raise VisualReferenceError(
                "Unmatched leading LibreOffice objects are not validated header/footer drawings: "
                + ", ".join(f"{item.name}={item.width_px}x{item.height_px}" for item in invalid)
            )
        exported = exported[extra_count:]
    matches = []
    cursor = 0
    for figure, items in ordered_items:
        segment = exported[cursor : cursor + len(items)]
        if len(segment) != len(items):
            raise VisualReferenceError(
                f"LibreOffice composition {figure.figure_id} is truncated at object {cursor}"
            )
        matched = _match_composition_objects(figure, items, segment)
        matches.append(
            LibreOfficeFigureMatch(
                figure_id=figure.figure_id,
                objects=matched,
                relationship_order=tuple(
                    item.relationship_id for item in items if item.relationship_id is not None
                ),
                unmatched_export_objects=(),
                excluded_non_document_objects=tuple(item.name for item in excluded),
            )
        )
        cursor += len(items)
    if cursor != len(exported):
        remainder = exported[cursor:]
        raise VisualReferenceError(
            "LibreOffice HTML has unmatched body drawing objects: "
            + ", ".join(item.name for item in remainder)
        )
    return tuple(matches)


def build_libreoffice_figure_references(
    package: OOXMLPackage,
    topic_id: str,
    figures: Sequence[FigureComposition],
    matches: Sequence[LibreOfficeFigureMatch],
) -> Tuple[FigureReference, ...]:
    """Composite matched LibreOffice objects into whole-figure pixel references."""
    match_by_id = _unique_html_matches(matches)
    source_by_id = _derive_source_figure_structures(package, topic_id)
    result = []
    for figure in figures:
        try:
            matched = match_by_id[figure.figure_id]
        except KeyError as error:
            raise VisualReferenceError(
                f"No LibreOffice object match for composition {figure.figure_id}"
            ) from error
        try:
            source = source_by_id[figure.figure_id]
        except KeyError as error:
            raise VisualReferenceError(
                f"Compiler composition has no independently derived source manifest: {figure.figure_id}"
            ) from error
        if matched.unmatched_export_objects:
            raise VisualReferenceError(
                f"LibreOffice composition {figure.figure_id} has unmatched objects: "
                f"{matched.unmatched_export_objects}"
            )
        # Bounds, placement, and stacking are re-read from OOXML below.  They
        # deliberately never come from the compiler object being validated.
        width = max(1, round(source.width_emu / 9525))
        height = max(1, round(source.height_emu / 9525))
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        exported_by_id = {entry.item.object_id: entry.exported for entry in matched.objects}
        layout = source.export_layout
        missing = sorted(item.object_id for item in layout if item.object_id not in exported_by_id)
        if missing:
            raise VisualReferenceError(
                f"LibreOffice composition {figure.figure_id} is missing mapped objects {missing}"
            )
        extra_objects = sorted(set(exported_by_id) - {item.object_id for item in layout})
        if extra_objects:
            raise VisualReferenceError(
                f"LibreOffice composition {figure.figure_id} has objects absent from source layout "
                f"{extra_objects}"
            )
        for item in sorted(
            layout,
            key=lambda entry: (entry.z_order, entry.depth, entry.source_path),
        ):
            exported = exported_by_id[item.object_id]
            try:
                with Image.open(BytesIO(exported.encoded_pixels)) as image:
                    layer = image.convert("RGBA")
            except (UnidentifiedImageError, OSError, ValueError) as error:
                raise VisualReferenceError(
                    f"Cannot decode matched LibreOffice object {exported.source_file}: {error}"
                ) from error
            if layer.size != (exported.width_px, exported.height_px):
                layer = layer.resize(
                    (exported.width_px, exported.height_px),
                    Image.Resampling.LANCZOS,
                )
            source_width = item.width_emu / 9525
            source_height = item.height_emu / 9525
            x = round(
                (item.x_emu - source.x_emu) / 9525
                + (source_width - exported.width_px) / 2
            )
            y = round(
                (item.y_emu - source.y_emu) / 9525
                + (source_height - exported.height_px) / 2
            )
            canvas.alpha_composite(layer, (x, y))
        buffer = BytesIO()
        canvas.save(buffer, "PNG")
        result.append(
            FigureReference(
                figure_id=figure.figure_id,
                relationship_order=source.relationship_order,
                width_px=width,
                height_px=height,
                label_sha256=source.label_sha256,
                object_manifest_sha256=source.object_manifest_sha256,
                geometry_sha256=source.geometry_sha256,
                connection_sha256=source.connection_sha256,
                color_sha256=source.color_sha256,
                pixel_png=buffer.getvalue(),
            )
        )
    extra = sorted(set(match_by_id) - {figure.figure_id for figure in figures})
    if extra:
        raise VisualReferenceError(f"Unmatched LibreOffice compositions: {extra}")
    extra_source = sorted(set(source_by_id) - {figure.figure_id for figure in figures})
    if extra_source:
        raise VisualReferenceError(f"Source manifests have unmatched compositions: {extra_source}")
    return tuple(result)


def _unique_html_matches(
    matches: Sequence[LibreOfficeFigureMatch],
) -> Mapping[str, LibreOfficeFigureMatch]:
    result = {}
    for match in matches:
        if match.figure_id in result:
            raise VisualReferenceError(
                f"Duplicate LibreOffice composition match: {match.figure_id}"
            )
        result[match.figure_id] = match
    return result


def _derive_source_figure_structures(
    package: OOXMLPackage,
    topic_id: str,
) -> Mapping[str, _SourceFigureStructure]:
    selected = _selected_drawings(package)
    selected_set = set(selected)
    nested_by_shape = defaultdict(list)
    top_by_paragraph = {}
    for drawing in selected:
        owner = drawing
        for ancestor in drawing.iterancestors(f"{{{W}}}drawing"):
            if ancestor in selected_set:
                owner = ancestor
        shape = next(drawing.iterancestors(f"{{{WPS}}}wsp"), None)
        if shape is not None:
            nested_by_shape[package.source_path(shape)].append(drawing)
        if owner is drawing:
            paragraph = next(drawing.iterancestors(f"{{{W}}}p"), None)
            if paragraph is None:
                raise VisualReferenceError(
                    f"Source drawing has no host paragraph: {package.source_path(drawing)}"
                )
            top_by_paragraph.setdefault(paragraph, []).append(drawing)
    drawings_and_visuals_by_paragraph = {
        paragraph: tuple((drawing, _direct_drawing_visual(drawing)) for drawing in drawings)
        for paragraph, drawings in top_by_paragraph.items()
    }
    path_to_visual = {
        package.source_path(visual): visual
        for pairs in drawings_and_visuals_by_paragraph.values()
        for _drawing, visual in pairs
    }
    ordered_paths = sorted(path_to_visual)
    events_by_visual = defaultdict(list)
    for event in extract_events(package).visible_events:
        index = bisect_right(ordered_paths, event.source_path) - 1
        if index >= 0 and (
            event.source_path == ordered_paths[index]
            or event.source_path.startswith(ordered_paths[index] + "/")
        ):
            events_by_visual[ordered_paths[index]].append(event)
    result = {}
    section_layouts = _reference_section_layouts(package)
    styles = StyleResolver(package)
    tables_by_path = {table.source_path: table for table in parse_tables(package)}
    for paragraph, drawings_and_visuals in drawings_and_visuals_by_paragraph.items():
        visuals = tuple(visual for _drawing, visual in drawings_and_visuals)
        object_records = []
        geometry_records = []
        connection_records = []
        color_records = []
        export_visuals = []
        export_layout = []
        for source_order, (drawing, visual) in enumerate(drawings_and_visuals):
            object_record, geometry_record, connection_record, color_record = _raw_visual_records(
                visual, package, nested_by_shape
            )
            object_records.append(object_record)
            geometry_records.append(geometry_record)
            connection_records.append(connection_record)
            color_records.append(color_record)
            export_visuals.extend(_raw_export_visuals(visual, package, nested_by_shape))
            export_layout.extend(
                _raw_drawing_export_layout(
                    drawing,
                    visual,
                    package,
                    nested_by_shape,
                section_layouts,
                styles,
                tables_by_path,
                events_by_visual.get(package.source_path(visual), ()),
                source_order=source_order,
                    parent_x=0,
                    parent_y=0,
                    depth=0,
                )
            )
        events = tuple(
            event
            for visual in visuals
            for event in events_by_visual[package.source_path(visual)]
        )
        label_manifest = _stable_json([
            {"kind": event.kind, "value": event.value, "source_path": event.source_path}
            for event in events
        ])
        source_path = package.source_path(paragraph)
        figure_id = sha256((topic_id + "\0" + source_path).encode("utf-8")).hexdigest()[:24]
        relationships = tuple(
            relationship
            for visual in export_visuals
            for relationship in (_direct_visual_relationship(visual),)
            if relationship is not None
        )
        top_level = tuple(item for item in export_layout if item.depth == 0)
        if not top_level:
            raise VisualReferenceError(
                f"Source composition has no top-level layout objects: {source_path}"
            )
        left = min(item.x_emu for item in top_level)
        top = min(item.y_emu for item in top_level)
        right = max(item.x_emu + max(item.width_emu, 1) for item in top_level)
        bottom = max(item.y_emu + max(item.height_emu, 1) for item in top_level)
        if figure_id in result:
            raise VisualReferenceError(f"Duplicate source composition ID: {figure_id}")
        result[figure_id] = _SourceFigureStructure(
            figure_id=figure_id,
            relationship_order=relationships,
            label_sha256=sha256(label_manifest).hexdigest(),
            object_manifest_sha256=sha256(_stable_json(object_records)).hexdigest(),
            geometry_sha256=sha256(_stable_json(geometry_records)).hexdigest(),
            connection_sha256=sha256(_stable_json(connection_records)).hexdigest(),
            color_sha256=sha256(_stable_json(color_records)).hexdigest(),
            x_emu=left,
            y_emu=top,
            width_emu=max(right - left, 1),
            height_emu=max(bottom - top, 1),
            export_layout=tuple(export_layout),
        )
    return result


def _raw_drawing_export_layout(
    drawing: etree._Element,
    visual: etree._Element,
    package: OOXMLPackage,
    nested_by_shape: Mapping[str, Sequence[etree._Element]],
    section_layouts: Mapping[etree._Element, _ReferenceSectionLayout],
    styles: StyleResolver,
    tables_by_path: Mapping[str, object],
    visible_events: Sequence[object],
    *,
    source_order: int,
    parent_x: int,
    parent_y: int,
    depth: int,
) -> Tuple[_SourceExportLayout, ...]:
    """Derive export-layer coordinates directly from source OOXML.

    This parser intentionally does not accept a ``DrawingItem``.  It is the
    independent coordinate side of the visual-reference gate.
    """
    wrapper = _direct_drawing_wrapper(drawing, package)
    paragraph = next(drawing.iterancestors(f"{{{W}}}p"), None)
    section = section_layouts.get(paragraph, _default_reference_section_layout())
    local_x, local_y, width, height, z_order = _reference_drawing_placement(
        wrapper, package, section, source_order
    )
    effect_extent, stroke_width_emu, arrowhead_extent_emu = _raw_reference_paint_overhang(
        wrapper, visual, package
    )
    absolute_x = parent_x + local_x
    absolute_y = parent_y + local_y
    path = package.source_path(visual)
    contains_table = any(
        isinstance(element.tag, str)
        and etree.QName(element).namespace == W
        and etree.QName(element).localname == "tbl"
        for element in visual.iter()
    )
    visible_content_bounds = _transparent_table_content_bounds(
        visual,
        package,
        tables_by_path,
        visible_events,
        absolute_x=absolute_x,
        absolute_y=absolute_y,
    )
    result = [
        _SourceExportLayout(
            object_id=sha256(path.encode("utf-8")).hexdigest()[:20],
            source_path=path,
            x_emu=absolute_x,
            y_emu=absolute_y,
            width_emu=width,
            height_emu=height,
            z_order=z_order,
            depth=depth,
            effect_extent=effect_extent,
            stroke_width_emu=stroke_width_emu,
            arrowhead_extent_emu=arrowhead_extent_emu,
            contains_table=contains_table,
            visible_content_bounds_emu=visible_content_bounds,
        )
    ]
    if etree.QName(visual).localname != "wsp":
        # Writer exports an OOXML group as one image; group descendants are
        # therefore intentionally not separate reference layers.
        return tuple(result)

    nested = nested_by_shape.get(path, ())
    if not nested:
        return tuple(result)
    properties = _direct_named_child(visual, "spPr")
    transform = _direct_named_child(properties, "xfrm")
    offset = _direct_named_child(transform, "off")
    extent = _direct_named_child(transform, "ext")
    owner_x = _source_integer(offset.get("x"), 0, package.source_path(offset), "x")
    owner_y = _source_integer(offset.get("y"), 0, package.source_path(offset), "y")
    owner_width = _source_integer(
        extent.get("cx"), width, package.source_path(extent), "cx"
    )
    body_properties = _direct_optional_child(visual, "bodyPr")
    insets = tuple(
        _source_integer(
            body_properties.get(name) if body_properties is not None else None,
            default,
            package.source_path(body_properties) if body_properties is not None else path,
            name,
        )
        for name, default in (
            ("lIns", 91_440),
            ("tIns", 45_720),
            ("rIns", 91_440),
            ("bIns", 45_720),
        )
    )
    for nested_order, child_drawing in enumerate(nested):
        child_wrapper = _direct_drawing_wrapper(child_drawing, package)
        if etree.QName(child_wrapper).localname != "inline":
            raise VisualReferenceError(
                "Nested reference drawing is not inline at "
                + package.source_path(child_drawing)
            )
        child_extent = _direct_named_child(child_wrapper, "extent")
        child_width = _source_integer(
            child_extent.get("cx"), None, package.source_path(child_extent), "cx"
        )
        child_height = _source_integer(
            child_extent.get("cy"), None, package.source_path(child_extent), "cy"
        )
        child_x, child_y = _reference_nested_offset(
            child_drawing,
            visual,
            owner_width,
            child_width,
            insets,
            styles,
            package,
        )
        child_visual = _direct_drawing_visual(child_drawing)
        result.extend(
            _raw_drawing_export_layout(
                child_drawing,
                child_visual,
                package,
                nested_by_shape,
                section_layouts,
                styles,
                tables_by_path,
                (),
                source_order=nested_order,
                parent_x=absolute_x + owner_x + child_x,
                parent_y=absolute_y + owner_y + child_y,
                depth=depth + 1,
            )
        )
        # The recursion re-reads the inline extent; retaining this explicit
        # equality catches a malformed wrapper before compositing anything.
        child_layout = result[-1]
        if child_layout.width_emu != child_width or child_layout.height_emu != child_height:
            raise VisualReferenceError(
                f"Nested source extent changed while parsing {package.source_path(child_drawing)}"
            )
    return tuple(result)


def _transparent_table_content_bounds(
    visual: etree._Element,
    package: OOXMLPackage,
    tables_by_path: Mapping[str, object],
    visible_events: Sequence[object],
    *,
    absolute_x: int,
    absolute_y: int,
) -> Optional[Tuple[int, int, int, int]]:
    """Return the source-visible footprint of a table-only transparent textbox.

    Writer's PDF page can carry unrelated body/footer paint behind the unused
    portion of a text-box anchor.  The anchor rectangle is not paint when the
    source shape explicitly has ``noFill`` and ``ln/noFill``.  Narrowing is
    permitted only for the simple, fully source-described case below; every
    other object retains its conservative source paint envelope.
    """
    if etree.QName(visual).localname != "wsp":
        return None
    properties = _direct_optional_child(visual, "spPr")
    if properties is None or _direct_optional_child(properties, "noFill") is None:
        return None
    line = _direct_optional_child(properties, "ln")
    if line is None or _direct_optional_child(line, "noFill") is None:
        return None
    textbox = _direct_optional_child(visual, "txbx")
    content = _direct_optional_child(textbox, "txbxContent") if textbox is not None else None
    if content is None:
        return None
    blocks = tuple(child for child in content if isinstance(child.tag, str))
    tables = tuple(child for child in blocks if etree.QName(child).namespace == W and etree.QName(child).localname == "tbl")
    if len(tables) != 1:
        return None
    # An eventful paragraph before/after the table is visible content too.  Do
    # not guess its glyph extent here: retain the full anchor instead.
    for paragraph in (
        child for child in blocks
        if etree.QName(child).namespace == W and etree.QName(child).localname == "p"
    ):
        paragraph_path = package.source_path(paragraph)
        if any(
            getattr(event, "kind", None) not in ("paragraph_boundary", "empty_paragraph")
            and (
                getattr(event, "source_path", "") == paragraph_path
                or getattr(event, "source_path", "").startswith(paragraph_path + "/")
            )
            for event in visible_events
        ):
            return None
    table_path = package.source_path(tables[0])
    try:
        table = tables_by_path[table_path]
    except KeyError as error:
        raise VisualReferenceError(
            f"Transparent textbox table is absent from parsed source: {table_path}"
        ) from error
    body = _direct_optional_child(visual, "bodyPr")
    left = _source_integer(
        body.get("lIns") if body is not None else None,
        91_440,
        package.source_path(body) if body is not None else package.source_path(visual),
        "lIns",
    )
    top = _source_integer(
        body.get("tIns") if body is not None else None,
        45_720,
        package.source_path(body) if body is not None else package.source_path(visual),
        "tIns",
    )
    space_first_last = body is not None and body.get("spcFirstLastPara") == "1"
    width = sum(int(value) * 635 for value in table.grid_widths_twips)
    height = _source_table_height_emu(table, space_first_last=space_first_last)
    # Include the centred border antialiasing in the strict ownership area.
    border_pad = _source_table_max_border_emu(table) // 2
    return (
        absolute_x + left - border_pad,
        absolute_y + top - border_pad,
        absolute_x + left + width + border_pad,
        absolute_y + top + height + border_pad,
    )


def _source_table_height_emu(table: object, *, space_first_last: bool) -> int:
    """Calculate table height from OOXML runs, spacing, margins and borders."""
    return sum(
        _source_table_row_height_emu(table, row, space_first_last=space_first_last)
        for row in table.rows
    )


def _source_table_row_height_emu(table: object, row: object, *, space_first_last: bool) -> int:
    required = 0
    for cell in row.cells:
        if cell.is_vertical_merge_continuation:
            continue
        cell_height = 0
        paragraphs = [block for block in cell.blocks if block.kind == "paragraph"]
        for block_index, block in enumerate(cell.blocks):
            if block.kind == "table":
                if block.nested_table is None:
                    raise VisualReferenceError(
                        f"Source nested table is missing at {block.canonical.source_path}"
                    )
                cell_height += _source_table_height_emu(
                    block.nested_table, space_first_last=space_first_last
                )
                continue
            events = block.canonical.text_events
            style = block.canonical.paragraph_style
            explicit_lines = 1 + sum(event.kind == "line_break" for event in events)
            cell_height += _source_paragraph_line_height_emu(events, style) * explicit_lines
            paragraph_index = paragraphs.index(block)
            if style is not None and (space_first_last or paragraph_index > 0):
                cell_height += (style.space_before_twips or 0) * 635
            if style is not None and (space_first_last or paragraph_index + 1 < len(paragraphs)):
                cell_height += (style.space_after_twips or 0) * 635
        required = max(
            required,
            cell_height + _source_table_margin_emu(cell.margins.top)
            + _source_table_margin_emu(cell.margins.bottom),
        )
    required += max(
        (_source_table_border_width_emu(_source_table_border(table, cell, "top")) for cell in row.cells),
        default=0,
    )
    required += max(
        (_source_table_border_width_emu(_source_table_border(table, cell, "bottom")) for cell in row.cells),
        default=0,
    )
    return max(1, required, (row.height_twips or 0) * 635)


def _source_paragraph_line_height_emu(events: Sequence[object], style: object) -> int:
    font_size = max(
        (
            round(event.run_style.font_size_half_points / 2 * 12700)
            for event in events
            if getattr(event, "run_style", None) is not None
            and event.run_style.font_size_half_points
        ),
        default=152_400,
    )
    raw = getattr(style, "line_spacing", None) if style is not None else None
    if raw is None:
        return font_size
    match = re.fullmatch(r"(\d+)(?::(auto|atLeast|exact))?", raw)
    if match is None:
        raise VisualReferenceError(f"Unsupported source table paragraph line spacing {raw!r}")
    value, rule = int(match.group(1)), match.group(2) or "auto"
    if rule == "auto":
        return max(1, round(font_size * value / 240))
    height = value * 635
    return max(1, height) if rule == "exact" else max(font_size, height)


def _source_table_margin_emu(width: object) -> int:
    if width is None or width.unit in ("nil", "auto"):
        return 0
    if width.unit != "dxa":
        raise VisualReferenceError(
            f"Unsupported source table margin unit {width.unit!r} at {width.source_path}"
        )
    return width.value * 635


def _source_table_border(table: object, cell: object, side: str) -> object:
    direct = getattr(cell.borders, side)
    if direct is not None:
        return direct
    if side == "top":
        return table.borders.top if cell.row_index == 0 else table.borders.inside_horizontal
    if side == "bottom":
        return table.borders.bottom if cell.row_index + cell.rowspan >= len(table.rows) else table.borders.inside_horizontal
    if side == "left":
        return table.borders.left if cell.column_index == 0 else table.borders.inside_vertical
    return table.borders.right if cell.column_index + cell.colspan >= len(table.grid_widths_twips) else table.borders.inside_vertical


def _source_table_border_width_emu(border: object) -> int:
    if border is None or border.style in ("nil", "none"):
        return 0
    return round((border.size_eighth_points or 4) / 8 * 12700)


def _source_table_max_border_emu(table: object) -> int:
    return max(
        (
            _source_table_border_width_emu(_source_table_border(table, cell, side))
            for row in table.rows
            for cell in row.cells
            for side in ("top", "right", "bottom", "left")
        ),
        default=0,
    )


def _raw_reference_paint_overhang(
    wrapper: etree._Element, visual: etree._Element, package: OOXMLPackage
) -> Tuple[Tuple[int, int, int, int], int, int]:
    """Read viewport overhang directly from the source, not compiler state."""
    effects = [
        child for child in wrapper
        if isinstance(child.tag, str) and etree.QName(child).localname == "effectExtent"
    ]
    if len(effects) > 1:
        raise VisualReferenceError(
            f"Duplicate source effect extent at {package.source_path(effects[1])}"
        )
    if effects:
        effect = effects[0]
        extent = tuple(
            _source_integer(effect.get(name), 0, package.source_path(effect), name)
            for name in ("l", "t", "r", "b")
        )
        if any(value < 0 for value in extent):
            raise VisualReferenceError(
                f"Negative source effect extent at {package.source_path(effect)}"
            )
    else:
        extent = (0, 0, 0, 0)
    properties = _direct_optional_child(visual, "spPr")
    line = _direct_optional_child(properties, "ln") if properties is not None else None
    if line is not None:
        if _direct_optional_child(line, "noFill") is not None:
            return extent, 0, 0
        width = _source_integer(line.get("w"), 12_700, package.source_path(line), "w")
        return extent, width, _line_end_extension_emu(line, width, package.source_path(line))
    # A Word processing shape with a nonzero style line reference has the
    # standard one-point outline.  Pictures without a line have no overhang.
    if etree.QName(visual).localname == "wsp":
        style = _direct_optional_child(visual, "style")
        line_ref = _direct_optional_child(style, "lnRef") if style is not None else None
        if line_ref is not None and line_ref.get("idx") == "0":
            return extent, 0, 0
        return extent, 12_700, 0
    return extent, 0, 0


def _line_end_extension_emu(
    line: etree._Element, width_emu: int, source_path: str
) -> int:
    """Return source-defined maximum triangle arrowhead overhang.

    DrawingML line ends are sized relative to the line width.  The book's
    connector tail uses the omitted/default medium triangle, whose source
    extent is three line widths; small and large use the corresponding
    two/five-width source scale.  This is an ownership/viewport envelope, so
    it is deliberately direction-neutral until the preset path direction is
    independently available.
    """
    extension = 0
    for local_name in ("headEnd", "tailEnd"):
        line_end = _direct_optional_child(line, local_name)
        if line_end is None or line_end.get("type", "none") == "none":
            continue
        if line_end.get("type") != "triangle":
            raise VisualReferenceError(
                f"Unsupported DrawingML line end {line_end.get('type')!r} at {source_path}"
            )
        length = line_end.get("len", "med")
        try:
            multiplier = {"sm": 2, "med": 3, "lg": 5}[length]
        except KeyError as error:
            raise VisualReferenceError(
                f"Unsupported DrawingML triangle length {length!r} at {source_path}"
            ) from error
        extension = max(extension, width_emu * multiplier)
    return extension


def _direct_drawing_wrapper(
    drawing: etree._Element, package: OOXMLPackage
) -> etree._Element:
    wrappers = [
        child
        for child in drawing
        if isinstance(child.tag, str)
        and etree.QName(child).localname in ("anchor", "inline")
    ]
    if len(wrappers) != 1:
        raise VisualReferenceError(
            f"Source drawing requires one direct wrapper at {package.source_path(drawing)}; "
            f"found {len(wrappers)}"
        )
    return wrappers[0]


def _reference_drawing_placement(
    wrapper: etree._Element,
    package: OOXMLPackage,
    section: _ReferenceSectionLayout,
    source_order: int,
) -> Tuple[int, int, int, int, int]:
    extent = _direct_named_child(wrapper, "extent")
    extent_path = package.source_path(extent)
    width = _source_integer(extent.get("cx"), None, extent_path, "cx")
    height = _source_integer(extent.get("cy"), None, extent_path, "cy")
    if width < 0 or height < 0:
        raise VisualReferenceError(f"Negative source drawing extent at {extent_path}")
    z_order = _source_integer(
        wrapper.get("relativeHeight"), source_order, package.source_path(wrapper), "relativeHeight"
    )
    if etree.QName(wrapper).localname == "inline":
        return 0, 0, width, height, z_order
    horizontal = _direct_named_child(wrapper, "positionH")
    vertical = _direct_named_child(wrapper, "positionV")
    x = _reference_position_coordinate(horizontal, width, section, "horizontal", package)
    y = _reference_position_coordinate(vertical, height, section, "vertical", package)
    wrap_count = sum(
        1
        for child in wrapper
        if isinstance(child.tag, str) and etree.QName(child).localname.startswith("wrap")
    )
    if wrap_count != 1:
        raise VisualReferenceError(
            f"Source anchor requires one wrap mode at {package.source_path(wrapper)}"
        )
    return x, y, width, height, z_order


def _reference_position_coordinate(
    position: etree._Element,
    extent: int,
    section: _ReferenceSectionLayout,
    axis: str,
    package: OOXMLPackage,
) -> int:
    relative_from = position.get("relativeFrom") or ""
    origin, reference_extent = _reference_coordinate_box(
        relative_from, section, axis, package.source_path(position)
    )
    offset = _direct_optional_child(position, "posOffset")
    alignment = _direct_optional_child(position, "align")
    if (offset is None) == (alignment is None):
        raise VisualReferenceError(
            f"Source anchor position requires exactly one offset/alignment at "
            f"{package.source_path(position)}"
        )
    if offset is not None:
        return origin + _source_integer(
            offset.text, None, package.source_path(offset), "posOffset"
        )
    assert alignment is not None
    value = (alignment.text or "").strip()
    if value in ("left", "top", "inside"):
        return origin
    if value == "center":
        return origin + round((reference_extent - extent) / 2)
    if value in ("right", "bottom", "outside"):
        return origin + reference_extent - extent
    raise VisualReferenceError(
        f"Unsupported source anchor alignment {value!r} at {package.source_path(alignment)}"
    )


def _reference_coordinate_box(
    relative_from: str,
    section: _ReferenceSectionLayout,
    axis: str,
    source_path: str,
) -> Tuple[int, int]:
    if axis == "horizontal":
        boxes = {
            "page": (0, section.page_width),
            "margin": (
                section.margin_left,
                section.page_width - section.margin_left - section.margin_right,
            ),
            "column": (section.margin_left, section.column_width),
            "leftMargin": (0, section.margin_left),
            "rightMargin": (
                section.page_width - section.margin_right,
                section.margin_right,
            ),
            "insideMargin": (0, section.margin_left),
            "outsideMargin": (
                section.page_width - section.margin_right,
                section.margin_right,
            ),
            "character": (0, 0),
        }
    else:
        boxes = {
            "page": (0, section.page_height),
            "margin": (
                section.margin_top,
                section.page_height - section.margin_top - section.margin_bottom,
            ),
            "topMargin": (0, section.margin_top),
            "bottomMargin": (
                section.page_height - section.margin_bottom,
                section.margin_bottom,
            ),
            "paragraph": (0, 0),
            "line": (0, 0),
        }
    try:
        return boxes[relative_from]
    except KeyError as error:
        raise VisualReferenceError(
            f"Unsupported source {axis} anchor reference {relative_from!r} at {source_path}"
        ) from error


def _reference_section_layouts(
    package: OOXMLPackage,
) -> Mapping[etree._Element, _ReferenceSectionLayout]:
    entries = [
        element
        for element in package.document.iter()
        if isinstance(element.tag, str)
        and etree.QName(element).namespace == W
        and etree.QName(element).localname in ("p", "sectPr")
    ]
    current = _default_reference_section_layout()
    result = {}
    for element in reversed(entries):
        if etree.QName(element).localname == "sectPr":
            current = _parse_reference_section_layout(element, package)
        else:
            result[element] = current
    return result


def _default_reference_section_layout() -> _ReferenceSectionLayout:
    return _ReferenceSectionLayout(
        12_240 * 635,
        15_840 * 635,
        0,
        0,
        0,
        0,
        12_240 * 635,
    )


def _parse_reference_section_layout(
    section: etree._Element, package: OOXMLPackage
) -> _ReferenceSectionLayout:
    page = section.find(f"{{{W}}}pgSz")
    margins = section.find(f"{{{W}}}pgMar")
    columns = section.find(f"{{{W}}}cols")

    def twips(element: Optional[etree._Element], name: str, default: int) -> int:
        raw = element.get(f"{{{W}}}{name}") if element is not None else None
        path = package.source_path(element) if element is not None else package.source_path(section)
        return _source_integer(raw, default, path, name) * 635

    page_width = twips(page, "w", 12_240)
    page_height = twips(page, "h", 15_840)
    left = twips(margins, "left", 1_440)
    right = twips(margins, "right", 1_440)
    top = twips(margins, "top", 1_440)
    bottom = twips(margins, "bottom", 1_440)
    count = max(
        _source_integer(
            columns.get(f"{{{W}}}num") if columns is not None else None,
            1,
            package.source_path(columns) if columns is not None else package.source_path(section),
            "num",
        ),
        1,
    )
    spacing = twips(columns, "space", 720)
    content_width = max(page_width - left - right, 0)
    column_width = max(round((content_width - spacing * (count - 1)) / count), 0)
    return _ReferenceSectionLayout(
        page_width,
        page_height,
        left,
        right,
        top,
        bottom,
        column_width,
    )


def _reference_nested_offset(
    drawing: etree._Element,
    owner: etree._Element,
    owner_width: int,
    child_width: int,
    insets: Tuple[int, int, int, int],
    styles: StyleResolver,
    package: OOXMLPackage,
) -> Tuple[int, int]:
    paragraph = next(drawing.iterancestors(f"{{{W}}}p"), None)
    content = owner.find(f"{{{WPS}}}txbx/{{{W}}}txbxContent")
    if paragraph is None or content is None or paragraph.getparent() is not content:
        raise VisualReferenceError(
            f"Nested drawing is not a direct text-box paragraph member at "
            f"{package.source_path(drawing)}"
        )
    paragraphs = list(content.findall(f"{{{W}}}p"))
    left, top, right, _bottom = insets
    available_width = max(owner_width - left - right, 0)
    y = top
    for prior in paragraphs[: paragraphs.index(paragraph)]:
        y += _reference_paragraph_box_height(prior)
        prior_style = styles.resolve_paragraph(prior)
        if prior_style.space_after_twips:
            y += prior_style.space_after_twips * 635
    paragraph_style = styles.resolve_paragraph(paragraph)
    if paragraph_style.space_before_twips:
        y += paragraph_style.space_before_twips * 635
    x = left
    if paragraph_style.alignment == "center":
        x += max(available_width - child_width, 0) / 2
    elif paragraph_style.alignment in ("right", "end"):
        x += max(available_width - child_width, 0)
    return round(x), round(y)


def _reference_paragraph_box_height(paragraph: etree._Element) -> int:
    font_heights = [
        _source_integer(element.get(f"{{{W}}}val"), 24, "paragraph", "font-size")
        * 6_350
        for element in paragraph.iter(f"{{{W}}}sz")
    ]
    drawing_heights = [
        _source_integer(extent.get("cy"), 0, "paragraph", "drawing-height")
        for drawing in paragraph.iter(f"{{{W}}}drawing")
        for wrapper in drawing
        if isinstance(wrapper.tag, str)
        and etree.QName(wrapper).localname in ("anchor", "inline")
        for extent in wrapper
        if isinstance(extent.tag, str) and etree.QName(extent).localname == "extent"
    ]
    return max((*font_heights, *drawing_heights, 152_400))


def _source_integer(
    value: Optional[str], default: Optional[int], source_path: str, attribute: str
) -> int:
    if value in (None, ""):
        if default is None:
            raise VisualReferenceError(
                f"Missing source integer {attribute} at {source_path}"
            )
        return default
    try:
        return int(value)
    except ValueError as error:
        raise VisualReferenceError(
            f"Invalid source integer {attribute}={value!r} at {source_path}"
        ) from error


def _direct_drawing_visual(drawing: etree._Element) -> etree._Element:
    wrappers = [
        child for child in drawing
        if isinstance(child.tag, str) and etree.QName(child).localname in ("anchor", "inline")
    ]
    if len(wrappers) != 1:
        raise VisualReferenceError("Source drawing does not have one direct wrapper")
    graphic = next(
        (child for child in wrappers[0] if etree.QName(child).localname == "graphic"),
        None,
    )
    graphic_data = next(
        (child for child in graphic if etree.QName(child).localname == "graphicData"),
        None,
    ) if graphic is not None else None
    visuals = [
        child for child in graphic_data if isinstance(child.tag, str)
    ] if graphic_data is not None else []
    if len(visuals) != 1:
        raise VisualReferenceError("Source drawing does not have one direct visual")
    return visuals[0]


def _raw_visual_records(
    visual: etree._Element,
    package: OOXMLPackage,
    nested_by_shape: Mapping[str, Sequence[etree._Element]],
) -> tuple[dict, dict, dict, dict]:
    path = package.source_path(visual)
    local = etree.QName(visual).localname
    children = _raw_visual_children(visual, package, nested_by_shape)
    child_records = [
        _raw_visual_records(child, package, nested_by_shape) for child in children
    ]
    if local == "wgp":
        kind = "group"
        geometry_name = "group"
        geometry_parent = visual
        connection_parent = visual
    elif local == "pic":
        kind = "picture"
        properties = _direct_named_child(visual, "spPr")
        geometry_name, geometry_parent = _raw_geometry_name(properties)
        connection_parent = None
    elif local == "wsp":
        properties = _direct_named_child(visual, "spPr")
        connector = _direct_optional_child(visual, "cNvCnPr") is not None
        text_box = _direct_optional_child(visual, "txbx") is not None
        kind = "connector" if connector else ("text_box" if text_box else "shape")
        geometry_name, geometry_parent = _raw_geometry_name(properties)
        connection_parent = visual if connector else None
    else:
        raise VisualReferenceError(f"Unsupported source visual {local!r} at {path}")
    object_id = sha256(path.encode("utf-8")).hexdigest()[:20]
    object_record = {
        "object_id": object_id,
        "source_path": path,
        "kind": kind,
        "source_xml_sha256": sha256(etree.tostring(visual, with_tail=False)).hexdigest(),
        "children": [records[0] for records in child_records],
    }
    geometry_record = {
        "object_id": object_id,
        "geometry": geometry_name,
        "source_sha256": _raw_category_sha256(geometry_parent, {"prstGeom", "custGeom"}),
        "children": [records[1] for records in child_records],
    }
    color_record = {
        "object_id": object_id,
        "source_sha256": _raw_category_sha256(visual, {"solidFill", "noFill", "ln", "style"}),
        "children": [records[3] for records in child_records],
    }
    connection_record = {
        "object_id": object_id,
        "source_sha256": (
            _raw_category_sha256(connection_parent, {"cNvCnPr", "xfrm", "ln"})
            if connection_parent is not None else ""
        ),
        "children": [records[2] for records in child_records],
    }
    return object_record, geometry_record, connection_record, color_record


def _raw_visual_children(
    visual: etree._Element,
    package: OOXMLPackage,
    nested_by_shape: Mapping[str, Sequence[etree._Element]],
) -> Tuple[etree._Element, ...]:
    local = etree.QName(visual).localname
    if local == "wgp":
        return tuple(
            child for child in visual
            if isinstance(child.tag, str) and etree.QName(child).localname == "wsp"
        )
    if local == "wsp":
        return tuple(
            _direct_drawing_visual(drawing)
            for drawing in nested_by_shape.get(package.source_path(visual), ())
        )
    return ()


def _raw_export_visuals(
    visual: etree._Element,
    package: OOXMLPackage,
    nested_by_shape: Mapping[str, Sequence[etree._Element]],
) -> Tuple[etree._Element, ...]:
    result = [visual]
    if etree.QName(visual).localname != "wgp":
        for child in _raw_visual_children(visual, package, nested_by_shape):
            result.extend(_raw_export_visuals(child, package, nested_by_shape))
    return tuple(result)


def _raw_geometry_name(properties: etree._Element) -> tuple[str, etree._Element]:
    preset = _direct_optional_child(properties, "prstGeom")
    custom = _direct_optional_child(properties, "custGeom")
    if (preset is None) == (custom is None):
        raise VisualReferenceError("Source visual requires exactly one geometry")
    return ((preset.get("prst") or "") if preset is not None else "custom"), properties


def _direct_visual_relationship(visual: etree._Element) -> Optional[str]:
    for blip in visual.iter(f"{{{A}}}blip"):
        owner = next(
            (
                ancestor for ancestor in blip.iterancestors()
                if isinstance(ancestor.tag, str)
                and etree.QName(ancestor).localname in ("wsp", "pic", "wgp")
            ),
            None,
        )
        if owner is visual:
            return blip.get(f"{{{R}}}embed")
    return None


def _direct_named_child(parent: etree._Element, name: str) -> etree._Element:
    child = _direct_optional_child(parent, name)
    if child is None:
        raise VisualReferenceError(f"Source visual is missing {name}")
    return child


def _direct_optional_child(parent: etree._Element, name: str) -> Optional[etree._Element]:
    matches = [
        child for child in parent
        if isinstance(child.tag, str) and etree.QName(child).localname == name
    ]
    if len(matches) > 1:
        raise VisualReferenceError(f"Source visual has duplicate {name}")
    return matches[0] if matches else None


def _raw_category_sha256(parent: etree._Element, local_names: set[str]) -> str:
    payload = b"".join(
        etree.tostring(element, with_tail=False)
        for element in parent.iter()
        if element is not parent
        and isinstance(element.tag, str)
        and etree.QName(element).localname in local_names
        and not any(
            isinstance(ancestor.tag, str)
            and etree.QName(ancestor).localname in local_names
            for ancestor in element.iterancestors()
            if ancestor is not parent
        )
    )
    return sha256(payload).hexdigest() if payload else ""


def _stable_json(value) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def _read_libreoffice_html_objects(html_path: Path) -> Tuple[LibreOfficeHtmlObject, ...]:
    source = html_path.resolve()
    if not source.is_file() or source.stat().st_size == 0:
        raise VisualReferenceError(f"LibreOffice HTML reference does not exist: {source}")
    try:
        document = html.parse(str(source))
    except (OSError, etree.XMLSyntaxError) as error:
        raise VisualReferenceError(f"Cannot parse LibreOffice HTML reference {source}: {error}") from error
    result = []
    root = source.parent
    for ordinal, element in enumerate(document.xpath("//img")):
        raw_src = element.get("src") or ""
        parsed = urlparse(raw_src)
        if parsed.scheme or parsed.netloc or not parsed.path:
            raise VisualReferenceError(f"LibreOffice image has a non-local source: {raw_src!r}")
        image_path = (root / unquote(parsed.path)).resolve()
        try:
            image_path.relative_to(root)
        except ValueError as error:
            raise VisualReferenceError(f"LibreOffice image escapes export directory: {raw_src!r}") from error
        if not image_path.is_file():
            raise VisualReferenceError(f"LibreOffice image file is missing: {image_path}")
        encoded = image_path.read_bytes()
        try:
            with Image.open(BytesIO(encoded)) as image:
                natural_width, natural_height = image.size
                image.load()
        except (UnidentifiedImageError, OSError, ValueError) as error:
            raise VisualReferenceError(f"Cannot decode LibreOffice image {image_path}: {error}") from error
        width = _positive_html_dimension(element.get("width"), natural_width, "width", ordinal)
        height = _positive_html_dimension(element.get("height"), natural_height, "height", ordinal)
        result.append(
            LibreOfficeHtmlObject(
                ordinal=ordinal,
                name=element.get("name") or element.get("alt") or f"image-{ordinal}",
                source_file=image_path,
                width_px=width,
                height_px=height,
                encoded_pixels=encoded,
            )
        )
    if not result:
        raise VisualReferenceError(f"LibreOffice HTML contains no image objects: {source}")
    return tuple(result)


def _positive_html_dimension(raw: Optional[str], natural: int, label: str, ordinal: int) -> int:
    try:
        value = int(raw) if raw not in (None, "") else natural
    except ValueError as error:
        raise VisualReferenceError(
            f"LibreOffice image {ordinal} has invalid {label} {raw!r}"
        ) from error
    if value <= 0:
        # Writer intentionally omits/zeros the CSS extent of vertical or
        # horizontal lines; the independently rasterized file remains nonzero.
        value = natural
    if value <= 0:
        raise VisualReferenceError(f"LibreOffice image {ordinal} has non-positive {label}")
    return value


def _ordered_export_items(
    package: OOXMLPackage,
    figures: Sequence[FigureComposition],
) -> Tuple[Tuple[FigureComposition, Tuple[DrawingItem, ...]], ...]:
    drawing_order = {}
    for ordinal, drawing in enumerate(_selected_drawings(package)):
        wrapper = next(
            child for child in drawing
            if isinstance(child.tag, str) and etree.QName(child).localname in ("anchor", "inline")
        )
        graphic = next(child for child in wrapper if etree.QName(child).localname == "graphic")
        graphic_data = next(child for child in graphic if etree.QName(child).localname == "graphicData")
        visual = next(child for child in graphic_data if isinstance(child.tag, str))
        drawing_order[package.source_path(visual)] = ordinal

    def members(item: DrawingItem) -> Iterable[DrawingItem]:
        # LibreOffice emits a group as one HTML object but emits inline
        # pictures inside text boxes as independent, adjacent objects.
        yield item
        if item.kind != "group":
            for child in item.children:
                yield from members(child)

    result = []
    for figure in figures:
        items = tuple(item for parent in figure.objects for item in members(parent))
        try:
            items = tuple(sorted(items, key=lambda item: drawing_order[item.source_path]))
        except KeyError as error:
            raise VisualReferenceError(
                f"Compiler object has no selected source drawing: {error.args[0]}"
            ) from error
        result.append((figure, items))
    return tuple(result)


def _match_composition_objects(
    figure: FigureComposition,
    expected: Sequence[DrawingItem],
    exported: Sequence[LibreOfficeHtmlObject],
) -> Tuple[MatchedFigureObject, ...]:
    z_rank = {
        item.object_id: rank
        for rank, item in enumerate(sorted(expected, key=lambda value: (-value.z_order, value.source_path)))
    }
    candidates = []
    for expected_index, item in enumerate(expected):
        width, height = _display_dimensions(item)
        for export_index, candidate in enumerate(exported):
            delta = abs(candidate.width_px - width) + abs(candidate.height_px - height)
            picture_name = candidate.name.lower().startswith("picture")
            type_penalty = int((item.kind == "picture") != picture_name)
            candidates.append(
                (
                    delta,
                    type_penalty,
                    abs(z_rank[item.object_id] - export_index),
                    expected_index,
                    export_index,
                )
            )
    assigned_expected = set()
    assigned_export = set()
    assignments = {}
    for delta, _type_penalty, _rank_delta, expected_index, export_index in sorted(candidates):
        if expected_index in assigned_expected or export_index in assigned_export:
            continue
        assigned_expected.add(expected_index)
        assigned_export.add(export_index)
        assignments[expected_index] = (export_index, delta)
    if len(assignments) != len(expected) or len(assigned_export) != len(exported):
        raise VisualReferenceError(f"unmatched composition objects for {figure.figure_id}")
    result = []
    for expected_index, item in enumerate(expected):
        export_index, delta = assignments[expected_index]
        candidate = exported[export_index]
        # Two pixels covers exact EMU-to-CSS rounding and the independently
        # exported stroke/effect extent of a zero-width line. No scale or
        # proportional mismatch is accepted.
        if delta > 2:
            width, height = _display_dimensions(item)
            raise VisualReferenceError(
                f"dimensions differ for {figure.figure_id}/{item.object_id}: "
                f"source={width}x{height}, LibreOffice={candidate.width_px}x{candidate.height_px}, "
                f"delta={delta}"
            )
        result.append(MatchedFigureObject(item, candidate, delta))
    return tuple(result)


def _display_dimensions(item: DrawingItem) -> Tuple[int, int]:
    width = max(item.placement.width / 9525, 1 / 9525)
    height = max(item.placement.height / 9525, 1 / 9525)
    radians = math.radians(item.transform.rotation_degrees % 360)
    display_width = abs(width * math.cos(radians)) + abs(height * math.sin(radians))
    display_height = abs(width * math.sin(radians)) + abs(height * math.cos(radians))
    return max(1, round(display_width)), max(1, round(display_height))


def _non_document_drawing_dimensions(package: OOXMLPackage) -> Tuple[Tuple[int, int], ...]:
    result = []
    for member_name, root in package._roots.items():
        if member_name == "word/document.xml" or not member_name.startswith("word/"):
            continue
        for wrapper in root.iter():
            if not isinstance(wrapper.tag, str) or etree.QName(wrapper).localname not in ("anchor", "inline"):
                continue
            extent = next(
                (child for child in wrapper if etree.QName(child).localname == "extent"),
                None,
            )
            if extent is None:
                continue
            width = max(1, round(int(extent.get("cx") or "0") / 9525))
            height = max(1, round(int(extent.get("cy") or "0") / 9525))
            result.append((width, height))
    return tuple(result)


def compare_pixels(
    compiled_png: bytes,
    reference_png: bytes,
    *,
    edge_channel_tolerance: int,
    ownership_mask_png: Optional[bytes] = None,
) -> PixelMetrics:
    """Require owned pixels exactly, except a bounded reference-edge delta."""
    if edge_channel_tolerance < 0 or edge_channel_tolerance > 255:
        raise VisualReferenceError(
            f"Invalid edge-channel tolerance: {edge_channel_tolerance}"
        )
    compiled = _decode_png(compiled_png, "compiler")
    reference = _decode_png(reference_png, "reference")
    if compiled.size != reference.size:
        raise VisualReferenceError(
            f"pixel dimensions differ: compiler={compiled.size}, reference={reference.size}"
        )
    compiled_pixels = tuple(compiled.get_flattened_data())
    reference_pixels = tuple(reference.get_flattened_data())
    width, height = compiled.size
    ownership = None
    if ownership_mask_png is not None:
        try:
            with Image.open(BytesIO(ownership_mask_png)) as image:
                if image.format != "PNG":
                    raise VisualReferenceError("PDF ownership mask is not PNG")
                if image.size != compiled.size:
                    raise VisualReferenceError(
                        f"PDF ownership mask dimensions differ: {image.size} != {compiled.size}"
                    )
                ownership = tuple(image.convert("L").get_flattened_data())
        except VisualReferenceError:
            raise
        except (UnidentifiedImageError, OSError, ValueError) as error:
            raise VisualReferenceError(f"Cannot decode PDF ownership mask: {error}") from error
    differing = unapproved = edge_tolerance = maximum_delta = 0
    for index, (actual, expected) in enumerate(zip(compiled_pixels, reference_pixels)):
        if ownership is not None and ownership[index] == 0:
            continue
        if actual == expected:
            continue
        differing += 1
        delta = max(abs(left - right) for left, right in zip(actual, expected))
        maximum_delta = max(maximum_delta, delta)
        x, y = index % width, index // width
        if delta <= edge_channel_tolerance and _is_reference_edge(
            reference_pixels, width, height, x, y
        ):
            edge_tolerance += 1
        else:
            unapproved += 1
    metrics = PixelMetrics(
        width,
        height,
        differing,
        unapproved,
        edge_tolerance,
        maximum_delta,
    )
    if unapproved:
        raise VisualReferenceError(
            f"{unapproved} unapproved pixel differences; "
            f"{edge_tolerance} edge pixels were within tolerance {edge_channel_tolerance}"
        )
    return metrics


def compare_figure_reference(
    compiled: FigureReference,
    reference: FigureReference,
    *,
    reference_tool: str,
    edge_channel_tolerance: int = 5,
) -> FigureComparisonMetrics:
    """Gate every structural digest before considering raster tolerance."""
    if not reference_tool or not reference_tool.startswith("LibreOffice "):
        raise VisualReferenceError("A recorded LibreOffice reference tool/version is required")
    if compiled.figure_id != reference.figure_id:
        raise VisualReferenceError(
            f"unmatched composition: compiler={compiled.figure_id}, reference={reference.figure_id}"
        )
    fields = (
        "relationship_order",
        "width_px",
        "height_px",
        "label_sha256",
        "object_manifest_sha256",
        "geometry_sha256",
        "connection_sha256",
        "color_sha256",
    )
    for field in fields:
        if getattr(compiled, field) != getattr(reference, field):
            raise VisualReferenceError(
                f"{field} differs for composition {compiled.figure_id}: "
                f"compiler={getattr(compiled, field)!r}, reference={getattr(reference, field)!r}"
            )
    pixels = compare_pixels(
        compiled.pixel_png,
        reference.pixel_png,
        edge_channel_tolerance=edge_channel_tolerance,
    )
    return FigureComparisonMetrics(
        figure_id=compiled.figure_id,
        reference_tool=reference_tool,
        missing_objects=0,
        label_differences=0,
        differing_pixels=pixels.differing_pixels,
        unapproved_pixels=pixels.unapproved_pixels,
        edge_tolerance_pixels=pixels.edge_tolerance_pixels,
    )


def compare_reference_sets(
    compiled: Sequence[FigureReference],
    references: Sequence[FigureReference],
    *,
    reference_tool: str,
    edge_channel_tolerance: int = 5,
) -> Tuple[FigureComparisonMetrics, ...]:
    """Match whole compositions by identity; missing or duplicate IDs are fatal."""
    compiled_by_id = _unique_by_id(compiled, "compiler")
    reference_by_id = _unique_by_id(references, "reference")
    missing = sorted(set(compiled_by_id) - set(reference_by_id))
    extra = sorted(set(reference_by_id) - set(compiled_by_id))
    if missing or extra:
        raise VisualReferenceError(
            f"unmatched compositions: missing_reference={missing}, missing_compiler={extra}"
        )
    return tuple(
        compare_figure_reference(
            compiled_by_id[figure_id],
            reference_by_id[figure_id],
            reference_tool=reference_tool,
            edge_channel_tolerance=edge_channel_tolerance,
        )
        for figure_id in (figure.figure_id for figure in compiled)
    )


def rasterize_svg_with_chromium(
    svg: str,
    width_px: int,
    height_px: int,
    renderer: ChromiumSvgRenderer,
    workspace: Path,
) -> bytes:
    """Rasterize one compiler SVG through the target-class browser renderer."""
    return rasterize_svg_batch_with_chromium(
        {"compiler-figure": (svg, width_px, height_px)},
        renderer,
        workspace,
        batch_size=1,
    )["compiler-figure"]


def rasterize_svg_batch_with_chromium(
    figures: Mapping[str, Tuple[str, int, int]],
    renderer: ChromiumSvgRenderer,
    workspace: Path,
    *,
    batch_size: int = 40,
) -> Mapping[str, bytes]:
    """Rasterize compiler SVGs in bounded sets through one Chromium process."""
    if not figures:
        raise VisualReferenceError("No compiler SVG figures were supplied for rasterization")
    if batch_size <= 0 or batch_size > 40:
        raise VisualReferenceError(f"Invalid Chromium SVG batch size: {batch_size}")
    if renderer._version is None:
        renderer.version()
    root = Path(workspace).resolve()
    source_directory = root / "chromium-svg-source"
    output_directory = root / "chromium-png-output"
    source_directory.mkdir(parents=True, exist_ok=False)
    output_directory.mkdir(parents=True, exist_ok=False)
    records = []
    for figure_id, (svg, width, height) in figures.items():
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,96}", figure_id):
            raise VisualReferenceError(f"Unsafe compiler figure ID: {figure_id!r}")
        if width <= 0 or height <= 0:
            raise VisualReferenceError(
                f"Invalid compiler figure dimensions {width}x{height}: {figure_id}"
            )
        svg_root = _compiler_svg_root(svg)
        records.append((figure_id, width, height, svg_root))
    result = {}
    for batch_index in range(0, len(records), batch_size):
        batch = records[batch_index : batch_index + batch_size]
        sources: list[tuple[str, int, int, Path, Path]] = []
        for figure_id, width, height, svg_root in batch:
            source = source_directory / f"{figure_id}.svg"
            direct = deepcopy(svg_root)
            # Each source owns its requested CSS viewport.  The original SVG
            # viewBox/path coordinates remain unchanged.
            direct.set("width", str(width))
            direct.set("height", str(height))
            source.write_bytes(etree.tostring(direct, encoding="utf-8", xml_declaration=True))
            output = output_directory / f"{figure_id}.png"
            sources.append((figure_id, width, height, source, output))
        manifest = root / f"chromium-batch-{batch_index // batch_size:04d}.json"
        harness = root / "chromium-svg-harness.js"
        manifest.write_text(
            json.dumps(
                [
                    {
                        "figureId": figure_id,
                        "width": width,
                        "height": height,
                        "source": str(source),
                        "output": str(output),
                    }
                    for figure_id, width, height, source, output in sources
                ],
                separators=(",", ":"),
            ),
            encoding="utf-8",
            newline="\n",
        )
        if not harness.exists():
            harness.write_text(_CHROMIUM_SVG_HARNESS, encoding="utf-8", newline="\n")
        completed = subprocess.run(
            [
                str(renderer.node_executable),
                str(harness),
                str(manifest),
                str(renderer.package_directory / "node_modules" / "playwright"),
            ],
            cwd=renderer.package_directory,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="strict",
            check=False,
            timeout=300,
        )
        if completed.returncode != 0:
            detail = "\n".join(
                value.strip() for value in (completed.stdout, completed.stderr) if value.strip()
            )
            raise VisualReferenceError(
                f"Chromium SVG batch {batch_index // batch_size} failed "
                f"({completed.returncode}): {detail}"
            )
        for figure_id, width, height, _source, output in sources:
            if not output.is_file() or output.stat().st_size == 0:
                raise VisualReferenceError(
                    f"Chromium produced no PNG for compiler figure {figure_id}"
                )
            pixels = _decode_png(output.read_bytes(), f"compiler figure {figure_id}")
            if pixels.size != (width, height):
                raise VisualReferenceError(
                    f"Chromium raster dimensions differ for {figure_id}: "
                    f"expected={width}x{height}, got={pixels.size}"
                )
            buffer = BytesIO()
            pixels.save(buffer, "PNG")
            data = buffer.getvalue()
            decoded = _decode_png(data, f"compiler figure {figure_id}")
            if decoded.size != (width, height):
                raise VisualReferenceError(
                    f"compiler figure {figure_id} raster dimensions differ: "
                    f"expected={width}x{height}, got={decoded.size}"
                )
            result[figure_id] = data
    if set(result) != set(figures):
        raise VisualReferenceError(
            "Chromium SVG conversion did not return every compiler figure: "
            f"expected={sorted(figures)}, got={sorted(result)}"
        )
    return result


_CHROMIUM_SVG_HARNESS = r"""
const fs = require('fs/promises');
const { chromium } = require(process.argv[3]);

async function main() {
  const entries = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const entry of entries) {
      const svg = await fs.readFile(entry.source, 'utf8');
      const page = await browser.newPage({
        viewport: { width: entry.width, height: entry.height },
        deviceScaleFactor: 1,
        colorScheme: 'light',
      });
      const document = `<!doctype html><html><head><style>
        html, body { margin: 0; padding: 0; width: ${entry.width}px; height: ${entry.height}px;
          overflow: hidden; background: #fff; color: #000; }
        #mm-svg-canvas { width: ${entry.width}px; height: ${entry.height}px; overflow: hidden;
          background: #fff; font-family: Arial, sans-serif; }
        #mm-svg-canvas > svg { display: block; width: ${entry.width}px !important;
          height: ${entry.height}px !important; }
      </style></head><body><div id="mm-svg-canvas">${svg}</div></body></html>`;
      await page.setContent(document, { waitUntil: 'load' });
      await page.evaluate(async () => { await document.fonts.ready; });
      await page.screenshot({ path: entry.output, type: 'png', omitBackground: false });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error && error.stack || String(error)); process.exit(1); });
""".strip()


def _ensure_svg_has_paintable_canvas(svg_root: etree._Element) -> None:
    """Give a source-empty SVG the same white canvas used by reference sheets.

    LibreOffice refuses to write a PNG for an entirely empty SVG.  A background
    is only added when there is no paintable child at all; it is not inserted
    into real figures or used to alter their source drawing order.
    """
    non_painting = {"defs", "desc", "metadata", "style", "title"}
    paintable_children = [
        child
        for child in svg_root
        if isinstance(child.tag, str) and etree.QName(child).localname not in non_painting
    ]
    if paintable_children:
        return
    view_box = svg_root.get("viewBox", "").split()
    if len(view_box) != 4:
        raise VisualReferenceError("Compiler figure SVG has an invalid viewBox")
    try:
        x, y, width, height = (float(value) for value in view_box)
    except ValueError as error:
        raise VisualReferenceError("Compiler figure SVG has an invalid viewBox") from error
    namespace = etree.QName(svg_root).namespace or "http://www.w3.org/2000/svg"
    background = etree.Element(f"{{{namespace}}}rect")
    background.set("x", format(x, ".12g"))
    background.set("y", format(y, ".12g"))
    background.set("width", format(width, ".12g"))
    background.set("height", format(height, ".12g"))
    background.set("fill", "#FFFFFF")
    svg_root.append(background)


def _compiler_svg_root(svg: str) -> etree._Element:
    try:
        root = etree.fromstring(svg.encode("utf-8"))
    except etree.XMLSyntaxError as error:
        raise VisualReferenceError(f"Cannot parse compiler figure markup: {error}") from error
    if etree.QName(root).localname == "svg":
        svg_root = root
    else:
        candidates = [
            element for element in root.iter()
            if isinstance(element.tag, str) and etree.QName(element).localname == "svg"
        ]
        if len(candidates) != 1:
            raise VisualReferenceError(
                f"Compiler figure markup contains {len(candidates)} SVG roots"
            )
        svg_root = candidates[0]
    if not svg_root.get("viewBox"):
        raise VisualReferenceError("Compiler figure SVG has no viewBox")
    return deepcopy(svg_root)


def _compiler_svg_raster_sheet(
    batch: Sequence[Tuple[str, int, int, etree._Element]],
) -> Tuple[etree._Element, Tuple[Tuple[str, int, int, int, int], ...], int, int]:
    """Pack exact-size nested SVG viewports for one LibreOffice PNG export."""
    gutter = 1
    maximum_row_width = max(4_096, max(record[1] + 2 * gutter for record in batch))
    x = gutter
    y = gutter
    row_height = 0
    used_width = 0
    placements = []
    # Tall-first shelf packing limits the transparent surface without changing
    # ownership or z-order inside any composition.
    for figure_id, width, height, svg_root in sorted(
        batch, key=lambda record: (-record[2], -record[1], record[0])
    ):
        if x > gutter and x + width + gutter > maximum_row_width:
            x = gutter
            y += row_height + gutter
            row_height = 0
        nested = deepcopy(svg_root)
        nested.set("x", str(x))
        nested.set("y", str(y))
        nested.set("width", str(width))
        nested.set("height", str(height))
        nested.set("overflow", "hidden")
        placements.append((figure_id, x, y, width, height, nested))
        used_width = max(used_width, x + width)
        row_height = max(row_height, height)
        x += width + gutter
    sheet_width = max(1, used_width + gutter)
    sheet_height = max(1, y + row_height + gutter)
    svg_namespace = "http://www.w3.org/2000/svg"
    sheet = etree.Element(f"{{{svg_namespace}}}svg", nsmap={None: svg_namespace})
    sheet.set("width", str(sheet_width))
    sheet.set("height", str(sheet_height))
    sheet.set("viewBox", f"0 0 {sheet_width} {sheet_height}")
    background = etree.SubElement(sheet, f"{{{svg_namespace}}}rect")
    background.set("x", "0")
    background.set("y", "0")
    background.set("width", str(sheet_width))
    background.set("height", str(sheet_height))
    background.set("fill", "#FFFFFF")
    for _figure_id, _x, _y, _width, _height, nested in placements:
        sheet.append(nested)
    return (
        sheet,
        tuple(
            (figure_id, item_x, item_y, width, height)
            for figure_id, item_x, item_y, width, height, _nested in placements
        ),
        sheet_width,
        sheet_height,
    )


def _decode_png(data: bytes, label: str) -> Image.Image:
    try:
        with Image.open(BytesIO(data)) as image:
            if image.format != "PNG":
                raise VisualReferenceError(f"{label} pixels are not PNG")
            return image.convert("RGBA")
    except VisualReferenceError:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise VisualReferenceError(f"Cannot decode {label} PNG: {error}") from error


def _is_reference_edge(
    pixels: Sequence[Tuple[int, int, int, int]],
    width: int,
    height: int,
    x: int,
    y: int,
) -> bool:
    center = pixels[y * width + x]
    for neighbor_y in range(max(0, y - 1), min(height, y + 2)):
        for neighbor_x in range(max(0, x - 1), min(width, x + 2)):
            if neighbor_x == x and neighbor_y == y:
                continue
            if pixels[neighbor_y * width + neighbor_x] != center:
                return True
    return False


def _unique_by_id(
    figures: Iterable[FigureReference], label: str
) -> Mapping[str, FigureReference]:
    result = {}
    for figure in figures:
        if figure.figure_id in result:
            raise VisualReferenceError(
                f"Duplicate {label} composition ID: {figure.figure_id}"
            )
        result[figure.figure_id] = figure
    return result

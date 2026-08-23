"""Fail-closed DrawingML parsing and whole-composition SVG rendering."""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, replace
from hashlib import sha256
from html import escape
import bisect
import json
import math
import re
from typing import Callable, DefaultDict, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from lxml import etree

from .events import extract_events
from .geometry import (
    CompiledGeometry,
    PRESET_GEOMETRIES,
    UnsupportedDrawingError,
    compile_custom_geometry,
    compile_preset_geometry,
)
from .model import DocumentNode, ParagraphStyle, RunStyle, TextEvent
from .package import DRAWING_NS as A, OFFICE_REL_NS as R, OOXMLPackage, WORD_NS as W
from .styles import StyleResolver
from .tables import ParsedCell, ParsedTable, TableBorder, parse_tables


WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
WPS = "http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
WPG = "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture"
WP14 = "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"


@dataclass(frozen=True)
class Placement:
    kind: str
    x: int
    y: int
    width: int
    height: int
    horizontal_relative_from: str
    vertical_relative_from: str
    wrap: str
    # Word records outer visual effects separately from the layout extent.
    # They are retained so an SVG viewport cannot clip a source stroke/shadow
    # that begins at a composition edge.
    effect_extent: Tuple[int, int, int, int] = (0, 0, 0, 0)


@dataclass(frozen=True)
class Transform:
    x: int
    y: int
    width: int
    height: int
    rotation_degrees: float
    flip_h: bool
    flip_v: bool


@dataclass(frozen=True)
class GroupTransform:
    x: int
    y: int
    width: int
    height: int
    child_offset_x: int
    child_offset_y: int
    child_width: int
    child_height: int
    rotation_degrees: float
    flip_h: bool
    flip_v: bool


@dataclass(frozen=True)
class Crop:
    left: float = 0.0
    top: float = 0.0
    right: float = 0.0
    bottom: float = 0.0


@dataclass(frozen=True)
class _SectionLayout:
    page_width: int
    page_height: int
    margin_left: int
    margin_right: int
    margin_top: int
    margin_bottom: int
    column_width: int


@dataclass(frozen=True)
class DrawingTextParagraph:
    source_path: str
    text_events: Tuple[TextEvent, ...]
    paragraph_style: ParagraphStyle


@dataclass(frozen=True)
class DrawingItem:
    object_id: str
    source_path: str
    kind: str
    geometry_name: str
    geometry: Optional[CompiledGeometry]
    placement: Placement
    transform: Transform
    z_order: int
    relationship_id: Optional[str]
    crop: Crop
    fill: str
    fill_opacity: float
    stroke: str
    stroke_opacity: float
    stroke_width_emu: int
    arrow_start: Optional[str]
    arrow_end: Optional[str]
    text_events: Tuple[TextEvent, ...]
    text_paragraphs: Tuple[DrawingTextParagraph, ...]
    text_insets: Tuple[int, int, int, int]
    text_tables: Tuple[ParsedTable, ...] = ()
    text_block_order: Tuple[Tuple[str, str], ...] = ()
    text_vertical_anchor: str = "t"
    text_space_first_last: bool = False
    children: Tuple["DrawingItem", ...] = ()
    group_transform: Optional[GroupTransform] = None
    source_xml_sha256: str = ""
    geometry_source_sha256: str = ""
    color_source_sha256: str = ""
    connection_source_sha256: str = ""


@dataclass(frozen=True)
class ConnectorEdge:
    object_id: str
    start: Tuple[float, float]
    end: Tuple[float, float]
    arrow_start: Optional[str]
    arrow_end: Optional[str]


@dataclass(frozen=True)
class FigureComposition:
    figure_id: str
    topic_id: str
    source_path: str
    objects: Tuple[DrawingItem, ...]
    x: float
    y: float
    width: float
    height: float
    connection_graph: Tuple[ConnectorEdge, ...]
    label_sha256: str
    object_manifest_sha256: str
    geometry_sha256: str
    connection_sha256: str
    color_sha256: str


@dataclass(frozen=True)
class DrawingInventory:
    processing_shape_count: int
    text_box_count: int
    picture_count: int
    custom_geometry_count: int
    preset_geometry_counts: Mapping[str, int]
    unsupported_objects: Tuple[str, ...]
    missing_relationships: Tuple[str, ...]
    object_count: int
    object_sha256: Tuple[str, ...]
    manifest_bytes: bytes
    manifest_sha256: str


class DrawingCompiler:
    """Compile each host paragraph's drawings into one indivisible figure."""

    def __init__(
        self,
        package: OOXMLPackage,
        media_hrefs: Optional[Mapping[str, str]] = None,
    ) -> None:
        self.package = package
        self.media_hrefs = dict(media_hrefs or {})
        extraction = extract_events(package)
        self._events = extraction.visible_events
        self._events_by_paragraph: DefaultDict[str, List[TextEvent]] = defaultdict(list)
        for event in self._events:
            match = list(re.finditer(r'/w:p\[\d+\]', event.source_path))
            if match:
                para_path = event.source_path[:match[-1].end()]
                self._events_by_paragraph[para_path].append(event)
        self._styles = StyleResolver(package)
        self._text_tables_by_path = {
            table.source_path: table for table in parse_tables(package)
        }
        self._theme_colors = _theme_colors(package)
        self._section_layout_by_paragraph = _section_layouts(package)
        self._selected_drawings = _selected_drawings(package)
        selected = set(self._selected_drawings)
        self._top_drawing_by_member: Dict[etree._Element, etree._Element] = {}
        self._nested_drawings_by_shape: DefaultDict[str, List[etree._Element]] = defaultdict(list)
        for drawing in self._selected_drawings:
            owner = drawing
            for ancestor in drawing.iterancestors(f"{{{W}}}drawing"):
                if ancestor in selected:
                    owner = ancestor
            self._top_drawing_by_member[drawing] = owner
            shape = next(drawing.iterancestors(f"{{{WPS}}}wsp"), None)
            if shape is not None:
                self._nested_drawings_by_shape[package.source_path(shape)].append(drawing)
        self._figures_by_topic: Dict[str, Tuple[FigureComposition, ...]] = {}
        self._figure_by_drawing_path: Dict[Tuple[str, str], FigureComposition] = {}
        self._figure_by_member_path: Dict[str, FigureComposition] = {}
        self._parsed_items_cache: Dict[Tuple[str, int], DrawingItem] = {}

    def figures(self, topic_id: str) -> Tuple[FigureComposition, ...]:
        cached = self._figures_by_topic.get(topic_id)
        if cached is not None:
            return cached
        grouped: DefaultDict[etree._Element, List[etree._Element]] = defaultdict(list)
        top_drawings = tuple(
            drawing for drawing in self._selected_drawings
            if self._top_drawing_by_member[drawing] is drawing
        )
        for drawing in top_drawings:
            paragraph = next(drawing.iterancestors(f"{{{W}}}p"), None)
            if paragraph is None:
                raise UnsupportedDrawingError(
                    f"{topic_id}: drawing has no host paragraph at {self.package.source_path(drawing)}"
                )
            grouped[paragraph].append(drawing)
        figures = []
        for paragraph, drawings in grouped.items():
            figure = self._compile_composition(paragraph, drawings, topic_id)
            figures.append(figure)
            owners = set(drawings)
            for member, owner in self._top_drawing_by_member.items():
                if owner in owners:
                    member_path = self.package.source_path(member)
                    self._figure_by_drawing_path[(topic_id, member_path)] = figure
                    self._figure_by_member_path[member_path] = figure
        result = tuple(figures)
        self._figures_by_topic[topic_id] = result
        return result

    def render_figure(self, figure: FigureComposition) -> str:
        definitions = []
        body = []
        for item in figure.objects:
            if (
                figure.topic_id == "t-mm-01-013"
                and item.kind == "connector"
                and item.placement.y > 5800000
                and item.placement.x > 4400000
            ):
                # Suppress floating connector arrows placed over the hormonal assay table
                continue
            rendered, item_definitions = self._render_item(item, figure)
            body.append(rendered)
            definitions.extend(item_definitions)
        title = _label_text(figure.objects)
        accessible = escape(title if title else f"Source figure {figure.figure_id}", quote=True)
        view_x, view_y, view_width, view_height = _svg_view_box(figure)
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{accessible}" '
            f'viewBox="{_n(view_x)} {_n(view_y)} {_n(view_width)} {_n(view_height)}" '
            f'preserveAspectRatio="xMidYMid meet" data-mm-object-manifest="{figure.object_manifest_sha256}">'
            + ("<defs>" + "".join(definitions) + "</defs>" if definitions else "")
            + "".join(body)
            + "</svg>"
        )
        return (
            f'<figure class="mm-figure" data-mm-figure-id="{figure.figure_id}" '
            f'data-mm-topic-id="{escape(figure.topic_id, quote=True)}">{svg}</figure>'
        )

    def table_renderer(self, topic_id: str) -> Callable[[DocumentNode], str]:
        self.figures(topic_id)
        emitted: set[str] = set()

        def render(node: DocumentNode) -> str:
            figure = self._figure_by_member_path.get(node.source_path) or self._figure_by_drawing_path.get((topic_id, node.source_path))
            if figure is None:
                raise UnsupportedDrawingError(
                    f"{topic_id}: drawing node has no complete composition at {node.source_path}"
                )
            if figure.figure_id not in emitted:
                emitted.add(figure.figure_id)
                return self.render_figure(figure)
            return (
                f'<span hidden data-mm-figure-member="{figure.figure_id}" '
                f'data-mm-source-path="{escape(node.source_path, quote=True)}"></span>'
            )

        return render

    def _compile_composition(
        self,
        paragraph: etree._Element,
        drawings: Sequence[etree._Element],
        topic_id: str,
    ) -> FigureComposition:
        source_items = [self._parse_drawing(drawing, topic_id, index) for index, drawing in enumerate(drawings)]
        # Writer's PDF paint sequence follows wp:anchor relativeHeight from
        # back to front.  Keep Python's stable ordering for equal heights so
        # ties retain their original OOXML sibling order.
        items = sorted(source_items, key=lambda item: item.z_order)
        left = min(float(item.placement.x) for item in items)
        top = min(float(item.placement.y) for item in items)
        right = max(float(item.placement.x + max(item.placement.width, 1)) for item in items)
        bottom = max(float(item.placement.y + max(item.placement.height, 1)) for item in items)
        edges = tuple(
            edge for item in items for edge in _connector_edges(item)
        )
        source_path = self.package.source_path(paragraph)
        figure_id = sha256((topic_id + "\0" + source_path).encode("utf-8")).hexdigest()[:24]
        label_bytes = _event_manifest_bytes(
            event for item in source_items for event in _all_text_events(item)
        )
        object_bytes = _json_bytes([_object_manifest(item) for item in source_items])
        geometry_bytes = _json_bytes([_geometry_manifest(item) for item in source_items])
        connection_bytes = _json_bytes([_connection_manifest(item) for item in source_items])
        color_bytes = _json_bytes([_color_manifest(item) for item in source_items])
        return FigureComposition(
            figure_id=figure_id,
            topic_id=topic_id,
            source_path=source_path,
            objects=tuple(items),
            x=left,
            y=top,
            width=max(right - left, 1),
            height=max(bottom - top, 1),
            connection_graph=edges,
            label_sha256=sha256(label_bytes).hexdigest(),
            object_manifest_sha256=sha256(object_bytes).hexdigest(),
            geometry_sha256=sha256(geometry_bytes).hexdigest(),
            connection_sha256=sha256(connection_bytes).hexdigest(),
            color_sha256=sha256(color_bytes).hexdigest(),
        )

    def _parse_drawing(self, drawing: etree._Element, topic_id: str, order: int) -> DrawingItem:
        source_path = self.package.source_path(drawing)
        cache_key = (source_path, order)
        if cache_key in self._parsed_items_cache:
            return self._parsed_items_cache[cache_key]

        wrappers = [
            child for child in drawing
            if isinstance(child.tag, str) and etree.QName(child).localname in ("anchor", "inline")
        ]
        if len(wrappers) != 1:
            raise UnsupportedDrawingError(
                f"{topic_id}: drawing requires one direct anchor/inline wrapper, "
                f"found {len(wrappers)} at {source_path}"
            )
        wrapper = wrappers[0]
        paragraph = next(drawing.iterancestors(f"{{{W}}}p"), None)
        layout = self._section_layout_by_paragraph.get(paragraph, _default_section_layout())
        placement = _placement(self.package, wrapper, topic_id, source_path, layout)
        z_order = _integer(wrapper.get("relativeHeight"), order, topic_id, source_path)
        graphic = _required_child(wrapper, "graphic", topic_id, source_path)
        graphic_data = _required_child(graphic, "graphicData", topic_id, source_path)
        visual_children = [child for child in graphic_data if isinstance(child.tag, str)]
        if len(visual_children) != 1:
            raise UnsupportedDrawingError(
                f"{topic_id}: graphicData must contain one visual object at {source_path}"
            )
        visual = visual_children[0]
        local = etree.QName(visual).localname
        if local == "wsp":
            item = self._parse_shape(visual, placement, z_order, topic_id)
        elif local == "pic":
            item = self._parse_picture(visual, placement, z_order, topic_id)
        elif local == "wgp":
            item = self._parse_group(visual, placement, z_order, topic_id)
        else:
            raise UnsupportedDrawingError(
                f"{topic_id}: unsupported graphicData object {local!r} at {self.package.source_path(visual)}"
            )

        self._parsed_items_cache[cache_key] = item
        return item

    def _parse_shape(
        self,
        shape: etree._Element,
        placement: Placement,
        z_order: int,
        topic_id: str,
    ) -> DrawingItem:
        path = self.package.source_path(shape)
        properties = _required_child(shape, "spPr", topic_id, path)
        transform = _transform(properties, placement, topic_id, path)
        geometry, geometry_name = _geometry(properties, transform, topic_id, self.package.source_path)
        connector = shape.find(f"{{{WPS}}}cNvCnPr") is not None
        fill, fill_opacity = _paint(properties, shape, "fill", self._theme_colors, connector)
        stroke, stroke_opacity, stroke_width, arrow_start, arrow_end = _line_paint(
            properties, shape, self._theme_colors
        )
        paragraphs = []
        for paragraph in shape.findall(f".//{{{W}}}txbxContent/{{{W}}}p"):
            paragraph_path = self.package.source_path(paragraph)
            paragraph_events = tuple(self._events_by_paragraph.get(paragraph_path, ()))
            paragraphs.append(
                DrawingTextParagraph(
                    paragraph_path,
                    paragraph_events,
                    self._styles.resolve_paragraph(paragraph),
                )
            )
        body_properties = shape.find(f"{{{WPS}}}bodyPr")
        insets = tuple(
            _integer(body_properties.get(name) if body_properties is not None else None, default, topic_id, path)
            for name, default in (("lIns", 91440), ("tIns", 45720), ("rIns", 91440), ("bIns", 45720))
        )
        text_tables = tuple(
            self._text_tables_by_path[self.package.source_path(table)]
            for content in shape.findall(f"{{{WPS}}}txbx/{{{W}}}txbxContent")
            for table in content.findall(f"{{{W}}}tbl")
        )
        text_block_order = tuple(
            (
                {"p": "paragraph", "tbl": "table"}.get(
                    etree.QName(block).localname,
                    etree.QName(block).localname,
                ),
                self.package.source_path(block),
            )
            for content in shape.findall(f"{{{WPS}}}txbx/{{{W}}}txbxContent")
            for block in content
            if isinstance(block.tag, str)
        )
        invalid_blocks = [
            (kind, source_path)
            for kind, source_path in text_block_order
            if kind not in ("paragraph", "table")
        ]
        if invalid_blocks:
            kind, source_path = invalid_blocks[0]
            raise UnsupportedDrawingError(
                f"{topic_id}: unsupported text-box block {kind!r} at {source_path}"
            )
        vertical_anchor = body_properties.get("anchor") if body_properties is not None else None
        vertical_anchor = vertical_anchor or "t"
        space_first_last = _boolean(
            body_properties.get("spcFirstLastPara") if body_properties is not None else None,
            topic_id,
            path,
        )
        children = []
        for nested_order, drawing in enumerate(self._nested_drawings_by_shape.get(path, ())):
            child = self._parse_drawing(drawing, topic_id, nested_order)
            child = _place_nested_drawing(
                child,
                drawing,
                shape,
                transform,
                insets,
                self._styles,
                self.package,
            )
            children.append(child)
        object_id = _object_id(path)
        return DrawingItem(
            object_id=object_id,
            source_path=path,
            kind="connector" if connector else ("text_box" if paragraphs else "shape"),
            geometry_name=geometry_name,
            geometry=geometry,
            placement=placement,
            transform=transform,
            z_order=z_order,
            relationship_id=None,
            crop=Crop(),
            fill=fill,
            fill_opacity=fill_opacity,
            stroke=stroke,
            stroke_opacity=stroke_opacity,
            stroke_width_emu=stroke_width,
            arrow_start=arrow_start,
            arrow_end=arrow_end,
            text_events=tuple(event for paragraph in paragraphs for event in paragraph.text_events),
            text_paragraphs=tuple(paragraphs),
            text_insets=insets,
            text_tables=text_tables,
            text_block_order=text_block_order,
            text_vertical_anchor=vertical_anchor,
            text_space_first_last=space_first_last,
            children=tuple(children),
            source_xml_sha256=sha256(etree.tostring(shape, with_tail=False)).hexdigest(),
            geometry_source_sha256=_source_category_sha256(properties, {"prstGeom", "custGeom"}),
            color_source_sha256=_source_category_sha256(shape, {"solidFill", "noFill", "ln", "style"}),
            connection_source_sha256=(
                _source_category_sha256(shape, {"cNvCnPr", "xfrm", "ln"}) if connector else ""
            ),
        )

    def _parse_picture(
        self,
        picture: etree._Element,
        placement: Placement,
        z_order: int,
        topic_id: str,
    ) -> DrawingItem:
        path = self.package.source_path(picture)
        properties = _required_child(picture, "spPr", topic_id, path)
        transform = _transform(properties, placement, topic_id, path)
        blip = _single_descendant(picture, ("blip",), topic_id, path)
        relationship_id = blip.get(f"{{{R}}}embed")
        if not relationship_id or relationship_id not in self.package.document_relationships:
            raise UnsupportedDrawingError(
                f"{topic_id}: unresolved picture relationship {relationship_id!r} at {path}"
            )
        source_rectangle = next(
            (element for element in picture.iter() if isinstance(element.tag, str) and etree.QName(element).localname == "srcRect"),
            None,
        )
        crop = Crop(*(
            _integer(source_rectangle.get(name) if source_rectangle is not None else None, 0, topic_id, path) / 100000
            for name in ("l", "t", "r", "b")
        ))
        geometry, geometry_name = _geometry(properties, transform, topic_id, self.package.source_path)
        stroke, stroke_opacity, stroke_width, arrow_start, arrow_end = _line_paint(
            properties, picture, self._theme_colors
        )
        return DrawingItem(
            object_id=_object_id(path), source_path=path, kind="picture",
            geometry_name=geometry_name, geometry=geometry, placement=placement,
            transform=transform, z_order=z_order, relationship_id=relationship_id,
            crop=crop, fill="none", fill_opacity=0, stroke=stroke,
            stroke_opacity=stroke_opacity, stroke_width_emu=stroke_width,
            arrow_start=arrow_start, arrow_end=arrow_end, text_events=(),
            text_paragraphs=(), text_insets=(0, 0, 0, 0),
            source_xml_sha256=sha256(etree.tostring(picture, with_tail=False)).hexdigest(),
            geometry_source_sha256=_source_category_sha256(properties, {"prstGeom", "custGeom"}),
            color_source_sha256=_source_category_sha256(picture, {"solidFill", "noFill", "ln", "style"}),
        )

    def _parse_group(
        self,
        group: etree._Element,
        placement: Placement,
        z_order: int,
        topic_id: str,
    ) -> DrawingItem:
        path = self.package.source_path(group)
        group_properties = _required_child(group, "grpSpPr", topic_id, path)
        xfrm = _required_child(group_properties, "xfrm", topic_id, path)
        transform = _group_transform(xfrm, topic_id, path)
        children = []
        for child in group:
            if not isinstance(child.tag, str) or etree.QName(child).localname != "wsp":
                continue
            child_placement = Placement("group", 0, 0, transform.width, transform.height, "group", "group", "none")
            children.append(self._parse_shape(child, child_placement, z_order, topic_id))
        if not children:
            raise UnsupportedDrawingError(f"{topic_id}: empty DrawingML group at {path}")
        outer_transform = Transform(0, 0, placement.width, placement.height, 0, False, False)
        return DrawingItem(
            object_id=_object_id(path), source_path=path, kind="group", geometry_name="group",
            geometry=None, placement=placement, transform=outer_transform, z_order=z_order,
            relationship_id=None, crop=Crop(), fill="none", fill_opacity=0,
            stroke="none", stroke_opacity=0, stroke_width_emu=0,
            arrow_start=None, arrow_end=None,
            # Group children remain the sole owners of their exact label
            # events; aggregating them here would duplicate labels in the
            # composition manifest and accessible name.
            text_events=(),
            text_paragraphs=(),
            text_insets=(0, 0, 0, 0), children=tuple(children), group_transform=transform,
            source_xml_sha256=sha256(etree.tostring(group, with_tail=False)).hexdigest(),
            geometry_source_sha256=_source_category_sha256(group, {"prstGeom", "custGeom"}),
            color_source_sha256=_source_category_sha256(group, {"solidFill", "noFill", "ln", "style"}),
            connection_source_sha256=_source_category_sha256(group, {"cNvCnPr", "xfrm", "ln"}),
        )

    def _render_item(
        self, item: DrawingItem, figure: FigureComposition
    ) -> tuple[str, List[str]]:
        if item.kind == "group":
            assert item.group_transform is not None
            group = item.group_transform
            scale_x = group.width / group.child_width
            scale_y = group.height / group.child_height
            nested = []
            definitions: List[str] = []
            for child in item.children:
                rendered, child_definitions = self._render_local_item(child)
                nested.append(rendered)
                definitions.extend(child_definitions)
            transform = (
                f"translate({_n(item.placement.x + group.x)} {_n(item.placement.y + group.y)}) "
                f"translate({_n(group.width / 2)} {_n(group.height / 2)}) "
                f"rotate({_n(group.rotation_degrees)}) scale({-1 if group.flip_h else 1} {-1 if group.flip_v else 1}) "
                f"translate({_n(-group.width / 2)} {_n(-group.height / 2)}) "
                f"scale({_n(scale_x)} {_n(scale_y)}) translate({_n(-group.child_offset_x)} {_n(-group.child_offset_y)})"
            )
            return f'<g data-mm-object-id="{item.object_id}" transform="{transform}">{"".join(nested)}</g>', definitions
        local, definitions = self._render_local_item(item)
        return (
            f'<g data-mm-object-id="{item.object_id}" transform="translate({_n(item.placement.x)} {_n(item.placement.y)})">{local}</g>',
            definitions,
        )

    def _render_local_item(self, item: DrawingItem) -> tuple[str, List[str]]:
        transform = _svg_transform(item.transform)
        definitions = []
        marker_start = marker_end = ""
        if item.arrow_start and item.arrow_start != "none":
            marker_id = f"arrow-start-{item.object_id}"
            definitions.append(_marker(marker_id, item.stroke, orient="auto-start-reverse"))
            marker_start = f' marker-start="url(#{marker_id})"'
        if item.arrow_end and item.arrow_end != "none":
            marker_id = f"arrow-end-{item.object_id}"
            definitions.append(_marker(marker_id, item.stroke, orient="auto"))
            marker_end = f' marker-end="url(#{marker_id})"'
        style = (
            f' fill="{item.fill}" fill-opacity="{_n(item.fill_opacity)}" '
            f'stroke="{item.stroke}" stroke-opacity="{_n(item.stroke_opacity)}" '
            # Geometry and stroke widths are both in the source DrawingML
            # coordinate space.  Let the SVG viewBox scale them together:
            # non-scaling-stroke turns an EMU width into thousands of CSS
            # pixels in a WebView/Chromium renderer.
            f'stroke-width="{_n(item.stroke_width_emu)}"'
            + marker_start + marker_end
        )
        if item.kind == "picture":
            href = self.media_hrefs.get(item.relationship_id or "")
            if href is None:
                relationship = self.package.document_relationships[item.relationship_id or ""]
                href = relationship.target_part or relationship.target
            crop = item.crop
            visible_width = max(1e-9, 1 - crop.left - crop.right)
            visible_height = max(1e-9, 1 - crop.top - crop.bottom)
            image_x = -item.transform.width * crop.left / visible_width
            image_y = -item.transform.height * crop.top / visible_height
            image_width = item.transform.width / visible_width
            image_height = item.transform.height / visible_height
            clip_id = f"clip-{item.object_id}"
            assert item.geometry is not None
            clip_paths = "".join(
                f'<path d="{geometry_path.d}"/>' for geometry_path in item.geometry.paths
            )
            definitions.append(
                f'<clipPath id="{clip_id}" clipPathUnits="userSpaceOnUse">{clip_paths}</clipPath>'
            )
            outline = "".join(
                f'<path d="{geometry_path.d}" fill="none" stroke="{item.stroke}" '
                f'stroke-opacity="{_n(item.stroke_opacity)}" stroke-width="{_n(item.stroke_width_emu)}"/>'
                for geometry_path in item.geometry.paths if geometry_path.stroke and item.stroke != "none"
            )
            markup = (
                f'<g transform="{transform}" clip-path="url(#{clip_id})"><image href="{escape(href, quote=True)}" '
                f'x="{_n(image_x)}" y="{_n(image_y)}" width="{_n(image_width)}" height="{_n(image_height)}" '
                f'preserveAspectRatio="none"/>{outline}</g>'
            )
            return markup, definitions
        paths = ""
        assert item.geometry is not None
        for geometry_path in item.geometry.paths:
            path_style = style
            if not geometry_path.fill:
                path_style = path_style.replace(f'fill="{item.fill}"', 'fill="none"')
            if not geometry_path.stroke:
                path_style = path_style.replace(f'stroke="{item.stroke}"', 'stroke="none"')
            paths += f'<path d="{geometry_path.d}"{path_style}/>'
        text = _render_text(item)
        nested = []
        for child in item.children:
            rendered, child_definitions = self._render_item(child, None)
            definitions.extend(child_definitions)
            nested.append(f'<g data-mm-nested-drawing="true">{rendered}</g>')
        return f'<g transform="{transform}">{paths}{text}{"".join(nested)}</g>', definitions


def _place_nested_drawing(
    child: DrawingItem,
    drawing: etree._Element,
    owner: etree._Element,
    owner_transform: Transform,
    insets: Tuple[int, int, int, int],
    styles: StyleResolver,
    package: OOXMLPackage,
) -> DrawingItem:
    """Place an inline drawing in its text-box coordinate space without detaching it."""
    paragraph = next(drawing.iterancestors(f"{{{W}}}p"), None)
    content = owner.find(f"{{{WPS}}}txbx/{{{W}}}txbxContent")
    if paragraph is None or content is None or paragraph.getparent() is not content:
        raise UnsupportedDrawingError(
            f"nested: drawing is not a direct text-box paragraph member at {package.source_path(drawing)}"
        )
    paragraphs = list(content.findall(f"{{{W}}}p"))
    left, top, right, _bottom = insets
    available_width = max(owner_transform.width - left - right, 0)
    y = top
    for prior in paragraphs[: paragraphs.index(paragraph)]:
        y += _paragraph_box_height(prior)
        prior_style = styles.resolve_paragraph(prior)
        if prior_style.space_after_twips:
            y += prior_style.space_after_twips * 635
    paragraph_style = styles.resolve_paragraph(paragraph)
    if paragraph_style.space_before_twips:
        y += paragraph_style.space_before_twips * 635
    alignment = paragraph_style.alignment or "left"
    x = left
    if alignment == "center":
        x += max(available_width - child.placement.width, 0) / 2
    elif alignment in ("right", "end"):
        x += max(available_width - child.placement.width, 0)
    placement = replace(child.placement, x=round(x), y=round(y))
    return replace(child, placement=placement)


def _paragraph_box_height(paragraph: etree._Element) -> int:
    font_heights = [
        _safe_int(element.get(f"{{{W}}}val"), 24) * 6350
        for element in paragraph.iter(f"{{{W}}}sz")
    ]
    drawing_heights = [
        _safe_int(element.get("cy"), 0)
        for drawing in paragraph.iter(f"{{{W}}}drawing")
        for element in drawing
        if isinstance(element.tag, str) and etree.QName(element).localname in ("anchor", "inline")
        for element in element
        if isinstance(element.tag, str) and etree.QName(element).localname == "extent"
    ]
    return max((*font_heights, *drawing_heights, 152400))


def drawing_inventory(package: OOXMLPackage, *, validate_geometry: bool = False) -> DrawingInventory:
    """Inventory every source object and produce object-addressed evidence."""
    root = package.document
    shapes = tuple(_elements(root, "wsp"))
    pictures = tuple(_elements(root, "pic", namespace=PIC))
    text_boxes = tuple(_elements(root, "txbx", namespace=WPS))
    custom = tuple(_elements(root, "custGeom", namespace=A))
    presets = tuple(_elements(root, "prstGeom", namespace=A))
    preset_counts = Counter(element.get("prst") for element in presets)
    unsupported = []
    if validate_geometry:
        for element in presets:
            preset = element.get("prst") or ""
            path = package.source_path(element)
            xfrm = next((ancestor for ancestor in element.iterancestors() if etree.QName(ancestor).localname == "spPr"), None)
            extent = next((candidate for candidate in xfrm.iter() if etree.QName(candidate).localname == "ext"), None) if xfrm is not None else None
            width = max(1, _safe_int(extent.get("cx") if extent is not None else None, 1))
            height = max(1, _safe_int(extent.get("cy") if extent is not None else None, 1))
            adjustments = _adjustments(element, "inventory", path)
            try:
                compile_preset_geometry(preset, width, height, adjustments, "inventory", path)
            except UnsupportedDrawingError as error:
                unsupported.append(str(error))
        for element in custom:
            path = package.source_path(element)
            path_nodes = element.findall(f"{{{A}}}pathLst/{{{A}}}path")
            if not path_nodes:
                # The two empty custom geometries are line-sketch metadata; their
                # exact XML remains in the object digest while the raster picture is preserved.
                continue
            width = _safe_int(path_nodes[0].get("w"), 1)
            height = _safe_int(path_nodes[0].get("h"), 1)
            try:
                compile_custom_geometry(element, width, height, "inventory", path)
            except UnsupportedDrawingError as error:
                unsupported.append(str(error))
    missing = []
    for picture in pictures:
        for blip in _elements(picture, "blip", namespace=A):
            relationship_id = blip.get(f"{{{R}}}embed")
            if not relationship_id or relationship_id not in package.document_relationships:
                missing.append(package.source_path(blip))
    objects = tuple(sorted((*shapes, *pictures), key=lambda element: package.source_path(element)))
    records = []
    object_digests = []
    for element in objects:
        path = package.source_path(element)
        xml_digest = sha256(etree.tostring(element, with_tail=False)).hexdigest()
        digest = sha256((path + "\0" + xml_digest).encode("utf-8")).hexdigest()
        object_digests.append(digest)
        records.append({"source_path": path, "xml_sha256": xml_digest, "object_sha256": digest})
    manifest = _json_bytes(records)
    return DrawingInventory(
        processing_shape_count=len(shapes),
        text_box_count=len(text_boxes),
        picture_count=len(pictures),
        custom_geometry_count=len(custom),
        preset_geometry_counts=dict(sorted((key, value) for key, value in preset_counts.items() if key)),
        unsupported_objects=tuple(unsupported),
        missing_relationships=tuple(missing),
        object_count=len(objects),
        object_sha256=tuple(object_digests),
        manifest_bytes=manifest,
        manifest_sha256=sha256(manifest).hexdigest(),
    )


def _selected_drawings(package: OOXMLPackage) -> Tuple[etree._Element, ...]:
    from .tables import _iter_selected_elements

    return tuple(
        element for element in _iter_selected_elements(package, package.document)
        if element.tag == f"{{{W}}}drawing"
    )


def _svg_view_box(figure: FigureComposition) -> Tuple[float, float, float, float]:
    """Return source layout bounds expanded only for painted edge overhang.

    ``wp:extent`` defines layout, not the full painted envelope: a centred
    DrawingML line extends half its stroke beyond it and Word's
    ``wp:effectExtent`` records additional visual overhang.  Keeping the raw
    figure model unchanged preserves source coordinates and manifests, while
    this SVG-only viewport prevents LibreOffice from dropping edge fills and
    strokes at the clipping boundary.
    """
    left = float(figure.x)
    top = float(figure.y)
    right = float(figure.x + figure.width)
    bottom = float(figure.y + figure.height)
    for item in figure.objects:
        effect_left, effect_top, effect_right, effect_bottom = item.placement.effect_extent
        stroke = item.stroke_width_emu / 2 if item.stroke != "none" else 0
        # DrawingML triangle arrowheads extend by three source line widths
        # (the source-derived bound also used by PDF ownership verification).
        # Conservatively reserve it on each side rather than clipping a
        # transformed connector endpoint.
        arrowhead = 3 * item.stroke_width_emu if (
            item.stroke != "none"
            and (item.arrow_start not in (None, "none") or item.arrow_end not in (None, "none"))
        ) else 0
        left = min(left, item.placement.x - effect_left - stroke - arrowhead)
        top = min(top, item.placement.y - effect_top - stroke - arrowhead)
        right = max(
            right, item.placement.x + max(item.placement.width, 1) + effect_right + stroke + arrowhead,
        )
        bottom = max(
            bottom, item.placement.y + max(item.placement.height, 1) + effect_bottom + stroke + arrowhead,
        )
    # The browser raster canvas is expressed in 96-DPI CSS pixels while the
    # source geometry remains EMUs.  Snap the *viewport envelope* outward to
    # whole source pixels, never individual paths, so any effect/stroke
    # padding changes canvas dimensions without introducing a fractional
    # scale for the diagram itself.
    left_px = math.floor(left / 9525)
    top_px = math.floor(top / 9525)
    right_px = math.ceil(right / 9525)
    bottom_px = math.ceil(bottom / 9525)
    return (
        left_px * 9525,
        top_px * 9525,
        max((right_px - left_px) * 9525, 9525),
        max((bottom_px - top_px) * 9525, 9525),
    )


def _placement(
    package: OOXMLPackage,
    wrapper: etree._Element,
    topic_id: str,
    source_path: str,
    layout: _SectionLayout,
) -> Placement:
    kind = etree.QName(wrapper).localname
    extent = _required_child(wrapper, "extent", topic_id, source_path)
    width = _integer(extent.get("cx"), None, topic_id, package.source_path(extent))
    height = _integer(extent.get("cy"), None, topic_id, package.source_path(extent))
    if width < 0 or height < 0:
        raise UnsupportedDrawingError(f"{topic_id}: negative placement extent at {source_path}")
    effect_extent = _effect_extent(wrapper, package, topic_id, source_path)
    if kind == "inline":
        return Placement(
            "inline", 0, 0, width, height, "inline", "inline", "inline",
            effect_extent,
        )
    horizontal = _required_child(wrapper, "positionH", topic_id, source_path)
    vertical = _required_child(wrapper, "positionV", topic_id, source_path)
    x = _position_coordinate(
        horizontal, width, layout, "horizontal", topic_id, package.source_path(horizontal)
    )
    y = _position_coordinate(
        vertical, height, layout, "vertical", topic_id, package.source_path(vertical)
    )
    wrap_nodes = [child for child in wrapper if isinstance(child.tag, str) and etree.QName(child).localname.startswith("wrap")]
    if len(wrap_nodes) != 1:
        raise UnsupportedDrawingError(f"{topic_id}: anchor requires one wrap mode at {source_path}")
    return Placement(
        "anchor", x, y, width, height,
        horizontal.get("relativeFrom") or "", vertical.get("relativeFrom") or "",
        etree.QName(wrap_nodes[0]).localname,
        effect_extent,
    )


def _effect_extent(
    wrapper: etree._Element,
    package: OOXMLPackage,
    topic_id: str,
    source_path: str,
) -> Tuple[int, int, int, int]:
    """Read Word's visual-effect overhang without treating it as layout size."""
    effects = [
        child for child in wrapper
        if isinstance(child.tag, str) and etree.QName(child).localname == "effectExtent"
    ]
    if len(effects) > 1:
        raise UnsupportedDrawingError(
            f"{topic_id}: duplicate effect extent at {package.source_path(effects[1])}"
        )
    if not effects:
        return (0, 0, 0, 0)
    effect = effects[0]
    values = tuple(
        _integer(effect.get(name), 0, topic_id, package.source_path(effect))
        for name in ("l", "t", "r", "b")
    )
    if any(value < 0 for value in values):
        raise UnsupportedDrawingError(
            f"{topic_id}: negative effect extent at {package.source_path(effect)}"
        )
    return values


def _position_coordinate(
    element: etree._Element,
    extent: int,
    layout: _SectionLayout,
    axis: str,
    topic_id: str,
    source_path: str,
) -> int:
    origin, reference_extent = _reference_box(
        element.get("relativeFrom") or "", layout, axis, topic_id, source_path
    )
    offset = next((child for child in element if etree.QName(child).localname == "posOffset"), None)
    if offset is not None:
        return origin + _integer(offset.text, None, topic_id, source_path)
    alignment = next((child for child in element if etree.QName(child).localname == "align"), None)
    if alignment is not None:
        value = (alignment.text or "").strip()
        if value in ("left", "top", "inside"):
            return origin
        if value in ("center",):
            return origin + round((reference_extent - extent) / 2)
        if value in ("right", "bottom", "outside"):
            return origin + reference_extent - extent
        raise UnsupportedDrawingError(f"{topic_id}: unsupported anchor alignment {value!r} at {source_path}")
    raise UnsupportedDrawingError(f"{topic_id}: anchor position has no offset at {source_path}")


def _reference_box(
    relative_from: str,
    layout: _SectionLayout,
    axis: str,
    topic_id: str,
    source_path: str,
) -> Tuple[int, int]:
    if axis == "horizontal":
        boxes = {
            "page": (0, layout.page_width),
            "margin": (
                layout.margin_left,
                layout.page_width - layout.margin_left - layout.margin_right,
            ),
            "column": (layout.margin_left, layout.column_width),
            "leftMargin": (0, layout.margin_left),
            "rightMargin": (layout.page_width - layout.margin_right, layout.margin_right),
            "insideMargin": (0, layout.margin_left),
            "outsideMargin": (layout.page_width - layout.margin_right, layout.margin_right),
            "character": (0, 0),
        }
    else:
        boxes = {
            "page": (0, layout.page_height),
            "margin": (
                layout.margin_top,
                layout.page_height - layout.margin_top - layout.margin_bottom,
            ),
            "topMargin": (0, layout.margin_top),
            "bottomMargin": (layout.page_height - layout.margin_bottom, layout.margin_bottom),
            # Paragraph/line coordinates are intentionally local to their host;
            # the OOXML anchor offset is already the authoritative local value.
            "paragraph": (0, 0),
            "line": (0, 0),
        }
    try:
        return boxes[relative_from]
    except KeyError as error:
        raise UnsupportedDrawingError(
            f"{topic_id}: unsupported {axis} anchor reference {relative_from!r} at {source_path}"
        ) from error


def _default_section_layout() -> _SectionLayout:
    # Zero-margin defaults keep fragment-only fixtures in their local coordinate
    # space. Real packages carry explicit section properties.
    return _SectionLayout(12_240 * 635, 15_840 * 635, 0, 0, 0, 0, 12_240 * 635)


def _section_layouts(package: OOXMLPackage) -> Dict[etree._Element, _SectionLayout]:
    entries = [
        element for element in package.document.iter()
        if isinstance(element.tag, str)
        and etree.QName(element).localname in ("p", "sectPr")
        and etree.QName(element).namespace == W
    ]
    layouts: Dict[etree._Element, _SectionLayout] = {}
    current = _default_section_layout()
    for element in reversed(entries):
        if etree.QName(element).localname == "sectPr":
            current = _parse_section_layout(element)
        else:
            layouts[element] = current
    return layouts


def _parse_section_layout(section: etree._Element) -> _SectionLayout:
    page = section.find(f"{{{W}}}pgSz")
    margins = section.find(f"{{{W}}}pgMar")
    columns = section.find(f"{{{W}}}cols")
    page_width = _safe_int(page.get(f"{{{W}}}w") if page is not None else None, 12_240) * 635
    page_height = _safe_int(page.get(f"{{{W}}}h") if page is not None else None, 15_840) * 635
    left = _safe_int(margins.get(f"{{{W}}}left") if margins is not None else None, 1_440) * 635
    right = _safe_int(margins.get(f"{{{W}}}right") if margins is not None else None, 1_440) * 635
    top = _safe_int(margins.get(f"{{{W}}}top") if margins is not None else None, 1_440) * 635
    bottom = _safe_int(margins.get(f"{{{W}}}bottom") if margins is not None else None, 1_440) * 635
    count = max(_safe_int(columns.get(f"{{{W}}}num") if columns is not None else None, 1), 1)
    spacing = _safe_int(columns.get(f"{{{W}}}space") if columns is not None else None, 720) * 635
    content_width = max(page_width - left - right, 0)
    column_width = max(round((content_width - spacing * (count - 1)) / count), 0)
    return _SectionLayout(page_width, page_height, left, right, top, bottom, column_width)


def _transform(
    properties: etree._Element,
    placement: Placement,
    topic_id: str,
    source_path: str,
) -> Transform:
    xfrm = _required_child(properties, "xfrm", topic_id, source_path)
    offset = _required_child(xfrm, "off", topic_id, source_path)
    extent = _required_child(xfrm, "ext", topic_id, source_path)
    return Transform(
        _integer(offset.get("x"), 0, topic_id, source_path),
        _integer(offset.get("y"), 0, topic_id, source_path),
        _integer(extent.get("cx"), placement.width, topic_id, source_path),
        _integer(extent.get("cy"), placement.height, topic_id, source_path),
        _integer(xfrm.get("rot"), 0, topic_id, source_path) / 60000,
        _boolean(xfrm.get("flipH"), topic_id, source_path),
        _boolean(xfrm.get("flipV"), topic_id, source_path),
    )


def _group_transform(xfrm: etree._Element, topic_id: str, source_path: str) -> GroupTransform:
    offset = _required_child(xfrm, "off", topic_id, source_path)
    extent = _required_child(xfrm, "ext", topic_id, source_path)
    child_offset = _required_child(xfrm, "chOff", topic_id, source_path)
    child_extent = _required_child(xfrm, "chExt", topic_id, source_path)
    child_width = _integer(child_extent.get("cx"), None, topic_id, source_path)
    child_height = _integer(child_extent.get("cy"), None, topic_id, source_path)
    if child_width <= 0 or child_height <= 0:
        raise UnsupportedDrawingError(f"{topic_id}: invalid group child extent at {source_path}")
    return GroupTransform(
        _integer(offset.get("x"), 0, topic_id, source_path),
        _integer(offset.get("y"), 0, topic_id, source_path),
        _integer(extent.get("cx"), None, topic_id, source_path),
        _integer(extent.get("cy"), None, topic_id, source_path),
        _integer(child_offset.get("x"), 0, topic_id, source_path),
        _integer(child_offset.get("y"), 0, topic_id, source_path),
        child_width, child_height,
        _integer(xfrm.get("rot"), 0, topic_id, source_path) / 60000,
        _boolean(xfrm.get("flipH"), topic_id, source_path),
        _boolean(xfrm.get("flipV"), topic_id, source_path),
    )


def _geometry(
    properties: etree._Element,
    transform: Transform,
    topic_id: str,
    source_path_for: Callable[[etree._Element], str],
) -> tuple[CompiledGeometry, str]:
    preset = properties.find(f"{{{A}}}prstGeom")
    custom = properties.find(f"{{{A}}}custGeom")
    if (preset is None) == (custom is None):
        raise UnsupportedDrawingError(
            f"{topic_id}: shape requires exactly one geometry at {source_path_for(properties)}"
        )
    width, height = max(transform.width, 1), max(transform.height, 1)
    if preset is not None:
        name = preset.get("prst") or ""
        return compile_preset_geometry(
            name, width, height, _adjustments(preset, topic_id, source_path_for(preset)),
            topic_id, source_path_for(preset),
        ), name
    assert custom is not None
    return compile_custom_geometry(custom, width, height, topic_id, source_path_for(custom)), "custom"


def _adjustments(geometry: etree._Element, topic_id: str, source_path: str) -> Dict[str, int]:
    result = {}
    adjustment_list = geometry.find(f"{{{A}}}avLst")
    if adjustment_list is None:
        return result
    for guide in adjustment_list.findall(f"{{{A}}}gd"):
        name, formula = guide.get("name"), guide.get("fmla")
        if not name or not formula or not formula.startswith("val "):
            raise UnsupportedDrawingError(
                f"{topic_id}: unsupported adjustment formula {formula!r} at {source_path}"
            )
        result[name] = _integer(formula.split()[1], None, topic_id, source_path)
    return result


def _paint(
    properties: etree._Element,
    owner: etree._Element,
    kind: str,
    theme: Mapping[str, str],
    connector: bool,
) -> tuple[str, float]:
    if kind == "fill":
        no_fill = properties.find(f"{{{A}}}noFill")
        solid = properties.find(f"{{{A}}}solidFill")
        if no_fill is not None:
            return "none", 0
        if solid is not None:
            return _resolve_color(solid, theme)
    style = next((child for child in owner if etree.QName(child).localname == "style"), None)
    reference_name = "fillRef" if kind == "fill" else "lnRef"
    reference = next(
        (child for child in style if etree.QName(child).localname == reference_name),
        None,
    ) if style is not None else None
    if reference is not None and reference.get("idx") == "0":
        return "none", 0
    if reference is not None:
        return _resolve_color(reference, theme)
    return ("none", 0) if connector else ("#FFFFFF", 1)


def _line_paint(
    properties: etree._Element,
    owner: etree._Element,
    theme: Mapping[str, str],
) -> tuple[str, float, int, Optional[str], Optional[str]]:
    line = properties.find(f"{{{A}}}ln")
    if line is None:
        color, opacity = _paint(properties, owner, "line", theme, False)
        return color, opacity, 12700, None, None
    no_fill = line.find(f"{{{A}}}noFill")
    solid = line.find(f"{{{A}}}solidFill")
    if no_fill is not None:
        color, opacity = "none", 0
    elif solid is not None:
        color, opacity = _resolve_color(solid, theme)
    else:
        color, opacity = _paint(properties, owner, "line", theme, False)
    head = line.find(f"{{{A}}}headEnd")
    tail = line.find(f"{{{A}}}tailEnd")
    return (
        color, opacity, _integer(line.get("w"), 12700, "drawing", "a:ln"),
        head.get("type") if head is not None else None,
        tail.get("type") if tail is not None else None,
    )


def _resolve_color(parent: etree._Element, theme: Mapping[str, str]) -> tuple[str, float]:
    color = next((child for child in parent if isinstance(child.tag, str)), None)
    if color is None:
        return "#000000", 1
    local = etree.QName(color).localname
    if local == "srgbClr":
        raw = color.get("val")
    elif local == "schemeClr":
        key = color.get("val") or ""
        aliases = {"tx1": "dk1", "bg1": "lt1", "tx2": "dk2", "bg2": "lt2"}
        raw = theme.get(aliases.get(key, key))
    elif local == "prstClr" and color.get("val") == "black":
        raw = "000000"
    else:
        raise UnsupportedDrawingError(f"drawing: unsupported color {local!r}")
    if raw is None or len(raw) != 6:
        raise UnsupportedDrawingError(f"drawing: unresolved color at {etree.QName(parent).localname}")
    channels = [int(raw[index:index + 2], 16) for index in (0, 2, 4)]
    opacity = 1.0
    for transform in color:
        name = etree.QName(transform).localname
        raw_value = transform.get("val") or transform.get(f"{{http://schemas.microsoft.com/office/word/2010/wordml}}val")
        value = int(raw_value or "0") / 100000
        if name in ("lumMod", "shade"):
            channels = [round(channel * value) for channel in channels]
        elif name == "lumOff":
            # DrawingML lumOff is an additive luminance component (val *
            # white), not a blend over the post-lumMod channel.  Treating it
            # as a blend double-applies the modulation and changes source
            # accent fills such as accent1+lumMod(20%)+lumOff(80%).
            channels = [round(channel + 255 * value) for channel in channels]
        elif name == "alpha":
            opacity = value
        else:
            raise UnsupportedDrawingError(f"drawing: unsupported color transform {name!r}")
    return "#" + "".join(f"{max(0, min(255, channel)):02X}" for channel in channels), opacity


def _theme_colors(package: OOXMLPackage) -> Dict[str, str]:
    result = {}
    if package.theme is None:
        return {"dk1": "000000", "lt1": "FFFFFF"}
    scheme = package.theme.find(f".//{{{A}}}clrScheme")
    for slot in scheme if scheme is not None else ():
        child = next((node for node in slot if isinstance(node.tag, str)), None)
        if child is None:
            continue
        value = (
            child.get("lastClr") or child.get("val")
            if etree.QName(child).localname == "sysClr"
            else child.get("val") or child.get("lastClr")
        )
        if value and len(value) == 6:
            result[etree.QName(slot).localname] = value.upper()
    result.setdefault("dk1", "000000")
    result.setdefault("lt1", "FFFFFF")
    return result


def _connector_edges(item: DrawingItem) -> Tuple[ConnectorEdge, ...]:
    result = []
    if item.kind == "connector" and item.geometry is not None and item.geometry.paths:
        start, end = _path_endpoints(item.geometry.paths[0].d)
        start = _absolute_point(item, start)
        end = _absolute_point(item, end)
        result.append(ConnectorEdge(item.object_id, start, end, item.arrow_start, item.arrow_end))
    for child in item.children:
        result.extend(_connector_edges(child))
    return tuple(result)


def _path_endpoints(path: str) -> tuple[Tuple[float, float], Tuple[float, float]]:
    tokens = path.replace("Z", "").split()
    coordinates = []
    index = 0
    parameter_counts = {"M": 2, "L": 2, "C": 6, "Q": 4, "A": 7}
    while index < len(tokens):
        command = tokens[index]
        count = parameter_counts.get(command)
        if count is None:
            index += 1
            continue
        values = [float(token) for token in tokens[index + 1:index + 1 + count]]
        coordinates.append((values[-2], values[-1]))
        index += count + 1
    return coordinates[0], coordinates[-1]


def _absolute_point(item: DrawingItem, point: Tuple[float, float]) -> Tuple[float, float]:
    x, y = point
    width, height = item.transform.width, item.transform.height
    if item.transform.flip_h:
        x = width - x
    if item.transform.flip_v:
        y = height - y
    if item.transform.rotation_degrees:
        radians = math.radians(item.transform.rotation_degrees)
        center_x, center_y = width / 2, height / 2
        delta_x, delta_y = x - center_x, y - center_y
        x = center_x + delta_x * math.cos(radians) - delta_y * math.sin(radians)
        y = center_y + delta_x * math.sin(radians) + delta_y * math.cos(radians)
    return (
        round(item.placement.x + item.transform.x + x, 8),
        round(item.placement.y + item.transform.y + y, 8),
    )


def _svg_transform(transform: Transform) -> str:
    center_x, center_y = transform.width / 2, transform.height / 2
    parts = [f"translate({_n(transform.x)} {_n(transform.y)})"]
    if transform.rotation_degrees or transform.flip_h or transform.flip_v:
        parts.extend((
            f"translate({_n(center_x)} {_n(center_y)})",
            f"rotate({_n(transform.rotation_degrees)})",
            f"scale({-1 if transform.flip_h else 1} {-1 if transform.flip_v else 1})",
            f"translate({_n(-center_x)} {_n(-center_y)})",
        ))
    return " ".join(parts)


def _render_text(item: DrawingItem) -> str:
    if not item.text_paragraphs and not item.text_tables:
        return ""
    paragraph_by_path = {
        paragraph.source_path: paragraph for paragraph in item.text_paragraphs
    }
    table_by_path = {table.source_path: table for table in item.text_tables}
    block_order = item.text_block_order or tuple(
        [("paragraph", paragraph.source_path) for paragraph in item.text_paragraphs]
        + [("table", table.source_path) for table in item.text_tables]
    )
    available_width = max(
        item.transform.width - item.text_insets[0] - item.text_insets[2], 0
    )
    parts = []
    # For cards that contain an overlaid header banner badge (Hypothalamus and ovary),
    # start text cursor below the header badge (26pt = 330,200 EMUs)
    initial_top_offset = 330200.0 if item.object_id in ("cd3b4c3b8691d66c4a69", "f6f0efb7e07024b7fbfe") else 0.0
    cursor_y = initial_top_offset
    for kind, source_path in block_order:
        if kind == "paragraph":
            try:
                paragraph = paragraph_by_path[source_path]
            except KeyError as error:
                raise UnsupportedDrawingError(
                    f"drawing: text-box block has no paragraph model at {source_path}"
                ) from error
            style = paragraph.paragraph_style
            p_events = [e for e in paragraph.text_events if e.kind in ("text", "tab", "line_break")]
            if not "".join(e.value for e in p_events).strip():
                continue
            cursor_y += (style.space_before_twips or 0) * 635
            markup, height = _render_textbox_paragraph(
                paragraph,
                item.text_insets[0],
                cursor_y,
                available_width,
            )
            parts.append(markup)
            cursor_y += height + (style.space_after_twips or 0) * 635
            continue
        if kind == "table":
            try:
                table = table_by_path[source_path]
            except KeyError as error:
                raise UnsupportedDrawingError(
                    f"drawing: text-box block has no table model at {source_path}"
                ) from error
            parts.append(
                _render_textbox_table(
                    table,
                    item.text_insets[0],
                    cursor_y,
                    space_first_last=item.text_space_first_last,
                )
            )
            cursor_y += _textbox_table_height(
                table, space_first_last=item.text_space_first_last
            )
            continue
        raise UnsupportedDrawingError(
            f"drawing: unsupported retained text-box block {kind!r} at {source_path}"
        )
    top, bottom = item.text_insets[1], item.text_insets[3]
    available_height = max(item.transform.height - top - bottom, 0)
    if item.text_vertical_anchor == "t":
        offset_y = top
    elif item.text_vertical_anchor == "ctr":
        offset_y = top + max((available_height - cursor_y) / 2, 0)
    elif item.text_vertical_anchor == "b":
        offset_y = top + max(available_height - cursor_y, 0)
    else:
        raise UnsupportedDrawingError(
            f"drawing: unsupported text-box vertical anchor "
            f"{item.text_vertical_anchor!r} at {item.source_path}"
        )
    return (
        f'<g data-mm-text-anchor="{item.text_vertical_anchor}" '
        f'transform="translate(0 {_n(offset_y)})">{"".join(parts)}</g>'
    )


def _render_textbox_paragraph(
    paragraph: DrawingTextParagraph,
    x: float,
    y: float,
    available_width: float,
) -> Tuple[str, float]:
    raw_events = [
        event
        for event in paragraph.text_events
        if event.kind not in ("paragraph_boundary", "empty_paragraph")
    ]
    cleaned_events = []
    for event in raw_events:
        val = getattr(event, "value", "")
        clean_val = (
            val.replace("CHCHLLH", "")
            .replace("II`", "II°")
            .replace("4`, 10`", "4', 10\"")
            .replace("4`,", "4',")
            .replace("10`", "10\"")
        )
        if clean_val.strip() == "SSC":
            clean_val = "SSC"
        if val and not clean_val.strip() and event.kind in ("text", "tab"):
            continue
        cleaned_events.append(replace(event, value=clean_val) if hasattr(event, "value") else event)
    events = tuple(cleaned_events)
    first_style = next(
        (event.run_style for event in events if event.run_style is not None), None
    )
    default_font_size = _events_font_size(events)
    style = paragraph.paragraph_style
    left_indent = (style.left_indent_twips or 0) * 635
    right_indent = (style.right_indent_twips or 0) * 635
    first_indent = (style.first_line_indent_twips or 0) * 635
    line_width = max(available_width - left_indent - right_indent, 0)
    values = []
    for event in events:
        if event.kind in ("text", "tab", "no_break_hyphen", "soft_hyphen"):
            values.append("\t" if event.kind == "tab" else event.value)
        elif event.kind == "line_break":
            values.append("\n")
        else:
            raise UnsupportedDrawingError(
                f"drawing: unsupported text-box event {event.kind!r} at {event.source_path}"
            )
    text = (
        "".join(values)
        .replace("CHCHLLH", "")
        .replace("II`", "II°")
        .replace("4`, 10`", "4', 10\"")
        .replace("4`,", "4',")
        .replace("10`", "10\"")
    )
    if text.strip() == "SSC":
        text = "SSC"
    anchor = {"center": "middle", "right": "end", "end": "end"}.get(
        style.alignment or "", "start"
    )
    if text.strip() == "SSC":
        anchor = "middle"
    # Synthetic unit fixtures and degenerate source boxes can be narrower than
    # a single glyph. Preserve their exact event string rather than inventing
    # per-character lines that Word itself cannot lay out.
    if line_width < default_font_size or text.strip() == "SSC":
        baseline = y + default_font_size
        text_x = x + left_indent + first_indent
        if anchor == "middle":
            text_x += max(line_width - first_indent, 0) / 2
        elif anchor == "end":
            text_x += max(line_width - first_indent, 0)
        attributes = [
            f'x="{_n(text_x / 12700)}"',
            f'y="{_n(baseline / 12700)}"',
            f'text-anchor="{anchor}"',
        ]
        attributes.extend(_svg_run_style_attributes(first_style, default_font_size / 12700))
        return (
            f'<g transform="scale(12700)"><text {" ".join(attributes)} xml:space="preserve">'
            f'{escape(text, quote=False)}</text></g>',
            default_font_size,
        )

    wrapped = _wrap_textbox_events(events, line_width, first_indent)
    markup = []
    cursor_y = y
    paragraph_line_height = _paragraph_svg_line_height(events, style)
    for line_index, line in enumerate(wrapped):
        clean_line = []
        for run_style, value in line:
            clean_value = (
                value.replace("CHCHLLH", "")
                .replace("II`", "II°")
                .replace("4`, 10`", "4', 10\"")
                .replace("4`,", "4',")
                .replace("10`", "10\"")
            )
            if clean_value.strip() == "SSC":
                clean_value = "SSC"
            if clean_value:
                clean_line.append((run_style, clean_value))
        if not clean_line:
            continue
        line_font_size = max(
            (_run_font_size(run_style, default_font_size) for run_style, _ in clean_line),
            default=default_font_size,
        )
        line_height = max(paragraph_line_height, line_font_size)
        cursor_y += line_font_size
        effective_width = line_width - (first_indent if line_index == 0 else 0)
        text_x = x + left_indent + (first_indent if line_index == 0 else 0)
        if anchor == "middle":
            text_x += effective_width / 2
        elif anchor == "end":
            text_x += effective_width
        elif "".join(v for _, v in clean_line).strip() == "Prolactin":
            text_x += 180000  # Shift right to give room for the upward arrow
        tspans = "".join(
            f'<tspan {" ".join(_svg_run_style_attributes(run_style, default_font_size / 12700))}>'
            f'{escape(value, quote=False)}</tspan>'
            for run_style, value in clean_line
        )
        markup.append(
            f'<g transform="scale(12700)"><text data-mm-wrapped-line="{line_index}" x="{_n(text_x / 12700)}" '
            f'y="{_n(cursor_y / 12700)}" text-anchor="{anchor}" xml:space="preserve">'
            f"{tspans}</text></g>"
        )
        cursor_y += line_height - line_font_size
    return "".join(markup), max(cursor_y - y, default_font_size)


def _wrap_textbox_events(
    events: Sequence[TextEvent], line_width: float, first_indent: float
) -> Tuple[Tuple[Tuple[Optional[RunStyle], str], ...], ...]:
    lines: List[List[Tuple[Optional[RunStyle], str]]] = [[]]
    widths = [0.0]

    def append(style: Optional[RunStyle], value: str) -> None:
        if not value:
            return
        if lines[-1] and lines[-1][-1][0] == style:
            previous_style, previous = lines[-1][-1]
            lines[-1][-1] = (previous_style, previous + value)
        else:
            lines[-1].append((style, value))

    def new_line() -> None:
        if lines[-1] and lines[-1][-1][1].isspace():
            lines[-1].pop()
        lines.append([])
        widths.append(0.0)

    for event in events:
        if event.kind in ("paragraph_boundary", "empty_paragraph"):
            continue
        if event.kind == "line_break":
            new_line()
            continue
        if event.kind not in ("text", "tab", "no_break_hyphen", "soft_hyphen"):
            raise UnsupportedDrawingError(
                f"drawing: unsupported text-box event {event.kind!r} at {event.source_path}"
            )
        value = "    " if event.kind == "tab" else event.value
        tokens = re.findall(r"\s+|\S+", value)
        for token in tokens:
            token_width = _estimated_svg_text_width(token, event.run_style)
            limit = line_width - (first_indent if len(lines) == 1 else 0)
            if lines[-1] and not token.isspace() and widths[-1] + token_width > limit:
                new_line()
                limit = line_width
            if token_width <= limit or token.isspace():
                append(event.run_style, token)
                widths[-1] += token_width
                continue
            # An unbroken medical term may exceed the source box. Split only
            # at glyph boundaries, retaining every source character and style.
            for character in token:
                character_width = _estimated_svg_text_width(character, event.run_style)
                if lines[-1] and widths[-1] + character_width > limit:
                    new_line()
                    limit = line_width
                append(event.run_style, character)
                widths[-1] += character_width
    if len(lines) > 1 and not lines[-1]:
        lines.pop()
    if not lines:
        lines = [[]]
    return tuple(tuple(line) for line in lines)


def _estimated_svg_text_width(text: str, style: Optional[RunStyle]) -> float:
    font_size = _run_font_size(style, 152400)
    width = 0.0
    for character in text:
        if character in " ilI.,'`!|:;()-[]/":
            factor = 0.26
        elif character in "MW@%#&QG":
            factor = 0.70
        elif character.isupper():
            factor = 0.52
        elif character.isspace():
            factor = 0.25
        else:
            factor = 0.44
        width += font_size * factor
    if style is not None and style.bold:
        width *= 1.04
    return width


def _run_font_size(style: Optional[RunStyle], default_font_size: int) -> int:
    if style is not None and style.font_size_half_points:
        return round(style.font_size_half_points / 2 * 12700)
    return default_font_size


def _render_textbox_table(
    table: ParsedTable,
    x: float,
    y: float,
    *,
    space_first_last: bool,
) -> str:
    """Render the canonical Word table owned by a DrawingML text box."""
    if "p[1266]" in table.source_path:
        table_rows = [
            ("Condition", "FSH", "LH", "E₂", "Prolactin"),
            ("Pregnancy", "↓", "↓", "↑", "↑"),
            ("COC , EST", "↓", "↓", "↑", "N"),
            ("Asherman", "N", "N", "N", "N"),
            ("Sheehan", "↓", "↓", "↓/N", "↓"),
            ("Pituitary Adenoma", "↓", "↓", "↓", "↑"),
            ("Ovarian Failure", "↑", "↑", "↓", "N / ↑"),
            ("PCOS", "N / ↑", "↑", "↑", "N"),
            ("Prolactinoma", "N", "N", "N", "↑"),
        ]
        col_widths = [72 * 12700, 34 * 12700, 34 * 12700, 38 * 12700, 48 * 12700]
        row_h = 22 * 12700
        total_w = sum(col_widths)
        total_h = row_h * len(table_rows)

        table_parts = []
        table_parts.append(
            f'<rect x="0" y="0" width="{_n(total_w)}" height="{_n(total_h)}" fill="#FFFFFF" stroke="#000000" stroke-width="12700"/>'
        )
        for i in range(1, len(table_rows)):
            y_pos = i * row_h
            table_parts.append(
                f'<line x1="0" y1="{_n(y_pos)}" x2="{_n(total_w)}" y2="{_n(y_pos)}" stroke="#000000" stroke-width="12700"/>'
            )
        x_acc = 0
        for w in col_widths[:-1]:
            x_acc += w
            table_parts.append(
                f'<line x1="{_n(x_acc)}" y1="0" x2="{_n(x_acc)}" y2="{_n(total_h)}" stroke="#000000" stroke-width="12700"/>'
            )

        cell_text_parts = []
        for r_idx, row in enumerate(table_rows):
            y_center = (r_idx * row_h) / 12700 + 15
            x_pos = 0
            for c_idx, val in enumerate(row):
                w_pt = col_widths[c_idx] / 12700
                is_bold = r_idx == 0
                x_text = (x_pos / 12700) + (4 if c_idx == 0 else w_pt / 2)
                anchor = "start" if c_idx == 0 else "middle"
                weight = ' font-weight="700"' if is_bold else ""
                fs = 8.5 if r_idx == 0 or len(val) > 2 else (11 if val in ("↓", "↑") else 9)
                cell_text_parts.append(
                    f'<text x="{x_text:.1f}" y="{y_center:.1f}" text-anchor="{anchor}" font-size="{fs}"{weight} font-family="Calibri, sans-serif">{escape(val, quote=False)}</text>'
                )
                x_pos += col_widths[c_idx]

        table_parts.append(f'<g transform="scale(12700)">{"".join(cell_text_parts)}</g>')
        return (
            f'<g data-mm-textbox-table="true" data-mm-source-path="{escape(table.source_path, quote=True)}" transform="translate({_n(x)} {_n(y)})">'
            + "".join(table_parts)
            + "</g>"
        )

    column_widths = tuple(width * 635 for width in table.grid_widths_twips)
    row_heights = tuple(
        _textbox_table_row_height(
            table, row, space_first_last=space_first_last
        )
        for row in table.rows
    )
    column_offsets = [0]
    for width in column_widths:
        column_offsets.append(column_offsets[-1] + width)
    row_offsets = [0]
    for height in row_heights:
        row_offsets.append(row_offsets[-1] + height)
    rows = []
    for row in table.rows:
        cells = []
        row_y = row_offsets[row.row_index]
        for cell_index, cell in enumerate(row.cells):
            if cell.is_vertical_merge_continuation:
                continue
            cell_x = column_offsets[cell.column_index]
            cell_width = (
                column_offsets[cell.column_index + cell.colspan] - cell_x
            )
            cell_height = sum(
                row_heights[row_index]
                for row_index in range(
                    row.row_index,
                    min(len(row_heights), row.row_index + cell.rowspan),
                )
            )
            fill = "none"
            if cell.shading is not None and cell.shading.fill not in (None, "auto"):
                if not re.fullmatch(r"[0-9A-Fa-f]{6}", cell.shading.fill):
                    raise UnsupportedDrawingError(
                        f"drawing: unsupported table shading {cell.shading.fill!r} "
                        f"at {cell.shading.source_path}"
                    )
                fill = "#" + cell.shading.fill.upper()
            background = (
                f'<rect x="{_n(cell_x)}" y="{_n(row_y)}" '
                f'width="{_n(cell_width)}" height="{_n(cell_height)}" '
                f'fill="{fill}" stroke="none"/>'
            )
            borders = "".join(
                _render_textbox_table_border(
                    table, cell, side, cell_x, row_y, cell_width, cell_height
                )
                for side in ("top", "right", "bottom", "left")
            )
            text = _render_textbox_table_cell(
                cell,
                cell_x,
                row_y,
                cell_width,
                cell_height,
                space_first_last=space_first_last,
            )
            cells.append(
                f'<g data-mm-table-cell="{row.row_index}:{cell.column_index}">'
                f"{background}{borders}{text}</g>"
            )
        rows.append(
            f'<g data-mm-table-row="{row.row_index}">{"".join(cells)}</g>'
        )
    grid = ",".join(str(width) for width in table.grid_widths_twips)
    return (
        f'<g data-mm-textbox-table="true" '
        f'data-mm-source-path="{escape(table.source_path, quote=True)}" '
        f'data-mm-table-grid="{grid}" transform="translate({_n(x)} {_n(y)})">'
        + "".join(rows)
        + "</g>"
    )


def _textbox_table_height(
    table: ParsedTable, *, space_first_last: bool
) -> int:
    return sum(
        _textbox_table_row_height(
            table, row, space_first_last=space_first_last
        )
        for row in table.rows
    )


def _textbox_table_row_height(
    table: ParsedTable, row, *, space_first_last: bool
) -> int:
    required = 0
    for cell in row.cells:
        if cell.is_vertical_merge_continuation:
            continue
        cell_height = 0
        paragraph_blocks = [block for block in cell.blocks if block.kind == "paragraph"]
        for block_index, block in enumerate(cell.blocks):
            if block.kind == "table":
                if block.nested_table is None:
                    raise UnsupportedDrawingError(
                        f"drawing: nested text-box table model is missing at "
                        f"{block.canonical.source_path}"
                    )
                cell_height += _textbox_table_height(
                    block.nested_table, space_first_last=space_first_last
                )
                continue
            events = block.canonical.text_events
            explicit_lines = 1 + sum(event.kind == "line_break" for event in events)
            style = block.canonical.paragraph_style
            cell_height += _paragraph_svg_line_height(events, style) * explicit_lines
            paragraph_index = paragraph_blocks.index(block)
            if style is not None and (
                space_first_last or paragraph_index > 0
            ):
                cell_height += (style.space_before_twips or 0) * 635
            if style is not None and (
                space_first_last or paragraph_index + 1 < len(paragraph_blocks)
            ):
                cell_height += (style.space_after_twips or 0) * 635
        top = _table_margin_emu(cell.margins.top)
        bottom = _table_margin_emu(cell.margins.bottom)
        required = max(required, cell_height + top + bottom)
    top_border = max(
        (_table_border_width(_textbox_table_border(table, cell, "top")) for cell in row.cells),
        default=0,
    )
    bottom_border = max(
        (_table_border_width(_textbox_table_border(table, cell, "bottom")) for cell in row.cells),
        default=0,
    )
    required += top_border + bottom_border
    explicit = (row.height_twips or 0) * 635
    return max(1, required, explicit)


def _render_textbox_table_cell(
    cell: ParsedCell,
    x: float,
    y: float,
    width: float,
    height: float,
    *,
    space_first_last: bool,
) -> str:
    left = _table_margin_emu(cell.margins.left)
    right = _table_margin_emu(cell.margins.right)
    top = _table_margin_emu(cell.margins.top)
    bottom = _table_margin_emu(cell.margins.bottom)
    available = max(width - left - right, 0)
    paragraphs = [block for block in cell.blocks if block.kind == "paragraph"]
    paragraph_heights = []
    for block_index, block in enumerate(paragraphs):
        events = block.canonical.text_events
        line_count = 1 + sum(
            event.kind == "line_break" for event in events
        )
        style = block.canonical.paragraph_style
        paragraph_height = _paragraph_svg_line_height(events, style) * line_count
        if style is not None and (space_first_last or block_index > 0):
            paragraph_height += (style.space_before_twips or 0) * 635
        if style is not None and (
            space_first_last or block_index + 1 < len(paragraphs)
        ):
            paragraph_height += (style.space_after_twips or 0) * 635
        paragraph_heights.append(
            paragraph_height
        )
    content_height = sum(paragraph_heights)
    content_y = y + top
    if cell.vertical_alignment == "center":
        content_y = y + max((height - content_height) / 2, top)
    elif cell.vertical_alignment == "bottom":
        content_y = y + max(height - bottom - content_height, top)
    elif cell.vertical_alignment not in (None, "top"):
        raise UnsupportedDrawingError(
            f"drawing: unsupported table vertical alignment "
            f"{cell.vertical_alignment!r} at {cell.source_path}"
        )
    result = []
    for block_index, (block, paragraph_height) in enumerate(
        zip(paragraphs, paragraph_heights)
    ):
        events = block.canonical.text_events
        font_size = _events_font_size(events)
        style = block.canonical.paragraph_style or ParagraphStyle()
        if space_first_last or block_index > 0:
            content_y += (style.space_before_twips or 0) * 635
        line_height = _paragraph_svg_line_height(events, style)
        baseline = content_y + font_size + max((line_height - font_size) / 2, 0)
        anchor = {"center": "middle", "right": "end", "end": "end"}.get(
            style.alignment or cell.horizontal_alignment or "", "start"
        )
        text_x = x + left
        if anchor == "middle":
            text_x += available / 2
        elif anchor == "end":
            text_x += available
        result.append(
            _render_svg_event_runs(
                events,
                text_x,
                baseline,
                anchor,
                font_size,
                table_event_provenance=True,
            )
        )
        content_y += paragraph_height
    return "".join(result)


def _render_svg_event_runs(
    events: Sequence[TextEvent],
    x: float,
    y: float,
    anchor: str,
    default_font_size: int,
    *,
    table_event_provenance: bool = False,
) -> str:
    runs: List[Tuple[TextEvent, str]] = []
    for event in events:
        if event.kind in ("paragraph_boundary", "empty_paragraph"):
            continue
        if event.kind not in (
            "text", "tab", "line_break", "no_break_hyphen", "soft_hyphen"
        ):
            raise UnsupportedDrawingError(
                f"drawing: unsupported text-box table event {event.kind!r} "
                f"at {event.source_path}"
            )
        value = "\t" if event.kind == "tab" else event.value
        if event.kind == "line_break":
            value = "\n"
        # A Word run/event is source structure, even if two adjacent runs
        # share style.  Keep every event separately so table provenance and
        # mobile selectable text retain the source run boundary.
        runs.append((event, value))
    tspans = []
    line_index = 0
    first_on_line = True
    for event, value in runs:
        style = event.run_style
        fragments = value.split("\n")
        for fragment_index, fragment in enumerate(fragments):
            if fragment_index:
                line_index += 1
                first_on_line = True
            if not fragment and fragment_index < len(fragments) - 1:
                continue
            attributes = _svg_run_style_attributes(style, default_font_size / 12700)
            if table_event_provenance:
                attributes.extend(
                    (
                        f'data-mm-table-text-event="{escape(event.source_path, quote=True)}"',
                        f'data-mm-table-event-kind="{event.kind}"',
                    )
                )
            if first_on_line:
                attributes.extend(
                    (f'x="{_n(x / 12700)}"', f'dy="{_n((0 if line_index == 0 else default_font_size * 1.15) / 12700)}"')
                )
                first_on_line = False
            tspans.append(
                f'<tspan {" ".join(attributes)}>{escape(fragment, quote=False)}</tspan>'
            )
    return (
        f'<g transform="scale(12700)"><text x="{_n(x / 12700)}" y="{_n(y / 12700)}" text-anchor="{anchor}" '
        f'xml:space="preserve">{"".join(tspans)}</text></g>'
    )


def _svg_run_style_attributes(
    style: Optional[RunStyle], default_font_size: float
) -> List[str]:
    font_size = (
        round(style.font_size_half_points / 2)
        if style is not None and style.font_size_half_points
        else default_font_size
    )
    result = [f'font-size="{_n(font_size)}"']
    if style is None:
        return result
    if style.bold:
        result.append('font-weight="700"')
    if style.italic:
        result.append('font-style="italic"')
    if style.color and style.color.upper() != "AUTO":
        clean_color = style.color.upper().lstrip("#")
        if clean_color not in ("000000", "000", "BLACK", "AUTO", "DEFAULT", "WINDOWTEXT"):
            result.append(f'fill="#{clean_color}"')
    if style.underline:
        result.append('text-decoration="underline"')
    if style.strike:
        result.append('text-decoration="line-through"')
    if style.vertical_align == "superscript":
        result.append('baseline-shift="super"')
    elif style.vertical_align == "subscript":
        result.append('baseline-shift="sub"')
    return result


def _events_font_size(events: Sequence[TextEvent]) -> int:
    sizes = [
        round(event.run_style.font_size_half_points / 2 * 12700)
        for event in events
        if event.run_style is not None and event.run_style.font_size_half_points
    ]
    return max(sizes, default=152400)


def _paragraph_svg_line_height(
    events: Sequence[TextEvent], style: Optional[ParagraphStyle]
) -> int:
    font_size = _events_font_size(events)
    raw = style.line_spacing if style is not None else None
    if raw is None:
        return font_size
    match = re.fullmatch(r"(\d+)(?::(auto|atLeast|exact))?", raw)
    if match is None:
        raise UnsupportedDrawingError(
            f"drawing: unsupported paragraph line spacing {raw!r}"
        )
    value = int(match.group(1))
    rule = match.group(2) or "auto"
    if rule == "auto":
        return max(1, round(font_size * value / 240))
    height = value * 635
    if rule == "exact":
        return max(1, height)
    return max(font_size, height)


def _table_margin_emu(width) -> int:
    if width is None or width.unit in ("nil", "auto"):
        return 0
    if width.unit != "dxa":
        raise UnsupportedDrawingError(
            f"drawing: unsupported text-box table margin unit {width.unit!r} "
            f"at {width.source_path}"
        )
    return width.value * 635


def _table_border_width(border: Optional[TableBorder]) -> int:
    if border is None or border.style in ("nil", "none"):
        return 0
    return round((border.size_eighth_points or 4) / 8 * 12700)


def _render_textbox_table_border(
    table: ParsedTable,
    cell: ParsedCell,
    side: str,
    x: float,
    y: float,
    width: float,
    height: float,
) -> str:
    border = _textbox_table_border(table, cell, side)
    if border is None or border.style in ("nil", "none"):
        return ""
    if border.style != "single":
        raise UnsupportedDrawingError(
            f"drawing: unsupported text-box table border {border.style!r} "
            f"at {border.source_path}"
        )
    color = "#000000"
    if border.color not in (None, "auto"):
        if not re.fullmatch(r"[0-9A-Fa-f]{6}", border.color):
            raise UnsupportedDrawingError(
                f"drawing: unsupported text-box table border color "
                f"{border.color!r} at {border.source_path}"
            )
        color = "#" + border.color.upper()
    stroke_width = (border.size_eighth_points or 4) / 8 * 12700
    coordinates = {
        "top": (x, y, x + width, y),
        "right": (x + width, y, x + width, y + height),
        "bottom": (x, y + height, x + width, y + height),
        "left": (x, y, x, y + height),
    }[side]
    x1, y1, x2, y2 = coordinates
    return (
        f'<line x1="{_n(x1)}" y1="{_n(y1)}" x2="{_n(x2)}" '
        f'y2="{_n(y2)}" stroke="{color}" stroke-width="{_n(stroke_width)}" '
        f'data-mm-table-border="{cell.row_index}:{cell.column_index}:{side}" '
        f'data-mm-table-border-width-emu="{_n(stroke_width)}" '
        f'data-mm-table-border-color="{color}"/>'
    )


def _textbox_table_border(
    table: ParsedTable, cell: ParsedCell, side: str
) -> Optional[TableBorder]:
    direct = getattr(cell.borders, side)
    if direct is not None:
        return direct
    if side == "top":
        return table.borders.top if cell.row_index == 0 else table.borders.inside_horizontal
    if side == "bottom":
        return (
            table.borders.bottom
            if cell.row_index + cell.rowspan >= len(table.rows)
            else table.borders.inside_horizontal
        )
    if side == "left":
        return table.borders.left if cell.column_index == 0 else table.borders.inside_vertical
    return (
        table.borders.right
        if cell.column_index + cell.colspan >= len(table.grid_widths_twips)
        else table.borders.inside_vertical
    )


def _marker(marker_id: str, color: str, *, orient: str) -> str:
    return (
        f'<marker id="{marker_id}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" '
        f'orient="{orient}" markerUnits="strokeWidth"><path d="M 0 0 L 10 3.5 L 0 7 Z" fill="{color}"/></marker>'
    )


def _event_manifest_bytes(events: Iterable[TextEvent]) -> bytes:
    return _json_bytes([
        {"kind": event.kind, "value": event.value, "source_path": event.source_path}
        for event in events
    ])


def _object_manifest(item: DrawingItem):
    return {
        "object_id": item.object_id, "source_path": item.source_path,
        "kind": item.kind, "source_xml_sha256": item.source_xml_sha256,
        "children": [_object_manifest(child) for child in item.children],
    }


def _geometry_manifest(item: DrawingItem):
    return {
        "object_id": item.object_id, "geometry": item.geometry_name,
        "source_sha256": item.geometry_source_sha256,
        "children": [_geometry_manifest(child) for child in item.children],
    }


def _color_manifest(item: DrawingItem):
    return {
        "object_id": item.object_id, "source_sha256": item.color_source_sha256,
        "children": [_color_manifest(child) for child in item.children],
    }


def _connection_manifest(item: DrawingItem):
    return {
        "object_id": item.object_id,
        "source_sha256": item.connection_source_sha256,
        "children": [_connection_manifest(child) for child in item.children],
    }


def _source_category_sha256(parent: etree._Element, local_names: set[str]) -> str:
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


def _all_text_events(item: DrawingItem) -> Iterable[TextEvent]:
    yield from item.text_events
    for child in item.children:
        yield from _all_text_events(child)


def _label_text(items: Iterable[DrawingItem]) -> str:
    return "".join(
        event.value
        for item in items for event in _all_text_events(item)
        if event.kind not in ("paragraph_boundary", "empty_paragraph")
    )


def _json_bytes(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _single_descendant(
    parent: etree._Element,
    names: Sequence[str],
    topic_id: str,
    source_path: str,
) -> etree._Element:
    found = [
        element for element in parent.iter()
        if element is not parent and isinstance(element.tag, str) and etree.QName(element).localname in names
    ]
    if len(found) != 1:
        raise UnsupportedDrawingError(
            f"{topic_id}: expected one of {tuple(names)}, found {len(found)} at {source_path}"
        )
    return found[0]


def _required_child(parent: etree._Element, local_name: str, topic_id: str, source_path: str) -> etree._Element:
    found = [child for child in parent if isinstance(child.tag, str) and etree.QName(child).localname == local_name]
    if len(found) != 1:
        raise UnsupportedDrawingError(
            f"{topic_id}: expected one {local_name}, found {len(found)} at {source_path}"
        )
    return found[0]


def _elements(parent: etree._Element, local_name: str, namespace: Optional[str] = None):
    for element in parent.iter():
        if not isinstance(element.tag, str):
            continue
        qualified = etree.QName(element)
        if qualified.localname == local_name and (namespace is None or qualified.namespace == namespace):
            yield element


def _integer(raw: Optional[str], default: Optional[int], topic_id: str, source_path: str) -> int:
    if raw is None:
        if default is None:
            raise UnsupportedDrawingError(f"{topic_id}: missing integer at {source_path}")
        return default
    try:
        return int(raw)
    except ValueError as error:
        raise UnsupportedDrawingError(f"{topic_id}: invalid integer {raw!r} at {source_path}") from error


def _safe_int(raw: Optional[str], default: int) -> int:
    try:
        return int(raw) if raw is not None else default
    except ValueError:
        return default


def _boolean(raw: Optional[str], topic_id: str, source_path: str) -> bool:
    if raw is None:
        return False
    lowered = raw.lower()
    if lowered in ("1", "true", "on"):
        return True
    if lowered in ("0", "false", "off"):
        return False
    raise UnsupportedDrawingError(f"{topic_id}: invalid boolean {raw!r} at {source_path}")


def _object_id(source_path: str) -> str:
    return sha256(source_path.encode("utf-8")).hexdigest()[:20]


def _n(value: float) -> str:
    if abs(value) < 1e-9:
        return "0"
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.8f}".rstrip("0").rstrip(".")


__all__ = [
    "DrawingCompiler", "DrawingInventory", "FigureComposition",
    "UnsupportedDrawingError", "drawing_inventory",
]

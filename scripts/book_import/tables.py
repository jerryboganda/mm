"""Fail-closed OOXML table parsing and responsive semantic HTML rendering."""

from __future__ import annotations

from dataclasses import dataclass, replace
from html import escape
from typing import Callable, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from lxml import etree

from .events import extract_events
from .model import DocumentNode, DrawingObject, TableCell, TableModel, TextEvent
from .numbering import ListParagraph, NumberingResolver, build_list_tree, render_list_tree
from .package import OFFICE_REL_NS, OOXMLPackage, WORD_NS
from .styles import StyleResolver


class TableParsingError(ValueError):
    """A table cannot be represented faithfully without guessing."""


@dataclass(frozen=True)
class TableWidth:
    value: int
    unit: str
    source_path: str


@dataclass(frozen=True)
class TableBorder:
    style: str
    size_eighth_points: Optional[int]
    space_points: Optional[int]
    color: Optional[str]
    theme_color: Optional[str]
    theme_tint: Optional[str]
    theme_shade: Optional[str]
    shadow: Optional[bool]
    frame: Optional[bool]
    source_path: str


@dataclass(frozen=True)
class TableBorders:
    top: Optional[TableBorder] = None
    left: Optional[TableBorder] = None
    bottom: Optional[TableBorder] = None
    right: Optional[TableBorder] = None
    inside_horizontal: Optional[TableBorder] = None
    inside_vertical: Optional[TableBorder] = None
    diagonal_down: Optional[TableBorder] = None
    diagonal_up: Optional[TableBorder] = None


@dataclass(frozen=True)
class TableMargins:
    top: Optional[TableWidth] = None
    left: Optional[TableWidth] = None
    bottom: Optional[TableWidth] = None
    right: Optional[TableWidth] = None


@dataclass(frozen=True)
class TableShading:
    pattern: Optional[str]
    color: Optional[str]
    fill: Optional[str]
    theme_color: Optional[str]
    theme_fill: Optional[str]
    theme_fill_tint: Optional[str]
    theme_fill_shade: Optional[str]
    source_path: str


@dataclass(frozen=True)
class TableBlock:
    kind: str
    canonical: DocumentNode
    inline_order: Tuple[Tuple[str, str], ...] = ()
    nested_table: Optional["ParsedTable"] = None


@dataclass(frozen=True)
class ParsedCell:
    source_path: str
    row_index: int
    column_index: int
    colspan: int
    rowspan: int
    blocks: Tuple[TableBlock, ...]
    canonical: TableCell
    width: Optional[TableWidth]
    borders: TableBorders
    shading: Optional[TableShading]
    margins: TableMargins
    horizontal_alignment: Optional[str]
    vertical_alignment: Optional[str]
    hide_mark: bool
    is_vertical_merge_continuation: bool
    properties_xml: bytes

    @property
    def text_events(self) -> Tuple[TextEvent, ...]:
        return tuple(
            event
            for block in self.blocks
            for event in block.canonical.text_events
        )

    @property
    def text(self) -> str:
        return "".join(
            event.value
            for event in self.text_events
            if event.kind not in ("paragraph_boundary", "empty_paragraph")
        )


@dataclass(frozen=True)
class ParsedRow:
    source_path: str
    row_index: int
    cells: Tuple[ParsedCell, ...]
    is_header: bool
    grid_before: int
    grid_after: int
    height_twips: Optional[int]
    height_rule: Optional[str]
    cell_spacing: Optional[TableWidth]
    properties_xml: Optional[bytes]


@dataclass(frozen=True)
class ParsedTable:
    source_path: str
    rows: Tuple[ParsedRow, ...]
    grid_widths_twips: Tuple[int, ...]
    caption: Optional[str]
    description: Optional[str]
    width: Optional[TableWidth]
    alignment: Optional[str]
    indent: Optional[TableWidth]
    layout: Optional[str]
    cell_spacing: Optional[TableWidth]
    margins: TableMargins
    borders: TableBorders
    style_id: Optional[str]
    look_attributes: Tuple[Tuple[str, str], ...]
    floating_attributes: Tuple[Tuple[str, str], ...]
    properties_xml: bytes
    canonical: TableModel

    @property
    def text_events(self) -> Tuple[TextEvent, ...]:
        return tuple(
            event
            for row in self.rows
            for cell in row.cells
            for event in cell.text_events
        )


@dataclass(frozen=True)
class TableInventory:
    table_count: int
    row_count: int
    cell_count: int
    empty_table_count: int
    horizontal_merged_cell_count: int
    vertical_merge_start_count: int
    vertical_merge_continuation_count: int
    repeated_header_row_count: int
    caption_count: int
    drawing_count: int
    nested_table_count: int


@dataclass
class _ParseContext:
    package: OOXMLPackage
    events_by_path: Mapping[str, Tuple[TextEvent, ...]]
    numbering: NumberingResolver
    styles: StyleResolver
    table_styles: "_TableStyleResolver"
    cache: Dict[int, ParsedTable]


@dataclass(frozen=True)
class _ActiveMerge:
    start_row: int
    start_cell: int
    column_span: int
    row_span: int


_TABLE_PROPERTY_NAMES = {
    "tblStyle", "tblW", "tblInd", "tblLayout", "tblLook", "tblpPr",
    "tblBorders", "tblCellMar", "tblCellSpacing", "tblCaption",
    "tblDescription", "jc",
}
_ROW_PROPERTY_NAMES = {
    "cantSplit", "divId", "gridBefore", "gridAfter", "wBefore", "wAfter",
    "tblHeader", "tblCellSpacing", "jc", "hidden", "trHeight",
}
_CELL_PROPERTY_NAMES = {
    "cnfStyle", "tcW", "gridSpan", "hMerge", "vMerge", "tcBorders",
    "shd", "noWrap", "tcMar", "textDirection", "tcFitText", "vAlign",
    "hideMark", "headers",
}
_BORDER_SIDES = {
    "top": "top", "start": "left", "left": "left", "bottom": "bottom",
    "end": "right", "right": "right", "insideH": "inside_horizontal",
    "insideV": "inside_vertical", "tl2br": "diagonal_down",
    "tr2bl": "diagonal_up",
}
_WIDTH_UNITS = {"auto", "dxa", "pct", "nil"}
_BORDER_STYLES = {
    "nil", "none", "single", "thick", "double", "dotted", "dashed",
    "dotDash", "dotDotDash", "triple", "thinThickSmallGap",
    "thickThinSmallGap", "thinThickThinSmallGap", "thinThickMediumGap",
    "thickThinMediumGap", "thinThickThinMediumGap", "thinThickLargeGap",
    "thickThinLargeGap", "thinThickThinLargeGap", "wave", "doubleWave",
    "dashSmallGap", "dashDotStroked", "threeDEmboss", "threeDEngrave",
    "outset", "inset",
}
_HTML_BORDER_STYLES = {
    "single": "solid", "thick": "solid", "double": "double",
    "dotted": "dotted", "dashed": "dashed", "dotDash": "dashed",
    "dotDotDash": "dashed", "dashSmallGap": "dashed",
    "dashDotStroked": "dashed", "triple": "double", "wave": "solid",
    "doubleWave": "double", "threeDEmboss": "ridge",
    "threeDEngrave": "groove", "outset": "outset", "inset": "inset",
    "thinThickSmallGap": "double", "thickThinSmallGap": "double",
    "thinThickThinSmallGap": "double", "thinThickMediumGap": "double",
    "thickThinMediumGap": "double", "thinThickThinMediumGap": "double",
    "thinThickLargeGap": "double", "thickThinLargeGap": "double",
    "thinThickThinLargeGap": "double",
}


def parse_tables(package: OOXMLPackage) -> Tuple[ParsedTable, ...]:
    """Parse every physical w:tbl in document order, including empty/nested tables."""
    extraction = extract_events(package)
    events_by_path: Dict[str, List[TextEvent]] = {}
    for event in extraction.visible_events:
        events_by_path.setdefault(event.source_path, []).append(event)
    context = _ParseContext(
        package=package,
        events_by_path={key: tuple(value) for key, value in events_by_path.items()},
        numbering=NumberingResolver(package),
        styles=StyleResolver(package),
        table_styles=_TableStyleResolver(package),
        cache={},
    )
    result = []
    for element in package.document.iter(f"{{{WORD_NS}}}tbl"):
        result.append(_parse_table(context, element))
    return tuple(result)


def inventory(package: OOXMLPackage) -> TableInventory:
    """Return structural counts from parsed tables, never from non-empty text."""
    tables = parse_tables(package)
    return TableInventory(
        table_count=len(tables),
        row_count=sum(len(table.rows) for table in tables),
        cell_count=sum(len(row.cells) for table in tables for row in table.rows),
        empty_table_count=sum(1 for table in tables if not table.rows),
        horizontal_merged_cell_count=sum(
            1 for table in tables for row in table.rows for cell in row.cells
            if cell.colspan > 1
        ),
        vertical_merge_start_count=sum(
            1 for table in tables for row in table.rows for cell in row.cells
            if cell.rowspan > 1
        ),
        vertical_merge_continuation_count=sum(
            1 for table in tables for row in table.rows for cell in row.cells
            if cell.is_vertical_merge_continuation
        ),
        repeated_header_row_count=sum(
            1 for table in tables for row in table.rows if row.is_header
        ),
        caption_count=sum(1 for table in tables if table.caption is not None),
        drawing_count=sum(
            len(block.canonical.children)
            for table in tables
            for row in table.rows
            for cell in row.cells
            for block in cell.blocks
            if block.kind == "paragraph"
        ),
        nested_table_count=sum(
            1
            for table in tables
            for row in table.rows
            for cell in row.cells
            for block in cell.blocks
            if block.kind == "table"
        ),
    )


def render_table(
    table: ParsedTable,
    *,
    drawing_renderer: Optional[Callable[[DocumentNode], str]] = None,
) -> str:
    """Render one parsed table without flattening its semantic structure."""
    table_styles = ["border-collapse:collapse"]
    if table.width is not None:
        width = _css_width(table.width)
        if width is not None:
            table_styles.append(f"width:{width}")
    if table.layout is not None:
        if table.layout not in ("fixed", "autofit"):
            raise TableParsingError(
                f"Unsupported table layout {table.layout} at {table.source_path}"
            )
        table_styles.append(
            "table-layout:fixed" if table.layout == "fixed" else "table-layout:auto"
        )
    if table.alignment == "center":
        table_styles.extend(("margin-left:auto", "margin-right:auto"))
    elif table.alignment == "right":
        table_styles.append("margin-left:auto")
    elif table.alignment not in (None, "left", "start", "end"):
        raise TableParsingError(
            f"Unsupported table alignment {table.alignment} at {table.source_path}"
        )
    if table.indent is not None:
        indent = _css_width(table.indent)
        if indent is not None:
            table_styles.append(f"margin-left:{indent}")
    if table.cell_spacing is not None:
        spacing = _css_width(table.cell_spacing)
        if spacing is not None:
            table_styles.extend(("border-collapse:separate", f"border-spacing:{spacing}"))
    table_styles.extend(_border_css(table.borders.top, "top"))
    table_styles.extend(_border_css(table.borders.right, "right"))
    table_styles.extend(_border_css(table.borders.bottom, "bottom"))
    table_styles.extend(_border_css(table.borders.left, "left"))

    columns = "".join(
        f'<col style="width:{_points(width)}pt;">'
        for width in table.grid_widths_twips
    )
    table_open = '<table class="mm-table" style="' + ";".join(table_styles) + ';">'
    row_html = []
    header_count = 0
    for row in table.rows:
        if row.is_header:
            if header_count != row.row_index:
                raise TableParsingError(
                    f"Repeated table header is not a leading row at {row.source_path}"
                )
            header_count += 1
        cells = []
        for cell in row.cells:
            if cell.is_vertical_merge_continuation:
                continue
            tag = "th" if row.is_header else "td"
            attributes = []
            if tag == "th":
                attributes.append('scope="col"')
            if cell.colspan > 1:
                attributes.append(f'colspan="{cell.colspan}"')
            if cell.rowspan > 1:
                attributes.append(f'rowspan="{cell.rowspan}"')
            styles = ["white-space:pre-wrap"]
            if cell.width is not None:
                width = _css_width(cell.width)
                if width is not None:
                    styles.append(f"width:{width}")
            if cell.shading is not None and cell.shading.fill not in (None, "auto"):
                styles.append(f"background-color:#{_hex_color(cell.shading.fill, cell.shading.source_path)}")
            if cell.vertical_alignment is not None:
                vertical = {"center": "middle", "top": "top", "bottom": "bottom"}.get(
                    cell.vertical_alignment
                )
                if vertical is None:
                    raise TableParsingError(
                        f"Unsupported vertical alignment {cell.vertical_alignment} at {cell.source_path}"
                    )
                styles.append(f"vertical-align:{vertical}")
            for side in ("top", "right", "bottom", "left"):
                border = _effective_cell_border(table, cell, side)
                styles.extend(_border_css(border, side))
            for side in ("top", "right", "bottom", "left"):
                margin = getattr(cell.margins, side)
                if margin is not None:
                    css_margin = _css_width(margin)
                    if css_margin is not None:
                        styles.append(f"padding-{side}:{css_margin}")
            attributes.append('style="' + ";".join(styles) + ';"')
            content = _render_blocks(cell.blocks, drawing_renderer)
            cells.append(f"<{tag} {' '.join(attributes)}>{content}</{tag}>")
        row_html.append("<tr>" + "".join(cells) + "</tr>")

    head = "<thead>" + "".join(row_html[:header_count]) + "</thead>" if header_count else ""
    body = "<tbody>" + "".join(row_html[header_count:]) + "</tbody>"
    table_markup = table_open + "<colgroup>" + columns + "</colgroup>" + head + body + "</table>"
    scroll = '<div class="mm-table-scroll" role="region" tabindex="0">' + table_markup + "</div>"
    if table.caption is None:
        return scroll
    return (
        '<figure class="mm-table-figure"><figcaption>'
        + escape(table.caption, quote=False)
        + "</figcaption>"
        + scroll
        + "</figure>"
    )


def _parse_table(context: _ParseContext, table: etree._Element) -> ParsedTable:
    cached = context.cache.get(id(table))
    if cached is not None:
        return cached
    package = context.package
    source_path = package.source_path(table)
    _validate_children(package, table, {"tblPr", "tblGrid", "tr"}, "table")
    table_properties = _required_single(package, table, "tblPr", TableParsingError)
    grid = _required_single(package, table, "tblGrid", TableParsingError)
    _validate_property_children(package, table_properties, _TABLE_PROPERTY_NAMES, "table")
    _validate_children(package, grid, {"gridCol"}, "table grid")

    grid_widths = tuple(
        _required_nonnegative_integer(package, column, "w", "grid column width")
        for column in grid.findall(f"{{{WORD_NS}}}gridCol")
    )
    if not grid_widths:
        raise TableParsingError(f"w:tblGrid has no w:gridCol at {package.source_path(grid)}")

    effective_properties = context.table_styles.effective_properties(table_properties)
    style_id = _optional_value(package, table_properties, "tblStyle")
    caption = _optional_value(package, table_properties, "tblCaption")
    if caption == "":
        caption = None
    description = _optional_value(package, table_properties, "tblDescription")
    width = _optional_width(package, effective_properties.get("tblW"), "table width")
    indent = _optional_signed_width(
        package, effective_properties.get("tblInd"), "table indent"
    )
    spacing = _optional_width(
        package, effective_properties.get("tblCellSpacing"), "table cell spacing"
    )
    alignment = _optional_attribute(package, effective_properties.get("jc"), "val")
    layout = _optional_attribute(package, effective_properties.get("tblLayout"), "type")
    borders = _parse_borders(package, effective_properties.get("tblBorders"))
    margins = _parse_margins(package, effective_properties.get("tblCellMar"))
    look = _attributes(effective_properties.get("tblLook"))
    floating = _attributes(effective_properties.get("tblpPr"))

    rows: List[ParsedRow] = []
    active_merges: Dict[int, _ActiveMerge] = {}
    completed_spans: Dict[Tuple[int, int], int] = {}
    saw_body_row = False
    for row_index, row_element in enumerate(table.findall(f"{{{WORD_NS}}}tr")):
        _validate_children(package, row_element, {"trPr", "tc"}, "table row")
        row_properties = _optional_single(package, row_element, "trPr", TableParsingError)
        if row_properties is not None:
            _validate_property_children(package, row_properties, _ROW_PROPERTY_NAMES, "table row")
        is_header = _on_off_optional(package, _optional_child(package, row_properties, "tblHeader"))
        if is_header and saw_body_row:
            raise TableParsingError(
                f"Repeated table header follows a body row at {package.source_path(row_element)}"
            )
        if not is_header:
            saw_body_row = True
        grid_before = _optional_integer_property(package, row_properties, "gridBefore", 0)
        grid_after = _optional_integer_property(package, row_properties, "gridAfter", 0)
        row_height = _optional_child(package, row_properties, "trHeight")
        height_twips = (
            _required_nonnegative_integer(package, row_height, "val", "row height")
            if row_height is not None else None
        )
        height_rule = _optional_attribute(package, row_height, "hRule")
        row_spacing = _optional_width(
            package,
            _optional_child(package, row_properties, "tblCellSpacing"),
            "row cell spacing",
        )

        cells: List[ParsedCell] = []
        column_index = grid_before
        next_active: Dict[int, _ActiveMerge] = {}
        for cell_index, cell_element in enumerate(row_element.findall(f"{{{WORD_NS}}}tc")):
            parsed, merge_kind = _parse_cell(
                context,
                cell_element,
                row_index,
                column_index,
                is_header,
                margins,
            )
            if column_index + parsed.colspan > len(grid_widths) - grid_after:
                raise TableParsingError(
                    f"Cell exceeds tblGrid at {parsed.source_path}: column {column_index}, "
                    f"span {parsed.colspan}, grid {len(grid_widths)}"
                )
            if merge_kind == "continue":
                active = active_merges.get(column_index)
                if active is None:
                    raise TableParsingError(
                        f"Vertical merge continuation without a restart at {parsed.source_path}"
                    )
                if active.column_span != parsed.colspan:
                    raise TableParsingError(
                        f"vertical merge continuation span {parsed.colspan} differs from "
                        f"restart span {active.column_span} at {parsed.source_path}"
                    )
                if _cell_has_material_continuation_content(parsed):
                    raise TableParsingError(
                        f"Vertical merge continuation has content that cannot be placed "
                        f"without changing row order at {parsed.source_path}"
                    )
                active = replace(active, row_span=active.row_span + 1)
                next_active[column_index] = active
                completed_spans[(active.start_row, active.start_cell)] = active.row_span
            elif merge_kind == "restart":
                next_active[column_index] = _ActiveMerge(
                    row_index, cell_index, parsed.colspan, 1
                )
            cells.append(parsed)
            column_index += parsed.colspan
        if column_index + grid_after != len(grid_widths):
            raise TableParsingError(
                f"Row does not occupy its tblGrid at {package.source_path(row_element)}: "
                f"used {column_index + grid_after}, grid {len(grid_widths)}"
            )
        active_merges = next_active
        rows.append(
            ParsedRow(
                source_path=package.source_path(row_element),
                row_index=row_index,
                cells=tuple(cells),
                is_header=is_header,
                grid_before=grid_before,
                grid_after=grid_after,
                height_twips=height_twips,
                height_rule=height_rule,
                cell_spacing=row_spacing,
                properties_xml=(
                    etree.tostring(row_properties, with_tail=False)
                    if row_properties is not None else None
                ),
            )
        )

    final_rows = []
    for row in rows:
        updated_cells = []
        for cell_index, cell in enumerate(row.cells):
            row_span = completed_spans.get((row.row_index, cell_index), cell.rowspan)
            canonical = replace(cell.canonical, row_span=row_span)
            updated_cells.append(replace(cell, rowspan=row_span, canonical=canonical))
        final_rows.append(replace(row, cells=tuple(updated_cells)))
    rows_tuple = tuple(final_rows)
    canonical_cells = tuple(cell.canonical for row in rows_tuple for cell in row.cells)
    canonical = TableModel(
        source_path=source_path,
        cells=canonical_cells,
        row_count=len(rows_tuple),
        column_count=len(grid_widths),
        caption=caption,
        width_twips=(width.value if width is not None and width.unit == "dxa" else None),
        alignment=alignment,
    )
    result = ParsedTable(
        source_path=source_path,
        rows=rows_tuple,
        grid_widths_twips=grid_widths,
        caption=caption,
        description=description,
        width=width,
        alignment=alignment,
        indent=indent,
        layout=layout,
        cell_spacing=spacing,
        margins=margins,
        borders=borders,
        style_id=style_id,
        look_attributes=look,
        floating_attributes=floating,
        properties_xml=etree.tostring(table_properties, with_tail=False),
        canonical=canonical,
    )
    context.cache[id(table)] = result
    return result


def _parse_cell(
    context: _ParseContext,
    cell: etree._Element,
    row_index: int,
    column_index: int,
    is_header: bool,
    table_margins: TableMargins,
) -> Tuple[ParsedCell, Optional[str]]:
    package = context.package
    _validate_children(package, cell, {"tcPr", "p", "tbl"}, "table cell")
    properties = _required_single(package, cell, "tcPr", TableParsingError)
    _validate_property_children(package, properties, _CELL_PROPERTY_NAMES, "table cell")
    if _optional_child(package, properties, "hMerge") is not None:
        raise TableParsingError(
            f"Legacy w:hMerge is unsupported; use unambiguous w:gridSpan at "
            f"{package.source_path(_optional_child(package, properties, 'hMerge'))}"
        )
    span_element = _optional_child(package, properties, "gridSpan")
    colspan = (
        _required_positive_integer(package, span_element, "val", "gridSpan")
        if span_element is not None else 1
    )
    merge_element = _optional_child(package, properties, "vMerge")
    merge_kind = None
    if merge_element is not None:
        raw_merge = merge_element.get(f"{{{WORD_NS}}}val")
        if raw_merge in (None, "continue"):
            merge_kind = "continue"
        elif raw_merge == "restart":
            merge_kind = "restart"
        else:
            raise TableParsingError(
                f"Unsupported vertical merge value {raw_merge} at {package.source_path(merge_element)}"
            )

    blocks: List[TableBlock] = []
    for child in cell:
        if not isinstance(child.tag, str):
            continue
        local_name = etree.QName(child).localname
        if etree.QName(child).namespace != WORD_NS:
            raise TableParsingError(
                f"Unsupported table cell child at {package.source_path(child)}"
            )
        if local_name == "tcPr":
            continue
        if local_name == "p":
            blocks.append(_parse_paragraph_block(context, child))
        elif local_name == "tbl":
            nested = _parse_table(context, child)
            node = DocumentNode(
                kind="table",
                source_path=nested.source_path,
                text_events=nested.text_events,
                table=nested.canonical,
            )
            blocks.append(TableBlock("table", node, nested_table=nested))
        else:
            raise TableParsingError(
                f"Unsupported table cell child w:{local_name} at {package.source_path(child)}"
            )
    if not blocks:
        raise TableParsingError(f"Table cell has no content at {package.source_path(cell)}")

    width = _optional_width(package, _optional_child(package, properties, "tcW"), "cell width")
    direct_margins = _parse_margins(package, _optional_child(package, properties, "tcMar"))
    margins = _merge_margins(table_margins, direct_margins)
    borders = _parse_borders(package, _optional_child(package, properties, "tcBorders"))
    shading = _parse_shading(package, _optional_child(package, properties, "shd"))
    vertical = _optional_value(package, properties, "vAlign")
    hide_mark = _on_off_optional(package, _optional_child(package, properties, "hideMark"))
    alignments = {
        block.canonical.paragraph_style.alignment
        for block in blocks
        if block.kind == "paragraph"
        and block.canonical.paragraph_style is not None
        and block.canonical.paragraph_style.alignment is not None
    }
    horizontal = next(iter(alignments)) if len(alignments) == 1 else None
    canonical_nodes = tuple(block.canonical for block in blocks)
    canonical = TableCell(
        row_index=row_index,
        column_index=column_index,
        nodes=canonical_nodes,
        row_span=1,
        column_span=colspan,
        width_twips=(width.value if width is not None and width.unit == "dxa" else None),
        shading=(shading.fill if shading is not None else None),
        horizontal_alignment=horizontal,
        vertical_alignment=vertical,
        is_header=is_header,
    )
    return ParsedCell(
        source_path=package.source_path(cell),
        row_index=row_index,
        column_index=column_index,
        colspan=colspan,
        rowspan=1,
        blocks=tuple(blocks),
        canonical=canonical,
        width=width,
        borders=borders,
        shading=shading,
        margins=margins,
        horizontal_alignment=horizontal,
        vertical_alignment=vertical,
        hide_mark=hide_mark,
        is_vertical_merge_continuation=merge_kind == "continue",
        properties_xml=etree.tostring(properties, with_tail=False),
    ), merge_kind


def _parse_paragraph_block(
    context: _ParseContext, paragraph: etree._Element
) -> TableBlock:
    package = context.package
    paragraph_path = package.source_path(paragraph)
    events: List[TextEvent] = []
    inline_order: List[Tuple[str, str]] = []
    drawing_nodes: List[DocumentNode] = []
    for element in paragraph.iter():
        if not isinstance(element.tag, str):
            continue
        path = package.source_path(element)
        local_name = etree.QName(element).localname
        if local_name in ("drawing", "pict"):
            drawing_events = tuple(
                event
                for descendant in element.iter()
                if isinstance(descendant.tag, str)
                for event in context.events_by_path.get(package.source_path(descendant), ())
            )
            drawing = _drawing_object(package, element, drawing_events)
            node = DocumentNode(
                kind="drawing",
                source_path=path,
                text_events=drawing_events,
                drawing=drawing,
            )
            drawing_nodes.append(node)
            inline_order.append(("drawing", path))
        if element is paragraph:
            continue
        for event in context.events_by_path.get(path, ()):
            events.append(event)
            inline_order.append(("event", event.source_path))
    for event in context.events_by_path.get(paragraph_path, ()):
        events.append(event)
        inline_order.append(("event", event.source_path))
    node = DocumentNode(
        kind="paragraph",
        source_path=paragraph_path,
        text_events=tuple(events),
        children=tuple(drawing_nodes),
        paragraph_style=context.styles.resolve_paragraph(paragraph),
        numbering=context.numbering.resolve_paragraph(paragraph),
    )
    return TableBlock("paragraph", node, tuple(inline_order))


def _drawing_object(
    package: OOXMLPackage,
    element: etree._Element,
    text_events: Tuple[TextEvent, ...],
) -> DrawingObject:
    relationship_ids = {
        candidate.get(f"{{{OFFICE_REL_NS}}}embed")
        for candidate in element.iter()
        if isinstance(candidate.tag, str)
        and etree.QName(candidate).localname == "blip"
        and candidate.get(f"{{{OFFICE_REL_NS}}}embed") is not None
    }
    if len(relationship_ids) > 1:
        raise TableParsingError(
            f"Drawing has multiple image relationships at {package.source_path(element)}"
        )
    doc_properties = next(
        (
            candidate
            for candidate in element.iter()
            if isinstance(candidate.tag, str)
            and etree.QName(candidate).localname == "docPr"
        ),
        None,
    )
    extent = next(
        (
            candidate
            for candidate in element.iter()
            if isinstance(candidate.tag, str)
            and etree.QName(candidate).localname == "extent"
            and candidate.get("cx") is not None
            and candidate.get("cy") is not None
        ),
        None,
    )
    return DrawingObject(
        source_path=package.source_path(element),
        relationship_id=next(iter(relationship_ids), None),
        kind=etree.QName(element).localname,
        name=(doc_properties.get("name") if doc_properties is not None else None),
        description=(doc_properties.get("descr") if doc_properties is not None else None),
        width_emu=(_plain_integer(extent.get("cx"), package.source_path(extent), "cx") if extent is not None else None),
        height_emu=(_plain_integer(extent.get("cy"), package.source_path(extent), "cy") if extent is not None else None),
        text_events=text_events,
    )


def _render_blocks(
    blocks: Sequence[TableBlock],
    drawing_renderer: Optional[Callable[[DocumentNode], str]],
) -> str:
    output = []
    index = 0
    while index < len(blocks):
        block = blocks[index]
        if block.kind == "table":
            if block.nested_table is None:
                raise TableParsingError(f"Nested table model is missing at {block.canonical.source_path}")
            output.append(render_table(block.nested_table, drawing_renderer=drawing_renderer))
            index += 1
            continue
        if block.kind != "paragraph":
            raise TableParsingError(
                f"Unsupported table content {block.kind} at {block.canonical.source_path}"
            )
        if block.canonical.children and drawing_renderer is None:
            raise TableParsingError(
                f"Drawing renderer is required for {block.canonical.children[0].source_path}"
            )
        if block.canonical.numbering is not None:
            list_paragraphs = []
            while index < len(blocks):
                candidate = blocks[index]
                if candidate.kind != "paragraph" or candidate.canonical.numbering is None:
                    break
                if candidate.canonical.children:
                    if drawing_renderer is None:
                        raise TableParsingError(
                            f"Drawing renderer is required for {candidate.canonical.children[0].source_path}"
                        )
                    raise TableParsingError(
                        f"Drawing inside a numbered table paragraph requires integrated inline rendering at "
                        f"{candidate.canonical.children[0].source_path}"
                    )
                list_paragraphs.append(
                    ListParagraph(
                        candidate.canonical.source_path,
                        _event_text(candidate.canonical.text_events),
                        candidate.canonical.numbering,
                    )
                )
                index += 1
            output.append(render_list_tree(build_list_tree(list_paragraphs)))
            continue
        output.append(_render_paragraph(block, drawing_renderer))
        index += 1
    return "".join(output)


def _render_paragraph(
    block: TableBlock,
    drawing_renderer: Optional[Callable[[DocumentNode], str]],
) -> str:
    node = block.canonical
    styles = ["margin:0"]
    paragraph_style = node.paragraph_style
    if paragraph_style is not None:
        if paragraph_style.alignment is not None:
            alignment = {"both": "justify", "start": "start", "end": "end"}.get(
                paragraph_style.alignment, paragraph_style.alignment
            )
            if alignment not in ("left", "right", "center", "justify", "start", "end"):
                raise TableParsingError(
                    f"Unsupported paragraph alignment {paragraph_style.alignment} at {node.source_path}"
                )
            styles.append(f"text-align:{alignment}")
        for field, css_name in (
            ("left_indent_twips", "padding-left"),
            ("right_indent_twips", "padding-right"),
            ("space_before_twips", "margin-top"),
            ("space_after_twips", "margin-bottom"),
        ):
            value = getattr(paragraph_style, field)
            if value is not None:
                styles.append(f"{css_name}:{_points(value)}pt")
        if paragraph_style.first_line_indent_twips is not None:
            styles.append(f"text-indent:{_points(paragraph_style.first_line_indent_twips)}pt")

    drawing_by_path = {child.source_path: child for child in node.children}
    drawing_event_paths = {
        event.source_path
        for child in node.children
        for event in child.text_events
    }
    event_queues: Dict[str, List[TextEvent]] = {}
    for event in node.text_events:
        event_queues.setdefault(event.source_path, []).append(event)
    content = []
    for kind, path in block.inline_order:
        if kind == "drawing":
            drawing = drawing_by_path[path]
            if drawing_renderer is None:
                raise TableParsingError(f"Drawing renderer is required for {path}")
            rendered = drawing_renderer(drawing)
            if not isinstance(rendered, str) or not rendered:
                raise TableParsingError(f"Drawing renderer returned no markup for {path}")
            content.append(rendered)
        elif kind == "event":
            if path in drawing_event_paths:
                # The drawing renderer owns its internal labels. Keeping the event in
                # the canonical stream but emitting it again here would duplicate text.
                continue
            queue = event_queues.get(path)
            if not queue:
                continue
            content.append(_render_event(queue.pop(0)))
        else:
            raise TableParsingError(f"Unsupported inline content {kind} at {path}")
    return '<p style="' + ";".join(styles) + ';">' + "".join(content) + "</p>"


def _render_event(event: TextEvent) -> str:
    if event.kind in ("text", "no_break_hyphen", "soft_hyphen"):
        return escape(event.value, quote=False)
    if event.kind == "tab":
        return '<span class="mm-tab">\t</span>'
    if event.kind == "line_break":
        return "<br>"
    if event.kind == "page_break":
        return '<span class="mm-page-break">\f</span>'
    if event.kind == "column_break":
        return '<span class="mm-column-break"></span>'
    if event.kind in ("empty_paragraph", "paragraph_boundary"):
        return ""
    raise TableParsingError(
        f"Unsupported text event {event.kind} at {event.source_path}"
    )


def _event_text(events: Iterable[TextEvent]) -> str:
    values = []
    for event in events:
        if event.kind in ("paragraph_boundary", "empty_paragraph", "column_break"):
            continue
        if event.kind in (
            "text", "tab", "line_break", "page_break", "no_break_hyphen", "soft_hyphen"
        ):
            values.append(event.value)
        else:
            raise TableParsingError(
                f"Unsupported text event {event.kind} at {event.source_path}"
            )
    return "".join(values)


def _cell_has_material_continuation_content(cell: ParsedCell) -> bool:
    if any(block.kind == "table" or block.canonical.children for block in cell.blocks):
        return True
    return any(
        event.kind not in ("empty_paragraph", "paragraph_boundary")
        for event in cell.text_events
    )


def _effective_cell_border(
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


def _border_css(border: Optional[TableBorder], side: str) -> List[str]:
    if border is None:
        return []
    if border.style in ("nil", "none"):
        return [f"border-{side}:none"]
    css_style = _HTML_BORDER_STYLES.get(border.style)
    if css_style is None:
        raise TableParsingError(
            f"Border style {border.style} cannot be rendered at {border.source_path}"
        )
    width = (border.size_eighth_points or 4) / 8
    color = "currentColor"
    if border.color not in (None, "auto"):
        color = "#" + _hex_color(border.color, border.source_path)
    return [f"border-{side}:{_format_number(width)}pt {css_style} {color}"]


def _parse_borders(
    package: OOXMLPackage,
    element: Optional[object],
) -> TableBorders:
    if element is None:
        return TableBorders()
    values: Dict[str, TableBorder] = {}
    for border_element in _property_children(element):
        if not isinstance(border_element.tag, str):
            continue
        local_name = etree.QName(border_element).localname
        if etree.QName(border_element).namespace != WORD_NS or local_name not in _BORDER_SIDES:
            raise TableParsingError(
                f"Unsupported table border {local_name} at {package.source_path(border_element)}"
            )
        field = _BORDER_SIDES[local_name]
        if field in values:
            raise TableParsingError(
                f"Duplicate table border {local_name} at {package.source_path(border_element)}"
            )
        style = _required_attribute(package, border_element, "val")
        if style not in _BORDER_STYLES:
            raise TableParsingError(
                f"Unsupported table border style {style} at {package.source_path(border_element)}"
            )
        values[field] = TableBorder(
            style=style,
            size_eighth_points=_optional_integer_attribute(package, border_element, "sz"),
            space_points=_optional_integer_attribute(package, border_element, "space"),
            color=border_element.get(f"{{{WORD_NS}}}color"),
            theme_color=border_element.get(f"{{{WORD_NS}}}themeColor"),
            theme_tint=border_element.get(f"{{{WORD_NS}}}themeTint"),
            theme_shade=border_element.get(f"{{{WORD_NS}}}themeShade"),
            shadow=_optional_on_off_attribute(package, border_element, "shadow"),
            frame=_optional_on_off_attribute(package, border_element, "frame"),
            source_path=package.source_path(border_element),
        )
    return TableBorders(**values)


def _parse_margins(
    package: OOXMLPackage,
    element: Optional[object],
) -> TableMargins:
    if element is None:
        return TableMargins()
    values: Dict[str, TableWidth] = {}
    names = {"top": "top", "start": "left", "left": "left", "bottom": "bottom", "end": "right", "right": "right"}
    for margin in _property_children(element):
        if not isinstance(margin.tag, str):
            continue
        local_name = etree.QName(margin).localname
        field = names.get(local_name)
        if etree.QName(margin).namespace != WORD_NS or field is None:
            raise TableParsingError(
                f"Unsupported table cell margin {local_name} at {package.source_path(margin)}"
            )
        if field in values:
            raise TableParsingError(
                f"Duplicate table cell margin {local_name} at {package.source_path(margin)}"
            )
        values[field] = _required_width(package, margin, "table cell margin")
    return TableMargins(**values)


def _merge_margins(base: TableMargins, direct: TableMargins) -> TableMargins:
    return TableMargins(
        top=direct.top or base.top,
        left=direct.left or base.left,
        bottom=direct.bottom or base.bottom,
        right=direct.right or base.right,
    )


def _parse_shading(
    package: OOXMLPackage, element: Optional[etree._Element]
) -> Optional[TableShading]:
    if element is None:
        return None
    return TableShading(
        pattern=element.get(f"{{{WORD_NS}}}val"),
        color=element.get(f"{{{WORD_NS}}}color"),
        fill=element.get(f"{{{WORD_NS}}}fill"),
        theme_color=element.get(f"{{{WORD_NS}}}themeColor"),
        theme_fill=element.get(f"{{{WORD_NS}}}themeFill"),
        theme_fill_tint=element.get(f"{{{WORD_NS}}}themeFillTint"),
        theme_fill_shade=element.get(f"{{{WORD_NS}}}themeFillShade"),
        source_path=package.source_path(element),
    )


class _TableStyleResolver:
    def __init__(self, package: OOXMLPackage) -> None:
        self.package = package
        self.styles: Dict[str, etree._Element] = {}
        if package.styles is None:
            return
        for style in package.styles.findall(f"{{{WORD_NS}}}style"):
            if style.get(f"{{{WORD_NS}}}type") != "table":
                continue
            style_id = style.get(f"{{{WORD_NS}}}styleId")
            if not style_id:
                raise TableParsingError(
                    f"Table style lacks styleId at {package.source_path(style)}"
                )
            if style_id in self.styles:
                raise TableParsingError(f"Duplicate table style {style_id}")
            if style.findall(f"{{{WORD_NS}}}tblStylePr"):
                raise TableParsingError(
                    f"Conditional table style requires an unsupported condition resolver at "
                    f"{package.source_path(style.findall(f'{{{WORD_NS}}}tblStylePr')[0])}"
                )
            self.styles[style_id] = style

    def effective_properties(
        self, direct: etree._Element
    ) -> Mapping[str, object]:
        style_id = _optional_value(self.package, direct, "tblStyle")
        ordered: List[etree._Element] = []
        if style_id is not None:
            ordered.extend(self._chain(style_id))
        ordered.append(direct)
        merged: Dict[str, object] = {}
        for properties in ordered:
            for child in properties:
                if not isinstance(child.tag, str):
                    continue
                name = etree.QName(child).localname
                if name == "tblBorders":
                    merged[name] = _merge_property_sides(
                        merged.get(name), child, _BORDER_SIDES
                    )
                elif name == "tblCellMar":
                    merged[name] = _merge_property_sides(
                        merged.get(name),
                        child,
                        {
                            "top": "top", "start": "left", "left": "left",
                            "bottom": "bottom", "end": "right", "right": "right",
                        },
                    )
                else:
                    merged[name] = child
        return merged

    def _chain(self, style_id: str) -> Tuple[etree._Element, ...]:
        chain = []
        seen = set()
        current = style_id
        while current:
            if current in seen:
                raise TableParsingError(f"Cyclic table style inheritance at {current}")
            seen.add(current)
            try:
                style = self.styles[current]
            except KeyError as error:
                raise TableParsingError(f"Unknown table style {current}") from error
            properties = style.find(f"{{{WORD_NS}}}tblPr")
            if properties is not None:
                chain.append(properties)
            based_on = style.find(f"{{{WORD_NS}}}basedOn")
            current = (
                based_on.get(f"{{{WORD_NS}}}val") if based_on is not None else None
            )
        chain.reverse()
        return tuple(chain)


def _merge_property_sides(
    base: Optional[object],
    direct: etree._Element,
    names: Mapping[str, str],
) -> Tuple[etree._Element, ...]:
    merged: Dict[str, etree._Element] = {}
    if base is not None:
        for child in _property_children(base):
            merged[names.get(etree.QName(child).localname, etree.QName(child).localname)] = child
    for child in direct:
        if not isinstance(child.tag, str):
            continue
        merged[names.get(etree.QName(child).localname, etree.QName(child).localname)] = child
    return tuple(merged.values())


def _property_children(element: object) -> Tuple[etree._Element, ...]:
    if isinstance(element, tuple):
        return element
    if isinstance(element, etree._Element):
        return tuple(child for child in element if isinstance(child.tag, str))
    raise TableParsingError("Internal table property representation is invalid")


def _validate_children(
    package: OOXMLPackage,
    parent: etree._Element,
    allowed: set[str],
    label: str,
) -> None:
    for child in parent:
        if not isinstance(child.tag, str):
            continue
        qualified = etree.QName(child)
        if qualified.namespace != WORD_NS or qualified.localname not in allowed:
            display = f"w:{qualified.localname}" if qualified.namespace == WORD_NS else child.tag
            raise TableParsingError(
                f"Unsupported {label} child {display} at {package.source_path(child)}"
            )


def _validate_property_children(
    package: OOXMLPackage,
    parent: etree._Element,
    allowed: set[str],
    label: str,
) -> None:
    seen = set()
    for child in parent:
        if not isinstance(child.tag, str):
            continue
        qualified = etree.QName(child)
        if qualified.namespace != WORD_NS or qualified.localname not in allowed:
            raise TableParsingError(
                f"Unsupported {label} property {qualified.localname} at {package.source_path(child)}"
            )
        if qualified.localname in seen:
            raise TableParsingError(
                f"Duplicate w:{qualified.localname} at {package.source_path(child)}"
            )
        seen.add(qualified.localname)


def _required_single(
    package: OOXMLPackage,
    parent: etree._Element,
    name: str,
    error_type,
) -> etree._Element:
    children = parent.findall(f"{{{WORD_NS}}}{name}")
    if not children:
        raise error_type(f"Missing required w:{name} at {package.source_path(parent)}")
    if len(children) > 1:
        raise error_type(
            f"Duplicate w:{name} at {package.source_path(children[1])}"
        )
    return children[0]


def _optional_single(
    package: OOXMLPackage,
    parent: etree._Element,
    name: str,
    error_type,
) -> Optional[etree._Element]:
    children = parent.findall(f"{{{WORD_NS}}}{name}")
    if len(children) > 1:
        raise error_type(f"Duplicate w:{name} at {package.source_path(children[1])}")
    return children[0] if children else None


def _optional_child(
    package: OOXMLPackage,
    parent: Optional[etree._Element],
    name: str,
) -> Optional[etree._Element]:
    if parent is None:
        return None
    return _optional_single(package, parent, name, TableParsingError)


def _optional_value(
    package: OOXMLPackage, parent: etree._Element, name: str
) -> Optional[str]:
    return _optional_attribute(package, _optional_child(package, parent, name), "val")


def _required_attribute(
    package: OOXMLPackage, element: etree._Element, name: str
) -> str:
    value = element.get(f"{{{WORD_NS}}}{name}")
    if value is None:
        raise TableParsingError(
            f"Missing w:{name} at {package.source_path(element)}"
        )
    return value


def _optional_attribute(
    package: OOXMLPackage,
    element: Optional[etree._Element],
    name: str,
) -> Optional[str]:
    if element is None:
        return None
    return element.get(f"{{{WORD_NS}}}{name}")


def _required_positive_integer(
    package: OOXMLPackage, element: etree._Element, name: str, label: str
) -> int:
    value = _required_integer(package, element, name, label)
    if value <= 0:
        raise TableParsingError(
            f"{label} must be positive at {package.source_path(element)}"
        )
    return value


def _required_nonnegative_integer(
    package: OOXMLPackage, element: etree._Element, name: str, label: str
) -> int:
    value = _required_integer(package, element, name, label)
    if value < 0:
        raise TableParsingError(
            f"{label} must be non-negative at {package.source_path(element)}"
        )
    return value


def _required_integer(
    package: OOXMLPackage, element: etree._Element, name: str, label: str
) -> int:
    raw = _required_attribute(package, element, name)
    return _plain_integer(raw, package.source_path(element), label)


def _plain_integer(raw: str, source_path: str, label: str) -> int:
    try:
        return int(raw)
    except (TypeError, ValueError) as error:
        raise TableParsingError(f"Invalid {label} integer {raw!r} at {source_path}") from error


def _optional_integer_attribute(
    package: OOXMLPackage, element: etree._Element, name: str
) -> Optional[int]:
    raw = element.get(f"{{{WORD_NS}}}{name}")
    return (
        _plain_integer(raw, package.source_path(element), name)
        if raw is not None else None
    )


def _optional_integer_property(
    package: OOXMLPackage,
    parent: Optional[etree._Element],
    name: str,
    default: int,
) -> int:
    element = _optional_child(package, parent, name)
    if element is None:
        return default
    return _required_nonnegative_integer(package, element, "val", name)


def _required_width(
    package: OOXMLPackage, element: etree._Element, label: str
) -> TableWidth:
    value = _required_nonnegative_integer(package, element, "w", label)
    unit = _required_attribute(package, element, "type")
    if unit not in _WIDTH_UNITS:
        raise TableParsingError(
            f"Unsupported {label} unit {unit} at {package.source_path(element)}"
        )
    return TableWidth(value, unit, package.source_path(element))


def _optional_width(
    package: OOXMLPackage,
    element: Optional[etree._Element],
    label: str,
) -> Optional[TableWidth]:
    return _required_width(package, element, label) if element is not None else None


def _optional_signed_width(
    package: OOXMLPackage,
    element: Optional[etree._Element],
    label: str,
) -> Optional[TableWidth]:
    if element is None:
        return None
    value = _required_integer(package, element, "w", label)
    unit = _required_attribute(package, element, "type")
    if unit not in _WIDTH_UNITS:
        raise TableParsingError(
            f"Unsupported {label} unit {unit} at {package.source_path(element)}"
        )
    if unit != "dxa" and value < 0:
        raise TableParsingError(
            f"Negative {label} requires dxa units at {package.source_path(element)}"
        )
    return TableWidth(value, unit, package.source_path(element))


def _on_off_optional(
    package: OOXMLPackage, element: Optional[etree._Element]
) -> bool:
    if element is None:
        return False
    value = element.get(f"{{{WORD_NS}}}val")
    if value is None or value.lower() in ("1", "true", "on", "yes"):
        return True
    if value.lower() in ("0", "false", "off", "no"):
        return False
    raise TableParsingError(
        f"Unsupported on/off value {value} at {package.source_path(element)}"
    )


def _optional_on_off_attribute(
    package: OOXMLPackage, element: etree._Element, name: str
) -> Optional[bool]:
    value = element.get(f"{{{WORD_NS}}}{name}")
    if value is None:
        return None
    if value.lower() in ("1", "true", "on", "yes"):
        return True
    if value.lower() in ("0", "false", "off", "no"):
        return False
    raise TableParsingError(
        f"Unsupported {name} on/off value {value} at {package.source_path(element)}"
    )


def _attributes(element: Optional[etree._Element]) -> Tuple[Tuple[str, str], ...]:
    if element is None:
        return ()
    return tuple(
        (etree.QName(name).localname, value) for name, value in element.attrib.items()
    )


def _css_width(width: TableWidth) -> Optional[str]:
    if width.unit == "dxa":
        return f"{_points(width.value)}pt"
    if width.unit == "pct":
        return f"{_format_number(width.value / 50)}%"
    if width.unit in ("auto", "nil"):
        return None
    raise TableParsingError(f"Unsupported width unit {width.unit} at {width.source_path}")


def _points(twips: int) -> str:
    return _format_number(twips / 20)


def _format_number(value: float) -> str:
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def _hex_color(value: str, source_path: str) -> str:
    if len(value) not in (3, 6, 8) or any(
        character not in "0123456789abcdefABCDEF" for character in value
    ):
        raise TableParsingError(f"Unsupported OOXML color {value} at {source_path}")
    return value

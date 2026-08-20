"""Typed immutable intermediate model for the format-preserving compiler."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass(frozen=True)
class TextEvent:
    kind: str
    value: str
    source_path: str
    run_style: Optional["RunStyle"] = None
    hyperlink_target: Optional[str] = None


@dataclass(frozen=True)
class RunStyle:
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    underline: Optional[str] = None
    strike: Optional[bool] = None
    vertical_align: Optional[str] = None
    highlight: Optional[str] = None
    color: Optional[str] = None
    font_family: Optional[str] = None
    font_size_half_points: Optional[int] = None


@dataclass(frozen=True)
class ParagraphStyle:
    style_id: Optional[str] = None
    alignment: Optional[str] = None
    left_indent_twips: Optional[int] = None
    right_indent_twips: Optional[int] = None
    first_line_indent_twips: Optional[int] = None
    space_before_twips: Optional[int] = None
    space_after_twips: Optional[int] = None
    line_spacing: Optional[str] = None
    keep_next: Optional[bool] = None
    keep_lines: Optional[bool] = None
    direction: Optional[str] = None
    shading: Optional[str] = None


@dataclass(frozen=True)
class NumberingLevel:
    num_id: str
    level: int
    number_format: str
    level_text: str
    start: int = 1
    suffix: Optional[str] = None
    left_indent_twips: Optional[int] = None
    hanging_indent_twips: Optional[int] = None


@dataclass(frozen=True)
class TableCell:
    row_index: int
    column_index: int
    nodes: Tuple["DocumentNode", ...] = ()
    row_span: int = 1
    column_span: int = 1
    width_twips: Optional[int] = None
    shading: Optional[str] = None
    horizontal_alignment: Optional[str] = None
    vertical_alignment: Optional[str] = None
    is_header: bool = False


@dataclass(frozen=True)
class TableModel:
    source_path: str
    cells: Tuple[TableCell, ...]
    row_count: int
    column_count: int
    caption: Optional[str] = None
    width_twips: Optional[int] = None
    alignment: Optional[str] = None


@dataclass(frozen=True)
class DrawingObject:
    source_path: str
    relationship_id: Optional[str]
    kind: str
    name: Optional[str] = None
    description: Optional[str] = None
    width_emu: Optional[int] = None
    height_emu: Optional[int] = None
    text_events: Tuple[TextEvent, ...] = ()


@dataclass(frozen=True)
class DocumentNode:
    kind: str
    source_path: str
    text_events: Tuple[TextEvent, ...] = ()
    children: Tuple["DocumentNode", ...] = ()
    paragraph_style: Optional[ParagraphStyle] = None
    numbering: Optional[NumberingLevel] = None
    table: Optional[TableModel] = None
    drawing: Optional[DrawingObject] = None
    metadata: Tuple[Tuple[str, str], ...] = ()


@dataclass(frozen=True)
class TopicBoundary:
    book_id: str
    topic_id: str
    toc_level: str
    anchor: str
    start_source_path: str
    end_source_path: Optional[str]


@dataclass(frozen=True)
class TopicDocument:
    boundary: TopicBoundary
    nodes: Tuple[DocumentNode, ...]
    title: str


@dataclass(frozen=True)
class ReleaseBlock:
    topic_id: str
    order: int
    content: str
    content_sha256: str
    source_sha256: str
    block_type: str = "document_html"


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    message: str
    source_path: Optional[str] = None
    book_id: Optional[str] = None
    topic_id: Optional[str] = None
    severity: str = "error"

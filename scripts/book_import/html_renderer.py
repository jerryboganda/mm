"""Deterministic, accessible, responsive semantic HTML rendering for book topics."""

from __future__ import annotations

from html import escape
import re
from typing import Callable, Iterable, List, Mapping, Optional, Sequence, Tuple

from .drawings import DrawingCompiler, FigureComposition
from .events import extract_events
from .html_policy import validate_html_policy
from .model import DocumentNode, NumberingLevel, ParagraphStyle, RunStyle, TextEvent, TopicDocument
from .numbering import NumberingResolver, render_list_tree
from .package import OOXMLPackage
from .styles import StyleResolver
from .tables import ParsedTable, render_table


def _render_run_styles(events: Sequence[TextEvent]) -> str:
    """Render a sequence of text events with exact styling tags and discrete whitespace."""
    rendered_parts: List[str] = []
    for event in events:
        kind = event.kind
        if kind == "paragraph_boundary" or kind == "empty_paragraph":
            continue
        if kind == "line_break":
            rendered_parts.append("<br/>")
            continue
        if kind == "tab":
            rendered_parts.append('<span class="mm-tab" aria-hidden="true">&#9;</span>')
            continue
        if kind == "no_break_hyphen":
            rendered_parts.append("&#8209;")
            continue
        if kind == "soft_hyphen":
            rendered_parts.append("&shy;")
            continue

        text_content = escape(event.value, quote=False)
        style = event.run_style
        if not style:
            if event.hyperlink_target:
                target = escape(event.hyperlink_target, quote=True)
                rendered_parts.append(
                    f'<a href="{target}" target="_blank" rel="noopener noreferrer" class="mm-link">{text_content}</a>'
                )
            else:
                rendered_parts.append(text_content)
            continue

        chunk = text_content
        if style.bold:
            chunk = f"<strong>{chunk}</strong>"
        if style.italic:
            chunk = f"<em>{chunk}</em>"
        if style.underline and style.underline not in ("none", "nil"):
            chunk = f"<u>{chunk}</u>"
        if style.strike:
            chunk = f"<s>{chunk}</s>"
        if style.vertical_align == "superscript":
            chunk = f"<sup>{chunk}</sup>"
        elif style.vertical_align == "subscript":
            chunk = f"<sub>{chunk}</sub>"

        inline_css: List[str] = []
        if style.color and style.color.upper() not in ("AUTO", "000000"):
            inline_css.append(f"color: #{style.color.upper()}")
        if style.font_family:
            inline_css.append(f'font-family: "{style.font_family}", sans-serif')
        if style.font_size_half_points:
            pt = style.font_size_half_points / 2.0
            inline_css.append(f"font-size: {pt:g}pt")
        if style.highlight:
            inline_css.append(f"background-color: {style.highlight}")

        if inline_css:
            css_str = escape("; ".join(inline_css), quote=True)
            chunk = f'<span class="mm-run" style="{css_str}">{chunk}</span>'

        if event.hyperlink_target:
            target = escape(event.hyperlink_target, quote=True)
            chunk = f'<a href="{target}" target="_blank" rel="noopener noreferrer" class="mm-link">{chunk}</a>'

        rendered_parts.append(chunk)

    return "".join(rendered_parts)


def _render_paragraph(node: DocumentNode) -> str:
    """Render a single paragraph node to semantic HTML."""
    content = _render_run_styles(node.text_events)
    source_path = escape(node.source_path, quote=True)

    style = node.paragraph_style
    tag = "p"
    classes = ["mm-para"]
    inline_css: List[str] = []

    if style:
        style_id = (style.style_id or "").lower()
        if "heading1" in style_id or style_id == "heading 1":
            tag = "h1"
            classes = ["mm-heading", "mm-h1"]
        elif "heading2" in style_id or style_id == "heading 2":
            tag = "h2"
            classes = ["mm-heading", "mm-h2"]
        elif "heading3" in style_id or style_id == "heading 3":
            tag = "h3"
            classes = ["mm-heading", "mm-h3"]
        elif "heading4" in style_id or style_id == "heading 4":
            tag = "h4"
            classes = ["mm-heading", "mm-h4"]
        elif "heading5" in style_id or style_id == "heading 5":
            tag = "h5"
            classes = ["mm-heading", "mm-h5"]
        elif "heading6" in style_id or style_id == "heading 6":
            tag = "h6"
            classes = ["mm-heading", "mm-h6"]
        elif "title" in style_id:
            tag = "h1"
            classes = ["mm-title"]

        if style.alignment and style.alignment != "left":
            inline_css.append(f"text-align: {style.alignment}")
        if style.space_before_twips:
            inline_css.append(f"margin-top: {style.space_before_twips / 20.0:g}pt")
        if style.space_after_twips:
            inline_css.append(f"margin-bottom: {style.space_after_twips / 20.0:g}pt")
        if style.left_indent_twips:
            inline_css.append(f"margin-left: {style.left_indent_twips / 20.0:g}pt")
        if style.right_indent_twips:
            inline_css.append(f"margin-right: {style.right_indent_twips / 20.0:g}pt")

    class_attr = " ".join(classes)
    style_attr = f' style="{escape("; ".join(inline_css), quote=True)}"' if inline_css else ""

    if not content:
        content = "&nbsp;"

    return f'<{tag} class="{class_attr}" data-mm-source-path="{source_path}"{style_attr}>{content}</{tag}>'


class TopicHtmlRenderer:
    """Renders whole TopicDocument structures into validated semantic HTML."""

    def __init__(
        self,
        package: OOXMLPackage,
        *,
        drawing_compiler: Optional[DrawingCompiler] = None,
        media_hrefs: Optional[Mapping[str, str]] = None,
    ) -> None:
        self.package = package
        self.media_hrefs = dict(media_hrefs or {})
        self.drawing_compiler = drawing_compiler or DrawingCompiler(package, media_hrefs=self.media_hrefs)
        from .tables import parse_tables
        self.parsed_tables = {table.source_path: table for table in parse_tables(package)}

    def render_topic(self, topic: TopicDocument, source_sha256: str) -> str:
        """Render a topic document to complete HTML fragment with release header."""
        topic_id = topic.boundary.topic_id
        blocks: List[str] = [
            f'<div class="mm-release-marker" data-mm-release="{source_sha256}" data-mm-topic="{escape(topic_id, quote=True)}" hidden></div>'
        ]

        table_renderer_fn = self.drawing_compiler.table_renderer(topic_id)

        for node in topic.nodes:
            if node.kind == "paragraph":
                blocks.append(_render_paragraph(node))
            elif node.kind == "table":
                parsed_table = self.parsed_tables.get(node.source_path)
                if parsed_table:
                    rendered_table = render_table(parsed_table, drawing_renderer=table_renderer_fn)
                    blocks.append(rendered_table)
                else:
                    blocks.append(f'<div class="mm-table-placeholder" data-mm-source-path="{escape(node.source_path, quote=True)}"></div>')
            elif node.kind == "drawing":
                figure = self.drawing_compiler._figure_by_drawing_path.get((topic_id, node.source_path))
                if figure:
                    blocks.append(self.drawing_compiler.render_figure(figure))
                else:
                    figures = self.drawing_compiler.figures(topic_id)
                    matched = next((f for f in figures if any(obj.source_path == node.source_path for obj in f.objects)), None)
                    if matched:
                        blocks.append(self.drawing_compiler.render_figure(matched))
            else:
                blocks.append(_render_paragraph(node))

        full_html = "\n".join(blocks)
        validate_html_policy(full_html, topic_id=topic_id)
        return full_html

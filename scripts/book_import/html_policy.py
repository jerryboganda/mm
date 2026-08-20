"""Fail-closed semantic HTML policy enforcement for book document content."""

from __future__ import annotations

from html import escape
import re
from typing import Optional, Set
from urllib.parse import urlparse

from lxml import etree, html


class HTMLPolicyError(ValueError):
    """Generated or imported HTML violates the allowed semantic contract."""


ALLOWED_TAGS: Set[str] = {
    "div",
    "p",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ol",
    "ul",
    "li",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "colgroup",
    "col",
    "caption",
    "figure",
    "figcaption",
    "svg",
    "path",
    "defs",
    "g",
    "text",
    "tspan",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "use",
    "image",
    "img",
    "a",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "s",
    "strike",
    "del",
    "ins",
    "small",
    "sub",
    "sup",
    "mark",
    "br",
    "wbr",
    "hr",
    "blockquote",
    "clippath",
    "mask",
    "pattern",
    "lineargradient",
    "radialgradient",
    "stop",
    "symbol",
    "marker",
}

ALLOWED_ATTRIBUTES: Set[str] = {
    "class",
    "id",
    "style",
    "role",
    "tabindex",
    "aria-label",
    "aria-labelledby",
    "aria-describedby",
    "aria-hidden",
    "hidden",
    "href",
    "target",
    "rel",
    "src",
    "alt",
    "width",
    "height",
    "viewbox",
    "preserveaspectratio",
    "xmlns",
    "colspan",
    "rowspan",
    "span",
    "headers",
    "scope",
    "start",
    "type",
    "d",
    "fill",
    "fill-opacity",
    "fill-rule",
    "stroke",
    "stroke-width",
    "stroke-opacity",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "opacity",
    "offset",
    "stop-color",
    "stop-opacity",
    "clip-path",
    "clip-rule",
    "mask",
    "transform",
    "x",
    "y",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "x1",
    "y1",
    "x2",
    "y2",
    "points",
    "dx",
    "dy",
    "text-anchor",
    "dominant-baseline",
    "alignment-baseline",
    "baseline-shift",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "letter-spacing",
    "word-spacing",
    "marker-start",
    "marker-mid",
    "marker-end",
    "markerunits",
    "markerwidth",
    "markerheight",
    "refx",
    "refy",
    "orient",
    "clippathunits",
    "gradientunits",
    "gradienttransform",
    "patternunits",
    "patterncontentunits",
    "patterntransform",
    "spreadmethod",
    "fx",
    "fy",
    "fr",
    "maskunits",
    "maskcontentunits",
    "vector-effect",
    "shape-rendering",
    "text-rendering",
    "image-rendering",
}

FORBIDDEN_TAGS: Set[str] = {
    "script",
    "iframe",
    "object",
    "embed",
    "applet",
    "meta",
    "link",
    "style",
    "base",
    "form",
    "input",
    "button",
}


def validate_html_policy(raw_html: str, topic_id: str = "t-mm-unknown") -> None:
    """Validate that raw HTML strictly complies with the book document policy."""
    if not raw_html:
        return

    # Check for forbidden tag patterns in raw text
    for forbidden in FORBIDDEN_TAGS:
        pattern = re.compile(rf"<\s*{forbidden}[\s/>]", re.IGNORECASE)
        if pattern.search(raw_html):
            raise HTMLPolicyError(f"{topic_id}: Forbidden HTML tag <{forbidden}> detected")

    # Check for script or javascript: href/src
    if re.search(r"javascript\s*:", raw_html, re.IGNORECASE):
        raise HTMLPolicyError(f"{topic_id}: javascript: URI scheme detected")
    if re.search(r"vbscript\s*:", raw_html, re.IGNORECASE):
        raise HTMLPolicyError(f"{topic_id}: vbscript: URI scheme detected")
    if re.search(r"expression\s*\(", raw_html, re.IGNORECASE):
        raise HTMLPolicyError(f"{topic_id}: CSS expression detected")

    # Parse with lxml HTML fragment parser
    try:
        wrapped = f"<div>{raw_html}</div>"
        root = html.fragment_fromstring(wrapped, create_parent=False)
    except Exception as error:
        raise HTMLPolicyError(f"{topic_id}: HTML is malformed: {error}") from error

    for element in root.iter():
        if element is root:
            continue
        tag = element.tag
        if not isinstance(tag, str):
            continue
        tag_lower = tag.lower()
        if tag_lower not in ALLOWED_TAGS:
            raise HTMLPolicyError(f"{topic_id}: Disallowed HTML tag <{tag_lower}>")

        for attr, value in element.attrib.items():
            attr_lower = attr.lower()
            if attr_lower.startswith("on"):
                raise HTMLPolicyError(f"{topic_id}: Inline event handler attribute {attr!r} detected")
            if (
                attr_lower.startswith("data-")
                or attr_lower.startswith("xml:")
                or attr_lower.startswith("xmlns")
                or attr_lower.startswith("xlink:")
            ):
                continue
            if attr_lower not in ALLOWED_ATTRIBUTES:
                raise HTMLPolicyError(f"{topic_id}: Disallowed attribute {attr!r} on <{tag_lower}>")

            if attr_lower in ("href", "src"):
                parsed = urlparse(value)
                if parsed.scheme in ("javascript", "vbscript", "data") and tag_lower == "a":
                    raise HTMLPolicyError(f"{topic_id}: Unsafe link scheme {parsed.scheme!r}")

            if attr_lower == "style":
                _validate_style_declarations(value, topic_id, tag_lower)


def _validate_style_declarations(style_text: str, topic_id: str, tag: str) -> None:
    if not style_text:
        return
    declarations = [d.strip() for d in style_text.split(";") if d.strip()]
    for declaration in declarations:
        if ":" not in declaration:
            continue
        prop, val = declaration.split(":", 1)
        prop_clean = prop.strip().lower()
        val_clean = val.strip().lower()

        if "url(" in val_clean:
            raise HTMLPolicyError(f"{topic_id}: CSS url() is disallowed in inline style on <{tag}>")
        if "expression(" in val_clean or "behavior:" in val_clean:
            raise HTMLPolicyError(f"{topic_id}: Dynamic CSS expression disallowed on <{tag}>")

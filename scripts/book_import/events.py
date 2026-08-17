"""Exact, display-aware text event extraction from WordprocessingML."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

from lxml import etree

from .model import RunStyle, TextEvent
from .package import OFFICE_REL_NS, OOXMLPackage, WORD_NS


class EventExtractionError(ValueError):
    """The displayed text stream cannot be determined without guessing."""


@dataclass(frozen=True)
class EventExtraction:
    visible_events: Tuple[TextEvent, ...]
    structural_diagnostics: Tuple[TextEvent, ...]


_VISIBLE_SPECIALS = {
    "tab": ("tab", "\t"),
    "cr": ("line_break", "\n"),
    "noBreakHyphen": ("no_break_hyphen", "\u2011"),
    "softHyphen": ("soft_hyphen", "\u00ad"),
}

_AMBIGUOUS_REVISION_ELEMENTS = {
    "conflictIns",
    "conflictDel",
    "customXmlInsRangeStart",
    "customXmlInsRangeEnd",
    "customXmlDelRangeStart",
    "customXmlDelRangeEnd",
}

_MARKUP_COMPATIBILITY_NS = (
    "http://schemas.openxmlformats.org/markup-compatibility/2006"
)
_SUPPORTED_MARKUP_NAMESPACES = {
    "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing",
    "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup",
    "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
}


def extract_events(package: OOXMLPackage) -> EventExtraction:
    """Return final-display events plus exact non-visible structural text."""
    for element in package.document.iter():
        local_name = etree.QName(element).localname
        if local_name in _AMBIGUOUS_REVISION_ELEMENTS:
            raise EventExtractionError(
                "Unsupported revision-display ambiguity at " + package.source_path(element)
            )
        if local_name == "del":
            parent = element.getparent()
            grandparent = parent.getparent() if parent is not None else None
            if (
                parent is not None
                and grandparent is not None
                and etree.QName(parent).localname == "trPr"
                and etree.QName(grandparent).localname == "tr"
            ):
                raise EventExtractionError(
                    "Unsupported deleted table row at " + package.source_path(element)
                )

    visible: List[TextEvent] = []
    diagnostics: List[TextEvent] = []
    style_resolver = _make_style_resolver(package)
    _walk_document(package, package.document, visible, diagnostics, style_resolver)
    return EventExtraction(tuple(visible), tuple(diagnostics))


def _make_style_resolver(package: OOXMLPackage):
    from .styles import StyleResolver

    return StyleResolver(package)


def _walk_document(
    package: OOXMLPackage,
    element: etree._Element,
    visible: List[TextEvent],
    diagnostics: List[TextEvent],
    style_resolver,
) -> None:
    for child in element:
        if not isinstance(child.tag, str):
            continue
        local_name = etree.QName(child).localname
        if local_name == "AlternateContent":
            _walk_document(
                package,
                _select_alternate_content(package, child),
                visible,
                diagnostics,
                style_resolver,
            )
        elif local_name == "p" and etree.QName(child).namespace == WORD_NS:
            _extract_paragraph(package, child, visible, diagnostics, style_resolver)
        else:
            _walk_document(package, child, visible, diagnostics, style_resolver)


def _extract_paragraph(
    package: OOXMLPackage,
    paragraph: etree._Element,
    visible: List[TextEvent],
    diagnostics: List[TextEvent],
    style_resolver,
) -> None:
    paragraph_events_before = len(visible)
    _walk_paragraph(
        package,
        paragraph,
        paragraph,
        visible,
        diagnostics,
        style_resolver,
        hyperlink_target=None,
        hidden_reason=None,
    )
    if len(visible) == paragraph_events_before:
        visible.append(TextEvent("empty_paragraph", "", package.source_path(paragraph)))
    visible.append(TextEvent("paragraph_boundary", "\n", package.source_path(paragraph)))


def _walk_paragraph(
    package: OOXMLPackage,
    paragraph: etree._Element,
    element: etree._Element,
    visible: List[TextEvent],
    diagnostics: List[TextEvent],
    style_resolver,
    hyperlink_target: Optional[str],
    hidden_reason: Optional[str],
) -> None:
    for child in element:
        if not isinstance(child.tag, str):
            continue
        local_name = etree.QName(child).localname
        child_hyperlink = hyperlink_target
        child_hidden_reason = hidden_reason

        if local_name == "AlternateContent":
            _walk_paragraph(
                package,
                paragraph,
                _select_alternate_content(package, child),
                visible,
                diagnostics,
                style_resolver,
                child_hyperlink,
                child_hidden_reason,
            )
            continue
        if local_name == "p" and etree.QName(child).namespace == WORD_NS:
            _extract_paragraph(package, child, visible, diagnostics, style_resolver)
            continue

        if local_name == "hyperlink":
            child_hyperlink = _hyperlink_target(package, child)
        if local_name == "fldSimple":
            instruction = child.get(f"{{{WORD_NS}}}instr")
            if instruction is None:
                raise EventExtractionError(
                    f"Simple field lacks an instruction at {package.source_path(child)}"
                )
            diagnostics.append(
                TextEvent(
                    "field_instruction",
                    instruction,
                    package.source_path(child),
                )
            )
        if local_name in ("del", "moveFrom"):
            child_hidden_reason = "deleted_text"
        elif local_name == "r" and style_resolver.run_is_hidden(child, paragraph):
            child_hidden_reason = "hidden_text"

        if local_name in ("t", "delText", "instrText", "delInstrText"):
            value = child.text or ""
            if local_name in ("instrText", "delInstrText"):
                diagnostic_kind = (
                    "deleted_instruction" if local_name == "delInstrText" else "field_instruction"
                )
                diagnostics.append(
                    _event(package, paragraph, child, diagnostic_kind, value, style_resolver)
                )
            elif child_hidden_reason is not None or local_name == "delText":
                diagnostics.append(
                    _event(
                        package,
                        paragraph,
                        child,
                        child_hidden_reason or "deleted_text",
                        value,
                        style_resolver,
                    )
                )
            elif value:
                visible.append(
                    _event(
                        package,
                        paragraph,
                        child,
                        "text",
                        value,
                        style_resolver,
                        child_hyperlink,
                    )
                )
            continue

        if local_name == "br":
            break_type = child.get(f"{{{WORD_NS}}}type")
            if break_type == "page":
                kind, value = "page_break", "\f"
            elif break_type == "column":
                kind, value = "column_break", ""
            elif break_type in (None, "textWrapping"):
                kind, value = "line_break", "\n"
            else:
                raise EventExtractionError(
                    f"Unsupported {break_type} break at {package.source_path(child)}"
                )
            _append_visible_or_diagnostic(
                package,
                paragraph,
                child,
                kind,
                value,
                child_hidden_reason,
                child_hyperlink,
                visible,
                diagnostics,
                style_resolver,
            )
            continue

        if local_name in _VISIBLE_SPECIALS:
            kind, value = _VISIBLE_SPECIALS[local_name]
            _append_visible_or_diagnostic(
                package,
                paragraph,
                child,
                kind,
                value,
                child_hidden_reason,
                child_hyperlink,
                visible,
                diagnostics,
                style_resolver,
            )
            continue

        if local_name in ("rPr", "pPr", "fldChar"):
            continue
        _walk_paragraph(
            package,
            paragraph,
            child,
            visible,
            diagnostics,
            style_resolver,
            child_hyperlink,
            child_hidden_reason,
        )


def _append_visible_or_diagnostic(
    package: OOXMLPackage,
    paragraph: etree._Element,
    element: etree._Element,
    kind: str,
    value: str,
    hidden_reason: Optional[str],
    hyperlink_target: Optional[str],
    visible: List[TextEvent],
    diagnostics: List[TextEvent],
    style_resolver,
) -> None:
    if hidden_reason is None:
        visible.append(
            _event(
                package,
                paragraph,
                element,
                kind,
                value,
                style_resolver,
                hyperlink_target,
            )
        )
    else:
        diagnostics.append(
            _event(
                package,
                paragraph,
                element,
                hidden_reason,
                value,
                style_resolver,
            )
        )


def _event(
    package: OOXMLPackage,
    paragraph: etree._Element,
    element: etree._Element,
    kind: str,
    value: str,
    style_resolver,
    hyperlink_target: Optional[str] = None,
) -> TextEvent:
    run = next(
        (
            ancestor
            for ancestor in (element, *element.iterancestors())
            if etree.QName(ancestor).localname == "r"
        ),
        None,
    )
    run_style: Optional[RunStyle] = None
    if run is not None:
        run_style = style_resolver.resolve_run(run, paragraph)
    return TextEvent(
        kind,
        value,
        package.source_path(element),
        run_style=run_style,
        hyperlink_target=hyperlink_target,
    )


def _hyperlink_target(package: OOXMLPackage, hyperlink: etree._Element) -> str:
    relationship_id = hyperlink.get(f"{{{OFFICE_REL_NS}}}id")
    anchor = hyperlink.get(f"{{{WORD_NS}}}anchor")
    if relationship_id:
        try:
            return package.hyperlinks[relationship_id]
        except KeyError as error:
            raise EventExtractionError(
                f"Unresolved hyperlink relationship {relationship_id} at "
                f"{package.source_path(hyperlink)}"
            ) from error
    if anchor:
        return f"#{anchor}"
    raise EventExtractionError(
        f"Hyperlink has no relationship or anchor at {package.source_path(hyperlink)}"
    )


def _select_alternate_content(
    package: OOXMLPackage, alternate_content: etree._Element
) -> etree._Element:
    fallback: Optional[etree._Element] = None
    for branch in alternate_content:
        if not isinstance(branch.tag, str):
            continue
        qualified_name = etree.QName(branch)
        if qualified_name.namespace != _MARKUP_COMPATIBILITY_NS:
            continue
        if qualified_name.localname == "Fallback":
            fallback = branch
            continue
        if qualified_name.localname != "Choice":
            continue
        requires = branch.get("Requires")
        if not requires:
            raise EventExtractionError(
                f"AlternateContent choice lacks Requires at {package.source_path(branch)}"
            )
        required_namespaces = []
        for prefix in requires.split():
            namespace = branch.nsmap.get(prefix)
            if namespace is None:
                raise EventExtractionError(
                    f"AlternateContent has unresolved prefix {prefix} at "
                    f"{package.source_path(branch)}"
                )
            required_namespaces.append(namespace)
        if all(
            namespace in _SUPPORTED_MARKUP_NAMESPACES
            for namespace in required_namespaces
        ):
            return branch
    if fallback is not None:
        return fallback
    raise EventExtractionError(
        f"AlternateContent has no supported choice or fallback at "
        f"{package.source_path(alternate_content)}"
    )

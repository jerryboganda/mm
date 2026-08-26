"""Fail-closed Word numbering resolution and semantic HTML list construction."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from html import escape
import re
from typing import Dict, Iterable, List, Mapping, Optional, Tuple

from lxml import etree

from .model import NumberingLevel
from .package import OOXMLPackage, WORD_NS
from .styles import StyleResolver, StyleResolutionError


class NumberingError(ValueError):
    """Numbering cannot be represented faithfully without guessing."""


_SUPPORTED_FORMATS = {
    "bullet",
    "decimal",
    "decimalZero",
    "lowerLetter",
    "upperLetter",
    "lowerRoman",
    "upperRoman",
}
_SUPPORTED_SUFFIXES = {"nothing", "space", "tab"}
_CSS_FORMATS = {
    "bullet": "disc",
    "decimal": "decimal",
    "decimalZero": "decimal-leading-zero",
    "lowerLetter": "lower-alpha",
    "upperLetter": "upper-alpha",
    "lowerRoman": "lower-roman",
    "upperRoman": "upper-roman",
}
_PLACEHOLDER = re.compile(r"%([1-9])")

# Adobe Symbol Encoding to Unicode:
# https://www.unicode.org/Public/MAPPINGS/VENDORS/ADOBE/symbol.txt
# Wingdings to Unicode mapping proposal:
# https://www.unicode.org/L2/L2011/11344-wingdings.pdf
_LEGACY_MARKER_MAP = {
    ("symbol", 0xF0AE): "\u2192",
    ("symbol", 0xF0B7): "\u2022",
    ("wingdings", 0xF076): "\u2756",
    ("wingdings", 0xF0A7): "\u25AA",
    ("wingdings", 0xF0D8): "\u2BA4",
    ("wingdings", 0xF0E8): "\U0001F869",
    ("wingdings", 0xF0F0): "\u21E8",
    ("wingdings", 0xF0FC): "\u2713",
}


@dataclass(frozen=True)
class ResolvedNumberingLevel(NumberingLevel):
    """A public NumberingLevel plus state needed for exact marker expansion."""

    restart_after_level: Optional[int] = None
    level_formats: Tuple[Optional[str], ...] = ()
    legal_numbering: bool = False
    display_level_text: Optional[str] = None
    marker_fonts: Tuple[Tuple[str, str], ...] = ()
    marker_font: Optional[str] = None


@dataclass(frozen=True)
class _LevelDefinition:
    level: int
    number_format: str
    level_text: str
    start: int
    suffix: str
    left_indent_twips: Optional[int]
    hanging_indent_twips: Optional[int]
    restart_after_level: Optional[int]
    legal_numbering: bool
    display_level_text: str
    marker_fonts: Tuple[Tuple[str, str], ...]
    marker_font: Optional[str]
    marker_font_source_path: Optional[str]
    level_text_source_path: str
    number_format_source_path: str


@dataclass(frozen=True)
class _NumberingDefinition:
    num_id: str
    levels: Mapping[int, _LevelDefinition]


@dataclass(frozen=True)
class ListParagraph:
    source_path: str
    text: str
    numbering: NumberingLevel


@dataclass
class ListItem:
    paragraph: ListParagraph
    marker_value: int
    marker_text: str
    children: List["ListBlock"] = field(default_factory=list)


@dataclass
class ListBlock:
    num_id: str
    level: int
    number_format: str
    level_text: str
    start: int
    suffix: str
    left_indent_twips: Optional[int]
    hanging_indent_twips: Optional[int]
    explicit_marker: bool
    items: List[ListItem] = field(default_factory=list)


@dataclass(frozen=True)
class NumberingInventory:
    format_counts: Mapping[str, int]
    level_counts: Mapping[int, int]
    bullet_marker_counts: Mapping[str, int] = field(default_factory=dict)
    portable_bullet_marker_counts: Mapping[str, int] = field(default_factory=dict)
    legacy_pua_bullet_count: int = 0
    legal_numbered_paragraph_count: int = 0


class NumberingResolver:
    """Resolve paragraph numPr through style, num, abstractNum, and overrides."""

    def __init__(self, package: OOXMLPackage) -> None:
        self.package = package
        self._style_resolver = StyleResolver(package)
        self._definitions = self._read_numbering()
        self._counters: Dict[Tuple[str, int], int] = {}

    def resolve_paragraph(
        self, paragraph: etree._Element
    ) -> Optional[ResolvedNumberingLevel]:
        num_id, level = self._paragraph_numbering(paragraph)
        if num_id is None:
            return None
        if num_id == "0":
            return None
        try:
            definition = self._definitions[num_id]
        except KeyError as error:
            raise NumberingError(
                f"Unknown numId {num_id} at {self.package.source_path(paragraph)}"
            ) from error
        try:
            selected = definition.levels[level]
        except KeyError as error:
            raise NumberingError(
                f"numId {num_id} has no level {level} at "
                f"{self.package.source_path(paragraph)}"
            ) from error
        formats: List[Optional[str]] = [None] * 9
        for level_number, candidate in definition.levels.items():
            formats[level_number] = candidate.number_format

        display_marker = selected.display_level_text
        if selected.number_format != "bullet":
            prev_val = self._counters.get((num_id, level), selected.start - 1)
            curr_val = prev_val + 1
            self._counters[(num_id, level)] = curr_val
            for lvl_idx in range(level + 1, 9):
                self._counters.pop((num_id, lvl_idx), None)
            display_marker = _marker_text(
                selected,
                curr_val,
                self._counters,
                self.package.source_path(paragraph),
                num_id=num_id,
            )

        return ResolvedNumberingLevel(
            num_id=num_id,
            level=level,
            number_format=selected.number_format,
            level_text=selected.level_text,
            start=selected.start,
            suffix=selected.suffix,
            left_indent_twips=selected.left_indent_twips,
            hanging_indent_twips=selected.hanging_indent_twips,
            restart_after_level=selected.restart_after_level,
            level_formats=tuple(formats),
            legal_numbering=selected.legal_numbering,
            display_level_text=display_marker,
            marker_fonts=selected.marker_fonts,
            marker_font=selected.marker_font,
        )

    def _paragraph_numbering(
        self, paragraph: etree._Element
    ) -> Tuple[Optional[str], int]:
        direct_properties = paragraph.find(f"{{{WORD_NS}}}pPr")
        style_node = _optional_single(
            self.package, direct_properties, "pStyle"
        )
        style_id = (
            _required_attribute(self.package, style_node, "val")
            if style_node is not None
            else None
        )
        effective_style_id = style_id or self._style_resolver._default_style_ids.get(
            "paragraph"
        )
        num_id: Optional[str] = None
        raw_level: Optional[str] = None
        saw_num_pr = False
        default_properties = self._style_resolver._doc_default_properties(
            "pPrDefault", "pPr"
        )
        default_num_pr = (
            _optional_single(self.package, default_properties, "numPr")
            if default_properties is not None
            else None
        )
        if default_num_pr is not None:
            saw_num_pr = True
            num_id, raw_level = _merge_num_pr(
                self.package, default_num_pr, num_id, raw_level
            )
        try:
            style_chain = self._style_resolver._style_chain(
                effective_style_id, "paragraph"
            )
        except StyleResolutionError as error:
            raise NumberingError(
                f"Cannot resolve paragraph numbering at "
                f"{self.package.source_path(paragraph)}: {error}"
            ) from error
        for style in style_chain:
            properties = style.find(f"{{{WORD_NS}}}pPr")
            num_pr = (
                _optional_single(self.package, properties, "numPr")
                if properties is not None
                else None
            )
            if num_pr is not None:
                saw_num_pr = True
                num_id, raw_level = _merge_num_pr(
                    self.package, num_pr, num_id, raw_level
                )
        direct_num_pr = (
            _optional_single(self.package, direct_properties, "numPr")
            if direct_properties is not None
            else None
        )
        if direct_num_pr is not None:
            saw_num_pr = True
            num_id, raw_level = _merge_num_pr(
                self.package, direct_num_pr, num_id, raw_level
            )
        if not saw_num_pr:
            return None, 0
        if num_id is None:
            raise NumberingError(
                "Numbering has ilvl but no numId at "
                f"{self.package.source_path(paragraph)}"
            )
        level = 0 if raw_level is None else _integer(
            raw_level, paragraph, self.package, "ilvl"
        )
        if not 0 <= level <= 8:
            raise NumberingError(
                f"Unsupported numbering level {level} at "
                f"{self.package.source_path(paragraph)}"
            )
        return num_id, level

    def _read_numbering(self) -> Mapping[str, _NumberingDefinition]:
        root = self.package.numbering
        if root is None:
            return {}
        abstract_definitions: Dict[str, Dict[int, _LevelDefinition]] = {}
        for abstract in root.findall(f"{{{WORD_NS}}}abstractNum"):
            abstract_id = _required_attribute(
                self.package, abstract, "abstractNumId"
            )
            if abstract_id in abstract_definitions:
                raise NumberingError(f"Duplicate abstractNumId {abstract_id}")
            levels: Dict[int, _LevelDefinition] = {}
            for level_element in abstract.findall(f"{{{WORD_NS}}}lvl"):
                level = _level_number(self.package, level_element)
                if level in levels:
                    raise NumberingError(
                        f"Duplicate level {level} at "
                        f"{self.package.source_path(level_element)}"
                    )
                levels[level] = _parse_level(self.package, level_element, None)
            abstract_definitions[abstract_id] = levels

        definitions: Dict[str, _NumberingDefinition] = {}
        for num in root.findall(f"{{{WORD_NS}}}num"):
            num_id = _required_attribute(self.package, num, "numId")
            if num_id in definitions:
                raise NumberingError(f"Duplicate numId {num_id}")
            abstract_reference = _optional_single(
                self.package, num, "abstractNumId"
            )
            if abstract_reference is None:
                raise NumberingError(
                    f"numId {num_id} lacks abstractNumId at "
                    f"{self.package.source_path(num)}"
                )
            abstract_id = _required_attribute(
                self.package, abstract_reference, "val"
            )
            try:
                levels = dict(abstract_definitions[abstract_id])
            except KeyError as error:
                raise NumberingError(
                    f"Unknown abstractNumId {abstract_id} at "
                    f"{self.package.source_path(abstract_reference)}"
                ) from error
            seen_overrides = set()
            for override in num.findall(f"{{{WORD_NS}}}lvlOverride"):
                level = _level_number(self.package, override)
                if level in seen_overrides:
                    raise NumberingError(
                        f"Duplicate override for level {level} at "
                        f"{self.package.source_path(override)}"
                    )
                seen_overrides.add(level)
                if level not in levels:
                    raise NumberingError(
                        f"Override for unknown level {level} at "
                        f"{self.package.source_path(override)}"
                    )
                replacement = _optional_single(self.package, override, "lvl")
                if replacement is not None:
                    replacement_level = _level_number(self.package, replacement)
                    if replacement_level != level:
                        raise NumberingError(
                            f"Override level {level} contains level "
                            f"{replacement_level} at "
                            f"{self.package.source_path(replacement)}"
                        )
                    levels[level] = _parse_level(
                        self.package, replacement, levels[level]
                    )
                start_override = _optional_single(
                    self.package, override, "startOverride"
                )
                if start_override is not None:
                    start = _required_integer(
                        self.package, start_override, "val", "startOverride"
                    )
                    current = levels[level]
                    levels[level] = _LevelDefinition(
                        level=current.level,
                        number_format=current.number_format,
                        level_text=current.level_text,
                        start=start,
                        suffix=current.suffix,
                        left_indent_twips=current.left_indent_twips,
                        hanging_indent_twips=current.hanging_indent_twips,
                        restart_after_level=current.restart_after_level,
                        legal_numbering=current.legal_numbering,
                        display_level_text=current.display_level_text,
                        marker_fonts=current.marker_fonts,
                        marker_font=current.marker_font,
                        marker_font_source_path=current.marker_font_source_path,
                        level_text_source_path=current.level_text_source_path,
                        number_format_source_path=current.number_format_source_path,
                    )
            for level, definition in levels.items():
                for match in _PLACEHOLDER.finditer(definition.level_text):
                    referenced_level = int(match.group(1)) - 1
                    if referenced_level > level or referenced_level not in levels:
                        raise NumberingError(
                            f"Level {level} marker {definition.level_text!r} "
                            "references "
                            f"unavailable level {referenced_level} for numId {num_id} "
                            f"at {definition.level_text_source_path}"
                        )
            definitions[num_id] = _NumberingDefinition(num_id, levels)
        return definitions


def inventory(package: OOXMLPackage) -> NumberingInventory:
    """Count resolved numbering formats and levels on source paragraphs."""
    resolver = NumberingResolver(package)
    formats: Counter[str] = Counter()
    levels: Counter[int] = Counter()
    bullet_markers: Counter[str] = Counter()
    portable_bullet_markers: Counter[str] = Counter()
    legacy_pua_bullets = 0
    legal_numbered_paragraphs = 0
    for paragraph in package.document.findall(f".//{{{WORD_NS}}}p"):
        resolved = resolver.resolve_paragraph(paragraph)
        if resolved is not None:
            formats[resolved.number_format] += 1
            levels[resolved.level] += 1
            if resolved.legal_numbering:
                legal_numbered_paragraphs += 1
            if resolved.number_format == "bullet":
                font = resolved.marker_font or "(none)"
                raw_codepoints = _codepoints(resolved.level_text)
                bullet_markers[f"{font}|{raw_codepoints}"] += 1
                portable_bullet_markers[
                    resolved.display_level_text or resolved.level_text
                ] += 1
                if any(_is_private_use(character) for character in resolved.level_text):
                    legacy_pua_bullets += 1
    return NumberingInventory(
        dict(formats),
        dict(levels),
        dict(bullet_markers),
        dict(portable_bullet_markers),
        legacy_pua_bullets,
        legal_numbered_paragraphs,
    )


def build_list_tree(paragraphs: Iterable[ListParagraph]) -> Tuple[ListBlock, ...]:
    """Build list blocks solely from ilvl, numId, and numbering continuation state."""
    paragraph_list = tuple(paragraphs)
    restart_rules: Dict[Tuple[str, int], Optional[int]] = {}
    for paragraph in paragraph_list:
        numbering = paragraph.numbering
        key = (numbering.num_id, numbering.level)
        restart = getattr(
            numbering,
            "restart_after_level",
            numbering.level - 1 if numbering.level > 0 else None,
        )
        if key in restart_rules and restart_rules[key] != restart:
            raise NumberingError(
                f"Conflicting restart definitions for numId {numbering.num_id} "
                f"level {numbering.level} at {paragraph.source_path}"
            )
        restart_rules[key] = restart

    roots: List[ListBlock] = []
    stack: List[ListBlock] = []
    counters: Dict[Tuple[str, int], int] = {}
    for paragraph in paragraph_list:
        numbering = paragraph.numbering
        if not 0 <= numbering.level <= 8:
            raise NumberingError(
                f"Unsupported numbering level {numbering.level} at "
                f"{paragraph.source_path}"
            )
        if numbering.number_format not in _SUPPORTED_FORMATS:
            raise NumberingError(
                f"Unsupported numbering format {numbering.number_format} at "
                f"{paragraph.source_path}"
            )
        suffix = numbering.suffix or "tab"
        if suffix not in _SUPPORTED_SUFFIXES:
            raise NumberingError(
                f"Unsupported numbering suffix {suffix} at {paragraph.source_path}"
            )

        for key, restart_after in tuple(restart_rules.items()):
            if key[0] == numbering.num_id and restart_after == numbering.level:
                counters.pop(key, None)
        counter_key = (numbering.num_id, numbering.level)
        marker_value = counters.get(counter_key, numbering.start - 1) + 1
        counters[counter_key] = marker_value
        marker_text = _marker_text(
            numbering, marker_value, counters, paragraph.source_path
        )

        while stack and stack[-1].level > numbering.level:
            stack.pop()
        block: Optional[ListBlock] = None
        if stack and stack[-1].level == numbering.level:
            if stack[-1].num_id == numbering.num_id:
                block = stack[-1]
            else:
                stack.pop()
        if block is None:
            block = _new_block(numbering, marker_value, suffix)
            if stack:
                if not stack[-1].items:
                    raise NumberingError(
                        f"Cannot nest level {numbering.level} without a parent item at "
                        f"{paragraph.source_path}"
                    )
                stack[-1].items[-1].children.append(block)
            else:
                roots.append(block)
            stack.append(block)
        block.items.append(ListItem(paragraph, marker_value, marker_text))
    return tuple(roots)


def render_list_tree(blocks: Iterable[ListBlock]) -> str:
    """Render list blocks as escaped semantic HTML without changing source text."""
    return "".join(_render_block(block, 0) for block in blocks)


def _new_block(
    numbering: NumberingLevel, marker_value: int, suffix: str
) -> ListBlock:
    return ListBlock(
        num_id=numbering.num_id,
        level=numbering.level,
        number_format=numbering.number_format,
        level_text=numbering.level_text,
        start=marker_value,
        suffix=suffix,
        left_indent_twips=numbering.left_indent_twips,
        hanging_indent_twips=numbering.hanging_indent_twips,
        explicit_marker=not _native_marker_can_represent(numbering, suffix),
    )


def _render_block(block: ListBlock, parent_left_twips: int) -> str:
    tag = "ul" if block.number_format == "bullet" else "ol"
    attributes: List[str] = []
    if tag == "ol" and block.start != 1:
        attributes.append(f'start="{block.start}"')
    css_type = "none" if block.explicit_marker else _CSS_FORMATS[block.number_format]
    styles = [f"list-style-type:{css_type}"]
    absolute_left = (
        block.left_indent_twips
        if block.left_indent_twips is not None
        else parent_left_twips
    )
    relative_left = absolute_left - parent_left_twips
    styles.append(f"margin:0 0 0 {_points(relative_left)}pt")
    styles.append("padding:0")
    if block.hanging_indent_twips is not None:
        styles.append(f"text-indent:-{_points(block.hanging_indent_twips)}pt")
    attributes.append(f'style="{";".join(styles)};"')
    opening = f"<{tag} {' '.join(attributes)}>"
    items = []
    for item in block.items:
        marker = ""
        if block.explicit_marker:
            suffix_in_marker = " " if block.suffix == "space" else ""
            marker_span = (
                '<span class="list-marker">'
                + escape(item.marker_text + suffix_in_marker, quote=False)
                + "</span>"
            )
            if block.suffix == "tab":
                if block.hanging_indent_twips is None:
                    raise NumberingError(
                        f"Tab list suffix lacks hanging indentation at "
                        f"{item.paragraph.source_path}"
                    )
                marker = (
                    '<span class="list-prefix" style="display:inline-flex;'
                    f'width:{_points(block.hanging_indent_twips)}pt;">'
                    + marker_span
                    + '<span class="list-tab" aria-hidden="true" '
                    'data-list-suffix="tab" '
                    'style="flex:1 1 auto;min-width:0;"></span></span>'
                )
            else:
                marker = marker_span
        children = "".join(
            _render_block(child, absolute_left) for child in item.children
        )
        source_attributes = _marker_source_attributes(item.paragraph.numbering)
        items.append(
            "<li"
            + source_attributes
            + ">"
            + marker
            + escape(item.paragraph.text, quote=False)
            + children
            + "</li>"
        )
    return opening + "".join(items) + f"</{tag}>"


def _marker_text(
    numbering: NumberingLevel,
    marker_value: int,
    counters: Mapping[Tuple[str, int], int],
    source_path: str,
    num_id: Optional[str] = None,
) -> str:
    level_text = (
        getattr(numbering, "display_level_text", None) or numbering.level_text
    )
    if "%" in _PLACEHOLDER.sub("", level_text):
        raise NumberingError(
            f"Unsupported numbering placeholder in {level_text!r} at {source_path}"
        )
    formats = getattr(numbering, "level_formats", ())
    legal = bool(getattr(numbering, "legal_numbering", False))

    owner_num_id = getattr(numbering, "num_id", None) or num_id
    if owner_num_id is None:
        raise NumberingError(
            f"Numbering marker {level_text!r} has no numId at {source_path}"
        )

    def replace(match: re.Match[str]) -> str:
        referenced_level = int(match.group(1)) - 1
        key = (owner_num_id, referenced_level)
        if referenced_level == numbering.level:
            value = marker_value
        elif key in counters:
            value = counters[key]
        else:
            starts = getattr(numbering, "level_starts", ())
            if referenced_level < len(starts) and starts[referenced_level] is not None:
                value = starts[referenced_level]
            else:
                value = 1
        number_format = "decimal" if legal else (
            formats[referenced_level]
            if referenced_level < len(formats) and formats[referenced_level] is not None
            else None
        )
        if number_format is None and referenced_level == numbering.level:
            number_format = numbering.number_format
        if number_format is None:
            number_format = "decimal"
        return _format_number(value, number_format, source_path)

    return _PLACEHOLDER.sub(replace, level_text)


def _format_number(value: int, number_format: str, source_path: str) -> str:
    if number_format == "decimal":
        return str(value)
    if number_format == "decimalZero":
        return f"{value:02d}"
    if value <= 0:
        raise NumberingError(
            f"Cannot render {number_format} numbering value {value} at {source_path}"
        )
    if number_format in ("lowerLetter", "upperLetter"):
        result = ""
        remaining = value
        while remaining:
            remaining, digit = divmod(remaining - 1, 26)
            result = chr(ord("a") + digit) + result
        return result.upper() if number_format == "upperLetter" else result
    if number_format in ("lowerRoman", "upperRoman"):
        result = _roman(value, source_path)
        return result if number_format == "upperRoman" else result.lower()
    raise NumberingError(
        f"Unsupported numbering format {number_format} at {source_path}"
    )


def _roman(value: int, source_path: str) -> str:
    if not 1 <= value <= 3999:
        raise NumberingError(
            f"Roman numbering value {value} is outside 1-3999 at {source_path}"
        )
    values = (
        (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
        (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
        (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
    )
    result = ""
    remaining = value
    for amount, digits in values:
        while remaining >= amount:
            result += digits
            remaining -= amount
    return result


def _native_marker_can_represent(numbering: NumberingLevel, suffix: str) -> bool:
    if suffix not in ("nothing", "space"):
        return False
    display_level_text = (
        getattr(numbering, "display_level_text", None) or numbering.level_text
    )
    if display_level_text != numbering.level_text:
        return False
    if numbering.number_format == "bullet":
        return display_level_text == "•"
    return display_level_text == f"%{numbering.level + 1}."


def _marker_source_attributes(numbering: NumberingLevel) -> str:
    marker_fonts = getattr(numbering, "marker_fonts", ())
    display_level_text = (
        getattr(numbering, "display_level_text", None) or numbering.level_text
    )
    if not marker_fonts and display_level_text == numbering.level_text:
        return ""
    attributes = [
        ' data-source-marker-codepoints="'
        + escape(_codepoints(numbering.level_text), quote=True)
        + '"'
    ]
    marker_font = getattr(numbering, "marker_font", None)
    if marker_font:
        attributes.append(
            ' data-source-marker-font="' + escape(marker_font, quote=True) + '"'
        )
    return "".join(attributes)


def _codepoints(value: str) -> str:
    return " ".join(f"U+{ord(character):04X}" for character in value)


def _is_private_use(character: str) -> bool:
    codepoint = ord(character)
    return (
        0xE000 <= codepoint <= 0xF8FF
        or 0xF0000 <= codepoint <= 0xFFFFD
        or 0x100000 <= codepoint <= 0x10FFFD
    )


def _points(twips: int) -> str:
    points = twips / 20
    return str(int(points)) if points.is_integer() else f"{points:g}"


def _parse_level(
    package: OOXMLPackage,
    element: etree._Element,
    base: Optional[_LevelDefinition],
) -> _LevelDefinition:
    level = _level_number(package, element)
    for singular_name in ("lvlJc", "pStyle"):
        _optional_single(package, element, singular_name)
    picture_bullet = _optional_single(package, element, "lvlPicBulletId")
    if picture_bullet is not None:
        raise NumberingError(
            f"Unsupported picture bullet at {package.source_path(picture_bullet)}"
        )

    start_node = _optional_single(package, element, "start")
    start = (
        _required_integer(package, start_node, "val", "start")
        if start_node is not None
        else (base.start if base is not None else 1)
    )
    format_node = _optional_single(package, element, "numFmt")
    number_format = (
        _required_attribute(package, format_node, "val")
        if format_node is not None
        else (base.number_format if base is not None else None)
    )
    if number_format is None:
        raise NumberingError(
            f"Numbering level lacks numFmt at {package.source_path(element)}"
        )
    if number_format not in _SUPPORTED_FORMATS:
        path = (
            package.source_path(format_node)
            if format_node is not None
            else package.source_path(element)
        )
        raise NumberingError(
            f"Unsupported numbering format {number_format} at {path}"
        )
    number_format_source_path = (
        package.source_path(format_node)
        if format_node is not None
        else base.number_format_source_path
    )
    text_node = _optional_single(package, element, "lvlText")
    level_text = (
        _required_attribute(package, text_node, "val")
        if text_node is not None
        else (base.level_text if base is not None else None)
    )
    if level_text is None:
        raise NumberingError(
            f"Numbering level lacks lvlText at {package.source_path(element)}"
        )
    if "%" in _PLACEHOLDER.sub("", level_text):
        path = (
            package.source_path(text_node)
            if text_node is not None
            else package.source_path(element)
        )
        raise NumberingError(
            f"Unsupported numbering placeholder in {level_text!r} at {path}"
        )
    level_text_source_path = (
        package.source_path(text_node)
        if text_node is not None
        else base.level_text_source_path
    )
    suffix_node = _optional_single(package, element, "suff")
    suffix = (
        _required_attribute(package, suffix_node, "val")
        if suffix_node is not None
        else (base.suffix if base is not None else "tab")
    )
    if suffix not in _SUPPORTED_SUFFIXES:
        path = (
            package.source_path(suffix_node)
            if suffix_node is not None
            else package.source_path(element)
        )
        raise NumberingError(f"Unsupported numbering suffix {suffix} at {path}")

    restart_node = _optional_single(package, element, "lvlRestart")
    if restart_node is not None:
        restart_value = _required_integer(
            package, restart_node, "val", "lvlRestart"
        )
        restart_after_level = None if restart_value == 0 else restart_value - 1
        if restart_after_level is not None and not 0 <= restart_after_level < level:
            raise NumberingError(
                f"Invalid lvlRestart {restart_value} for level {level} at "
                f"{package.source_path(restart_node)}"
            )
    elif base is not None:
        restart_after_level = base.restart_after_level
    else:
        restart_after_level = level - 1 if level > 0 else None

    paragraph_properties = _optional_single(package, element, "pPr")
    indentation = (
        _optional_single(package, paragraph_properties, "ind")
        if paragraph_properties is not None
        else None
    )
    if paragraph_properties is not None:
        _optional_single(package, paragraph_properties, "tabs")
    left = base.left_indent_twips if base is not None else None
    hanging = base.hanging_indent_twips if base is not None else None
    if indentation is not None:
        raw_left = _one_of_attributes(package, indentation, ("left", "start"))
        raw_hanging = indentation.get(f"{{{WORD_NS}}}hanging")
        if raw_left is not None:
            left = _integer(raw_left, indentation, package, "indentation")
        if raw_hanging is not None:
            hanging = _integer(raw_hanging, indentation, package, "hanging indentation")
        if indentation.get(f"{{{WORD_NS}}}firstLine") is not None:
            raise NumberingError(
                f"Unsupported firstLine numbering indentation at "
                f"{package.source_path(indentation)}"
            )
    legal_node = _optional_single(package, element, "isLgl")
    legal = (
        _on_off(package, legal_node)
        if legal_node is not None
        else (base.legal_numbering if base is not None else False)
    )

    run_properties = _optional_single(package, element, "rPr")
    fonts_node = (
        _optional_single(package, run_properties, "rFonts")
        if run_properties is not None
        else None
    )
    if fonts_node is not None:
        marker_fonts = tuple(
            sorted(
                (etree.QName(attribute).localname, value)
                for attribute, value in fonts_node.attrib.items()
                if etree.QName(attribute).namespace == WORD_NS
            )
        )
        marker_font_source_path = package.source_path(fonts_node)
    elif base is not None:
        marker_fonts = base.marker_fonts
        marker_font_source_path = base.marker_font_source_path
    else:
        marker_fonts = ()
        marker_font_source_path = None
    font_values = dict(marker_fonts)
    explicit_marker_fonts = tuple(
        font_values[name] for name in ("ascii", "hAnsi") if name in font_values
    )
    if (
        any(_is_private_use(character) for character in level_text)
        and len({font.casefold() for font in explicit_marker_fonts}) > 1
    ):
        raise NumberingError(
            f"Conflicting legacy marker fonts {explicit_marker_fonts!r} at "
            f"{marker_font_source_path} for {level_text_source_path}"
        )
    marker_font = explicit_marker_fonts[0] if explicit_marker_fonts else None
    display_level_text = _portable_marker_text(
        level_text,
        marker_font,
        level_text_source_path,
        marker_font_source_path,
    )
    return _LevelDefinition(
        level,
        number_format,
        level_text,
        start,
        suffix,
        left,
        hanging,
        restart_after_level,
        legal,
        display_level_text,
        marker_fonts,
        marker_font,
        marker_font_source_path,
        level_text_source_path,
        number_format_source_path,
    )


def _merge_num_pr(
    package: OOXMLPackage,
    num_pr: etree._Element,
    num_id: Optional[str],
    raw_level: Optional[str],
) -> Tuple[Optional[str], Optional[str]]:
    level_node = _optional_single(package, num_pr, "ilvl")
    num_node = _optional_single(package, num_pr, "numId")
    if level_node is not None:
        raw_level = _required_attribute(package, level_node, "val")
    if num_node is not None:
        num_id = _required_attribute(package, num_node, "val")
    return num_id, raw_level


def _level_number(package: OOXMLPackage, element: etree._Element) -> int:
    raw = _required_attribute(package, element, "ilvl")
    level = _integer(raw, element, package, "ilvl")
    if not 0 <= level <= 8:
        raise NumberingError(
            f"Unsupported numbering level {level} at {package.source_path(element)}"
        )
    return level


def _required_attribute(
    package: OOXMLPackage, element: etree._Element, name: str
) -> str:
    value = element.get(f"{{{WORD_NS}}}{name}")
    if value is None:
        raise NumberingError(
            f"Missing {name} at {package.source_path(element)}"
        )
    return value


def _required_integer(
    package: OOXMLPackage,
    element: etree._Element,
    attribute: str,
    label: str,
) -> int:
    return _integer(
        _required_attribute(package, element, attribute), element, package, label
    )


def _integer(
    raw: str,
    element: etree._Element,
    package: OOXMLPackage,
    label: str,
) -> int:
    try:
        return int(raw)
    except ValueError as error:
        raise NumberingError(
            f"Invalid {label} integer {raw} at {package.source_path(element)}"
        ) from error


def _optional_single(
    package: OOXMLPackage,
    parent: Optional[etree._Element],
    local_name: str,
) -> Optional[etree._Element]:
    if parent is None:
        return None
    children = parent.findall(f"{{{WORD_NS}}}{local_name}")
    if len(children) > 1:
        raise NumberingError(
            f"Duplicate w:{local_name} child at {package.source_path(children[1])}; "
            f"first at {package.source_path(children[0])}"
        )
    return children[0] if children else None


def _portable_marker_text(
    raw_text: str,
    marker_font: Optional[str],
    text_source_path: str,
    font_source_path: Optional[str],
) -> str:
    if not any(_is_private_use(character) for character in raw_text):
        return raw_text
    normalized_font = marker_font.casefold() if marker_font else ""
    portable = []
    for character in raw_text:
        if not _is_private_use(character):
            portable.append(character)
            continue
        key = (normalized_font, ord(character))
        try:
            portable.append(_LEGACY_MARKER_MAP[key])
        except KeyError as error:
            font_label = marker_font or "(missing font)"
            font_location = font_source_path or "(missing w:rFonts)"
            raise NumberingError(
                f"Unknown legacy marker U+{ord(character):04X} with font "
                f"{font_label} at {text_source_path}; font metadata at "
                f"{font_location}"
            ) from error
    return "".join(portable)


def _one_of_attributes(
    package: OOXMLPackage,
    element: etree._Element,
    names: Tuple[str, ...],
) -> Optional[str]:
    values = [
        element.get(f"{{{WORD_NS}}}{name}")
        for name in names
        if element.get(f"{{{WORD_NS}}}{name}") is not None
    ]
    if len(set(values)) > 1:
        raise NumberingError(
            f"Conflicting {'/'.join(names)} values at {package.source_path(element)}"
        )
    return values[0] if values else None


def _on_off(package: OOXMLPackage, element: etree._Element) -> bool:
    value = element.get(f"{{{WORD_NS}}}val")
    if value is None or value.lower() in ("1", "true", "on", "yes"):
        return True
    if value.lower() in ("0", "false", "off", "no"):
        return False
    raise NumberingError(
        f"Unsupported on/off value {value} at {package.source_path(element)}"
    )

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


@dataclass(frozen=True)
class ResolvedNumberingLevel(NumberingLevel):
    """A public NumberingLevel plus state needed for exact marker expansion."""

    restart_after_level: Optional[int] = None
    level_formats: Tuple[Optional[str], ...] = ()
    legal_numbering: bool = False


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


class NumberingResolver:
    """Resolve paragraph numPr through style, num, abstractNum, and overrides."""

    def __init__(self, package: OOXMLPackage) -> None:
        self.package = package
        self._style_resolver = StyleResolver(package)
        self._definitions = self._read_numbering()

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
        )

    def _paragraph_numbering(
        self, paragraph: etree._Element
    ) -> Tuple[Optional[str], int]:
        direct_properties = paragraph.find(f"{{{WORD_NS}}}pPr")
        style_id = _child_value(direct_properties, "pStyle")
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
            default_properties.find(f"{{{WORD_NS}}}numPr")
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
                properties.find(f"{{{WORD_NS}}}numPr")
                if properties is not None
                else None
            )
            if num_pr is not None:
                saw_num_pr = True
                num_id, raw_level = _merge_num_pr(
                    self.package, num_pr, num_id, raw_level
                )
        direct_num_pr = (
            direct_properties.find(f"{{{WORD_NS}}}numPr")
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
            abstract_reference = num.find(f"{{{WORD_NS}}}abstractNumId")
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
                replacement = override.find(f"{{{WORD_NS}}}lvl")
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
                start_override = override.find(f"{{{WORD_NS}}}startOverride")
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
                    )
            for level, definition in levels.items():
                for match in _PLACEHOLDER.finditer(definition.level_text):
                    referenced_level = int(match.group(1)) - 1
                    if referenced_level > level or referenced_level not in levels:
                        raise NumberingError(
                            f"Level {level} marker {definition.level_text!r} "
                            "references "
                            f"unavailable level {referenced_level} for numId {num_id}"
                        )
            definitions[num_id] = _NumberingDefinition(num_id, levels)
        return definitions


def inventory(package: OOXMLPackage) -> NumberingInventory:
    """Count resolved numbering formats and levels on source paragraphs."""
    resolver = NumberingResolver(package)
    formats: Counter[str] = Counter()
    levels: Counter[int] = Counter()
    for paragraph in package.document.findall(f".//{{{WORD_NS}}}p"):
        resolved = resolver.resolve_paragraph(paragraph)
        if resolved is not None:
            formats[resolved.number_format] += 1
            levels[resolved.level] += 1
    return NumberingInventory(dict(formats), dict(levels))


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
    return "".join(_render_block(block) for block in blocks)


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


def _render_block(block: ListBlock) -> str:
    tag = "ul" if block.number_format == "bullet" else "ol"
    attributes: List[str] = []
    if tag == "ol" and block.start != 1:
        attributes.append(f'start="{block.start}"')
    css_type = "none" if block.explicit_marker else _CSS_FORMATS[block.number_format]
    styles = [f"list-style-type:{css_type}"]
    if block.left_indent_twips is not None:
        styles.append(f"margin-left:{_points(block.left_indent_twips)}pt")
    if block.hanging_indent_twips is not None:
        styles.append(f"text-indent:-{_points(block.hanging_indent_twips)}pt")
    attributes.append(f'style="{";".join(styles)};"')
    opening = f"<{tag} {' '.join(attributes)}>"
    items = []
    for item in block.items:
        marker = ""
        if block.explicit_marker:
            marker = (
                '<span class="list-marker">'
                + escape(item.marker_text + _suffix_text(block.suffix), quote=False)
                + "</span>"
            )
        children = "".join(_render_block(child) for child in item.children)
        items.append(
            "<li>"
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
) -> str:
    level_text = numbering.level_text
    if "%" in _PLACEHOLDER.sub("", level_text):
        raise NumberingError(
            f"Unsupported numbering placeholder in {level_text!r} at {source_path}"
        )
    formats = getattr(numbering, "level_formats", ())
    legal = bool(getattr(numbering, "legal_numbering", False))

    def replace(match: re.Match[str]) -> str:
        referenced_level = int(match.group(1)) - 1
        key = (numbering.num_id, referenced_level)
        if referenced_level == numbering.level:
            value = marker_value
        elif key in counters:
            value = counters[key]
        else:
            raise NumberingError(
                f"Numbering marker {level_text!r} references unavailable level "
                f"{referenced_level} at {source_path}"
            )
        number_format = "decimal" if legal else (
            formats[referenced_level]
            if referenced_level < len(formats)
            else None
        )
        if number_format is None and referenced_level == numbering.level:
            number_format = numbering.number_format
        if number_format is None:
            raise NumberingError(
                f"Numbering marker {level_text!r} lacks format for level "
                f"{referenced_level} at {source_path}"
            )
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
    if suffix != "space":
        return False
    if numbering.number_format == "bullet":
        return numbering.level_text == "•"
    return numbering.level_text == f"%{numbering.level + 1}."


def _suffix_text(suffix: str) -> str:
    return {"nothing": "", "space": " ", "tab": "\t"}[suffix]


def _points(twips: int) -> str:
    points = twips / 20
    return str(int(points)) if points.is_integer() else f"{points:g}"


def _parse_level(
    package: OOXMLPackage,
    element: etree._Element,
    base: Optional[_LevelDefinition],
) -> _LevelDefinition:
    level = _level_number(package, element)
    start_node = element.find(f"{{{WORD_NS}}}start")
    start = (
        _required_integer(package, start_node, "val", "start")
        if start_node is not None
        else (base.start if base is not None else 1)
    )
    format_node = element.find(f"{{{WORD_NS}}}numFmt")
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
    text_node = element.find(f"{{{WORD_NS}}}lvlText")
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
    suffix_node = element.find(f"{{{WORD_NS}}}suff")
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

    restart_node = element.find(f"{{{WORD_NS}}}lvlRestart")
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

    indentation = element.find(f"{{{WORD_NS}}}pPr/{{{WORD_NS}}}ind")
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
    legal_node = element.find(f"{{{WORD_NS}}}isLgl")
    legal = (
        _on_off(package, legal_node)
        if legal_node is not None
        else (base.legal_numbering if base is not None else False)
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
    )


def _merge_num_pr(
    package: OOXMLPackage,
    num_pr: etree._Element,
    num_id: Optional[str],
    raw_level: Optional[str],
) -> Tuple[Optional[str], Optional[str]]:
    level_node = num_pr.find(f"{{{WORD_NS}}}ilvl")
    num_node = num_pr.find(f"{{{WORD_NS}}}numId")
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


def _child_value(parent: Optional[etree._Element], local_name: str) -> Optional[str]:
    if parent is None:
        return None
    child = parent.find(f"{{{WORD_NS}}}{local_name}")
    return child.get(f"{{{WORD_NS}}}val") if child is not None else None


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

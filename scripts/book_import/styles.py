"""Deterministic WordprocessingML paragraph and run style inheritance."""

from __future__ import annotations

import colorsys
from typing import Dict, Iterable, List, Optional, Tuple

from lxml import etree

from .model import ParagraphStyle, RunStyle
from .package import DRAWING_NS, OOXMLPackage, WORD_NS


class StyleResolutionError(ValueError):
    """A style cannot be resolved faithfully from the source OOXML."""


class StyleResolver:
    def __init__(self, package: OOXMLPackage) -> None:
        self.package = package
        self._styles: Dict[Tuple[str, str], etree._Element] = {}
        self._default_style_ids: Dict[str, str] = {}
        if package.styles is not None:
            for style in package.styles.findall(f"{{{WORD_NS}}}style"):
                style_type = style.get(f"{{{WORD_NS}}}type")
                style_id = style.get(f"{{{WORD_NS}}}styleId")
                if not style_type or not style_id:
                    raise StyleResolutionError(
                        f"Style lacks type or styleId at {package.source_path(style)}"
                    )
                key = (style_type, style_id)
                if key in self._styles:
                    raise StyleResolutionError(
                        f"Duplicate {style_type} style ID {style_id}"
                    )
                self._styles[key] = style
                if _attribute_on(style, "default"):
                    self._default_style_ids[style_type] = style_id
        self._theme_colors, self._theme_fonts = self._read_theme()

    def resolve_paragraph(self, paragraph: etree._Element) -> ParagraphStyle:
        values: Dict[str, object] = {}
        defaults = self._doc_default_properties("pPrDefault", "pPr")
        if defaults is not None:
            self._merge_paragraph_properties(values, defaults)

        direct_properties = paragraph.find(f"{{{WORD_NS}}}pPr")
        style_id = _child_value(direct_properties, "pStyle")
        effective_style_id = style_id or self._default_style_ids.get("paragraph")
        for style in self._style_chain(effective_style_id, "paragraph"):
            self._merge_paragraph_properties(
                values, style.find(f"{{{WORD_NS}}}pPr")
            )
        if direct_properties is not None:
            self._merge_paragraph_properties(values, direct_properties)
        values["style_id"] = style_id
        return ParagraphStyle(**values)

    def resolve_run(
        self,
        run: etree._Element,
        paragraph: Optional[etree._Element] = None,
    ) -> RunStyle:
        values: Dict[str, object] = {}
        defaults = self._doc_default_properties("rPrDefault", "rPr")
        if defaults is not None:
            self._merge_run_properties(values, defaults)

        if paragraph is None:
            paragraph = next(
                (
                    ancestor
                    for ancestor in run.iterancestors(f"{{{WORD_NS}}}p")
                ),
                None,
            )
        if paragraph is not None:
            paragraph_properties = paragraph.find(f"{{{WORD_NS}}}pPr")
            paragraph_style_id = _child_value(paragraph_properties, "pStyle")
            effective_paragraph_style = (
                paragraph_style_id or self._default_style_ids.get("paragraph")
            )
            for style in self._style_chain(
                effective_paragraph_style, "paragraph"
            ):
                self._merge_run_properties(
                    values,
                    style.find(f"{{{WORD_NS}}}rPr"),
                    style_toggle=True,
                )

        run_properties = run.find(f"{{{WORD_NS}}}rPr")
        character_style_id = _child_value(run_properties, "rStyle")
        for style in self._character_style_chain(character_style_id):
            self._merge_run_properties(
                values,
                style.find(f"{{{WORD_NS}}}rPr"),
                style_toggle=True,
            )
        if paragraph is not None and paragraph_properties is not None:
            self._merge_run_properties(
                values, paragraph_properties.find(f"{{{WORD_NS}}}rPr")
            )
        if run_properties is not None:
            self._merge_run_properties(values, run_properties)
        return RunStyle(**values)

    def run_is_hidden(
        self,
        run: etree._Element,
        paragraph: Optional[etree._Element] = None,
    ) -> bool:
        """Resolve vanish/webHidden through the same inheritance order as run style."""
        values: Dict[str, bool] = {}
        defaults = self._doc_default_properties("rPrDefault", "rPr")
        self._merge_visibility(values, defaults, style_toggle=False)

        if paragraph is None:
            paragraph = next(
                (ancestor for ancestor in run.iterancestors(f"{{{WORD_NS}}}p")),
                None,
            )
        if paragraph is not None:
            paragraph_properties = paragraph.find(f"{{{WORD_NS}}}pPr")
            paragraph_style_id = _child_value(paragraph_properties, "pStyle")
            effective_paragraph_style = (
                paragraph_style_id or self._default_style_ids.get("paragraph")
            )
            for style in self._style_chain(effective_paragraph_style, "paragraph"):
                self._merge_visibility(
                    values,
                    style.find(f"{{{WORD_NS}}}rPr"),
                    style_toggle=True,
                )

        run_properties = run.find(f"{{{WORD_NS}}}rPr")
        character_style_id = _child_value(run_properties, "rStyle")
        for style in self._character_style_chain(character_style_id):
            self._merge_visibility(
                values,
                style.find(f"{{{WORD_NS}}}rPr"),
                style_toggle=True,
            )
        if paragraph is not None and paragraph_properties is not None:
            self._merge_visibility(
                values,
                paragraph_properties.find(f"{{{WORD_NS}}}rPr"),
                style_toggle=False,
            )
        self._merge_visibility(values, run_properties, style_toggle=False)
        return values.get("vanish", False) or values.get("web_hidden", False)

    def _doc_default_properties(
        self, wrapper_name: str, properties_name: str
    ) -> Optional[etree._Element]:
        if self.package.styles is None:
            return None
        return self.package.styles.find(
            f"{{{WORD_NS}}}docDefaults/{{{WORD_NS}}}{wrapper_name}/"
            f"{{{WORD_NS}}}{properties_name}"
        )

    def _style_chain(
        self, style_id: Optional[str], style_type: str
    ) -> Tuple[etree._Element, ...]:
        if not style_id:
            return ()
        chain: List[etree._Element] = []
        visited: List[str] = []
        current_id: Optional[str] = style_id
        while current_id:
            if current_id in visited:
                cycle_start = visited.index(current_id)
                cycle = visited[cycle_start:] + [current_id]
                raise StyleResolutionError(
                    f"{style_type.capitalize()} style ancestry cycle: "
                    + " -> ".join(cycle)
                )
            visited.append(current_id)
            try:
                style = self._styles[(style_type, current_id)]
            except KeyError as error:
                raise StyleResolutionError(
                    f"Unresolved {style_type} style ID {current_id}"
                ) from error
            chain.append(style)
            current_id = _child_value(style, "basedOn")
        chain.reverse()
        return tuple(chain)

    def _character_style_chain(
        self, selected_style_id: Optional[str]
    ) -> Tuple[etree._Element, ...]:
        default_style_id = self._default_style_ids.get("character")
        combined = (
            *self._style_chain(default_style_id, "character"),
            *self._style_chain(selected_style_id, "character"),
        )
        unique_chain: List[etree._Element] = []
        seen_ids = set()
        for style in combined:
            style_id = style.get(f"{{{WORD_NS}}}styleId")
            if style_id not in seen_ids:
                seen_ids.add(style_id)
                unique_chain.append(style)
        return tuple(unique_chain)

    def _merge_paragraph_properties(
        self, values: Dict[str, object], properties: Optional[etree._Element]
    ) -> None:
        if properties is None:
            return
        alignment = _child_value(properties, "jc")
        if alignment is not None:
            values["alignment"] = alignment

        indentation = properties.find(f"{{{WORD_NS}}}ind")
        if indentation is not None:
            self._set_int_attribute(
                values, "left_indent_twips", indentation, ("left", "start")
            )
            self._set_int_attribute(
                values, "right_indent_twips", indentation, ("right", "end")
            )
            first_line = _first_attribute(indentation, ("firstLine",))
            hanging = _first_attribute(indentation, ("hanging",))
            if first_line is not None:
                values["first_line_indent_twips"] = _integer(
                    first_line, indentation, self.package
                )
            elif hanging is not None:
                values["first_line_indent_twips"] = -_integer(
                    hanging, indentation, self.package
                )

        spacing = properties.find(f"{{{WORD_NS}}}spacing")
        if spacing is not None:
            self._set_int_attribute(values, "space_before_twips", spacing, ("before",))
            self._set_int_attribute(values, "space_after_twips", spacing, ("after",))
            line = _first_attribute(spacing, ("line",))
            if line is not None:
                line_rule = _first_attribute(spacing, ("lineRule",))
                values["line_spacing"] = (
                    f"{line}:{line_rule}" if line_rule is not None else line
                )

        for xml_name, field_name in (
            ("keepNext", "keep_next"),
            ("keepLines", "keep_lines"),
        ):
            child = properties.find(f"{{{WORD_NS}}}{xml_name}")
            if child is not None:
                values[field_name] = _on_off(child)

        bidi = properties.find(f"{{{WORD_NS}}}bidi")
        if bidi is not None:
            values["direction"] = "rtl" if _on_off(bidi) else "ltr"
        text_direction = _child_value(properties, "textDirection")
        if text_direction is not None:
            values["direction"] = text_direction

    def _set_int_attribute(
        self,
        values: Dict[str, object],
        field_name: str,
        element: etree._Element,
        attribute_names: Iterable[str],
    ) -> None:
        raw = _first_attribute(element, attribute_names)
        if raw is not None:
            values[field_name] = _integer(raw, element, self.package)

    def _merge_run_properties(
        self,
        values: Dict[str, object],
        properties: Optional[etree._Element],
        *,
        style_toggle: bool = False,
    ) -> None:
        if properties is None:
            return
        for xml_name, field_name in (
            ("b", "bold"),
            ("i", "italic"),
            ("strike", "strike"),
        ):
            child = properties.find(f"{{{WORD_NS}}}{xml_name}")
            if child is not None:
                if style_toggle:
                    if _on_off(child):
                        values[field_name] = not bool(values.get(field_name, False))
                else:
                    values[field_name] = _on_off(child)

        underline = properties.find(f"{{{WORD_NS}}}u")
        if underline is not None:
            underline_kind = underline.get(f"{{{WORD_NS}}}val") or "single"
            if underline_kind in ("none", "0", "false", "off"):
                values["underline"] = None
            else:
                underline_color = self._resolve_color(
                    underline, required=False, value_attribute_is_color=False
                )
                values["underline"] = (
                    f"{underline_kind}:{underline_color}"
                    if underline_color is not None
                    else underline_kind
                )

        for xml_name, field_name in (
            ("vertAlign", "vertical_align"),
            ("highlight", "highlight"),
        ):
            value = _child_value(properties, xml_name)
            if value is not None:
                values[field_name] = value

        color = properties.find(f"{{{WORD_NS}}}color")
        if color is not None:
            values["color"] = self._resolve_color(color, required=True)

        fonts = properties.find(f"{{{WORD_NS}}}rFonts")
        if fonts is not None:
            family = _first_attribute(fonts, ("ascii", "hAnsi", "eastAsia", "cs"))
            if family is None:
                theme_font = _first_attribute(
                    fonts,
                    ("asciiTheme", "hAnsiTheme", "eastAsiaTheme", "cstheme"),
                )
                if theme_font is not None:
                    family = self._theme_fonts.get(theme_font, f"theme:{theme_font}")
            if family is not None:
                values["font_family"] = family

        size = properties.find(f"{{{WORD_NS}}}sz")
        if size is not None:
            raw_size = size.get(f"{{{WORD_NS}}}val")
            if raw_size is None:
                raise StyleResolutionError(
                    f"Font size lacks a value at {self.package.source_path(size)}"
                )
            values["font_size_half_points"] = _integer(
                raw_size, size, self.package
            )

    def _merge_visibility(
        self,
        values: Dict[str, bool],
        properties: Optional[etree._Element],
        *,
        style_toggle: bool,
    ) -> None:
        if properties is None:
            return
        for xml_name, field_name in (("vanish", "vanish"), ("webHidden", "web_hidden")):
            child = properties.find(f"{{{WORD_NS}}}{xml_name}")
            if child is None:
                continue
            if style_toggle:
                if _on_off(child):
                    values[field_name] = not values.get(field_name, False)
            else:
                values[field_name] = _on_off(child)

    def _resolve_color(
        self,
        element: etree._Element,
        *,
        required: bool,
        value_attribute_is_color: bool = True,
    ) -> Optional[str]:
        theme_name = element.get(f"{{{WORD_NS}}}themeColor")
        literal = element.get(f"{{{WORD_NS}}}color")
        if literal is None and value_attribute_is_color:
            literal = element.get(f"{{{WORD_NS}}}val")
        if theme_name:
            try:
                color = self._theme_colors[theme_name]
            except KeyError as error:
                raise StyleResolutionError(
                    f"Unresolved theme color {theme_name} at "
                    f"{self.package.source_path(element)}"
                ) from error
            tint = element.get(f"{{{WORD_NS}}}themeTint")
            shade = element.get(f"{{{WORD_NS}}}themeShade")
            if tint:
                color = _apply_luminance_transform(color, tint, tinting=True, element=element, package=self.package)
            if shade:
                color = _apply_luminance_transform(color, shade, tinting=False, element=element, package=self.package)
            return f"#{color}"
        if literal is None:
            if required:
                raise StyleResolutionError(
                    f"Color lacks val or themeColor at {self.package.source_path(element)}"
                )
            return None
        if literal.lower() == "auto":
            return "auto"
        if not re_full_hex(literal):
            raise StyleResolutionError(
                f"Invalid color {literal} at {self.package.source_path(element)}"
            )
        return f"#{literal.upper()}"

    def _read_theme(self) -> Tuple[Dict[str, str], Dict[str, str]]:
        colors: Dict[str, str] = {}
        fonts: Dict[str, str] = {}
        theme = self.package.theme
        if theme is None:
            return colors, fonts
        scheme = theme.find(f".//{{{DRAWING_NS}}}clrScheme")
        if scheme is not None:
            for slot in scheme:
                if not isinstance(slot.tag, str):
                    continue
                name = etree.QName(slot).localname
                color_node = next(
                    (child for child in slot if isinstance(child.tag, str)), None
                )
                if color_node is None:
                    continue
                color = color_node.get("val")
                if not color or not re_full_hex(color):
                    color = color_node.get("lastClr")
                if color and re_full_hex(color):
                    colors[name] = color.upper()
        for alias, slot in (
            ("background1", "lt1"),
            ("text1", "dk1"),
            ("background2", "lt2"),
            ("text2", "dk2"),
            ("hyperlink", "hlink"),
            ("followedHyperlink", "folHlink"),
        ):
            if slot in colors:
                colors[alias] = colors[slot]
        font_scheme = theme.find(f".//{{{DRAWING_NS}}}fontScheme")
        if font_scheme is not None:
            for category, prefix in (("majorFont", "major"), ("minorFont", "minor")):
                group = font_scheme.find(f"{{{DRAWING_NS}}}{category}")
                if group is None:
                    continue
                for tag_name, suffixes in (
                    ("latin", ("Ascii", "HAnsi")),
                    ("ea", ("EastAsia",)),
                    ("cs", ("Bidi",)),
                ):
                    node = group.find(f"{{{DRAWING_NS}}}{tag_name}")
                    typeface = node.get("typeface") if node is not None else None
                    if typeface:
                        for suffix in suffixes:
                            fonts[f"{prefix}{suffix}"] = typeface
        return colors, fonts


def _child_value(parent: Optional[etree._Element], local_name: str) -> Optional[str]:
    if parent is None:
        return None
    child = parent.find(f"{{{WORD_NS}}}{local_name}")
    return child.get(f"{{{WORD_NS}}}val") if child is not None else None


def _first_attribute(element: etree._Element, names: Iterable[str]) -> Optional[str]:
    for name in names:
        value = element.get(f"{{{WORD_NS}}}{name}")
        if value is not None:
            return value
    return None


def _on_off(element: etree._Element) -> bool:
    value = element.get(f"{{{WORD_NS}}}val")
    return value is None or value.lower() not in ("0", "false", "off", "no")


def _attribute_on(element: etree._Element, name: str) -> bool:
    value = element.get(f"{{{WORD_NS}}}{name}")
    return value is not None and value.lower() not in ("0", "false", "off", "no")


def _integer(raw: str, element: etree._Element, package: OOXMLPackage) -> int:
    try:
        return int(raw)
    except ValueError as error:
        raise StyleResolutionError(
            f"Invalid integer {raw} at {package.source_path(element)}"
        ) from error


def re_full_hex(value: str) -> bool:
    return len(value) == 6 and all(character in "0123456789abcdefABCDEF" for character in value)


def _apply_luminance_transform(
    color: str,
    transform: str,
    *,
    tinting: bool,
    element: etree._Element,
    package: OOXMLPackage,
) -> str:
    try:
        amount = int(transform, 16) / 255.0
    except ValueError as error:
        raise StyleResolutionError(
            f"Invalid theme color transform {transform} at {package.source_path(element)}"
        ) from error
    red, green, blue = (int(color[index : index + 2], 16) / 255 for index in (0, 2, 4))
    hue, luminance, saturation = colorsys.rgb_to_hls(red, green, blue)
    luminance = luminance + (1.0 - luminance) * amount if tinting else luminance * amount
    transformed = colorsys.hls_to_rgb(hue, luminance, saturation)
    return "".join(f"{round(channel * 255):02X}" for channel in transformed)

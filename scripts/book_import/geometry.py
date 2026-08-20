"""Direct DrawingML guide and path evaluation for the source geometry set."""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Dict, Iterable, Mapping, Optional, Sequence, Tuple

from lxml import etree


A = "http://schemas.openxmlformats.org/drawingml/2006/main"


class UnsupportedDrawingError(ValueError):
    """DrawingML cannot be mapped exactly to the closed SVG representation."""


@dataclass(frozen=True)
class GeometryPath:
    d: str
    fill: bool = True
    stroke: bool = True


@dataclass(frozen=True)
class CompiledGeometry:
    name: str
    width: int
    height: int
    paths: Tuple[GeometryPath, ...]


PRESET_GEOMETRIES = (
    "straightConnector1",
    "rect",
    "line",
    "downArrow",
    "rightBracket",
    "bentConnector3",
    "rightArrow",
    "leftBracket",
    "triangle",
    "upArrow",
    "curvedConnector3",
    "ellipse",
    "plus",
)


def compile_preset_geometry(
    preset: str,
    width: int,
    height: int,
    adjustments: Optional[Mapping[str, int]] = None,
    topic_id: str = "unknown-topic",
    source_path: str = "unknown-path",
) -> CompiledGeometry:
    """Evaluate one of the thirteen ECMA-376 geometries present in the book."""
    _positive_extent(width, height, topic_id, source_path)
    if preset not in PRESET_GEOMETRIES:
        _unsupported(topic_id, source_path, f"preset geometry {preset!r}")
    values = _base_guides(width, height)
    supplied = dict(adjustments or {})

    if preset in ("straightConnector1", "line"):
        paths = (_path(("M", 0, 0), ("L", width, height), fill=False),)
    elif preset == "rect":
        paths = (_path(("M", 0, 0), ("L", width, 0), ("L", width, height), ("L", 0, height), ("Z",)),)
    elif preset == "ellipse":
        paths = (_ellipse_path(width, height),)
    elif preset == "triangle":
        adjustment = _clamp(supplied.get("adj", 50000), 0, 100000)
        apex = width * adjustment / 100000
        paths = (_path(("M", 0, height), ("L", apex, 0), ("L", width, height), ("Z",)),)
    elif preset == "plus":
        adjustment = _clamp(supplied.get("adj", 25000), 0, 50000)
        inset = min(width, height) * adjustment / 100000
        x2, y2 = width - inset, height - inset
        paths = (_path(
            ("M", 0, inset), ("L", inset, inset), ("L", inset, 0),
            ("L", x2, 0), ("L", x2, inset), ("L", width, inset),
            ("L", width, y2), ("L", x2, y2), ("L", x2, height),
            ("L", inset, height), ("L", inset, y2), ("L", 0, y2), ("Z",),
        ),)
    elif preset == "bentConnector3":
        x1 = width * supplied.get("adj1", 50000) / 100000
        paths = (_path(("M", 0, 0), ("L", x1, 0), ("L", x1, height), ("L", width, height), fill=False),)
    elif preset == "curvedConnector3":
        x2 = width * supplied.get("adj1", 50000) / 100000
        x1, x3 = x2 / 2, (width + x2) / 2
        paths = (_path(
            ("M", 0, 0),
            ("C", x1, 0, x2, height / 4, x2, height / 2),
            ("C", x2, height * 3 / 4, x3, height, width, height),
            fill=False,
        ),)
    elif preset in ("rightArrow", "upArrow", "downArrow"):
        paths = (_arrow_path(preset, width, height, supplied),)
    elif preset in ("rightBracket", "leftBracket"):
        paths = _bracket_paths(preset, width, height, supplied)
    else:  # pragma: no cover - the closed set above is exhaustive
        _unsupported(topic_id, source_path, f"preset geometry {preset!r}")
    return CompiledGeometry(preset, width, height, paths)


def compile_custom_geometry(
    custom_geometry: etree._Element,
    width: int,
    height: int,
    topic_id: str,
    source_path: str,
) -> CompiledGeometry:
    """Evaluate DrawingML guides and paths without substituting interpreted art."""
    _positive_extent(width, height, topic_id, source_path)
    if etree.QName(custom_geometry).localname != "custGeom":
        _unsupported(topic_id, source_path, "element is not a:custGeom")
    path_list = custom_geometry.find(f"{{{A}}}pathLst")
    paths = tuple(path_list.findall(f"{{{A}}}path")) if path_list is not None else ()
    reference_width = _integer_attribute(paths[0], "w", width, topic_id, source_path) if paths else width
    reference_height = _integer_attribute(paths[0], "h", height, topic_id, source_path) if paths else height
    values = _base_guides(reference_width, reference_height)
    _evaluate_guide_list(custom_geometry.find(f"{{{A}}}avLst"), values, topic_id, source_path)
    _evaluate_guide_list(custom_geometry.find(f"{{{A}}}gdLst"), values, topic_id, source_path)

    compiled = []
    for path_index, path in enumerate(paths, 1):
        path_width = _integer_attribute(path, "w", reference_width, topic_id, source_path)
        path_height = _integer_attribute(path, "h", reference_height, topic_id, source_path)
        if path_width <= 0 or path_height <= 0:
            _unsupported(topic_id, source_path, f"non-positive custom path extent at path[{path_index}]")
        scale_x, scale_y = width / path_width, height / path_height
        d, current = [], (0.0, 0.0)
        for command_index, command in enumerate(path, 1):
            local = etree.QName(command).localname
            diagnostic = f"{source_path}/a:pathLst[1]/a:path[{path_index}]/a:{local}[{command_index}]"
            if local == "moveTo":
                point = _single_point(command, values, topic_id, diagnostic)
                current = point
                d.append(f"M {_number(point[0] * scale_x)} {_number(point[1] * scale_y)}")
            elif local == "lnTo":
                point = _single_point(command, values, topic_id, diagnostic)
                current = point
                d.append(f"L {_number(point[0] * scale_x)} {_number(point[1] * scale_y)}")
            elif local in ("quadBezTo", "cubicBezTo"):
                expected = 2 if local == "quadBezTo" else 3
                points = _points(command, values, topic_id, diagnostic)
                if len(points) != expected:
                    _unsupported(topic_id, diagnostic, f"{local} requires {expected} points")
                letter = "Q" if expected == 2 else "C"
                d.append(letter + " " + " ".join(
                    f"{_number(x * scale_x)} {_number(y * scale_y)}" for x, y in points
                ))
                current = points[-1]
            elif local == "arcTo":
                radius_x = _resolve(command.get("wR"), values, topic_id, diagnostic)
                radius_y = _resolve(command.get("hR"), values, topic_id, diagnostic)
                start = _resolve(command.get("stAng"), values, topic_id, diagnostic)
                sweep = _resolve(command.get("swAng"), values, topic_id, diagnostic)
                arc, current = _arc_command(current, radius_x, radius_y, start, sweep, scale_x, scale_y)
                d.append(arc)
            elif local == "close":
                d.append("Z")
            else:
                _unsupported(topic_id, diagnostic, f"path command {local!r}")
        if not d:
            _unsupported(topic_id, source_path, f"empty custom path[{path_index}]")
        compiled.append(
            GeometryPath(
                " ".join(d),
                fill=path.get("fill", "norm") != "none",
                stroke=path.get("stroke", "true").lower() not in ("0", "false", "off"),
            )
        )
    return CompiledGeometry("custom", width, height, tuple(compiled))


def evaluate_formula(
    formula: str,
    values: Mapping[str, float],
    topic_id: str,
    source_path: str,
) -> float:
    parts = formula.split()
    if not parts:
        _unsupported(topic_id, source_path, "empty guide formula")
    operation, arguments = parts[0], parts[1:]
    arities = {
        "val": 1, "abs": 1, "sqrt": 1,
        "*/": 3, "+-": 3, "+/": 3, "?:": 3, "pin": 3,
        "max": 2, "min": 2, "mod": 3, "at2": 2,
        "cos": 2, "sin": 2, "tan": 2, "cat2": 3, "sat2": 3,
    }
    if operation not in arities:
        _unsupported(topic_id, source_path, f"guide formula {operation!r}")
    if len(arguments) != arities[operation]:
        _unsupported(topic_id, source_path, f"guide formula {operation!r} arity")
    numbers = [_resolve(argument, values, topic_id, source_path) for argument in arguments]
    try:
        if operation == "val": return numbers[0]
        if operation == "abs": return abs(numbers[0])
        if operation == "sqrt": return math.sqrt(numbers[0])
        if operation == "*/": return numbers[0] * numbers[1] / numbers[2]
        if operation == "+-": return numbers[0] + numbers[1] - numbers[2]
        if operation == "+/": return (numbers[0] + numbers[1]) / numbers[2]
        if operation == "?:": return numbers[1] if numbers[0] > 0 else numbers[2]
        if operation == "pin": return _clamp(numbers[1], numbers[0], numbers[2])
        if operation == "max": return max(numbers)
        if operation == "min": return min(numbers)
        if operation == "mod": return math.sqrt(sum(number * number for number in numbers))
        if operation == "at2": return math.degrees(math.atan2(numbers[0], numbers[1])) * 60000
        angle = math.radians(numbers[-1] / 60000)
        if operation == "cos": return numbers[0] * math.cos(angle)
        if operation == "sin": return numbers[0] * math.sin(angle)
        if operation == "tan": return numbers[0] * math.tan(angle)
        hypotenuse = math.hypot(numbers[1], numbers[2])
        if operation == "cat2": return numbers[0] * numbers[1] / hypotenuse
        if operation == "sat2": return numbers[0] * numbers[2] / hypotenuse
    except (ValueError, ZeroDivisionError) as error:
        raise UnsupportedDrawingError(
            f"{topic_id}: invalid guide formula {formula!r} at {source_path}: {error}"
        ) from error
    _unsupported(topic_id, source_path, f"guide formula {operation!r}")


def _base_guides(width: int, height: int) -> Dict[str, float]:
    short = min(width, height)
    long = max(width, height)
    values: Dict[str, float] = {
        "l": 0, "t": 0, "r": width, "b": height,
        "w": width, "h": height, "hc": width / 2, "vc": height / 2,
        "ss": short, "ls": long,
        "cd2": 10800000, "cd4": 5400000, "cd8": 2700000,
        "3cd4": 16200000, "5cd8": 13500000, "7cd8": 18900000,
    }
    for divisor in (2, 3, 4, 5, 6, 8, 10, 12, 16, 32):
        values[f"wd{divisor}"] = width / divisor
        values[f"hd{divisor}"] = height / divisor
        values[f"ssd{divisor}"] = short / divisor
    return values


def _evaluate_guide_list(
    guide_list: Optional[etree._Element],
    values: Dict[str, float],
    topic_id: str,
    source_path: str,
) -> None:
    if guide_list is None:
        return
    for index, guide in enumerate(guide_list.findall(f"{{{A}}}gd"), 1):
        name, formula = guide.get("name"), guide.get("fmla")
        diagnostic = f"{source_path}/a:{etree.QName(guide_list).localname}[1]/a:gd[{index}]"
        if not name or not formula:
            _unsupported(topic_id, diagnostic, "guide lacks name or formula")
        values[name] = evaluate_formula(formula, values, topic_id, diagnostic)


def _arrow_path(name: str, width: int, height: int, supplied: Mapping[str, int]) -> GeometryPath:
    short = min(width, height)
    a1 = _clamp(supplied.get("adj1", 50000), 0, 100000)
    max_a2 = 100000 * (width if name == "rightArrow" else height) / short
    a2 = _clamp(supplied.get("adj2", 50000), 0, max_a2)
    if name == "rightArrow":
        dx = short * a2 / 100000
        x1 = width - dx
        dy = height * a1 / 200000
        y1, y2 = height / 2 - dy, height / 2 + dy
        return _path(("M", 0, y1), ("L", x1, y1), ("L", x1, 0), ("L", width, height / 2), ("L", x1, height), ("L", x1, y2), ("L", 0, y2), ("Z",))
    dy = short * a2 / 100000
    dx = width * a1 / 200000
    x1, x2 = width / 2 - dx, width / 2 + dx
    if name == "upArrow":
        y2 = dy
        return _path(("M", 0, y2), ("L", width / 2, 0), ("L", width, y2), ("L", x2, y2), ("L", x2, height), ("L", x1, height), ("L", x1, y2), ("Z",))
    y1 = height - dy
    return _path(("M", 0, y1), ("L", x1, y1), ("L", x1, 0), ("L", x2, 0), ("L", x2, y1), ("L", width, y1), ("L", width / 2, height), ("Z",))


def _bracket_paths(name: str, width: int, height: int, supplied: Mapping[str, int]) -> Tuple[GeometryPath, ...]:
    max_adjustment = 50000 * height / min(width, height)
    adjustment = _clamp(supplied.get("adj", 8333), 0, max_adjustment)
    y1 = min(width, height) * adjustment / 100000
    y2 = height - y1
    if name == "rightBracket":
        commands = (("M", 0, 0), ("A", width, y1, 16200000, 5400000), ("L", width, y2), ("A", width, y1, 0, 5400000))
    else:
        commands = (("M", width, height), ("A", width, y1, 5400000, 5400000), ("L", 0, y1), ("A", width, y1, 10800000, 5400000))
    outline = _commands_with_arcs(commands, close=True, fill=True)
    stroke = _commands_with_arcs(commands, close=False, fill=False)
    return outline, stroke


def _commands_with_arcs(commands: Sequence[tuple], *, close: bool, fill: bool) -> GeometryPath:
    d = []
    current = (0.0, 0.0)
    for command in commands:
        if command[0] == "M":
            current = (float(command[1]), float(command[2]))
            d.append(f"M {_number(current[0])} {_number(current[1])}")
        elif command[0] == "L":
            current = (float(command[1]), float(command[2]))
            d.append(f"L {_number(current[0])} {_number(current[1])}")
        else:
            arc, current = _arc_command(current, command[1], command[2], command[3], command[4], 1, 1)
            d.append(arc)
    if close:
        d.append("Z")
    return GeometryPath(" ".join(d), fill=fill, stroke=True)


def _ellipse_path(width: int, height: int) -> GeometryPath:
    return GeometryPath(
        f"M 0 {_number(height / 2)} "
        f"A {_number(width / 2)} {_number(height / 2)} 0 1 0 {_number(width)} {_number(height / 2)} "
        f"A {_number(width / 2)} {_number(height / 2)} 0 1 0 0 {_number(height / 2)} Z"
    )


def _path(*commands: tuple, fill: bool = True, stroke: bool = True) -> GeometryPath:
    parts = []
    for command in commands:
        letter = command[0]
        if letter == "Z":
            parts.append("Z")
        else:
            parts.append(letter + " " + " ".join(_number(value) for value in command[1:]))
    return GeometryPath(" ".join(parts), fill=fill, stroke=stroke)


def _points(
    command: etree._Element,
    values: Mapping[str, float],
    topic_id: str,
    source_path: str,
) -> Tuple[Tuple[float, float], ...]:
    result = []
    for point in command.findall(f"{{{A}}}pt"):
        result.append((
            _resolve(point.get("x"), values, topic_id, source_path),
            _resolve(point.get("y"), values, topic_id, source_path),
        ))
    return tuple(result)


def _single_point(
    command: etree._Element,
    values: Mapping[str, float],
    topic_id: str,
    source_path: str,
) -> Tuple[float, float]:
    points = _points(command, values, topic_id, source_path)
    if len(points) != 1:
        _unsupported(topic_id, source_path, "path command requires exactly one point")
    return points[0]


def _arc_command(
    current: Tuple[float, float],
    radius_x: float,
    radius_y: float,
    start_angle: float,
    sweep_angle: float,
    scale_x: float,
    scale_y: float,
) -> tuple[str, Tuple[float, float]]:
    start_radians = math.radians(start_angle / 60000)
    end_radians = math.radians((start_angle + sweep_angle) / 60000)
    center_x = current[0] - radius_x * math.cos(start_radians)
    center_y = current[1] - radius_y * math.sin(start_radians)
    end = (
        center_x + radius_x * math.cos(end_radians),
        center_y + radius_y * math.sin(end_radians),
    )
    large = 1 if abs(sweep_angle) > 10800000 else 0
    sweep = 1 if sweep_angle >= 0 else 0
    command = (
        f"A {_number(abs(radius_x * scale_x))} {_number(abs(radius_y * scale_y))} "
        f"0 {large} {sweep} {_number(end[0] * scale_x)} {_number(end[1] * scale_y)}"
    )
    return command, end


def _resolve(
    token: Optional[str],
    values: Mapping[str, float],
    topic_id: str,
    source_path: str,
) -> float:
    if token is None:
        _unsupported(topic_id, source_path, "missing guide/path coordinate")
    try:
        return float(token)
    except ValueError:
        try:
            return float(values[token])
        except KeyError as error:
            raise UnsupportedDrawingError(
                f"{topic_id}: unresolved guide {token!r} at {source_path}"
            ) from error


def _integer_attribute(
    element: etree._Element,
    name: str,
    default: int,
    topic_id: str,
    source_path: str,
) -> int:
    raw = element.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError as error:
        raise UnsupportedDrawingError(
            f"{topic_id}: invalid integer {raw!r} at {source_path}"
        ) from error


def _positive_extent(width: int, height: int, topic_id: str, source_path: str) -> None:
    if width <= 0 or height <= 0:
        _unsupported(topic_id, source_path, f"non-positive geometry extent {width}x{height}")


def _clamp(value: float, low: float, high: float) -> float:
    return min(max(value, low), high)


def _number(value: float) -> str:
    if abs(value) < 1e-9:
        return "0"
    if float(value).is_integer():
        return str(int(value))
    return (f"{value:.8f}").rstrip("0").rstrip(".")


def _unsupported(topic_id: str, source_path: str, detail: str):
    raise UnsupportedDrawingError(f"{topic_id}: unsupported {detail} at {source_path}")

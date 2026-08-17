"""Read-only, fail-closed access to the OOXML members used by the compiler."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePosixPath
import re
from typing import BinaryIO, Dict, Mapping, Optional, Tuple, Union
from zipfile import BadZipFile, ZipFile

from lxml import etree


WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
XML_NS = "http://www.w3.org/XML/1998/namespace"

NAMESPACES = {
    "w": WORD_NS,
    "r": OFFICE_REL_NS,
    "a": DRAWING_NS,
    "pr": REL_NS,
}

XML_PARTS = (
    "word/document.xml",
    "word/styles.xml",
    "word/numbering.xml",
    "word/fontTable.xml",
    "word/theme/theme1.xml",
    "word/_rels/document.xml.rels",
)


class OOXMLPackageError(ValueError):
    """The DOCX package cannot be interpreted without guessing."""


@dataclass(frozen=True)
class Relationship:
    relationship_id: str
    relationship_type: str
    target: str
    target_mode: Optional[str]
    target_part: Optional[str]
    source_path: str


@dataclass(frozen=True)
class Bookmark:
    bookmark_id: str
    name: str
    start_path: str
    end_path: Optional[str]


class OOXMLPackage:
    """Parsed OOXML parts kept entirely in memory; no ZIP member is extracted."""

    def __init__(
        self,
        members: Mapping[str, bytes],
        roots: Mapping[str, etree._Element],
        paths: Mapping[etree._Element, str],
        relationships: Tuple[Relationship, ...],
    ) -> None:
        self._members = dict(members)
        self._roots = dict(roots)
        self._paths = dict(paths)
        self.relationships = relationships
        self.document_relationships = {
            relationship.relationship_id: relationship
            for relationship in relationships
            if relationship.source_path.startswith("word/_rels/document.xml.rels/")
        }
        self.hyperlinks = {
            relationship.relationship_id: relationship.target
            for relationship in self.document_relationships.values()
            if relationship.relationship_type.endswith("/hyperlink")
        }
        self.bookmarks = self._collect_bookmarks()

    @classmethod
    def from_file(cls, source: Union[str, BinaryIO]) -> "OOXMLPackage":
        try:
            with ZipFile(source, "r") as archive:
                members: Dict[str, bytes] = {}
                for info in archive.infolist():
                    normalized = _normalize_member_name(info.filename)
                    if normalized in members:
                        raise OOXMLPackageError(
                            f"Duplicate ZIP member after normalization: {normalized}"
                        )
                    if info.is_dir():
                        continue
                    members[normalized] = archive.read(info)
        except OOXMLPackageError:
            raise
        except (BadZipFile, OSError) as error:
            raise OOXMLPackageError(f"Invalid DOCX ZIP package: {error}") from error

        if "word/document.xml" not in members:
            raise OOXMLPackageError("Missing required OOXML member word/document.xml")
        if "word/_rels/document.xml.rels" not in members:
            raise OOXMLPackageError(
                "Missing required OOXML member word/_rels/document.xml.rels"
            )

        roots: Dict[str, etree._Element] = {}
        paths: Dict[etree._Element, str] = {}
        for member_name in XML_PARTS:
            if member_name in members:
                root = _parse_xml(member_name, members[member_name])
                roots[member_name] = root
                _index_paths(member_name, root, paths)

        relationships = _parse_all_relationships(members, roots, paths)
        return cls(members, roots, paths, relationships)

    @property
    def document(self) -> etree._Element:
        return self._roots["word/document.xml"]

    @property
    def styles(self) -> Optional[etree._Element]:
        return self._roots.get("word/styles.xml")

    @property
    def numbering(self) -> Optional[etree._Element]:
        return self._roots.get("word/numbering.xml")

    @property
    def font_table(self) -> Optional[etree._Element]:
        return self._roots.get("word/fontTable.xml")

    @property
    def theme(self) -> Optional[etree._Element]:
        return self._roots.get("word/theme/theme1.xml")

    def source_path(self, element: etree._Element) -> str:
        try:
            return self._paths[element]
        except KeyError as error:
            raise OOXMLPackageError("Element is not part of a loaded OOXML XML member") from error

    def member_bytes(self, member_name: str) -> bytes:
        normalized = _normalize_member_name(member_name)
        try:
            return self._members[normalized]
        except KeyError as error:
            raise OOXMLPackageError(f"Missing OOXML member {normalized}") from error

    def _collect_bookmarks(self) -> Tuple[Bookmark, ...]:
        starts: Dict[str, tuple[str, str]] = {}
        ends: Dict[str, str] = {}
        for element in self.document.iter():
            local_name = etree.QName(element).localname
            if local_name == "bookmarkStart":
                bookmark_id = element.get(f"{{{WORD_NS}}}id")
                name = element.get(f"{{{WORD_NS}}}name")
                if bookmark_id is None or name is None:
                    raise OOXMLPackageError(
                        f"Bookmark start lacks id or name at {self.source_path(element)}"
                    )
                if bookmark_id in starts:
                    raise OOXMLPackageError(f"Duplicate bookmark ID {bookmark_id}")
                starts[bookmark_id] = (name, self.source_path(element))
            elif local_name == "bookmarkEnd":
                bookmark_id = element.get(f"{{{WORD_NS}}}id")
                if bookmark_id is None:
                    raise OOXMLPackageError(
                        f"Bookmark end lacks id at {self.source_path(element)}"
                    )
                if bookmark_id in ends:
                    raise OOXMLPackageError(f"Duplicate bookmark end ID {bookmark_id}")
                ends[bookmark_id] = self.source_path(element)
        return tuple(
            Bookmark(bookmark_id, name, start_path, ends.get(bookmark_id))
            for bookmark_id, (name, start_path) in starts.items()
        )


def _normalize_member_name(member_name: str) -> str:
    candidate = member_name.replace("\\", "/")
    if candidate.startswith("/") or re.match(r"^[A-Za-z]:", candidate):
        raise OOXMLPackageError(f"Absolute ZIP member path is forbidden: {member_name}")
    parts = []
    for part in PurePosixPath(candidate).parts:
        if part == "..":
            raise OOXMLPackageError(f"ZIP member path traversal is forbidden: {member_name}")
        if part not in ("", "."):
            parts.append(part)
    if not parts:
        raise OOXMLPackageError(f"Empty ZIP member path is forbidden: {member_name}")
    return "/".join(parts)


def _parse_xml(member_name: str, contents: bytes) -> etree._Element:
    if b"<!DOCTYPE" in contents.upper():
        raise OOXMLPackageError(f"DOCTYPE is forbidden in OOXML member {member_name}")
    parser = etree.XMLParser(
        resolve_entities=False,
        no_network=True,
        load_dtd=False,
        recover=False,
        huge_tree=False,
        remove_blank_text=False,
    )
    try:
        return etree.fromstring(contents, parser=parser)
    except etree.XMLSyntaxError as error:
        raise OOXMLPackageError(f"Malformed XML in {member_name}: {error}") from error


def _qualified_name(tag: str) -> str:
    qualified = etree.QName(tag)
    for prefix, namespace in NAMESPACES.items():
        if namespace == qualified.namespace:
            return f"{prefix}:{qualified.localname}"
    if qualified.namespace:
        return f"{{{qualified.namespace}}}{qualified.localname}"
    return qualified.localname


def _index_paths(
    member_name: str,
    root: etree._Element,
    paths: Dict[etree._Element, str],
) -> None:
    def visit(element: etree._Element, parent_path: str, index: int) -> None:
        element_path = f"{parent_path}/{_qualified_name(element.tag)}[{index}]"
        paths[element] = element_path
        counts: Dict[str, int] = {}
        for child in element:
            if not isinstance(child.tag, str):
                continue
            counts[child.tag] = counts.get(child.tag, 0) + 1
            visit(child, element_path, counts[child.tag])

    visit(root, member_name, 1)


def _relationship_part_base(relationship_member: str) -> str:
    path = PurePosixPath(relationship_member)
    if path.name == ".rels" and str(path.parent) == "_rels":
        return ""
    if path.parent.name != "_rels" or not path.name.endswith(".rels"):
        raise OOXMLPackageError(f"Invalid relationships member path: {relationship_member}")
    source_name = path.name[: -len(".rels")]
    return str(path.parent.parent / source_name)


def _resolve_internal_target(relationship_member: str, target: str) -> str:
    target_path = target.split("#", 1)[0].replace("\\", "/")
    if target_path.startswith("/"):
        return _normalize_member_name(target_path[1:])
    source_part = _relationship_part_base(relationship_member)
    base_parts = list(PurePosixPath(source_part).parent.parts) if source_part else []
    for part in PurePosixPath(target_path).parts:
        if part in ("", "."):
            continue
        if part == "..":
            if not base_parts:
                raise OOXMLPackageError(
                    f"Relationship target escapes package root: {target}"
                )
            base_parts.pop()
        else:
            base_parts.append(part)
    if not base_parts:
        raise OOXMLPackageError(f"Empty relationship target: {target}")
    return "/".join(base_parts)


def _parse_all_relationships(
    members: Mapping[str, bytes],
    loaded_roots: Dict[str, etree._Element],
    paths: Dict[etree._Element, str],
) -> Tuple[Relationship, ...]:
    result = []
    relationship_members = sorted(
        name for name in members if name.endswith(".rels")
    )
    for member_name in relationship_members:
        root = loaded_roots.get(member_name)
        if root is None:
            root = _parse_xml(member_name, members[member_name])
            loaded_roots[member_name] = root
            _index_paths(member_name, root, paths)
        seen_ids = set()
        for element in root.findall(f"{{{REL_NS}}}Relationship"):
            relationship_id = element.get("Id")
            relationship_type = element.get("Type")
            target = element.get("Target")
            if not relationship_id or not relationship_type or target is None:
                raise OOXMLPackageError(
                    f"Incomplete relationship at {paths[element]}"
                )
            if relationship_id in seen_ids:
                raise OOXMLPackageError(
                    f"Duplicate relationship ID {relationship_id} in {member_name}"
                )
            seen_ids.add(relationship_id)
            target_mode = element.get("TargetMode")
            external = target_mode is not None and target_mode.lower() == "external"
            if external and relationship_type.endswith("/image"):
                raise OOXMLPackageError(
                    f"External image relationship {relationship_id} is forbidden"
                )
            target_part = None
            if not external:
                target_part = _resolve_internal_target(member_name, target)
                if target_part not in members:
                    raise OOXMLPackageError(
                        f"Relationship {relationship_id} has missing target {target_part}"
                    )
            result.append(
                Relationship(
                    relationship_id,
                    relationship_type,
                    target,
                    target_mode,
                    target_part,
                    paths[element],
                )
            )
    return tuple(result)

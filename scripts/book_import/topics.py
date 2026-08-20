"""Deterministic book/topic boundaries resolved only through TOC bookmarks."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import DefaultDict, Dict, List, Sequence, Tuple

from lxml import etree

from .constants import BOOK_COUNT, EXPECTED_BOOK_IDS, TOPIC_COUNT, assert_compilation_invariants
from .events import extract_events
from .model import DocumentNode, TextEvent, TopicBoundary, TopicDocument
from .numbering import NumberingResolver
from .package import OOXMLPackage, WORD_NS
from .styles import StyleResolver


class TopicMappingError(ValueError):
    """The source navigation or ownership topology cannot be mapped exactly."""


@dataclass(frozen=True)
class BookBoundary:
    book_id: str
    toc_level: str
    anchor: str
    start_source_path: str
    title: str


@dataclass(frozen=True)
class TopicMappingResult:
    books: Tuple[BookBoundary, ...]
    topics: Tuple[TopicDocument, ...]
    unowned_body_nodes: List[str]
    multiply_owned_body_nodes: List[str]
    toc_anchor_count: int


@dataclass(frozen=True)
class _TOCEntry:
    level: str
    anchor: str
    paragraph_path: str
    bookmark_path: str
    body_child_index: int
    book_index: int
    topic_index_in_book: int | None


@dataclass(frozen=True)
class _TOCScan:
    entries: Tuple[_TOCEntry, ...]
    books: Tuple[_TOCEntry, ...]
    topics: Tuple[_TOCEntry, ...]


_TOC_LEVELS = ("TOC1", "TOC2", "TOC3")
_OWNABLE_BODY_ELEMENTS = {
    "p": "paragraph",
    "tbl": "table",
    "drawing": "drawing",
    "pict": "drawing",
}


def map_topics(package: OOXMLPackage) -> Tuple[TopicBoundary, ...]:
    """Return the frozen 285 topic boundaries in existing ID order."""
    return _topic_boundaries(_scan_toc(package))


def map_topic_documents(package: OOXMLPackage) -> TopicMappingResult:
    """Map every study-body top-level node to exactly one topic."""
    scan = _scan_toc(package)
    boundaries = _topic_boundaries(scan)
    extraction = extract_events(package)
    titles = _toc_titles(scan.entries, extraction.visible_events)
    events_by_body_node = _events_by_body_node(extraction.visible_events)

    books = tuple(
        BookBoundary(
            book_id=EXPECTED_BOOK_IDS[entry.book_index],
            toc_level=entry.level,
            anchor=entry.anchor,
            start_source_path=entry.bookmark_path,
            title=titles[entry.anchor],
        )
        for entry in scan.books
    )

    body = package.document.find(f"{{{WORD_NS}}}body")
    if body is None:
        raise TopicMappingError("word/document.xml has no w:body")
    body_children = tuple(child for child in body if isinstance(child.tag, str))
    topic_positions = tuple(entry.body_child_index for entry in scan.topics)
    first_topic_position = topic_positions[0]

    owners: DefaultDict[int, List[int]] = defaultdict(list)
    study_body_indices = []
    for body_index, element in enumerate(body_children):
        local_name = etree.QName(element).localname
        if local_name not in _OWNABLE_BODY_ELEMENTS or body_index < first_topic_position:
            continue
        study_body_indices.append(body_index)

    for topic_number, start_position in enumerate(topic_positions):
        end_position = (
            topic_positions[topic_number + 1]
            if topic_number + 1 < len(topic_positions)
            else len(body_children)
        )
        for body_index in study_body_indices:
            if start_position <= body_index < end_position:
                owners[body_index].append(topic_number)

    unowned = [
        package.source_path(body_children[index])
        for index in study_body_indices
        if not owners[index]
    ]
    multiply_owned = [
        package.source_path(body_children[index])
        for index in study_body_indices
        if len(owners[index]) > 1
    ]
    if unowned or multiply_owned:
        raise TopicMappingError(
            "Study-body ownership is not one-to-one: "
            f"unowned={unowned}, multiply_owned={multiply_owned}"
        )

    style_resolver = StyleResolver(package)
    numbering_resolver = NumberingResolver(package)
    nodes_by_topic: DefaultDict[int, List[DocumentNode]] = defaultdict(list)
    for index in study_body_indices:
        owner = owners[index]
        if len(owner) == 1:
            topic_number = owner[0]
            node = _document_node(
                package,
                body_children[index],
                events_by_body_node,
                style_resolver=style_resolver,
                numbering_resolver=numbering_resolver,
            )
            nodes_by_topic[topic_number].append(node)

    topics = []
    for topic_number, (entry, boundary) in enumerate(zip(scan.topics, boundaries)):
        nodes = tuple(nodes_by_topic[topic_number])
        topics.append(TopicDocument(boundary, nodes, titles[entry.anchor]))

    return TopicMappingResult(
        books=books,
        topics=tuple(topics),
        unowned_body_nodes=unowned,
        multiply_owned_body_nodes=multiply_owned,
        toc_anchor_count=len(scan.entries),
    )


def _scan_toc(package: OOXMLPackage) -> _TOCScan:
    body = package.document.find(f"{{{WORD_NS}}}body")
    if body is None:
        raise TopicMappingError("word/document.xml has no w:body")

    toc_paragraphs = []
    for paragraph in body.iter(f"{{{WORD_NS}}}p"):
        style_element = paragraph.find(
            f"./{{{WORD_NS}}}pPr/{{{WORD_NS}}}pStyle"
        )
        style = (
            style_element.get(f"{{{WORD_NS}}}val")
            if style_element is not None
            else None
        )
        if style in _TOC_LEVELS:
            toc_paragraphs.append((paragraph, style))

    book_count = sum(1 for _, level in toc_paragraphs if level == "TOC1")
    topic_count = len(toc_paragraphs) - book_count
    if book_count != BOOK_COUNT:
        raise TopicMappingError(
            f"Expected {BOOK_COUNT} TOC1 entries, got {book_count}"
        )
    if topic_count != TOPIC_COUNT:
        raise TopicMappingError(
            f"Expected {TOPIC_COUNT} TOC2/TOC3 entries, got {topic_count}"
        )

    anchors = []
    paragraph_rows = []
    for paragraph, level in toc_paragraphs:
        hyperlinks = paragraph.findall(f".//{{{WORD_NS}}}hyperlink")
        hyperlink_anchors = [
            anchor
            for hyperlink in hyperlinks
            if (anchor := hyperlink.get(f"{{{WORD_NS}}}anchor"))
        ]
        if len(hyperlinks) != 1 or len(hyperlink_anchors) != 1:
            raise TopicMappingError(
                f"{level} entry at {package.source_path(paragraph)} must have exactly one "
                f"hyperlink anchor; found {len(hyperlink_anchors)}"
            )
        anchor = hyperlink_anchors[0]
        if anchor in anchors:
            raise TopicMappingError(f"Duplicate TOC anchor {anchor}")
        anchors.append(anchor)
        paragraph_rows.append((paragraph, level, anchor))

    bookmarks_by_name: DefaultDict[str, list] = defaultdict(list)
    for bookmark in package.bookmarks:
        bookmarks_by_name[bookmark.name].append(bookmark)

    body_children = tuple(child for child in body if isinstance(child.tag, str))
    body_child_indices = {id(child): index for index, child in enumerate(body_children)}
    elements_by_path = {
        package.source_path(element): element
        for element in package.document.iter()
        if isinstance(element.tag, str)
    }

    entries = []
    books = []
    topics = []
    current_book_index = -1
    topics_in_current_book = 0
    prior_position = -1
    for paragraph, level, anchor in paragraph_rows:
        matching_bookmarks = bookmarks_by_name.get(anchor, [])
        if not matching_bookmarks:
            raise TopicMappingError(f"Unknown TOC anchor {anchor}: no matching bookmarkStart")
        if len(matching_bookmarks) != 1:
            raise TopicMappingError(
                f"TOC anchor {anchor} must have exactly one matching bookmarkStart; "
                f"found {len(matching_bookmarks)}"
            )
        bookmark = matching_bookmarks[0]
        bookmark_element = elements_by_path[bookmark.start_path]
        body_child = bookmark_element
        while body_child.getparent() is not body:
            body_child = body_child.getparent()
            if body_child is None:
                raise TopicMappingError(
                    f"TOC anchor {anchor} is not inside the document body"
                )
        body_position = body_child_indices[id(body_child)]
        if body_position <= prior_position:
            raise TopicMappingError(
                f"TOC anchor is out of document order at {anchor}: "
                f"body index {body_position} follows {prior_position}"
            )
        prior_position = body_position

        if level == "TOC1":
            current_book_index += 1
            topics_in_current_book = 0
            entry = _TOCEntry(
                level,
                anchor,
                package.source_path(paragraph),
                bookmark.start_path,
                body_position,
                current_book_index,
                None,
            )
            books.append(entry)
        else:
            if current_book_index < 0:
                raise TopicMappingError(
                    f"{level} entry {anchor} appears before the first TOC1 entry"
                )
            topics_in_current_book += 1
            entry = _TOCEntry(
                level,
                anchor,
                package.source_path(paragraph),
                bookmark.start_path,
                body_position,
                current_book_index,
                topics_in_current_book,
            )
            topics.append(entry)
        entries.append(entry)

    if any(
        not any(topic.book_index == book_index for topic in topics)
        for book_index in range(BOOK_COUNT)
    ):
        raise TopicMappingError("Every TOC1 book must contain at least one TOC2/TOC3 topic")

    assert_compilation_invariants(
        (EXPECTED_BOOK_IDS[entry.book_index] for entry in books),
        len(topics),
    )
    return _TOCScan(tuple(entries), tuple(books), tuple(topics))


def _topic_boundaries(scan: _TOCScan) -> Tuple[TopicBoundary, ...]:
    boundaries = []
    for index, entry in enumerate(scan.topics):
        next_path = (
            scan.topics[index + 1].bookmark_path
            if index + 1 < len(scan.topics)
            else None
        )
        boundaries.append(
            TopicBoundary(
                book_id=EXPECTED_BOOK_IDS[entry.book_index],
                topic_id=(
                    f"t-mm-{entry.book_index + 1:02d}-{entry.topic_index_in_book:03d}"
                ),
                toc_level=entry.level,
                anchor=entry.anchor,
                start_source_path=entry.bookmark_path,
                end_source_path=next_path,
            )
        )
    return tuple(boundaries)


def _toc_titles(
    entries: Sequence[_TOCEntry], visible_events: Sequence[TextEvent]
) -> Dict[str, str]:
    title_parts: DefaultDict[str, List[str]] = defaultdict(list)
    known_targets = {f"#{entry.anchor}": entry.anchor for entry in entries}
    for event in visible_events:
        anchor = known_targets.get(event.hyperlink_target or "")
        if anchor is not None:
            title_parts[anchor].append(event.value)

    titles = {}
    for entry in entries:
        title = "".join(title_parts[entry.anchor])
        if not title:
            raise TopicMappingError(
                f"TOC anchor {entry.anchor} has no exact visible title events"
            )
        titles[entry.anchor] = title
    return titles


def _events_by_body_node(
    visible_events: Sequence[TextEvent],
) -> Dict[str, Tuple[TextEvent, ...]]:
    body_prefix = "word/document.xml/w:document[1]/w:body[1]/"
    grouped: DefaultDict[str, List[TextEvent]] = defaultdict(list)
    for event in visible_events:
        if not event.source_path.startswith(body_prefix):
            continue
        remainder = event.source_path[len(body_prefix) :]
        top_level_segment = remainder.split("/", 1)[0]
        grouped[body_prefix + top_level_segment].append(event)
    return {path: tuple(events) for path, events in grouped.items()}


def _document_node(
    package: OOXMLPackage,
    element: etree._Element,
    events_by_body_node: Dict[str, Tuple[TextEvent, ...]],
    style_resolver: Optional[StyleResolver] = None,
    numbering_resolver: Optional[NumberingResolver] = None,
) -> DocumentNode:
    source_path = package.source_path(element)
    local_name = etree.QName(element).localname
    kind = _OWNABLE_BODY_ELEMENTS[local_name]
    paragraph_style = None
    numbering = None
    if kind == "paragraph":
        if style_resolver is not None:
            paragraph_style = style_resolver.resolve_paragraph(element)
        if numbering_resolver is not None:
            numbering = numbering_resolver.resolve_paragraph(element)
    return DocumentNode(
        kind=kind,
        source_path=source_path,
        text_events=events_by_body_node.get(source_path, ()),
        paragraph_style=paragraph_style,
        numbering=numbering,
    )

# Responsive Book Content Fidelity Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for every behavior change and `superpowers:verification-before-completion` before any completion claim.

**Goal:** Compile the authoritative Maternal Mind DOCX into source-locked, responsive, selectable topic documents that preserve every educational text and structural event, retain genuine diagrams as faithful figures, render identically in the admin preview and subscribed mobile reader, and can be activated and rolled back in production without changing the existing books, topics, user activity, MCQs, or subscription rules.

**Architecture:** Replace the heuristic extractor with a deterministic OOXML compiler. It maps the 13 books and 285 current topic IDs through TOC bookmarks, emits allowlisted semantic HTML plus versioned figure assets and an exact fidelity manifest, and produces deterministic `document_html` content blocks. A pure shared TypeScript contract builds the same isolated document shell for an admin iframe and the existing native WebView. A dedicated content-release command snapshots and transactionally replaces only the 285 target topics' content blocks; ordinary application deployment is prohibited from importing SQL.

**Tech Stack:** Python 3.12 (`zipfile`, `lxml`, Pillow, `unittest`), OOXML/DrawingML, semantic HTML/CSS, TypeScript 5.9, React 19, React Native/Expo 54, `react-native-webview`, Node 20, Zod, Drizzle-backed PostgreSQL/MySQL, Playwright, GitHub Actions, Hostinger, self-hosted Expo Updates.

**Spec:** `docs/superpowers/specs/2026-08-17-responsive-book-content-fidelity-design.md`

## Global Constraints

- The authoritative input is `Maternal Mind Education Content/BOOK MATERNAL MIND BY DR.FARZANA MUNEER(FINAL).docx`, expected SHA-256 `f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605`.
- Treat all educational content as immutable. Never correct, normalize, summarize, translate, infer, rewrite, merge, split, reorder, OCR, or manually retype it. HTML escaping and deterministic OOXML-to-CSS mapping are the only permitted transformations.
- Preserve books `book-mm-01` through `book-mm-13`, the current one-chapter-per-book records, all 285 `t-mm-*` topic IDs and ordering, `isPaid`, publication state, progress, bookmarks, MCQs, subscriptions, users, and audit data.
- Topic body text must remain selectable responsive text. Only genuine source pictures/diagrams may render as images or SVG. Keep every complete diagram composition intact; never rebuild it from medical interpretation.
- Every unsupported source node, drawing geometry, relationship, media format, sanitizer decision, source/output event mismatch, or ambiguous bookmark is a hard compilation failure. A failed validation must not emit an activatable release.
- Generated content uses UTF-8 without newline rewriting. The raw source event stream, not a normalized diagnostic comparison, is the release gate.
- Generated release assets are additive and content-addressed. Never overwrite the active release's assets.
- No command, log, snapshot, manifest, workflow artifact, or report may contain database credentials, access tokens, or student data.
- The existing native WebView dependency is sufficient; do not add native packages or require a store build unless verification proves the active runtime lacks it.
- Do not touch the unrelated untracked workspace files shown by `git status`. Each commit must contain only the task's intended files.

---

### Task 1: Freeze the authoritative corpus and executable acceptance constants

**Files:**

- Create: `scripts/book_import/__init__.py`
- Create: `scripts/book_import/constants.py`
- Create: `scripts/book_import/model.py`
- Create: `scripts/book_import/requirements.txt`
- Create: `scripts/tests/__init__.py`
- Create: `scripts/tests/test_book_source_contract.py`
- Modify: `package.json`

**Step 1: Write the failing source-contract test**

```python
# scripts/tests/test_book_source_contract.py
from pathlib import Path
import hashlib
import unittest

from scripts.book_import.constants import (
    BOOK_COUNT,
    SOURCE_SHA256,
    TOPIC_COUNT,
    authoritative_source,
)


class BookSourceContractTest(unittest.TestCase):
    def test_authoritative_source_digest_and_counts_are_frozen(self):
        source = authoritative_source(Path.cwd())
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), SOURCE_SHA256)
        self.assertEqual(BOOK_COUNT, 13)
        self.assertEqual(TOPIC_COUNT, 285)
```

Run: `python -m unittest scripts.tests.test_book_source_contract -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.book_import'`.

**Step 2: Add immutable constants and typed compiler models**

`constants.py` must expose the exact source path, digest, `BOOK_COUNT = 13`, `TOPIC_COUNT = 285`, `MAX_FRAGMENT_UTF8_BYTES = 48 * 1024`, and the 13 expected book IDs. `model.py` must define frozen dataclasses for `TextEvent`, `RunStyle`, `ParagraphStyle`, `NumberingLevel`, `TableCell`, `TableModel`, `DrawingObject`, `DocumentNode`, `TopicBoundary`, `TopicDocument`, `ReleaseBlock`, and `ValidationIssue`.

Do not put corrected titles or medical content into constants. Titles are copied from the TOC at compile time.

Pin only the compiler dependencies:

```text
lxml==6.1.1
Pillow==12.3.0
```

Add scripts:

```json
"test:book-import": "python -m unittest discover -s scripts/tests -p \"test_*.py\" -v",
"test:book-document": "tsx --test tests/book-document-contract.test.ts",
"verify:book-release": "python scripts/compile_maternal_mind_book.py verify"
```

**Step 3: Run the test to green**

Run: `python -m unittest scripts.tests.test_book_source_contract -v`

Expected: PASS with the exact digest and counts.

**Step 4: Commit**

```powershell
git add package.json scripts/book_import scripts/tests/test_book_source_contract.py scripts/tests/__init__.py
git commit -m "test: freeze maternal mind book source contract"
```

---

### Task 2: Parse OOXML relationships, styles, events, and bookmarks without text loss

**Files:**

- Create: `scripts/book_import/package.py`
- Create: `scripts/book_import/styles.py`
- Create: `scripts/book_import/events.py`
- Create: `scripts/tests/fixtures.py`
- Create: `scripts/tests/test_ooxml_events.py`
- Create: `scripts/tests/test_style_resolution.py`

**Step 1: Write minimal DOCX fixtures and failing event tests**

`fixtures.py` must create tiny in-memory DOCX ZIPs from explicit XML strings; it must not use Word or rewrite fixture text. Cover `xml:space="preserve"`, repeated spaces, `w:tab`, `w:br`, `w:cr`, `w:noBreakHyphen`, `w:softHyphen`, non-breaking spaces, hyperlinks, bookmarks, field-code display text, hidden/deleted text, and empty paragraphs.

```python
def test_text_event_stream_preserves_every_source_code_point(self):
    events = parse_fixture_events(" A  B\tC\nD\u00a0E\u2011F\u00adG")
    self.assertEqual(
        [(event.kind, event.value) for event in events],
        [
            ("text", " A  B"),
            ("tab", "\t"),
            ("text", "C"),
            ("line_break", "\n"),
            ("text", "D\u00a0E"),
            ("no_break_hyphen", "\u2011"),
            ("text", "F"),
            ("soft_hyphen", "\u00ad"),
            ("text", "G"),
        ],
    )
```

Run: `python -m unittest scripts.tests.test_ooxml_events scripts.tests.test_style_resolution -v`

Expected: FAIL because the package/event/style readers do not exist.

**Step 2: Implement the read-only OOXML package layer**

`package.py` must:

- normalize ZIP member paths without extracting the DOCX;
- reject path traversal, duplicate relationships, missing targets, external image targets, and malformed XML;
- load `document.xml`, `styles.xml`, `numbering.xml`, `fontTable.xml`, `theme1.xml`, and `document.xml.rels`;
- preserve document-order element paths for diagnostics;
- expose bookmarks and hyperlink relationships without performing title matching.

**Step 3: Implement exact event extraction and style inheritance**

`events.py` must copy source characters directly and emit explicit event kinds for text, tabs, line breaks, page breaks, non-breaking hyphens, soft hyphens, paragraph boundaries, and empty paragraphs. Do not call `.strip()`, collapse whitespace, or use a regex cleanup pass.

`styles.py` must resolve document defaults, paragraph ancestry, character ancestry, paragraph/run properties, then direct formatting. Preserve bold, italic, underline kind/color, strike, vertical alignment, highlight, foreground color, font family, font size, alignment, indentation, spacing, keep rules, and direction. Detect style cycles and unresolved theme colors as errors.

**Step 4: Run the tests to green and refactor**

Run: `python -m unittest scripts.tests.test_ooxml_events scripts.tests.test_style_resolution -v`

Expected: PASS. Add one regression assertion proving an apparent typo and unusual medical unit remain byte-for-byte unchanged.

**Step 5: Commit**

```powershell
git add scripts/book_import/package.py scripts/book_import/styles.py scripts/book_import/events.py scripts/tests/fixtures.py scripts/tests/test_ooxml_events.py scripts/tests/test_style_resolution.py
git commit -m "feat: preserve exact ooxml text and styles"
```

---

### Task 3: Map all source body elements to the existing topics by TOC bookmark

**Files:**

- Create: `scripts/book_import/topics.py`
- Create: `scripts/tests/test_topic_boundaries.py`
- Create: `scripts/tests/test_full_book_boundaries.py`

**Step 1: Write failing bookmark-boundary tests**

Cover nested TOC content controls, one anchor per `TOC1`/`TOC2`/`TOC3` entry, the sequence mapping to `book-mm-XX` and `t-mm-XX-NNN`, and failures for missing, duplicate, unknown, and out-of-order anchors. Include two identical topic titles to prove matching is anchor-based rather than text-based.

```python
def test_duplicate_titles_are_mapped_by_unique_bookmark_not_text(self):
    mapping = map_topics(duplicate_title_fixture())
    self.assertNotEqual(mapping[0].anchor, mapping[1].anchor)
    self.assertEqual([m.topic_id for m in mapping], ["t-mm-01-001", "t-mm-01-002"])
```

Run: `python -m unittest scripts.tests.test_topic_boundaries -v`

Expected: FAIL because `topics.py` does not exist.

**Step 2: Implement deterministic topic ownership**

Recursively read TOC paragraphs inside structured document tags. Require exactly 13 `TOC1` and exactly 285 `TOC2`/`TOC3` entries, each with one unique hyperlink anchor and one matching `bookmarkStart`. Map by sequence only; preserve each TOC level in the manifest. Assign every top-level body paragraph/table/drawing from a topic bookmark to the next topic bookmark. Exclude the cover and generated TOC only. Reject zero-owner and multi-owner nodes.

**Step 3: Add the real-book boundary gate**

The full-book test must assert:

```python
self.assertEqual(len(result.books), 13)
self.assertEqual(len(result.topics), 285)
self.assertEqual(result.unowned_body_nodes, [])
self.assertEqual(result.multiply_owned_body_nodes, [])
self.assertEqual(result.toc_anchor_count, 298)
```

Run: `python -m unittest scripts.tests.test_topic_boundaries scripts.tests.test_full_book_boundaries -v`

Expected: PASS and identify all 298 TOC anchors without a substring match.

**Step 4: Commit**

```powershell
git add scripts/book_import/topics.py scripts/tests/test_topic_boundaries.py scripts/tests/test_full_book_boundaries.py
git commit -m "feat: map book topics through toc bookmarks"
```

---

### Task 4: Preserve Word numbering and nested list semantics

**Files:**

- Create: `scripts/book_import/numbering.py`
- Create: `scripts/tests/test_numbering.py`

**Step 1: Write failing list tests**

Fixtures must cover bullets, decimal, lower/upper Roman, lower/upper letter, custom `lvlText`, suffixes, indentation, continuation across paragraphs, explicit restart, `startOverride`, levels 0-8, and a changed `numId` at the same level.

```python
def test_num_id_change_does_not_invent_a_deeper_level(self):
    html = render_numbering_fixture("same-level-new-num-id")
    self.assertEqual(html.count("<ol"), 2)
    self.assertNotIn("<ol><li><ol>", html)
```

Run: `python -m unittest scripts.tests.test_numbering -v`

Expected: FAIL because numbering resolution is absent.

**Step 2: Implement numbering resolution and list-tree construction**

Resolve `numId -> abstractNumId -> lvl`, overrides, starts, formats, level text, suffix, indentation, and paragraph-style numbering. Construct lists from `ilvl` and continuation state only. Render actual `ol`/`ul`, `start`, and CSS marker styles; use an explicit marker span only when HTML list primitives cannot represent the source `lvlText`. Do not delete source marker punctuation.

**Step 3: Run to green and check the real format inventory**

Run: `python -m unittest scripts.tests.test_numbering -v`

Expected: PASS.

Run the compiler's inventory subcommand after Task 9 exists; until then expose `numbering.inventory()` and assert the source contains non-zero bullet, decimal, lower-Roman, and lower-letter paragraphs. This guards against the current all-`ul` regression.

**Step 4: Commit**

```powershell
git add scripts/book_import/numbering.py scripts/tests/test_numbering.py
git commit -m "feat: preserve word numbering and list nesting"
```

---

### Task 5: Preserve complete table structure and responsive overflow

**Files:**

- Create: `scripts/book_import/tables.py`
- Create: `scripts/tests/test_tables.py`

**Step 1: Write failing table tests**

Create fixtures for horizontal/vertical merges, grid spans, multiple cell paragraphs, nested lists, repeated headers, captions, cell widths, borders, shading, alignment, vertical alignment, and nested tables.

```python
def test_merged_table_keeps_structure_and_all_cell_events(self):
    table = parse_table_fixture("merged-and-styled")
    self.assertEqual(table.rows[0].cells[0].colspan, 2)
    self.assertEqual(table.rows[1].cells[0].rowspan, 2)
    self.assertEqual(table.text_events, expected_source_events())
```

Run: `python -m unittest scripts.tests.test_tables -v`

Expected: FAIL because `tables.py` does not exist.

**Step 2: Implement the table model**

Honor `tblGrid`, `gridSpan`, `vMerge`, headers, captions, widths, borders, shading, cell margins/alignment, and every child paragraph/list/drawing in document order. Emit `<figure class="mm-table-figure">` only when a real caption exists, and wrap the table with `<div class="mm-table-scroll" role="region" tabindex="0">`. Never convert a table to an image.

**Step 3: Run to green and assert the real count**

Run: `python -m unittest scripts.tests.test_tables -v`

Expected: PASS.

Add a full-source inventory assertion of exactly 139 tables, 1,110 rows, and 4,615 cells. The test must fail if even an empty table disappears.

**Step 4: Commit**

```powershell
git add scripts/book_import/tables.py scripts/tests/test_tables.py
git commit -m "feat: preserve complete textbook tables"
```

---

### Task 6: Preserve pictures, EMF media, shapes, connectors, text boxes, and complete diagrams

**Files:**

- Create: `scripts/book_import/media.py`
- Create: `scripts/book_import/drawings.py`
- Create: `scripts/book_import/geometry.py`
- Create: `scripts/book_import/visual_reference.py`
- Create: `scripts/book_import/convert_emf.ps1`
- Create: `scripts/tests/test_media.py`
- Create: `scripts/tests/test_drawings.py`
- Create: `scripts/tests/test_visual_reference.py`
- Create: `scripts/ci/install-book-renderer.sh`

**Step 1: Write failing media and diagram tests**

Test byte-signature detection (including the source `.bin` part whose bytes are PNG), original-byte preservation for PNG/JPEG/JFIF, EMF conversion, inline/anchored placement, crop, rotation, flips, stacking, group transforms, connectors, arrowheads, labels, text-box paragraph events, fill/line colors, and aspect ratio.

Exercise all source preset geometries:

```text
straightConnector1, rect, line, downArrow, rightBracket,
bentConnector3, rightArrow, leftBracket, triangle, upArrow,
curvedConnector3, ellipse, plus
```

Also cover `a:custGeom`; the authoritative source contains three custom geometries. An unknown formula or path command must raise `UnsupportedDrawingError` with topic ID and OOXML path.

Run: `python -m unittest scripts.tests.test_media scripts.tests.test_drawings scripts.tests.test_visual_reference -v`

Expected: FAIL because the media/drawing pipeline is absent.

**Step 2: Implement media sniffing and content-addressed output**

Hash original bytes and derive the display extension from magic bytes, not the package filename. Keep supported raster source bytes unchanged. Convert EMF to lossless PNG with the Windows GDI+ metafile renderer in `convert_emf.ps1`, using explicit source/output paths and a temporary destination; then validate decoded width, height, alpha, and source relationship. Keep the original EMF digest in the manifest. Reject corrupt or polyglot files. This conversion path is intentionally independent from the LibreOffice visual-reference path in Step 4.

`scripts/ci/install-book-renderer.sh` installs the pinned CI package set needed for headless LibreOffice and fonts. It must print versions, not environment values.

**Step 3: Implement DrawingML-to-SVG without educational interpretation**

Map OOXML coordinates and transformations directly to SVG. Implement the 13 encountered preset geometries plus DrawingML guide/formula/path evaluation for the three `custGeom` nodes. Preserve group coordinate spaces, z-order, connector endpoints, arrowheads, fills, strokes, rotations, flips, and exact text-box event streams. Keep a whole connected/grouped composition in one `<figure>`/SVG asset. Do not split its labels into body paragraphs.

**Step 4: Implement independent visual-reference validation**

Use LibreOffice headless HTML/PDF export only as an independent visual reference, never as the educational text source. Match exported figure objects to compiler figures by relationship/order/dimensions, rasterize SVG at source dimensions, and compare label digests, object manifests, geometry, connection graphs, colors, dimensions, and pixels. Record the reference tool/version and metrics. Require zero missing objects and zero label differences; use a documented anti-alias tolerance only for edge pixels. Any unmatched composition fails.

**Step 5: Run to green and run the authoritative inventory**

Run: `python -m unittest scripts.tests.test_media scripts.tests.test_drawings scripts.tests.test_visual_reference -v`

Expected: PASS.

The real-source inventory must report 164 media parts (75 PNG, 40 JPG, 7 JPEG, 40 EMF, 1 JFIF, and 1 PNG-signature `.bin`), 3,127 processing shapes, 607 text boxes, and 294 picture objects. Counts are diagnostics only; digest/object equivalence remains the gate.

**Step 6: Commit**

```powershell
git add scripts/book_import/media.py scripts/book_import/drawings.py scripts/book_import/geometry.py scripts/book_import/visual_reference.py scripts/book_import/convert_emf.ps1 scripts/tests/test_media.py scripts/tests/test_drawings.py scripts/tests/test_visual_reference.py scripts/ci/install-book-renderer.sh
git commit -m "feat: preserve source figures and drawing geometry"
```

---

### Task 7: Render safe semantic HTML and deterministic database fragments

**Files:**

- Create: `scripts/book_import/html_renderer.py`
- Create: `scripts/book_import/html_policy.py`
- Create: `scripts/book_import/fragments.py`
- Create: `scripts/tests/test_html_renderer.py`
- Create: `scripts/tests/test_html_policy.py`
- Create: `scripts/tests/test_fragments.py`

**Step 1: Write failing HTML-policy and exact-event tests**

Assert headings, separate paragraphs, empty paragraphs, exact tabs/breaks, inline formatting, lists, tables, figures, captions, safe hyperlinks, and CSS properties. Add malicious fixture values for scripts, event attributes, `javascript:`, remote images, CSS `url()`, expressions, and unsupported tags.

```python
def test_rendered_event_stream_equals_source_event_stream_exactly(self):
    source = compile_fixture("whitespace-and-medical-notation")
    html = render_topic(source)
    self.assertEqual(extract_html_events(html), source.text_events)

def test_fragmenter_never_splits_an_atomic_top_level_element(self):
    blocks = fragment_topic(render_large_fixture(), max_utf8_bytes=512)
    self.assertTrue(all(is_balanced_fragment(block.content) for block in blocks))
```

Run: `python -m unittest scripts.tests.test_html_renderer scripts.tests.test_html_policy scripts.tests.test_fragments -v`

Expected: FAIL because rendering and policy modules do not exist.

**Step 2: Implement a closed HTML/CSS generator**

Generate XHTML-compatible fragments only from typed compiler nodes. Escape text and attributes once. Allow only the spec's semantic tags, `data-mm-*` metadata, ARIA fields, first-party versioned asset URLs, `https` links, and explicit numeric/color/font CSS values. Never accept arbitrary HTML or CSS from the DOCX. Use `white-space: break-spaces` spans and explicit tab/break elements where required.

Begin each topic with an invisible, non-text marker:

```html
<div class="mm-release-marker" data-mm-release="SOURCE_SHA256" data-mm-topic="TOPIC_ID" hidden></div>
```

**Step 3: Implement deterministic block fragmentation**

Split only between complete top-level nodes and cap `content.encode("utf-8")` at 48 KiB. Keep lists, tables, figures, headings, and paragraphs atomic. Use deterministic IDs derived from source digest, topic ID, fragment order, and fragment SHA-256. Fail if one atomic node exceeds the limit. Reassembly by `order` must be byte-identical to the original topic HTML.

**Step 4: Run to green**

Run: `python -m unittest scripts.tests.test_html_renderer scripts.tests.test_html_policy scripts.tests.test_fragments -v`

Expected: PASS with exact raw event equivalence and no policy violations.

**Step 5: Commit**

```powershell
git add scripts/book_import/html_renderer.py scripts/book_import/html_policy.py scripts/book_import/fragments.py scripts/tests/test_html_renderer.py scripts/tests/test_html_policy.py scripts/tests/test_fragments.py
git commit -m "feat: render deterministic responsive book html"
```

---

### Task 8: Build the fail-closed manifest and authoritative compiler CLI

**Files:**

- Create: `scripts/book_import/manifest.py`
- Create: `scripts/book_import/compiler.py`
- Create: `scripts/compile_maternal_mind_book.py`
- Create: `scripts/tests/test_manifest.py`
- Create: `scripts/tests/test_compiler_cli.py`
- Delete: `scripts/parse_maternal_mind_book.py`
- Delete: `scripts/validate_extraction.py`
- Delete: `scripts/generate_book_sql.py`
- Delete: `scripts/extracted_book_data.json`
- Delete: `scripts/maternal_mind_book_mysql.sql`
- Delete: `scripts/maternal_mind_book_pg.sql`

**Step 1: Write failing manifest and CLI tests**

Test deterministic compilation, expected source digest enforcement, exact source/generated event digests, normalized diagnostics that cannot override raw mismatch, per-topic ownership, list/table/figure/run-format counts, asset digests, sanitizer status, and refusal to write a release after any failure.

```python
def test_normalized_match_cannot_approve_raw_text_mismatch(self):
    result = validate_events(source="A  B", generated="A B")
    self.assertFalse(result.approved)
    self.assertEqual(result.code, "RAW_TEXT_EVENT_MISMATCH")

def test_failed_compile_leaves_no_activatable_release(self):
    code = cli_main(["compile", "--source", bad_fixture, "--output", output])
    self.assertNotEqual(code, 0)
    self.assertFalse((output / "release.json.gz").exists())
```

Run: `python -m unittest scripts.tests.test_manifest scripts.tests.test_compiler_cli -v`

Expected: FAIL because the compiler/manifest do not exist.

**Step 2: Implement `inventory`, `compile`, and `verify` commands**

The CLI must use explicit arguments and these exit semantics:

```text
inventory  -> read-only source audit, never says release approved
compile    -> writes to a temporary sibling, validates, then atomically renames
verify     -> reopens a committed release and proves source/manifest/assets/blocks
```

Write deterministic JSON with sorted keys and `\n`; write deterministic gzip with `mtime=0`. The manifest includes every field required by the approved spec. The release payload contains only topic ID, deterministic block ID, `document_html`, exact content, and order—never topic edits or user data.

**Step 3: Remove the unsafe heuristic artifacts**

Delete the old parser, count-only validator, SQL generator, generated JSON, and generated book SQL files in the same commit that introduces the passing compiler. This prevents the former false `100%` message or broad SQL files from being used accidentally. Do not delete the authoritative DOCX or unrelated database scripts.

**Step 4: Run focused and full-book verification**

Run:

```powershell
python -m unittest discover -s scripts/tests -p "test_*.py" -v
python scripts/compile_maternal_mind_book.py inventory --source "Maternal Mind Education Content/BOOK MATERNAL MIND BY DR.FARZANA MUNEER(FINAL).docx"
python scripts/compile_maternal_mind_book.py compile --source "Maternal Mind Education Content/BOOK MATERNAL MIND BY DR.FARZANA MUNEER(FINAL).docx" --output "output/book-content/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605"
python scripts/compile_maternal_mind_book.py verify --source "Maternal Mind Education Content/BOOK MATERNAL MIND BY DR.FARZANA MUNEER(FINAL).docx" --release "output/book-content/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605"
```

Expected: all tests PASS; compile and verify exit 0; 13 books, 285 topics, zero unowned nodes, zero raw text-event differences, zero unsupported structures, and all asset/object/visual gates pass. If any gate fails, stop here and fix the compiler without editing educational content.

**Step 5: Commit**

```powershell
git add scripts/book_import scripts/compile_maternal_mind_book.py scripts/tests package.json
git add -u scripts
git commit -m "feat: replace heuristic book import with fail-closed compiler"
```

---

### Task 9: Commit one reviewed, content-addressed book release

**Files:**

- Create: `content/book-releases/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605/manifest.json`
- Create: `content/book-releases/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605/release.json.gz`
- Create: `content/book-releases/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605/visual-validation.json`
- Create: `uploads/content-images/maternal-mind-book/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605/**`
- Modify: `.gitignore`

**Step 1: Write a failing committed-release test**

Extend `test_compiler_cli.py` to verify that the committed release exists, has the expected digest, reassembles exactly 285 topics, and that every referenced asset exists beneath its digest directory. It must reject an extra/unreferenced asset.

Run: `python -m unittest scripts.tests.test_compiler_cli.CommittedReleaseTest -v`

Expected: FAIL because the reviewed release is not committed yet.

**Step 2: Generate to ignored output, review, then promote byte-for-byte**

Compile to `output/book-content/<digest>`, review the manifest and visual-validation report, and copy only validated files into `content/book-releases/<digest>` and `uploads/content-images/maternal-mind-book/<digest>`. Add ignore rules for temporary reference renders and snapshots, not for committed release files.

Before promotion, inspect every reported source warning. A suspected textbook mistake is recorded as an unchanged source observation; it is never edited.

**Step 3: Verify the promoted release**

Run:

```powershell
python scripts/compile_maternal_mind_book.py verify --source "Maternal Mind Education Content/BOOK MATERNAL MIND BY DR.FARZANA MUNEER(FINAL).docx" --release "content/book-releases/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605"
python -m unittest scripts.tests.test_compiler_cli.CommittedReleaseTest -v
git diff --check
```

Expected: PASS and byte-identical release verification. Do not proceed on warnings classified as fidelity blockers.

**Step 4: Commit**

```powershell
git add .gitignore content/book-releases/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605 uploads/content-images/maternal-mind-book/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605
git commit -m "content: add verified maternal mind book release"
```

---

### Task 10: Create one shared document shell and strict runtime contract

**Files:**

- Create: `shared/book-document-contract.ts`
- Create: `tests/book-document-contract.test.ts`
- Modify: `client/lib/query-client.ts`
- Modify: `server/routes/content.ts`
- Create: `server/lib/book-document-policy.ts`
- Create: `tests/book-document-server-policy.test.ts`

**Step 1: Write failing pure TypeScript tests**

Tests must cover ordered fragment assembly, mixed legacy/document rejection, release/topic marker validation, CSP generation, escaping wrapper metadata, first-party base URL validation, bridge nonce/message validation, renderer capability parsing, and old-client rejection after activation.

```typescript
test("reassembles document_html blocks without changing a byte", () => {
  const html = assembleBookDocument([
    { order: 2, content: "<p>B</p>" },
    { order: 1, content: "<p>A  </p>" },
  ]);
  assert.equal(html, "<p>A  </p><p>B</p>");
});

test("rejects a document response for an incapable client", () => {
  assert.throws(() => requireBookRenderer(undefined, true), /APP_UPDATE_REQUIRED/);
});
```

Run: `npx tsx --test tests/book-document-contract.test.ts tests/book-document-server-policy.test.ts`

Expected: FAIL because the shared contract and policy do not exist.

**Step 2: Implement the shared shell**

Export:

```typescript
export const BOOK_DOCUMENT_BLOCK_TYPE = "document_html" as const;
export const BOOK_DOCUMENT_RENDERER_VERSION = "1" as const;
export const BOOK_DOCUMENT_RENDERER_HEADER = "x-mm-book-document-renderer";
export const BOOK_DOCUMENT_CSS: string;
export function assembleBookDocument(blocks: BookDocumentBlock[]): string;
export function buildBookDocumentHtml(input: BookDocumentShellInput): string;
export function parseBookDocumentMessage(raw: string, nonce: string): BookDocumentMessage | null;
```

The shell must use a white paper surface in all app themes; 16px-or-larger body text; source-defined typography/alignment/spacing; local horizontal table scroll; responsive images/SVG; `overflow-wrap` that does not alter stored text; and print/reference styles. Add a nonce-scoped bridge script for height and link messages. CSP must default to `none`, allow inline document CSS and only the nonce script, and allow images from `data:` plus the validated first-party API origin. Imported fragments cannot contain scripts.

**Step 3: Add the renderer capability header and server gate**

Attach `x-mm-book-document-renderer: 1` to authenticated client requests in both `apiRequest` and `getQueryFn`. In the topic route, if stored blocks include `document_html` and the header is absent/unsupported, return HTTP 426 with code `APP_UPDATE_REQUIRED`; never send unknown document blocks to an incapable installed app. Preserve the existing subscription check before content delivery.

**Step 4: Run to green**

Run: `npx tsx --test tests/book-document-contract.test.ts tests/book-document-server-policy.test.ts`

Expected: PASS.

**Step 5: Commit**

```powershell
git add shared/book-document-contract.ts tests/book-document-contract.test.ts tests/book-document-server-policy.test.ts client/lib/query-client.ts server/routes/content.ts server/lib/book-document-policy.ts
git commit -m "feat: add shared book document rendering contract"
```

---

### Task 11: Render source-locked documents in the native topic reader

**Files:**

- Create: `client/components/ResponsiveBookDocument.tsx`
- Create: `client/lib/book-document.ts`
- Modify: `client/screens/TopicReaderScreen.tsx`
- Create: `tests/book-document-web.spec.ts`

**Step 1: Write failing renderer behavior tests**

Use the pure helper tests for native message handling and Playwright for the web iframe path. Cover 375, 430, and 768 CSS-pixel widths, exact visible text extraction, ordered/bullet marker types, nested lists, superscript/subscript, merged tables, wide-table-only horizontal scrolling, responsive figures, CSP, height messages, and intercepted links.

```typescript
test("wide content scrolls only inside the table wrapper", async ({ page }) => {
  await mountBookDocumentFixture(page, "wide-table");
  expect(await page.locator("body").evaluate((e) => e.scrollWidth === e.clientWidth)).toBe(true);
  expect(await page.locator(".mm-table-scroll").evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
});
```

Run: `npx playwright test tests/book-document-web.spec.ts --project=chromium`

Expected: FAIL because the component/harness does not exist.

**Step 2: Implement `ResponsiveBookDocument`**

On native, use the existing `react-native-webview` with `javaScriptEnabled`, no injected tokens, no storage, no arbitrary navigation, a validated message nonce, `scrollEnabled={false}`, and measured height. Resolve only first-party versioned assets. On web, use a sandboxed `iframe srcDoc` built by the same shared shell and the same message schema. A renderer failure shows the topic/release ID and retry action; it must not flatten or silently drop the document.

**Step 3: Integrate without disturbing topic chrome**

Add `document_html` to `ContentBlock`. Sort and group all such blocks, validate one release/topic marker, and render one `ResponsiveBookDocument` in their original position. Keep the native title, author/source/reference metadata, watermark, bookmark, report, completion, previous/next, paywall handling, and legacy block renderer unchanged. Reject a mixed document/legacy payload so ordering cannot become ambiguous.

**Step 4: Run tests and focused type check**

Run:

```powershell
npx tsx --test tests/book-document-contract.test.ts
npx playwright test tests/book-document-web.spec.ts --project=chromium
npx tsc --noEmit
```

Expected: PASS.

**Step 5: Commit**

```powershell
git add client/components/ResponsiveBookDocument.tsx client/lib/book-document.ts client/screens/TopicReaderScreen.tsx tests/book-document-web.spec.ts
git commit -m "feat: render responsive source-locked book topics"
```

---

### Task 12: Make the admin preview identical and imported documents immutable

**Files:**

- Create: `admin/src/components/ResponsiveBookDocumentPreview.tsx`
- Create: `admin/src/components/ImportedDocumentBlock.tsx`
- Modify: `admin/src/components/BlockEditor.tsx`
- Modify: `admin/src/components/MobileContentPreview.tsx`
- Modify: `admin/src/pages/TopicEditorPage.tsx`
- Modify: `admin/vite.config.ts`
- Modify: `admin/tsconfig.json`
- Modify: `server/routes/admin-content.ts`
- Modify: `server/admin-storage.ts`
- Create: `server/lib/content-block-policy.ts`
- Create: `tests/content-block-policy.test.ts`
- Create: `tests/admin-book-document-preview.spec.ts`

**Step 1: Write failing source-lock and preview tests**

The pure policy test must reject create, update, delete, and reorder attempts involving `document_html` while allowing every current legacy type. The Playwright test must prove admin and mobile preview iframe `srcDoc` use the same `BOOK_DOCUMENT_CSS` digest and produce the same semantic DOM/text at 390px.

Run:

```powershell
npx tsx --test tests/content-block-policy.test.ts
npx playwright test tests/admin-book-document-preview.spec.ts --project=chromium
```

Expected: FAIL.

**Step 2: Share the contract with the admin build**

Add Vite alias `@shared` to `../shared`, permit that resolved workspace directory in `server.fs.allow`, and include `../shared/**/*.ts` in admin TypeScript. Do not copy the CSS into a second admin constant.

**Step 3: Implement the locked admin experience**

When a topic contains document blocks, show one locked card with source digest, release validation state, topic ID, fragment count, and the instruction to update the authoritative DOCX and recompile. Do not instantiate TipTap, expose raw mutation fields, show delete/reorder buttons, or allow block insertion for that imported topic. Legacy topics remain fully editable.

`MobileContentPreview` delegates document blocks to `ResponsiveBookDocumentPreview`, a sandboxed iframe using the exact shared shell; keep its existing legacy preview for legacy blocks.

**Step 4: Enforce the lock on the server**

Keep `document_html` out of the admin create enum. Before update/delete/reorder/batch-save, load the existing block/topic types and call the pure policy. Return HTTP 409 with code `SOURCE_LOCKED`; do not rely on disabled buttons alone. The release command in Task 13 writes directly inside its dedicated transaction and is the only writer.

**Step 5: Run to green and build admin**

Run:

```powershell
npx tsx --test tests/content-block-policy.test.ts
npx playwright test tests/admin-book-document-preview.spec.ts --project=chromium
cmd /c "cd admin && npm run build"
```

Expected: PASS.

**Step 6: Commit**

```powershell
git add admin/src/components/ResponsiveBookDocumentPreview.tsx admin/src/components/ImportedDocumentBlock.tsx admin/src/components/BlockEditor.tsx admin/src/components/MobileContentPreview.tsx admin/src/pages/TopicEditorPage.tsx admin/vite.config.ts admin/tsconfig.json server/routes/admin-content.ts server/admin-storage.ts server/lib/content-block-policy.ts tests/content-block-policy.test.ts tests/admin-book-document-preview.spec.ts
git commit -m "feat: lock imported book content in admin"
```

---

### Task 13: Add transactional activation, exact verification, and rollback

**Files:**

- Create: `scripts/book-release/lib.mjs`
- Create: `scripts/book-release/db.mjs`
- Create: `scripts/apply-book-content-release.mjs`
- Create: `scripts/verify-book-content-release.mjs`
- Create: `scripts/rollback-book-content-release.mjs`
- Create: `tests/book-content-release.test.ts`
- Modify: `package.json`

**Step 1: Write failing release-plan tests with an in-memory fake adapter**

Test exact topic allowlist, topology verification, snapshot-before-delete, transaction rollback on every failure point, deterministic insert order, block digest verification before commit, no table outside `content_blocks`, idempotent reapply, and rollback from a named snapshot.

```typescript
test("activation never mutates non-content tables", async () => {
  const db = new RecordingBookReleaseDb(expectedTopology());
  await applyRelease(db, verifiedRelease());
  assert.deepEqual(new Set(db.mutatedTables), new Set(["content_blocks"]));
});

test("an insert mismatch rolls back the complete replacement", async () => {
  const db = failingDb("after-insert");
  await assert.rejects(applyRelease(db, verifiedRelease()));
  assert.equal(db.committed, false);
  assert.equal(db.rolledBack, true);
});
```

Run: `npx tsx --test tests/book-content-release.test.ts`

Expected: FAIL because release modules do not exist.

**Step 2: Implement dialect adapters and snapshot format**

Use `DATABASE_URL` only. Support the repository's MySQL and PostgreSQL drivers, parameterized statements, advisory/named locks, and transactions. Never interpolate content into SQL or print the URL. Before mutation, query joins among books/chapters/topics and prove all 285 current IDs/order map to `book-mm-*`; do not update those tables.

Write a deterministic gzip snapshot containing only the selected content-block rows plus release metadata. Write it with exclusive creation beneath an explicit `--snapshot-dir`; fsync it before starting deletion. Refuse paths outside that directory. Snapshot files contain no users, subscriptions, progress, bookmarks, MCQs, sessions, or credentials.

**Step 3: Implement activation and rollback**

Activation sequence:

1. Verify committed release, source digest, block/asset hashes, renderer readiness token, and target topology.
2. Acquire lock and begin transaction.
3. Snapshot existing target blocks.
4. Delete only `content_blocks` rows whose `topic_id` is in the exact manifest allowlist.
5. Insert deterministic `document_html` blocks in bounded batches.
6. Read back every row, reassemble every topic, and compare block/content/release digests.
7. Commit only after all comparisons pass; otherwise roll back.

Rollback performs the symmetric transaction from one explicitly named snapshot and verifies the restored row digest before commit. It never infers the newest file or uses a wildcard.

**Step 4: Add non-mutating live verification**

`verify-book-content-release.mjs` supports `--database` and authenticated `--api-base`. It proves 285 topics, release markers, reassembled digests, first-party asset HTTP 200/digests, free/paid access behavior, and no mixed block types. Read the bearer token from `MM_ACCEPTANCE_ACCESS_TOKEN`; never accept or echo it on the command line.

**Step 5: Run to green**

Run: `npx tsx --test tests/book-content-release.test.ts`

Expected: PASS. Run `--dry-run` against local development data before any real mutation and confirm the plan names only `content_blocks` and 285 topic IDs.

**Step 6: Commit**

```powershell
git add scripts/book-release scripts/apply-book-content-release.mjs scripts/verify-book-content-release.mjs scripts/rollback-book-content-release.mjs tests/book-content-release.test.ts package.json
git commit -m "feat: add transactional book content release"
```

---

### Task 14: Remove automatic database imports and add a gated production workflow

**Files:**

- Modify: `scripts/deploy_hostinger.sh`
- Modify: `.github/workflows/deploy-hostinger.yml`
- Modify: `.github/workflows/ota-publish.yml`
- Create: `.github/workflows/release-book-content.yml`
- Create: `scripts/verify-ota-release.mjs`
- Create: `tests/deployment-safety.test.ts`

**Step 1: Write failing deployment-safety tests**

Read workflow/shell sources as text and assert:

- ordinary Hostinger deploy contains no SQL import and no book activation command;
- no hard-coded database URL/password remains in the deployment script;
- release workflow requires a production environment approval and exact confirmation phrase;
- OTA publication and manifest verification precede database activation;
- activation receives the expected source digest and renderer release commit;
- rollback snapshot retention is configured;
- no workflow command prints secrets.

Run: `npx tsx --test tests/deployment-safety.test.ts`

Expected: FAIL against the current automatic SQL-import deploy script.

**Step 2: Make ordinary application deployment database-neutral**

Remove all automatic SQL-import behavior and embedded database connection values from `deploy_hostinger.sh`. The script may install production dependencies, place static artifacts, restart, and verify services; it must never mutate book content. Narrow `deploy-hostinger.yml` sources so it ships only intentional runtime/build artifacts, not arbitrary generated SQL or local backup files.

**Step 3: Make OTA reusable and verifiable**

Add `workflow_call` support to `ota-publish.yml`, with a `require_enabled` input that fails closed when `OTA_ENABLED` is not true. Put `rendererVersion: "1"` and commit SHA into `expo-updates-extra.json`. `verify-ota-release.mjs` requests the public signed manifest for both current runtime versions and verifies the expected commit/renderer version without logging signing material.

**Step 4: Add the dedicated release workflow**

`release-book-content.yml` is manual-only and uses GitHub's `production` environment. Require inputs:

```text
source_digest = f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605
confirm = RELEASE_MATERNAL_MIND_BOOK
snapshot_retention_days >= 30
```

Jobs run in this order:

1. Checkout exact SHA; install Node/Python/compiler dependencies and LibreOffice.
2. Re-verify the committed source, release, visuals, tests, type checks, admin/web/server builds, and asset inventory.
3. Deploy compatible server/admin/web code and versioned assets without DB mutation.
4. Publish the compatible native OTA and verify the public manifests expose the same commit and renderer version for active runtimes.
5. Run `apply-book-content-release.mjs` over SSH with an explicit snapshot directory and digest.
6. Run database/API/asset verification and upload the redacted verification report plus snapshot identifier.

If any post-activation gate fails, invoke rollback with the exact snapshot path from the activation output, verify restoration, and fail the workflow. Do not delete old assets during this workflow.

**Step 5: Run to green and lint workflow syntax**

Run:

```powershell
npx tsx --test tests/deployment-safety.test.ts
npx prettier --check ".github/workflows/*.yml" "scripts/**/*.mjs"
git diff --check
```

Expected: PASS.

**Step 6: Commit**

```powershell
git add scripts/deploy_hostinger.sh .github/workflows/deploy-hostinger.yml .github/workflows/ota-publish.yml .github/workflows/release-book-content.yml scripts/verify-ota-release.mjs tests/deployment-safety.test.ts
git commit -m "ci: gate maternal mind book content releases"
```

---

### Task 15: Run complete local acceptance before pushing or production mutation

**Files:**

- Create: `docs/verification/book-content-fidelity-local.md`
- Modify only if a test exposes a defect: files owned by Tasks 1-14

**Step 1: Run compiler and release verification from a clean generated-output directory**

```powershell
python -m unittest discover -s scripts/tests -p "test_*.py" -v
python scripts/compile_maternal_mind_book.py verify --source "Maternal Mind Education Content/BOOK MATERNAL MIND BY DR.FARZANA MUNEER(FINAL).docx" --release "content/book-releases/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605"
npx tsx --test tests/book-document-contract.test.ts tests/book-document-server-policy.test.ts tests/content-block-policy.test.ts tests/book-content-release.test.ts tests/deployment-safety.test.ts
```

Expected: all PASS; zero unsupported or mismatched source elements.

**Step 2: Run application checks**

```powershell
npx tsc --noEmit
cmd /c "cd admin && npm run build"
npm run expo:web:build
npm run server:build
npx playwright test tests/book-document-web.spec.ts tests/admin-book-document-preview.spec.ts --project=chromium
```

Expected: all PASS.

If broad legacy checks fail in untouched areas, record the exact unrelated failures separately; do not call the requested slice fully green until every touched-path check passes.

**Step 3: Perform representative visual/accessibility review**

Select at least one topic from every book and ensure the set includes deep bullets, decimal/Roman/letter lists, wide and merged tables, superscript/subscript, colored/underlined runs, raster figures, EMF, connectors/arrows, grouped/custom geometry, text boxes, and captions. At 375, 430, and 768 widths verify selectable text, source ordering, no body overflow, table-only horizontal scroll, figure integrity, 200% font scaling, and keyboard/screen-reader reading order.

Record topic IDs, structure classes, viewport, source digest, release digest, commands, and artifact paths in `docs/verification/book-content-fidelity-local.md`. Do not embed educational text excerpts or credentials in the report.

**Step 4: Verify worktree scope and commit**

```powershell
git status --short
git diff --check
git diff --stat origin/main...HEAD
git add docs/verification/book-content-fidelity-local.md
git commit -m "test: record local book fidelity acceptance"
```

Expected: only intended tracked changes are committed; unrelated untracked files remain untouched.

---

### Task 16: Release and prove the real subscribed mobile experience

**Files:**

- Create after execution: `docs/verification/book-content-fidelity-production.md`
- No source edits unless a verified defect requires returning to the relevant TDD task

**Step 1: Establish repository and release identity**

Push the reviewed commits only after Task 15 is green. Verify local `HEAD`, `origin/main`, workflow checkout SHA, source digest, release manifest digest, OTA commit, and deployed server/admin/web SHA all agree. A push is not a deployment.

**Step 2: Run the gated content-release workflow**

Use the exact confirmation phrase and source digest. Observe all jobs through OTA verification, asset staging, transaction, and post-activation checks. Preserve the emitted snapshot identifier for at least the requested retention period.

**Step 3: Verify production independently**

Run the read-only verifier with a dedicated subscribed acceptance account. Confirm:

- public app/admin shells and every sampled versioned asset are reachable;
- all 285 production topic payloads carry the approved release marker and match manifest digests;
- subscription checks still deny paid content to an inactive account and allow it to the subscribed test account;
- renderer-incompatible requests receive explicit HTTP 426 rather than partial content;
- no user/progress/bookmark/MCQ/subscription counts changed because of the release.

**Step 4: Verify a real installed native app**

On at least one production Android or iOS installation using the active subscription:

1. Foreground the app and apply the mandatory signed OTA.
2. Open representative topics through Books -> Topics.
3. Compare the source structure and diagrams against the approved local reference set.
4. Exercise selection, font scaling, wide-table scrolling, light/dark app chrome, bookmark, report, complete, and previous/next navigation.
5. Capture redacted screenshots/device details and the OTA/release IDs; never capture student data or tokens.

Web-only screenshots, API JSON, a successful transaction, or container/process health are not substitutes for this native acceptance.

**Step 5: Roll back on any mismatch**

If text, structure, diagram, navigation, access, or runtime compatibility differs, stop acceptance and invoke `rollback-book-content-release.mjs` with the exact retained snapshot. Verify the restored digest and previous mobile behavior, keep the new versioned assets for diagnosis, and return to the responsible test-first task. Never patch educational content directly in production or the admin editor.

**Step 6: Record evidence and final parity**

Create `docs/verification/book-content-fidelity-production.md` with commit SHAs, workflow run, source/release/OTA digests, database/API checks, sampled topic matrix, native device evidence, snapshot identifier, and any explicitly unverified boundary. Then verify:

```powershell
git rev-parse HEAD
git ls-remote origin refs/heads/main
git status --short
```

Commit and push only the redacted evidence report. Completion can be claimed only when `main` parity, deployed parity, the 285-topic production manifest, and subscribed native mobile acceptance are all proven.

---

## Final Self-Review Checklist

- [ ] Every approved-spec requirement maps to at least one implementation task and one verification gate.
- [ ] No task edits, regenerates, or manually transcribes educational content.
- [ ] All source strings in tests are synthetic except digest/count assertions; no accidental textbook excerpts are introduced.
- [ ] The compiler has no `.strip()`, whitespace-collapse, title-substring mapping, all-`ul` fallback, unsupported-node skip, or count-only approval path.
- [ ] The exact event digest is authoritative; normalized digests are diagnostic only.
- [ ] All 139 tables and every drawing/media relationship are owned and validated.
- [ ] The three custom geometries and every encountered preset geometry have tests.
- [ ] Admin and mobile import the same shell/CSS constant; no duplicated stylesheet can drift.
- [ ] `document_html` is immutable through every admin mutation path.
- [ ] Existing IDs, navigation, access rules, and user-related tables are unchanged.
- [ ] Ordinary deployment cannot import SQL or mutate book content.
- [ ] Activation snapshots, validates, transacts, reads back, and rolls back exact content blocks only.
- [ ] OTA compatibility is live and verified before content activation.
- [ ] Production proof includes a subscribed installed native app, not only web/API evidence.
- [ ] Any unavailable production credential, distribution gate, or native-device check is reported as an unverified boundary rather than silently claimed complete.

# Responsive Book Content Fidelity Design

**Date:** 2026-08-17
**Status:** Approved
**Source of truth:** `Maternal Mind Education Content/BOOK MATERNAL MIND BY DR.FARZANA MUNEER(FINAL).docx`
**Scope:** The existing Maternal Mind books, chapters, topics, admin preview, mobile topic reader, import tooling, production content records, and textbook assets.

## 1. Goal

Subscribed students must continue to navigate through the current **Books -> Topics -> Topic Content** flow and read each topic as responsive, selectable mobile content. The importer and renderer must preserve the textbook's complete topic content and semantic presentation: text, punctuation, significant whitespace, heading hierarchy, list type and nesting, tables, inline formatting, figures, captions, and diagrams.

The implementation must not turn textbook pages or topic text into screenshots. Genuine textbook figures and diagrams may remain images or inline SVG because they are figures in the source document.

Educational content is immutable and mission-critical. No workflow component may paraphrase, summarize, correct, normalize, rewrite, reorder, infer, merge, split, translate, regenerate, or otherwise editorially alter the source. This prohibition includes spelling, grammar, punctuation, terminology, units, dosages, symbols, labels, captions, list markers, table values, diagram text, and apparent source mistakes. Suspected source errors must be reported separately and left unchanged until the book owner supplies a revised authoritative document.

## 2. Clarified Fidelity Boundary

The mobile layout reflows to the device width. Word pagination, physical page coordinates, and source line wrapping are therefore not acceptance requirements. They cannot remain identical across different phone widths while the content remains responsive text.

The following are acceptance requirements:

- Every study topic in the current 13-book, 285-topic navigation remains present and in its current order.
- Every source character, punctuation mark, meaningful space, tab, line break, and non-breaking character assigned to a topic is represented in the rendered topic.
- Heading levels and paragraph boundaries remain distinguishable.
- Ordered lists remain ordered; unordered lists retain their marker style; all nesting levels and numbering sequences remain correct.
- Tables retain row order, column order, merged cells, cell content, headers, captions, borders, alignment, and reading order.
- Bold, italic, underline, strike-through, superscript, subscript, highlight, foreground color, alignment, indentation, and paragraph spacing are retained where the source defines them.
- Embedded pictures, Word drawings, arrows, connectors, labels, text boxes, and captions remain in their correct reading position.
- Each diagram remains one faithful diagram composition. Its geometry, connectors, arrows, labels, colors, relative positions, and reading direction may not be decomposed, rearranged, or recreated from interpretation.
- Content is selectable and readable on a phone. Page-sized body screenshots are prohibited.
- The production import fails closed if any required source element cannot be mapped or rendered.

## 3. Ground Truth and Confirmed Failure Modes

The attached download and repository copy have the same SHA-256 digest, so the repository copy is the authoritative build input.

The DOCX audit found:

- 685 Word pages and 117,485 metadata words.
- 13 `TOC1` entries, 209 `TOC2` entries, and 76 `TOC3` entries: 13 books and 285 topics.
- 27,315 non-empty OOXML paragraphs, including paragraphs inside table cells and text boxes.
- 139 tables, 1,110 rows, and 4,615 cells.
- 12,040 numbered/list paragraphs, including bullet, decimal, Roman numeral, and letter formats.
- 4,085 tabs, 77 explicit line/page breaks, and extensive paragraph indentation.
- 164 media files, including 40 EMF files and one binary media part.
- 3,127 Word processing shapes, 607 text boxes, 294 picture objects, and 13 known preset geometry types.
- 10,470 bold runs, 4,904 underlined runs, 1,892 italic runs, and 1,130 superscript/subscript runs.

The current import reduces the book to 1,157 content blocks. Its confirmed defects include:

- `get_p_text()` and `get_p_html()` call `strip()`, removing source whitespace.
- Tabs, breaks, non-breaking characters, paragraph spacing, indentation, alignment, fonts, sizes, colors, highlights, superscript/subscript, and most style inheritance are discarded.
- Every numbered list becomes `<ul>`; the generated payload contains zero `<ol>` elements despite thousands of numbered source paragraphs.
- A change in Word `numId` is incorrectly treated as a deeper list level.
- `TOC2` and `TOC3` entries are flattened, and body headings are matched by ambiguous substring comparison rather than Word bookmarks.
- Six source tables are absent from the generated payload. Existing tables lose merges, widths, shading, borders, alignment, and paragraph structure.
- Inline image position, dimensions, crop, wrap, and captions are lost. EMF and binary assets are emitted even though the mobile image path cannot reliably display them.
- Word drawings and text-box geometry are flattened into surrounding text or omitted.
- The current validator checks hard-coded object counts and file existence only. It never compares source content with generated content, so its `100%` success message is not evidence of fidelity.

## 4. Chosen Architecture

### 4.1 Canonical OOXML compiler

Replace the heuristic parser with a deterministic compiler that reads these DOCX parts as one document model:

- `word/document.xml`
- `word/styles.xml`
- `word/numbering.xml`
- `word/fontTable.xml`
- `word/theme/theme1.xml`
- `word/_rels/document.xml.rels`
- all referenced media parts

The compiler resolves style inheritance in this order: document defaults, paragraph style ancestry, character style ancestry, paragraph/run properties, then direct formatting. It preserves `xml:space`, tabs, breaks, no-break hyphens, soft hyphens, bookmarks, hyperlinks, paragraph properties, table properties, and drawing relationships.

The compiler emits a versioned canonical manifest and responsive HTML fragments. The DOCX SHA-256 digest is the content release identifier, making repeated imports deterministic and idempotent.

The compiler is a format-preserving transform, not an editorial pipeline. It copies source text code points and source relationships directly. It may escape characters for valid HTML and map OOXML presentation properties to equivalent HTML/CSS, but it may not run content cleanup, grammar correction, OCR, language-model generation, medical interpretation, or heuristic text substitution.

### 4.2 Stable book and topic mapping

The current IDs, order, progress, bookmarks, MCQs, subscription flags, and navigation records remain unchanged:

- Books: `book-mm-01` through `book-mm-13`.
- Current single chapter record under each book remains unchanged.
- Topics retain their existing IDs and sequence.

`TOC1` entries map to books by sequence. `TOC2` and `TOC3` entries map to the existing 285 topics by sequence. Topic body boundaries are resolved from the TOC hyperlink/bookmark anchors and document order. Substring title matching is prohibited. A missing, duplicate, out-of-order, or ambiguous anchor stops the build.

The Word cover and generated table of contents are navigation/front-matter artifacts, not duplicated inside Topic 1. Every study-body element from the first topic anchor through the final topic boundary must belong to exactly one topic.

### 4.3 Semantic responsive HTML

Each topic is compiled to sanitized semantic HTML:

- Headings use `h1` through `h6` according to the resolved source hierarchy.
- Paragraphs remain separate `p` elements.
- Lists use nested `ol`/`ul` elements with resolved `numFmt`, `lvlText`, start value, marker style, and indentation.
- Tables retain `thead`, `tbody`, `th`, `td`, `rowspan`, `colspan`, cell paragraphs, captions, widths, borders, shading, and alignment.
- Inline formatting uses a strict set of semantic elements and safe inline styles.
- Significant whitespace uses explicit spans, tab stops, `white-space` rules, and non-breaking characters. Responsive line wrapping is allowed.
- Images and figures use `figure`, `img` or inline `svg`, and `figcaption`, with source dimensions, aspect ratio, reading order, and alternative text.

The compiler stores ordered `document_html` fragments in the existing `content_blocks` table. Storage fragments are concatenated in order before rendering, so database size boundaries do not alter the DOM. A fragment may split only between top-level elements; it may not split a list, table, figure, or paragraph. The compiler fails if an atomic element exceeds the safe database payload limit.

### 4.4 Drawings and media

The renderer distinguishes body text from genuine figures:

- PNG, JPEG, JFIF, and supported source pictures retain their original bytes.
- Original EMF, binary media, and DrawingML parts are retained unchanged as audit artifacts. A display derivative may be produced only as lossless SVG or lossless PNG and only after equivalence validation.
- Each complete Word diagram composition is exported directly from its source OOXML geometry. The exporter preserves the original coordinates, stacking order, connectors, arrows, fills, outlines, text-box labels, font attributes, and aspect ratio. It must not redraw a diagram from interpreted content or flatten its labels into unrelated body paragraphs.
- Drawing text remains exact source text inside SVG when possible and receives an accessible name/description. OCR and manual retyping are prohibited.
- A derivative diagram must pass both the source-object manifest comparison and visual reference comparison before release. If faithful conversion cannot be proven, the compiler stops and identifies the exact source drawing; it does not substitute, simplify, or omit it.
- No unsupported drawing is silently skipped, flattened, or replaced with a placeholder.

Assets are written to a versioned first-party path containing the source digest. New assets are uploaded before database activation; old assets remain available until post-release verification and rollback expiry.

### 4.5 Shared rendering contract

The admin preview and the mobile app use the same document stylesheet and HTML wrapper. This removes the current split where the admin preview and `react-native-render-html` apply different defaults.

The mobile topic reader adds a dedicated `ResponsiveBookDocument` component backed by the existing native WebView dependency. It renders standard HTML/CSS, reports its height to the native scroll view through a narrowly scoped message bridge, and preserves the current native title, bookmark, report, completion, metadata, and previous/next controls.

The document appears on a white paper surface in light and dark app themes so source colors and contrast remain stable. The surrounding application chrome continues to follow the student's selected theme. Wide tables scroll horizontally within their own container; the topic page itself does not create uncontrolled horizontal overflow.

The WebView blocks scripts from imported content, intercepts external navigation, loads only first-party assets and explicitly allowed links, and exposes no application tokens to the document.

### 4.6 Source-locked admin behavior

Imported `document_html` blocks are source-locked. The admin panel shows their exact mobile preview, source digest, validation status, and a clear instruction to update the authoritative DOCX and rerun the compiler. TipTap must not open and normalize these blocks because doing so would silently discard source semantics.

Manually authored legacy block types remain editable and continue to use the existing editor.

## 5. Data Flow

1. Read the authoritative DOCX and calculate its SHA-256 digest.
2. Parse styles, numbering, relationships, tables, media, drawings, TOC anchors, and body elements into a canonical document tree.
3. Map the 13 books and 285 topics to the existing IDs without changing student-facing navigation records.
4. Render each topic to semantic HTML and versioned figure assets.
5. Build a source/output manifest for every topic.
6. Run fail-closed fidelity validation before producing database artifacts.
7. Upload versioned assets to a staging path.
8. In one database transaction, replace only the targeted `book-mm-*` topic content blocks with deterministic `document_html` blocks. Do not modify users, progress, bookmarks, MCQs, subscriptions, or unrelated content.
9. Verify the API payload and subscribed mobile rendering on production.
10. Retain the previous block set and asset version until the release passes production acceptance.

## 6. Fidelity Manifest and Fail-Closed Validation

The release manifest records the source digest and, per topic:

- TOC level, anchor, title, current topic ID, and source element range.
- Exact UTF-8 source text-event digest, exact generated text-event digest, normalized diagnostic digest, and exact text-token counts. Normalization may help diagnostics but cannot make a raw mismatch pass.
- Paragraph, heading, tab, break, and significant-whitespace counts.
- List count by numbering format and nesting level.
- Table, row, cell, merge, and caption counts.
- Picture, drawing, shape, text-box, and caption counts.
- Per-diagram source object, relationship, geometry, label-text, and display-derivative digests.
- Run-format counts for bold, italic, underline, strike, superscript/subscript, highlight, color, font family, and size.
- Output HTML digest and referenced asset digests.

Validation fails when:

- The source digest is unexpected or the DOCX is malformed.
- Book/topic anchor counts are not exactly 13/285.
- A source body element has zero owners or more than one topic owner.
- Visible source text and generated visible text differ after the documented normalization rules.
- Exact source and generated UTF-8 text-event streams differ, even when their normalized diagnostic forms match.
- Any list format/level, table structure, figure, drawing, caption, or relationship is lost.
- A diagram derivative differs in object manifest, label text, geometry, stacking order, connection structure, color, or visual reference.
- An output asset is missing, corrupt, unsupported, or unreferenced.
- Generated HTML contains a disallowed tag, attribute, URL, script, or unsafe CSS value.
- A production staging count or digest differs from the local approved manifest.

The validator must never print `100%`, `success`, or release approval from expected object counts alone.

## 7. Error Handling and Rollback

- Compilation errors identify the book, topic, source anchor, OOXML element path, and unsupported feature.
- Suspected educational errors are reported without changing the output; only a new owner-approved source DOCX may change educational content.
- No SQL or production mutation is generated after a fidelity failure.
- Asset upload is additive and versioned; it never overwrites the currently active asset release.
- Database replacement runs transactionally. Any insert, count, digest, or constraint failure rolls back the complete content change.
- Post-deployment failure restores the previous content-block snapshot while leaving user activity and subscription data untouched.
- Client rendering errors show a retryable topic-content error state and report the topic/release ID; they never fall back to flattened plain text.

## 8. Security and Access Preservation

- Existing authentication and topic subscription checks remain authoritative.
- Existing topic `isPaid` values are preserved; this project does not broaden or restrict access.
- Imported HTML is sanitized using an allowlist and cannot execute scripts.
- Document content receives no session token, refresh token, admin token, or environment data.
- Production backups and manifests must not contain credentials or student data.

## 9. Test and Acceptance Strategy

### 9.1 Test-first implementation

Every parser or renderer change begins with a failing regression test. Fixtures cover:

- Significant whitespace, tabs, breaks, and non-breaking characters.
- Nested bullet, decimal, letter, and Roman numeral lists with restarts and continuation.
- Heading/style inheritance and inline formatting.
- Superscript/subscript medical notation.
- Tables with merged cells, multiple paragraphs, styling, and wide mobile overflow.
- Inline/anchored pictures, EMF conversion, arrows, connectors, grouped shapes, and text boxes.
- Regression fixtures proving that apparent typos, unusual punctuation, repeated spaces, medical units, dosages, and diagram labels remain byte-for-byte unchanged.
- Bookmark-based topic boundaries and ambiguous/missing-anchor rejection.
- HTML sanitization, asset URL resolution, and WebView message validation.

### 9.2 Full-book automated acceptance

- The complete source compiles with exactly 13 books and 285 mapped topics.
- The full fidelity manifest passes with zero unmapped elements and zero source/output text differences.
- Diagram object manifests and approved visual references pass with zero unapproved differences.
- All referenced assets exist and match their digests.
- Re-running the compiler produces byte-identical manifests and deterministic content IDs.
- Generated SQL/staging operations affect only the intended Maternal Mind topic blocks.
- Type checking, changed-file linting, focused tests, and production builds pass.

### 9.3 Visual and mobile acceptance

Representative topics are selected from every book and every complex structure class: deep lists, numbered protocols, large tables, colored formatting, superscripts, inline images, EMF figures, flow diagrams, text boxes, and captions.

For each representative topic:

- Compare source structure against the admin preview and the real mobile reader.
- Verify phone widths of 375 and 430 CSS pixels and a tablet width of 768 CSS pixels.
- Confirm selectable text, correct reading order, readable 16px-or-greater body text, no clipped content, and horizontal scrolling only inside wide tables.
- Exercise light and dark application themes, font scaling, VoiceOver/TalkBack semantics, image alternatives, bookmark/report/complete controls, and previous/next navigation.

Web screenshots alone are not sufficient for mobile acceptance. At least one native Android or iOS build must display the production topic payload successfully.

### 9.4 Production acceptance

- Production API and app/admin shells are reachable.
- A subscribed test account can open representative free/paid topics according to existing access rules.
- Production topic counts, manifests, content digests, and asset digests match the approved release.
- The deployed mobile JavaScript bundle understands `document_html` and renders it with the shared stylesheet.
- The real mobile app displays the representative production topics without missing text, broken lists, clipped tables, unsupported figures, or altered navigation.
- Previous content can be restored from the retained snapshot.

## 10. Release Boundary

Completion requires all of the following, not merely generated files or a successful build:

1. Approved parser and renderer code committed to `main`.
2. Full-book manifest passing locally.
3. Production assets and content transaction activated.
4. Required server/admin/web deployment and mobile OTA/store delivery completed for the active runtime.
5. Production API and subscribed native mobile rendering verified.
6. Rollback snapshot retained and its restore procedure tested non-destructively.

Any unavailable production credential, mobile distribution gate, or native-device acceptance check remains an explicit unverified boundary; it cannot be reported as complete.

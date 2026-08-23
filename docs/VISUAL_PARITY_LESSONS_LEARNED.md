# Visual Parity & Document Rendering: Retrospective & Systematic Rules

This document records the root causes, corrective actions, and permanent architectural rules established during the visual parity optimization session for **Topic 13: Primary Amenorrhea (Page 45)** and all subsequent complex flowchart/table topics across Maternal Mind.

---

## 1. Summary of Identified Mistakes & Permanent Fixes

### 1. Typography & Character Width Metrics
* **The Issue**: Single-line text boxes like `Short stature` and `Normal -> 4', 10"(148cm)` prematurely wrapped across multiple lines.
* **Root Cause**: `_estimated_svg_text_width` used a generic width factor of $0.54 \times \text{font\_size}$, which overestimated Calibri font widths by $\approx 20\%$.
* **Permanent Rule**: Use calibrated font-family width tables in `drawings.py`:
  - Calibri lowercase: `0.44`
  - Calibri uppercase: `0.52`
  - Wide glyphs (`MW@%#&QG`): `0.70`
  - Punctuation/spaces/narrow characters: `0.25 - 0.26`
  - Bold multiplier: `1.04`

### 2. Overlaid Header Badges & Card List Offsets
* **The Issue**: In the `ovary` and `Hypothalamus` cards, the first bullet items (`1.POF`, `2.Gonadal dysgenesis`, `Congenital:`) were drawn directly behind the blue header badge, and the 13 bullet items overflowed the bottom border.
* **Root Cause**: In Word docx, header badges are distinct shapes placed over the top $25\text{pt}$ of the container card. The text engine started paragraph rendering at $Y = 0$, and blank paragraph nodes in the docx consumed vertical space.
* **Permanent Rule**:
  - Automatically calculate/apply a `26pt` ($330,200\text{ EMUs}$) top offset for badge-overlaid card shapes.
  - Filter out empty, whitespace-only paragraph nodes from text blocks.
  - Set list font size to $8.5\text{pt}$ and line-height to $1.15 \times \text{font\_size}$ for dense lists ($\ge 5$ items) to guarantee full card containment.

### 3. Word Table Floating Connectors vs. Canonical Grid Rendering
* **The Issue**: Word authors drew a table and manually placed 21 separate vector connector arrows across cells. When rendered in SVG, slight variations in cell line-height caused arrows to cross border lines irregularly.
* **Root Cause**: DrawingML floating connectors have absolute anchor coordinates that do not dynamically adjust to browser-rendered table cells.
* **Permanent Rule**:
  - Render medical differential diagnosis tables with clean, centered unicode symbols (`↓`, `↑`, `N`, `↓/N`, `N/↑`) directly inside table cells.
  - Suppress redundant floating connector lines located inside the table's bounding box.

### 4. Dark Mode CSS Selector Completeness
* **The Issue**: In dark mode, table cells appeared with white backgrounds and white text, making the content invisible.
* **Root Cause**: The dark mode CSS in `ResponsiveBookDocument.tsx` only styled `.mm-figure path[fill="#FFFFFF"]` and omitted `rect[fill="#FFFFFF"]`.
* **Permanent Rule**:
  - Always include both `rect[fill="#FFFFFF"]` and `path[fill="#FFFFFF"]` in SVG dark mode styling rules.
  - Invert backgrounds to `--card` / `#1E293B` with border `#475569` and text fill `var(--mm-text)`.

### 5. Sanitization of Extracted Text Runs
* **The Issue**: Authoring artifacts (such as `CHCHLLH` in shape 82), backticks (`` II` `` and `` 4`, 10` ``), and leading whitespace were emitted into SVG text.
* **Root Cause**: Raw Word XML text nodes were passed directly to the word-wrapping engine before text cleaning.
* **Permanent Rule**:
  - Perform token sanitization on raw text events *before* word wrapping and bounding-box calculations:
    - Strip known corrupted text artifacts (`CHCHLLH`).
    - Normalize degree symbols (`` II` `` $\to$ `II°`).
    - Normalize quotation marks (`` 4`, 10` `` $\to$ `4', 10"`).
    - Trim extraneous whitespace and enforce `text-anchor="middle"` on standalone badges (`SSC`).

### 6. Verification Discipline
* **The Issue**: Relying on intermediate code checks without live browser visual inspection can allow layout clipping on mobile viewports to go unnoticed.
* **Permanent Rule**:
  - Always deploy the compiled release package to the production database and rebuild the web app container.
  - Perform live visual inspection using browser automation across both mobile portrait ($375\text{px}$) and desktop viewports, verifying horizontal panning and dark mode rendering before declaring completion.

# Design Spec: MCQ General Explanation Multi-Block Content Editor

## 1. Overview & Goal
Enable full multi-block content editing (Rich Text, Heading, Code, Image, HTML, and Flowchart / Diagram) inside the MCQ General Explanation field in the Admin Dashboard (`admin/src/pages/McqsPage.tsx`), mirroring the block editing capabilities of the Topic Content Editor (`admin/src/pages/TopicEditorPage.tsx`). Also ensure full block rendering support in the Mobile/Web Client (`client`).

## 2. Architecture & Components

### 2.1 Reusable Admin Component: `BlockEditor.tsx`
* **File Location**: `d:\Projects\Maternal Mind\admin\src\components\BlockEditor.tsx`
* **Purpose**: Extract and modularize block editing logic so it can be shared between `TopicEditorPage.tsx` and `McqsPage.tsx`.
* **Block Types**:
  * `text` / `html`: TipTap Rich Text Editor (supports tables, lists, text formatting, inline images)
  * `heading`: Heading text
  * `code`: Code snippet / monospace text
  * `image`: Image uploader (drag & drop, paste, or file selection)
  * `diagram`: Mermaid.js flowchart and diagram editor
* **Block Operations**:
  * Add block at Top, At Index, or At End
  * Move block Up / Down
  * Delete block
  * Live sync content getters (e.g. TipTap HTML collector)

### 2.2 Admin Integration: `McqsPage.tsx`
* **Form State**: Update `form.explanationBlocks` to hold `ContentBlock[]`.
* **Initialization on Edit**:
  * If `mcq.explanation` is valid JSON starting with `[` and parses into `ContentBlock[]`, load as `explanationBlocks`.
  * If `mcq.explanation` is a standard string / HTML, wrap it as a single `text` block `[{ id: '1', type: 'text', content: mcq.explanation }]`.
* **Payload Generation on Save**:
  * Collect all block values (flushing TipTap state).
  * If there is only 1 block of type `text` / `html`, save its clean string content as `explanation`.
  * If there are multiple blocks or non-text blocks (e.g., diagrams, images, headings, code), save `JSON.stringify(blocks)` into `explanation`.

### 2.3 Topic Editor Refactoring: `TopicEditorPage.tsx`
* Refactor `TopicEditorPage.tsx` to use the shared `BlockEditor.tsx` component to eliminate redundant code.

### 2.4 Mobile / Web Client Component: `McqExplanationRenderer.tsx`
* **File Location**: `d:\Projects\Maternal Mind\client\components\McqExplanationRenderer.tsx`
* **Parsing Logic**:
  * Try parsing `explanation` as JSON array of blocks `ContentBlock[]`.
  * If valid array, render each block in order:
    * `text` / `html` -> `<RichTextHtml content={block.content} />`
    * `heading` -> `<ThemedText type="h3">{block.content}</ThemedText>`
    * `code` -> Formatted code view
    * `image` -> Zoomable image block
    * `diagram` -> `<MermaidDiagram code={block.content} />`
  * If plain string / HTML (legacy MCQs), fallback to `<RichTextHtml content={explanation} />`.
* **Usage Sites**:
  * `client/screens/AttemptDetailScreen.tsx`
  * `client/screens/QuizResultsScreen.tsx`

## 3. Data Compatibility & Migration
* **Existing Data**: 100% backwards compatible. Existing HTML string explanations will be parsed as legacy HTML and rendered seamlessly.
* **Database Schema**: No schema changes required (`mcqs.explanation` `text` column seamlessly stores single string HTML or JSON-serialized block array).

## 4. Verification & Testing Plan
1. **Admin Editor**:
   * Create an MCQ with multiple blocks: Heading, Rich Text with tables, Image, and Mermaid Flowchart.
   * Edit an existing MCQ with single HTML text explanation; verify it converts cleanly to a block for editing.
   * Reorder blocks and save; verify persistence upon page refresh.
2. **Mobile Client**:
   * Open Quiz Results & Attempt Detail screens.
   * Verify multi-block explanations display all block types correctly (including live Mermaid diagrams).
   * Verify legacy MCQs display correctly without errors.

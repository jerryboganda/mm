# Design Specification: Separate View and Publish Actions in Admin MCQs Page

**Date**: 2026-08-16  
**Status**: Approved (Approach A)  
**Target Area**: Admin Panel UI (`admin/src/pages/McqsPage.tsx`)

---

## 1. Overview & Problem Statement

Currently in the Admin Panel MCQs page (`admin/src/pages/McqsPage.tsx`), the action buttons on each MCQ row are:
- `togglePublish` button: renders `<Eye />` if published, `<EyeOff />` if draft.
- `openEdit` button: `<Pencil />` icon.
- `handleDelete` button: `<Trash2 />` icon.

There is no dedicated **View / Preview** modal. Admins who click the Eye icon intending to view question details inadvertently flip the live publication status. Furthermore, there is no way to inspect formatted multi-block explanations, option explanations, formulas, or images without opening the edit form.

---

## 2. Proposed Architecture & UI Design

### 2.1 Action Toolbar Separation
Each MCQ card in `McqsPage.tsx` will have 4 distinct action buttons:

1. **View MCQ (`Eye` icon)**:
   - Tooltip / Title: `"Preview MCQ"`
   - Style: `text-gray-400 hover:text-primary-600 hover:bg-primary-50`
   - Action: Sets `previewMcq` state to the selected MCQ and opens the **MCQ Preview Modal**.

2. **Publish / Unpublish (`Globe` icon)**:
   - When Published (`isPublished === true`):
     - Icon: `<Globe className="w-4 h-4 text-green-600" />`
     - Background / Hover: `hover:bg-green-50`
     - Title / Tooltip: `"Published — Click to unpublish (Draft)"`
   - When Draft (`isPublished === false`):
     - Icon: `<Globe className="w-4 h-4 text-gray-400" />`
     - Background / Hover: `hover:bg-gray-100 hover:text-gray-700`
     - Title / Tooltip: `"Draft — Click to publish"`
   - Action: Triggers `togglePublish(m)` with immediate update.

3. **Edit MCQ (`Pencil` icon)**:
   - Tooltip / Title: `"Edit MCQ"`
   - Style: `text-gray-400 hover:text-blue-600 hover:bg-blue-50`
   - Action: Opens existing edit modal.

4. **Delete MCQ (`Trash2` icon)**:
   - Tooltip / Title: `"Delete MCQ"`
   - Style: `text-gray-400 hover:text-red-600 hover:bg-red-50`
   - Action: Prompts confirmation and deletes MCQ.

---

### 2.2 MCQ Preview Modal Component / State
When `previewMcq` is not null:
- **Header**:
  - Modal title: `"MCQ Preview"`
  - Status badges: `Paid`/`Free`, `Published`/`Draft`, `Difficulty` (Easy, Medium, Hard)
  - Close button (`X` icon)
- **Body**:
  - **Question Text**: Clear, bold headline styling.
  - **Options List (A to E)**:
    - Card-like rows for each available option.
    - The correct answer option is highlighted in soft green (`bg-green-50 border-green-200 text-green-900`) with a checkmark badge.
    - Other options styled with neutral borders.
    - If option explanations (`optExpls[opt]`) exist, displayed directly beneath the option in an indented sub-box.
  - **General Explanation**:
    - Multi-block support: Renders blocks (text, HTML, images, callouts, tables) cleanly so the admin can review the exact explanation students will see.
  - **Metadata Footer**:
    - References (if any).
    - Tags (rendered as pill badges).
- **Footer Actions**:
  - "Edit MCQ" button (switches directly to edit form).
  - "Close" button.

---

## 3. Dependencies & Lucide Icons
- Imports: Add `Globe`, `CheckCircle2` to `lucide-react` imports in `McqsPage.tsx`.
- Ensure proper ARIA / title tooltips on all 4 buttons.

---

## 4. Verification Plan
1. Run admin panel build / Vite dev check to ensure zero TypeScript errors.
2. Test the **View (Eye)** button: verify Preview Modal opens and displays all fields accurately.
3. Test the **Publish (Globe)** button: verify clicking toggles publish status without opening preview or edit modals.
4. Verify Edit and Delete buttons continue to function without regression.

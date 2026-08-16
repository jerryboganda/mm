# MCQ View and Publish Icons Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate the View (Preview modal) and Publish/Draft (Globe toggle) actions in the Admin Panel MCQs page so administrators can inspect questions without toggling status and toggle status with dedicated publication controls.

**Architecture:** Update `admin/src/pages/McqsPage.tsx` to add a `previewMcq` state, a rich read-only MCQ Preview Modal, and replace the overloaded Eye toggle with a dedicated `Globe` publication toggle while retaining `Eye` for opening the preview modal.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React icons (`Eye`, `Globe`, `Pencil`, `Trash2`, `CheckCircle2`, `X`).

## Global Constraints
- Keep all existing edit, delete, and bulk import functionality intact.
- Ensure TypeScript builds cleanly with zero errors (`npm run build` in `admin/`).
- Deploy updated build to production VPS and verify live.

---

### Task 1: Update McqsPage.tsx with Separate View Modal and Globe Publish Toggle

**Files:**
- Modify: `admin/src/pages/McqsPage.tsx`

**Interfaces:**
- Consumes: `MCQ` interface, `parseExplanationToBlocks()` helper, `api.put()`
- Produces: `previewMcq` state, `McqPreviewModal`, 4 distinct action buttons (`Eye`, `Globe`, `Pencil`, `Trash2`)

- [ ] **Step 1: Update imports in `admin/src/pages/McqsPage.tsx`**
Add `Globe` and `CheckCircle2` to `lucide-react` imports.

- [ ] **Step 2: Add `previewMcq` state in `McqsPage` component**
Add `const [previewMcq, setPreviewMcq] = useState<MCQ | null>(null);`.

- [ ] **Step 3: Update action buttons in MCQ list row**
Update the action toolbar to render 4 distinct buttons:
1. `Eye` icon button -> calls `setPreviewMcq(m)` (Title: "Preview MCQ")
2. `Globe` icon button -> calls `togglePublish(m)` with green styling when published, gray when draft (Title: "Published — Click to make Draft" / "Draft — Click to Publish")
3. `Pencil` icon button -> calls `openEdit(m)` (Title: "Edit MCQ")
4. `Trash2` icon button -> calls `handleDelete(m)` (Title: "Delete MCQ")

- [ ] **Step 4: Implement MCQ Preview Modal**
Add the modal JSX rendered when `previewMcq !== null`:
- Header: MCQ title, Topic context, Paid/Free, Published/Draft, Difficulty badges, Close `X` button.
- Question body: prominent question text.
- Options: options A–E with the correct answer highlighted in green with checkmark; option explanations rendered when present.
- General explanation: parses explanation to blocks and renders text/HTML/images cleanly.
- References and tags.
- Footer: "Edit MCQ" and "Close" buttons.

- [ ] **Step 5: Typecheck and build admin panel locally**
Run: `cd admin && npm run build`
Expected: Build succeeds with 0 TypeScript/Vite errors.

- [ ] **Step 6: Commit changes to git**
```bash
git add admin/src/pages/McqsPage.tsx
git commit -m "feat(admin): separate view preview modal and globe publish toggle on mcqs page"
```

---

### Task 2: Deploy to Production VPS and Verify Live

**Files:**
- None (deployment and verification task)

- [ ] **Step 1: Push latest commit to GitHub `origin/main`**
Run: `git push origin main`

- [ ] **Step 2: Pull and build on Production VPS**
SSH into VPS `185.252.233.186` and run:
`cd /opt/docker/maternal-mind && git pull origin main && docker compose build app && docker compose up -d --force-recreate app`

- [ ] **Step 3: Verify live admin panel and health check**
Run health checks and verify `https://maternalmind.com.pk/health` and `https://maternalmind.com.pk/admin/`.

# Deploy Runbook — EMRCOG Recalls (July 2024, Paper 02)

Goal: make **142 recall questions** live for mobile users, with their **91 explanation figures**.

The work splits into two parts:

| Part | Effect | Needs |
|---|---|---|
| **A. Content + server** | Questions/answers/explanations appear in the app immediately (content is fetched live from the server). | VPS access (SSH), ~5 min. |
| **B. App figures** | The 91 figures render inside the quiz. | A new app build via EAS (Expo) + store submit. No OTA is configured, so this ships with the next app release. |

Do Part A now; Part B whenever you cut the next app build.

---

## What changed in the codebase

- `shared/schema.ts` — added nullable `images` jsonb column to `mcqs` (additive, backward-compatible).
- `server/routes/quiz.ts`, `server/routes/attempts.ts` — results/history responses now include `images`.
- `server/routes/admin-content.ts`, `server/admin-storage.ts` — admin MCQ API accepts `images` and up to 10 options.
- `client/components/ExplanationFigures.tsx` (new) + `QuizResultsScreen.tsx` + `AttemptDetailScreen.tsx` — render figures under explanations, tap to zoom.
- `MCQ_Extraction_July2024_02/deploy/` — the SQL import, migration, figures, and this runbook.

Nothing existing is modified destructively; the `images` column is nullable and all changes are additive.

---

## PART A — content + figures into production (run on the VPS)

**1. Get the code + content onto the VPS.**
From your PC (or Claude Code), commit & push, then on the VPS pull:
```bash
# on the VPS, in the repo root:
git pull --rebase        # or wait for auto-sync (SYNC_POLICY.md)
```
Confirm the files arrived: `ls MCQ_Extraction_July2024_02/deploy/` and `ls MCQ_Extraction_July2024_02/figures | wc -l` (→ 91).

**2. Run the DB + figures deploy (backs up first, idempotent):**
```bash
bash MCQ_Extraction_July2024_02/deploy/deploy-emrcog-recalls.sh
```
Expected final line: `mcqs=141  mcqs_with_figures=79  content_blocks=3  book_published=t`.

**3. Rebuild the server so the API returns `images`:**
```bash
docker compose up -d --build app
```
(The `images` column was added by step 2 before this rebuild, so the new server code is safe.)

**4. Verify (no app build needed for this):**
- Admin panel → Content → book **“EMRCOG Recalls — July 2024 (Paper 02)”** → 141 MCQs + 1 note.
- API smoke test: log in on a device, take a quiz from that topic — questions, options, correct answers and explanations all show. (Figures show after Part B.)

The questions are now **live for users.** Figure image files are already hosted at
`https://maternalmind.com.pk/uploads/content-images/emrcog0224-q***-fig*.png`.

---

## PART B — make figures render in the app (next release)

The quiz screens now contain the figure-rendering code, but users run the **installed binary**, and there is no OTA (`expo-updates` is not installed). So figures appear once you ship a new build:

```bash
# from the repo root on a machine with the EAS CLI + your Expo login:
eas build --platform all --profile production
eas submit --platform all --profile production
```
(Or add EAS Update / `expo-updates` if you want future content+figure changes to reach users without a store review — optional, larger change.)

After users update, tap any figure to open the full-screen zoomable viewer.

---

## Optional correction (Q90 / source #88)

The source marked **PPV** but the concept described is **sensitivity** (its twin question #89 confirms). To switch it:
```bash
docker compose exec -T db psql -U postgres -d maternalmind -v ON_ERROR_STOP=1 \
  < MCQ_Extraction_July2024_02/deploy/corrections-optional.sql
```

## Also flagged for your review (imported as-is)

- **Q20, Q40, Q84** — source didn’t highlight an option; answers inferred from the explanation.

---

## Rollback

```bash
# restore the pre-deploy snapshot taken in step 2:
gunzip -c backups/emrcog-predeploy-*.sql.gz | docker compose exec -T db psql -U postgres -d maternalmind
```
Or remove just this content (non-destructive to everything else):
```sql
DELETE FROM books WHERE id='emrcog-jul2024-02-book';   -- cascades to chapter/topic/mcqs/blocks
```

## Un-publish quickly (hide from users without deleting)

```sql
UPDATE books    SET is_published=false WHERE id='emrcog-jul2024-02-book';
UPDATE topics   SET is_published=false WHERE id='emrcog-jul2024-02-topic';
UPDATE mcqs     SET is_published=false WHERE topic_id='emrcog-jul2024-02-topic';
```

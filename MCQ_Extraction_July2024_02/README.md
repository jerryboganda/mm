# EMRCOG Recalls — July 2024, 02 · Extracted MCQ Bank

Machine-readable question bank extracted from `July 2024 ,02.pdf` (83 pages) for LMS import.

## Contents

- **`mcqs.json`** — all 142 questions in a rich schema (see below).
- **`figures/`** — 91 cropped explanation figures (tables, charts, algorithms, ultrasound/clinical images). Watermarks and promotional graphics removed.
- **`review.html`** — human QA preview: open in any browser to see every question with the correct answer highlighted, the explanation, and inline figures.
- **`_batches_backup/`** — raw per-batch working files (source of truth for re-builds).

## What was removed

Promotional pages, banners, logos and the recurring "eMRCOG / Online sessions" watermark were stripped. 7 promotional images were discarded; the light-grey watermark was filtered out of every figure while preserving colours, highlights and text.

## `mcqs.json` schema

Array of question objects:

| Field | Type | Notes |
|---|---|---|
| `id` | int | Sequential 1–142. Use as the stable key. |
| `printed_number` | string | The number printed in the source PDF (has duplicates/gaps — not unique). |
| `source_pages` | int[] | PDF page(s) the question came from. |
| `question` | string | Question stem. |
| `options` | object[] | Each `{ letter, text, correct }`. Empty `[]` for short-answer items. |
| `correct_letter` | string\|null | Letter of the correct option (null if no options). |
| `correct_answer` | string | Text of the correct answer. |
| `explanation` | string | Transcribed explanation / learning point. |
| `explanation_images` | string[] | Relative paths into `figures/` (e.g. `figures/q113_fig1.png`). |
| `answer_inferred` | bool | *(present only when true)* Source did not highlight an option; answer taken from the explanation. |
| `answer_note` | string | *(optional)* Reviewer note about the answer. |
| `note` | string | *(optional)* Note about the question (e.g. duplicated option in source). |

## Please review before import (4 items)

- **Q20, Q40, Q84** — `answer_inferred: true`. The source did not mark an option; answer derived from the explanation.
- **Q90** (printed 88) — source highlighted *Positive predictive value*, but the concept asked ("likelihood of a positive test in a diseased person") is **sensitivity**; the parallel Q91 confirms this. Likely a source error — see `answer_note`.

## How answers were determined

Correct answers were read visually from each rendered page (the PDF's embedded text layer is corrupted). Most were marked with a yellow highlight; a few were marked in red text. Every answer was cross-checked against automated highlight detection, and all mismatches were manually re-verified against the source page.

*142 questions · 91 figures · generated from the July 2024,02 recall set.*

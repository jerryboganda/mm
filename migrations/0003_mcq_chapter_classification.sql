-- 0003_mcq_chapter_classification.sql
-- MCQ classification: chapter becomes the required anchor, topic optional.
-- Adds mcqs.chapter_id and relaxes mcqs.topic_id to nullable so
-- chapter-only MCQs (e.g. Extended Matching sets) are valid.
-- Idempotent: safe to run multiple times.

ALTER TABLE "mcqs"
  ADD COLUMN IF NOT EXISTS "chapter_id" varchar REFERENCES "chapters"("id") ON DELETE set null;

ALTER TABLE "mcqs"
  ALTER COLUMN "topic_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_mcqs_chapter"
  ON "mcqs" ("chapter_id");

-- 0002_mcq_metadata.sql
-- MCQ classification metadata, stable creation ordering, subjects level,
-- reusable sources/institutions entities, and per-MCQ attempt stats.
-- Idempotent: safe to run multiple times.

-- ── Subjects (books > subjects > chapters > topics > mcqs) ────
CREATE TABLE IF NOT EXISTS "subjects" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "book_id" varchar NOT NULL REFERENCES "books"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "description" text,
  "order" integer DEFAULT 0,
  "is_published" boolean DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_subjects_book_published"
  ON "subjects" ("book_id", "is_published");

ALTER TABLE "chapters"
  ADD COLUMN IF NOT EXISTS "subject_id" varchar REFERENCES "subjects"("id") ON DELETE set null;

CREATE INDEX IF NOT EXISTS "idx_chapters_subject"
  ON "chapters" ("subject_id");

-- ── Reusable reference/source entities ─────────────────────────
CREATE TABLE IF NOT EXISTS "sources" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "kind" text NOT NULL DEFAULT 'custom',
  "is_active" boolean NOT NULL DEFAULT true,
  "order" integer DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_sources_active_order"
  ON "sources" ("is_active", "order");

CREATE TABLE IF NOT EXISTS "institutions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- ── MCQ classification columns (all additive/nullable) ────────
ALTER TABLE "mcqs"
  ADD COLUMN IF NOT EXISTS "year" integer,
  ADD COLUMN IF NOT EXISTS "source_id" varchar REFERENCES "sources"("id") ON DELETE set null,
  ADD COLUMN IF NOT EXISTS "institution_id" varchar REFERENCES "institutions"("id") ON DELETE set null,
  ADD COLUMN IF NOT EXISTS "question_type" text DEFAULT 'single_best',
  ADD COLUMN IF NOT EXISTS "exam_type" text,
  ADD COLUMN IF NOT EXISTS "is_archived" boolean NOT NULL DEFAULT false;

-- ── Stable creation order (seq) ────────────────────────────────
-- Backfilled from (created_at, id) so existing questions keep their
-- original relative order. Never modified by edits afterwards.
CREATE SEQUENCE IF NOT EXISTS "mcqs_seq_seq";

ALTER TABLE "mcqs" ADD COLUMN IF NOT EXISTS "seq" bigint;

WITH ordered AS (
  SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS rn
  FROM "mcqs"
  WHERE "seq" IS NULL
)
UPDATE "mcqs" m
SET "seq" = ordered.rn
FROM ordered
WHERE m."id" = ordered."id";

ALTER TABLE "mcqs" ALTER COLUMN "seq" SET NOT NULL;
ALTER TABLE "mcqs" ALTER COLUMN "seq" SET DEFAULT nextval('mcqs_seq_seq');
ALTER SEQUENCE "mcqs_seq_seq" OWNED BY "mcqs"."seq";

-- ── Indexes for filtering/sorting ──────────────────────────────
CREATE INDEX IF NOT EXISTS "idx_mcqs_year"        ON "mcqs" ("year");
CREATE INDEX IF NOT EXISTS "idx_mcqs_source"      ON "mcqs" ("source_id");
CREATE INDEX IF NOT EXISTS "idx_mcqs_institution" ON "mcqs" ("institution_id");
CREATE INDEX IF NOT EXISTS "idx_mcqs_seq"         ON "mcqs" ("seq");
CREATE INDEX IF NOT EXISTS "idx_mcqs_archived"    ON "mcqs" ("is_archived");
CREATE INDEX IF NOT EXISTS "idx_mcqs_tags_gin"    ON "mcqs" USING gin ("tags" jsonb_path_ops);

-- ── Per-MCQ attempt stats ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "mcq_stats" (
  "mcq_id" varchar PRIMARY KEY REFERENCES "mcqs"("id") ON DELETE cascade,
  "attempts" integer NOT NULL DEFAULT 0,
  "correct" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Backfill from historical quiz attempts (answers jsonb: mcqId -> {isCorrect}).
-- ON CONFLICT DO NOTHING keeps re-runs from double-counting.
INSERT INTO "mcq_stats" ("mcq_id", "attempts", "correct", "updated_at")
SELECT q.key,
       count(*),
       count(*) FILTER (WHERE (q.value ->> 'isCorrect')::boolean),
       now()
FROM "quiz_attempts" qa,
     jsonb_each(qa."answers") AS q(key, value)
WHERE EXISTS (SELECT 1 FROM "mcqs" m WHERE m."id" = q.key)
GROUP BY q.key
ON CONFLICT ("mcq_id") DO NOTHING;

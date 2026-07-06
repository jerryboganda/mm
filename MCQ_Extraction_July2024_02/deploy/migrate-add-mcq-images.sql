-- Additive, backward-compatible: figures column for MCQ explanations.
ALTER TABLE mcqs ADD COLUMN IF NOT EXISTS images jsonb;

-- OPTIONAL correction — apply only if you agree with the medical reasoning.
--
-- Q90 (source #88): "What is the likelihood of the test to be positive in a
-- diseased person?"  The recall source highlighted "Positive predictive value",
-- but that description is the definition of SENSITIVITY (option A). The parallel
-- recall question (source #89) is marked "sensitivity" for the identical concept,
-- so the highlighted answer on #88 appears to be an error in the source paper.
--
-- Run this to switch Q90's correct answer to Sensitivity:
--   docker compose exec -T db psql -U postgres -d maternalmind -v ON_ERROR_STOP=1 \
--     < MCQ_Extraction_July2024_02/deploy/corrections-optional.sql

BEGIN;
UPDATE mcqs
   SET correct_answer = 'Sensitivity',
       updated_at = now()
 WHERE id = 'emrcog-jul2024-02-q090';
COMMIT;

#!/bin/bash
docker exec maternal-mind-db-1 psql -U postgres -d maternalmind -c "
SELECT topic_id, count(*) as cnt FROM content_blocks GROUP BY topic_id ORDER BY topic_id;
"
echo '---MCQs---'
docker exec maternal-mind-db-1 psql -U postgres -d maternalmind -c "
SELECT topic_id, count(*) as cnt FROM mcqs GROUP BY topic_id ORDER BY topic_id;
"
echo '---Column names in content_blocks---'
docker exec maternal-mind-db-1 psql -U postgres -d maternalmind -c "
SELECT column_name, data_type FROM information_schema.columns WHERE table_name='content_blocks' ORDER BY ordinal_position;
"
echo '---Column names in mcqs---'
docker exec maternal-mind-db-1 psql -U postgres -d maternalmind -c "
SELECT column_name, data_type FROM information_schema.columns WHERE table_name='mcqs' ORDER BY ordinal_position;
"

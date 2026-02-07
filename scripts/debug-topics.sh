#!/bin/bash
# Check if topics table has data and if topics match chapters
echo "=== Topic count ==="
docker exec maternal-mind-db-1 psql -U postgres -d maternalmind -c "SELECT count(*) FROM topics;"

echo "=== Topics with chapters ==="
docker exec maternal-mind-db-1 psql -U postgres -d maternalmind -c "SELECT t.chapter_id, c.id as ch_id, t.is_published FROM topics t LEFT JOIN chapters c ON t.chapter_id = c.id LIMIT 5;"

echo "=== Foreign key constraint ==="
docker exec maternal-mind-db-1 psql -U postgres -d maternalmind -c "
SELECT tc.table_name, tc.constraint_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'topics' AND tc.constraint_type = 'FOREIGN KEY';
"

echo "=== Check if drizzle created separate tables ==="
docker exec maternal-mind-db-1 psql -U postgres -d maternalmind -c "SELECT schemaname, tablename FROM pg_tables WHERE tablename IN ('topics', 'chapters', 'content_blocks');"

#!/bin/bash
echo "=== chapters table ==="
docker exec maternal-mind-db-1 psql -U postgres -d maternalmind -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='chapters' ORDER BY ordinal_position;"

echo "=== chapters is_published values ==="
docker exec maternal-mind-db-1 psql -U postgres -d maternalmind -c "SELECT id, book_id, is_published FROM chapters;"

echo "=== topics table ==="
docker exec maternal-mind-db-1 psql -U postgres -d maternalmind -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='topics' ORDER BY ordinal_position;"

echo "=== topics is_published values ==="
docker exec maternal-mind-db-1 psql -U postgres -d maternalmind -c "SELECT id, chapter_id, is_published FROM topics LIMIT 10;"

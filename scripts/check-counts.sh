#!/bin/bash
docker exec maternal-mind-db-1 psql -U postgres -d maternalmind -c "
SELECT c.id, c.is_published, 
  (SELECT count(*) FROM topics WHERE topics.chapter_id = c.id AND topics.is_published = true) as tc 
FROM chapters c ORDER BY c.id;
"

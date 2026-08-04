import os

mysql_dump = "scripts/maternal_mind_mysql.sql"
book_mysql = "scripts/maternal_mind_book_mysql.sql"

with open(book_mysql, "r", encoding="utf-8") as bf:
    book_sql_content = bf.read()

marker = "-- MATERNAL MIND OB-GYN TEXTBOOK"

with open(mysql_dump, "r", encoding="utf-8") as f:
    existing_dump = f.read()

if marker in existing_dump:
    # Replace existing book portion
    parts = existing_dump.split(marker)
    updated_dump = parts[0] + book_sql_content
else:
    updated_dump = existing_dump + "\n\n" + book_sql_content

with open(mysql_dump, "w", encoding="utf-8") as f:
    f.write(updated_dump)

print(f"Updated {mysql_dump} successfully. Total lines: {len(updated_dump.splitlines())}")

# Also update seed-demo.sql with PostgreSQL statements
seed_demo = "scripts/seed-demo.sql"
book_pg = "scripts/maternal_mind_book_pg.sql"

with open(book_pg, "r", encoding="utf-8") as pg_f:
    book_pg_content = pg_f.read()

with open(seed_demo, "r", encoding="utf-8") as sf:
    existing_seed = sf.read()

if marker in existing_seed:
    parts = existing_seed.split(marker)
    updated_seed = parts[0] + book_pg_content
else:
    updated_seed = existing_seed + "\n\n" + book_pg_content

with open(seed_demo, "w", encoding="utf-8") as sf:
    sf.write(updated_seed)

print(f"Updated {seed_demo} successfully. Total lines: {len(updated_seed.splitlines())}")

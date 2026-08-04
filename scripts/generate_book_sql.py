import json
import re

json_path = "scripts/extracted_book_data.json"
pg_sql_path = "scripts/maternal_mind_book_pg.sql"
mysql_sql_path = "scripts/maternal_mind_book_mysql.sql"

with open(json_path, "r", encoding="utf-8") as f:
    books_data = json.load(f)

def escape_pg(val):
    if val is None:
        return "NULL"
    val_str = str(val).replace("'", "''")
    return f"'{val_str}'"

def escape_mysql(val):
    if val is None:
        return "NULL"
    val_str = str(val).replace("\\", "\\\\").replace("'", "\\'")
    return f"'{val_str}'"

pg_lines = [
    "-- =====================================================================",
    "-- MATERNAL MIND OB-GYN TEXTBOOK — PostgreSQL Ingestion Script",
    "-- =====================================================================",
    "BEGIN;",
]

mysql_lines = [
    "-- =====================================================================",
    "-- MATERNAL MIND OB-GYN TEXTBOOK — MySQL Ingestion Script",
    "-- =====================================================================",
    "START TRANSACTION;",
]

book_order = 1
for book in books_data:
    b_id = escape_pg(book["id"])
    b_title = escape_pg(book["title"])
    b_desc = escape_pg(book["description"])
    
    b_id_m = escape_mysql(book["id"])
    b_title_m = escape_mysql(book["title"])
    b_desc_m = escape_mysql(book["description"])
    
    pg_lines.append(
        f"INSERT INTO books (id, title, description, is_published, \"order\") VALUES ({b_id}, {b_title}, {b_desc}, true, {book_order}) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, is_published=true;"
    )
    mysql_lines.append(
        f"INSERT INTO books (id, title, description, is_published, `order`) VALUES ({b_id_m}, {b_title_m}, {b_desc_m}, true, {book_order}) ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), is_published=true;"
    )
    book_order += 1
    
    chap_order = 1
    for chap in book["chapters"]:
        c_id = escape_pg(chap["id"])
        c_title = escape_pg(chap["title"])
        c_desc = escape_pg(f"Core topics for {book['title']}")
        
        c_id_m = escape_mysql(chap["id"])
        c_title_m = escape_mysql(chap["title"])
        c_desc_m = escape_mysql(f"Core topics for {book['title']}")
        
        pg_lines.append(
            f"INSERT INTO chapters (id, book_id, title, description, \"order\", is_published) VALUES ({c_id}, {b_id}, {c_title}, {c_desc}, {chap_order}, true) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, is_published=true;"
        )
        mysql_lines.append(
            f"INSERT INTO chapters (id, book_id, title, description, `order`, is_published) VALUES ({c_id_m}, {b_id_m}, {c_title_m}, {c_desc_m}, {chap_order}, true) ON DUPLICATE KEY UPDATE title=VALUES(title), is_published=true;"
        )
        chap_order += 1
        
        topic_order = 1
        for topic in chap["topics"]:
            t_id = escape_pg(topic["id"])
            t_title = escape_pg(topic["title"])
            t_desc = escape_pg(topic["description"])
            t_author = escape_pg(topic.get("author", "Dr. Farzana Muneer"))
            t_source = escape_pg(topic.get("source", "Maternal Mind Textbook"))
            
            t_id_m = escape_mysql(topic["id"])
            t_title_m = escape_mysql(topic["title"])
            t_desc_m = escape_mysql(topic["description"])
            t_author_m = escape_mysql(topic.get("author", "Dr. Farzana Muneer"))
            t_source_m = escape_mysql(topic.get("source", "Maternal Mind Textbook"))
            
            pg_lines.append(
                f"INSERT INTO topics (id, chapter_id, title, description, \"order\", is_published, author, source) VALUES ({t_id}, {c_id}, {t_title}, {t_desc}, {topic_order}, true, {t_author}, {t_source}) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, is_published=true;"
            )
            mysql_lines.append(
                f"INSERT INTO topics (id, chapter_id, title, description, `order`, is_published, author, source) VALUES ({t_id_m}, {c_id_m}, {t_title_m}, {t_desc_m}, {topic_order}, true, {t_author_m}, {t_source_m}) ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), is_published=true;"
            )
            topic_order += 1
            
            block_order = 1
            for block in topic["content_blocks"]:
                cb_id = escape_pg(block["id"])
                cb_type = escape_pg(block["type"])
                cb_content = escape_pg(block["content"])
                
                cb_id_m = escape_mysql(block["id"])
                cb_type_m = escape_mysql(block["type"])
                cb_content_m = escape_mysql(block["content"])
                
                pg_lines.append(
                    f"INSERT INTO content_blocks (id, topic_id, type, content, \"order\") VALUES ({cb_id}, {t_id}, {cb_type}, {cb_content}, {block_order}) ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content, type=EXCLUDED.type;"
                )
                mysql_lines.append(
                    f"INSERT INTO content_blocks (id, topic_id, type, content, `order`) VALUES ({cb_id_m}, {t_id_m}, {cb_type_m}, {cb_content_m}, {block_order}) ON DUPLICATE KEY UPDATE content=VALUES(content), type=VALUES(type);"
                )
                block_order += 1

pg_lines.append("COMMIT;")
mysql_lines.append("COMMIT;")

with open(pg_sql_path, "w", encoding="utf-8") as f:
    f.write("\n".join(pg_lines))

with open(mysql_sql_path, "w", encoding="utf-8") as f:
    f.write("\n".join(mysql_lines))

print(f"Generated PostgreSQL script: {pg_sql_path} ({len(pg_lines)} SQL statements)")
print(f"Generated MySQL script: {mysql_sql_path} ({len(mysql_lines)} SQL statements)")

import re

with open("content/book-releases/f94027611ab71565c9dfd689046bb4a24db921b97ef1453416d5acfa140ed605/release.sql", "r", encoding="utf-8") as f:
    sql = f.read()

pattern = re.compile(r"INSERT INTO content_blocks \([^)]+\) VALUES \('([^']+)', 't-mm-01-001', '([^']+)', '((?:''|[^'])*)', (\d+)\);")
matches = pattern.findall(sql)

print(f"Found {len(matches)} blocks for t-mm-01-001:")
for idx, (block_id, block_type, content, order) in enumerate(matches):
    clean_content = content.replace("''", "'")
    print(f"=== BLOCK {idx} ({block_type}, order={order}, len={len(clean_content)}) ===")
    print(clean_content[:2500])
    print("...\n")

with open("scripts/topic1_dump.html", "w", encoding="utf-8") as out:
    for _, _, _, content, _ in matches:
        out.write(content.replace("''", "'") + "\n")
print("Wrote full HTML to scripts/topic1_dump.html")

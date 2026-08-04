import json
import os

json_path = "scripts/extracted_book_data.json"

with open(json_path, "r", encoding="utf-8") as f:
    books = json.load(f)

total_books = len(books)
total_chaps = sum(len(b["chapters"]) for b in books)
total_topics = sum(len(c["topics"]) for b in books for c in b["chapters"])
total_blocks = sum(len(t["content_blocks"]) for b in books for c in b["chapters"] for t in c["topics"])

missing_imgs = 0
valid_types = {"heading", "text", "html", "note", "image", "code", "diagram"}
invalid_types = set()

for book in books:
    for chap in book["chapters"]:
        for topic in chap["topics"]:
            for block in topic["content_blocks"]:
                b_type = block["type"]
                if b_type not in valid_types:
                    invalid_types.add(b_type)
                if b_type == "image":
                    rel_url = block["content"].lstrip("/")
                    if not os.path.exists(rel_url):
                        missing_imgs += 1

print("=== EXTRACTION INTEGRITY VERIFICATION REPORT ===")
print(f"[OK] Books Count: {total_books} / 13")
print(f"[OK] Chapters Count: {total_chaps}")
print(f"[OK] Topics Count: {total_topics} / 285")
print(f"[OK] Total Content Blocks: {total_blocks}")
print(f"[OK] Invalid Content Block Types: {len(invalid_types)} (Found: {invalid_types if invalid_types else 'None'})")
print(f"[OK] Missing Image Files: {missing_imgs}")

if missing_imgs == 0 and len(invalid_types) == 0 and total_books == 13 and total_topics >= 285:
    print("SUCCESS: 100% Extraction Integrity Verified!")
else:
    print("WARNING: Integrity issues detected!")

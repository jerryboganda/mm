import zipfile
import xml.etree.ElementTree as ET
import os
import json
import re
import uuid

docx_path = r"Maternal Mind Education Content/BOOK MATERNAL MIND BY DR.FARZANA MUNEER(FINAL).docx"
output_img_dir = r"uploads/content-images/maternal_mind_book"
output_json_path = r"scripts/extracted_book_data.json"

os.makedirs(output_img_dir, exist_ok=True)

z = zipfile.ZipFile(docx_path)

# 1. Extract relationships map (rId -> image filename)
rels_xml = z.read("word/_rels/document.xml.rels")
rels_root = ET.fromstring(rels_xml)
rel_ns = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}

rid_to_file = {}
for rel in rels_root.findall('.//r:Relationship', rel_ns):
    r_id = rel.attrib.get('Id')
    target = rel.attrib.get('Target')
    if target and target.startswith('media/'):
        rid_to_file[r_id] = target

print(f"Mapped {len(rid_to_file)} media relationship IDs.")

# 2. Extract media files to output_img_dir
extracted_images = {}
for r_id, target in rid_to_file.items():
    img_bytes = z.read(f"word/{target}")
    filename = os.path.basename(target)
    out_path = os.path.join(output_img_dir, filename)
    with open(out_path, "wb") as img_f:
        img_f.write(img_bytes)
    # Server relative path used in app
    extracted_images[r_id] = f"/uploads/content-images/maternal_mind_book/{filename}"

print(f"Extracted {len(extracted_images)} media files to {output_img_dir}")

# 3. Read document.xml
doc_xml = z.read("word/document.xml")
doc_root = ET.fromstring(doc_xml)

ns = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'v': 'urn:schemas-microsoft-microsoft-com:vml'
}

# 4. Helper functions to extract text and elements
def get_p_text(p_elem):
    texts = [t.text for t in p_elem.findall('.//w:t', ns) if t.text]
    return "".join(texts).strip()

def get_p_images(p_elem):
    img_urls = []
    # Check drawing blips
    for blip in p_elem.findall('.//a:blip', ns):
        embed_id = blip.attrib.get(f"{{{ns['r']}}}embed")
        if embed_id in extracted_images:
            img_urls.append(extracted_images[embed_id])
    # Check VML imagedata
    for vml in p_elem.findall('.//v:imagedata', ns):
        r_id = vml.attrib.get(f"{{{ns['r']}}}id")
        if r_id in extracted_images:
            img_urls.append(extracted_images[r_id])
    return img_urls

def table_to_html(tbl_elem):
    rows_html = []
    for tr in tbl_elem.findall('.//w:tr', ns):
        cells_html = []
        is_header = False
        trPr = tr.find('.//w:trPr', ns)
        if trPr is not None and trPr.find('.//w:tblHeader', ns) is not None:
            is_header = True
            
        for tc in tr.findall('.//w:tc', ns):
            cell_texts = []
            for p in tc.findall('.//w:p', ns):
                txt = get_p_text(p)
                if txt:
                    cell_texts.append(txt)
            cell_content = "<br/>".join(cell_texts)
            tag = "th" if is_header else "td"
            cells_html.append(f"<{tag}>{cell_content}</{tag}>")
        rows_html.append(f"<tr>{''.join(cells_html)}</tr>")
    return f"<table><tbody>{''.join(rows_html)}</tbody></table>"

# 5. Extract TOC to know official Books and Topics list
paragraphs = doc_root.findall('.//w:p', ns)

toc_items = []
in_toc = False
for p in paragraphs:
    pStyle = p.find('.//w:pStyle', ns)
    style_val = pStyle.attrib.get(f"{{{ns['w']}}}val") if pStyle is not None else None
    if style_val and 'TOC' in style_val:
        in_toc = True
        txt = get_p_text(p)
        if txt:
            toc_items.append((style_val, txt))
    elif in_toc and not (style_val and 'TOC' in style_val):
        if len(toc_items) > 100:
            break # TOC ended

print(f"Extracted {len(toc_items)} TOC items.")

def clean_toc_title(raw):
    cleaned = re.sub(r'\d+$', '', raw).strip()
    cleaned = re.sub(r'[\:\.\s]+$', '', cleaned).strip()
    return cleaned

books_structure = []
current_book = None
current_chap = None

for style, raw_txt in toc_items:
    clean_t = clean_toc_title(raw_txt)
    if not clean_t:
        continue
    if style == 'TOC1':
        current_book = {
            "id": f"book-mm-{len(books_structure)+1:02d}",
            "title": clean_t,
            "description": f"Comprehensive OB-GYN study module covering {clean_t}.",
            "chapters": []
        }
        books_structure.append(current_book)
        current_chap = {
            "id": f"chap-mm-{len(books_structure):02d}-01",
            "title": f"{clean_t} Core Topics",
            "topics": []
        }
        current_book["chapters"].append(current_chap)
    elif style in ['TOC2', 'TOC3'] and current_book:
        topic_idx = len(current_chap["topics"]) + 1
        topic_id = f"t-mm-{len(books_structure):02d}-{topic_idx:03d}"
        topic_obj = {
            "id": topic_id,
            "title": clean_t,
            "raw_title": raw_txt,
            "description": f"Detailed medical reference and study guide on {clean_t}.",
            "author": "Dr. Farzana Muneer",
            "source": "Maternal Mind FCPS/MRCOG Textbook",
            "content_blocks": []
        }
        current_chap["topics"].append(topic_obj)

total_topics_count = sum(len(c["topics"]) for b in books_structure for c in b["chapters"])
print(f"Structured {len(books_structure)} Books containing {total_topics_count} Topics.")

# 6. Process document elements body sequentially into Topics and Content Blocks
body = doc_root.find('w:body', ns)

def find_matching_topic(heading_text):
    clean_h = clean_toc_title(heading_text).lower()
    if not clean_h or len(clean_h) < 3:
        return None
    for book in books_structure:
        for chap in book["chapters"]:
            for topic in chap["topics"]:
                t_clean = topic["title"].lower()
                if clean_h == t_clean or clean_h in t_clean or t_clean in clean_h:
                    return topic
    return None

current_active_topic = None
if books_structure and books_structure[0]["chapters"][0]["topics"]:
    current_active_topic = books_structure[0]["chapters"][0]["topics"][0]

block_order_counter = 1

for elem in body:
    tag = elem.tag.split('}')[-1]
    
    if tag == 'p':
        p_txt = get_p_text(elem)
        p_imgs = get_p_images(elem)
        
        pStyle = elem.find('.//w:pStyle', ns)
        style_val = pStyle.attrib.get(f"{{{ns['w']}}}val") if pStyle is not None else None
        
        is_heading = False
        if style_val and ('Heading' in style_val or 'Title' in style_val or style_val in ['1', '2', '3']):
            is_heading = True
        elif p_txt and (p_txt.startswith("CHAPTER") or p_txt.startswith("SECTION") or re.match(r'^\d+\.\s+[A-Z\s]{3,}', p_txt)):
            is_heading = True
            
        if is_heading and p_txt:
            matched_topic = find_matching_topic(p_txt)
            if matched_topic:
                current_active_topic = matched_topic
                block_order_counter = len(current_active_topic["content_blocks"]) + 1
            else:
                if current_active_topic:
                    current_active_topic["content_blocks"].append({
                        "id": f"cb-{uuid.uuid4().hex[:8]}",
                        "type": "heading",
                        "content": p_txt,
                        "order": len(current_active_topic["content_blocks"]) + 1
                    })
        else:
            if p_txt and current_active_topic:
                is_note = any(k in p_txt.upper() for k in ["NOTE:", "MNEMONIC:", "CLINICAL PEARL:", "WARNING:", "KEY POINT:", "IMPORTANT:"])
                block_type = "note" if is_note else "text"
                
                current_active_topic["content_blocks"].append({
                    "id": f"cb-{uuid.uuid4().hex[:8]}",
                    "type": block_type,
                    "content": p_txt,
                    "order": len(current_active_topic["content_blocks"]) + 1
                })
        
        if p_imgs and current_active_topic:
            for img_url in p_imgs:
                current_active_topic["content_blocks"].append({
                    "id": f"cb-{uuid.uuid4().hex[:8]}",
                    "type": "image",
                    "content": img_url,
                    "order": len(current_active_topic["content_blocks"]) + 1
                })
                
    elif tag == 'tbl' and current_active_topic:
        tbl_html = table_to_html(elem)
        current_active_topic["content_blocks"].append({
            "id": f"cb-{uuid.uuid4().hex[:8]}",
            "type": "html",
            "content": tbl_html,
            "order": len(current_active_topic["content_blocks"]) + 1
        })

total_blocks = sum(len(t["content_blocks"]) for b in books_structure for c in b["chapters"] for t in c["topics"])
print(f"Extraction Complete! Total Content Blocks: {total_blocks}")

with open(output_json_path, "w", encoding="utf-8") as out_f:
    json.dump(books_structure, out_f, indent=2, ensure_ascii=False)

print(f"Saved JSON payload to {output_json_path}")

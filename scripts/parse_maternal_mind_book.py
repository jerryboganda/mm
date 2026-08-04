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

def get_p_text(p_elem):
    texts = [t.text for t in p_elem.findall('.//w:t', ns) if t.text]
    return "".join(texts).strip()

def get_p_html(p_elem):
    runs_html = []
    for r in p_elem.findall('.//w:r', ns):
        txt = "".join([t.text for t in r.findall('.//w:t', ns) if t.text])
        if not txt:
            continue
        is_b = r.find('.//w:b', ns) is not None
        is_i = r.find('.//w:i', ns) is not None
        is_u = r.find('.//w:u', ns) is not None
        
        safe_txt = txt.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if is_b:
            safe_txt = f"<strong>{safe_txt}</strong>"
        if is_i:
            safe_txt = f"<em>{safe_txt}</em>"
        if is_u:
            safe_txt = f"<u>{safe_txt}</u>"
        runs_html.append(safe_txt)
        
    return "".join(runs_html).strip()

def get_p_images(p_elem):
    img_urls = []
    for blip in p_elem.findall('.//a:blip', ns):
        embed_id = blip.attrib.get(f"{{{ns['r']}}}embed")
        if embed_id in extracted_images:
            img_urls.append(extracted_images[embed_id])
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
                p_h = get_p_html(p)
                if p_h:
                    cell_texts.append(p_h)
            cell_content = "<br/>".join(cell_texts) if cell_texts else "&nbsp;"
            tag = "th" if is_header else "td"
            cells_html.append(f"<{tag}>{cell_content}</{tag}>")
        rows_html.append(f"<tr>{''.join(cells_html)}</tr>")
    return f"<table><tbody>{''.join(rows_html)}</tbody></table>"

# 4. Extract TOC items
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
            break

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
            "raw_elements": []
        }
        current_chap["topics"].append(topic_obj)

total_topics_count = sum(len(c["topics"]) for b in books_structure for c in b["chapters"])
print(f"Structured {len(books_structure)} Books containing {total_topics_count} Topics.")

# 5. Process document elements into raw topic buffers
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

for elem in body:
    tag = elem.tag.split('}')[-1]
    
    if tag == 'p':
        p_txt = get_p_text(elem)
        p_html = get_p_html(elem)
        p_imgs = get_p_images(elem)
        
        pPr = elem.find('.//w:pPr', ns)
        pStyle = pPr.find('.//w:pStyle', ns) if pPr is not None else None
        style_val = pStyle.attrib.get(f"{{{ns['w']}}}val") if pStyle is not None else None
        
        numPr = pPr.find('.//w:numPr', ns) if pPr is not None else None
        numId_val = None
        ilvl_val = 0
        if numPr is not None:
            numId = numPr.find('.//w:numId', ns)
            if numId is not None:
                numId_val = numId.attrib.get(f"{{{ns['w']}}}val")
            ilvl = numPr.find('.//w:ilvl', ns)
            if ilvl is not None:
                try:
                    ilvl_val = int(ilvl.attrib.get(f"{{{ns['w']}}}val", "0"))
                except:
                    ilvl_val = 0
        
        is_heading = False
        if style_val and ('Heading' in style_val or 'Title' in style_val or style_val in ['1', '2', '3']):
            is_heading = True
        elif p_txt and (p_txt.startswith("CHAPTER") or p_txt.startswith("SECTION") or re.match(r'^\d+\.\s+[A-Z\s]{3,}', p_txt)):
            is_heading = True
            
        if is_heading and p_txt:
            matched_topic = find_matching_topic(p_txt)
            if matched_topic:
                current_active_topic = matched_topic
            else:
                if current_active_topic:
                    current_active_topic["raw_elements"].append({
                        "kind": "heading",
                        "text": p_txt,
                        "html": p_html
                    })
        else:
            if p_txt and current_active_topic:
                is_note = any(k in p_txt.upper() for k in ["NOTE:", "MNEMONIC:", "CLINICAL PEARL:", "WARNING:", "KEY POINT:", "IMPORTANT:"])
                is_bullet = (numId_val is not None) or (style_val == 'ListParagraph') or p_txt.startswith("- ") or p_txt.startswith("> ") or p_txt.startswith("• ") or p_txt.startswith("⇒ ")
                
                kind = "note" if is_note else ("bullet" if is_bullet else "paragraph")
                current_active_topic["raw_elements"].append({
                    "kind": kind,
                    "text": p_txt,
                    "html": p_html,
                    "style": style_val,
                    "numId": numId_val,
                    "ilvl": ilvl_val
                })
                
        if p_imgs and current_active_topic:
            for img_url in p_imgs:
                current_active_topic["raw_elements"].append({
                    "kind": "image",
                    "url": img_url
                })
                
    elif tag == 'tbl' and current_active_topic:
        tbl_html = table_to_html(elem)
        current_active_topic["raw_elements"].append({
            "kind": "table",
            "html": tbl_html
        })

def render_nested_list_group(list_items):
    if not list_items:
        return ""
    primary_numId = list_items[0][0]
    
    html_out = ["<ul>"]
    in_sublist = False
    
    for idx, (numId, ilvl, text) in enumerate(list_items):
        is_sub = (numId != primary_numId) or (ilvl > 0)
        
        if not is_sub:
            if in_sublist:
                html_out.append("</ul></li>")
                in_sublist = False
                
            next_is_sub = False
            if idx + 1 < len(list_items):
                next_numId, next_ilvl, _ = list_items[idx+1]
                if (next_numId != primary_numId) or (next_ilvl > 0):
                    next_is_sub = True
                    
            if next_is_sub:
                html_out.append(f"<li>{text}<ul>")
                in_sublist = True
            else:
                html_out.append(f"<li>{text}</li>")
        else:
            if not in_sublist:
                html_out.append("<ul>")
                in_sublist = True
            html_out.append(f"<li>{text}</li>")
            
    if in_sublist:
        html_out.append("</ul></li>")
    html_out.append("</ul>")
    return "".join(html_out)

# 6. Group raw elements into cohesive Content Blocks for each Topic
for book in books_structure:
    for chap in book["chapters"]:
        for topic in chap["topics"]:
            blocks = []
            html_buffer = []
            bullet_group = []

            for item in topic.get("raw_elements", []):
                kind = item.get("kind")

                if kind in ["heading", "note", "image", "table"]:
                    if bullet_group:
                        html_buffer.append(render_nested_list_group(bullet_group))
                        bullet_group = []
                    if html_buffer:
                        blocks.append({
                            "id": f"cb-{uuid.uuid4().hex[:8]}",
                            "type": "html",
                            "content": "\n".join(html_buffer),
                            "order": len(blocks) + 1
                        })
                        html_buffer = []
                    
                    if kind == "heading":
                        blocks.append({
                            "id": f"cb-{uuid.uuid4().hex[:8]}",
                            "type": "heading",
                            "content": item["text"],
                            "order": len(blocks) + 1
                        })
                    elif kind == "note":
                        blocks.append({
                            "id": f"cb-{uuid.uuid4().hex[:8]}",
                            "type": "note",
                            "content": item["text"],
                            "order": len(blocks) + 1
                        })
                    elif kind == "image":
                        blocks.append({
                            "id": f"cb-{uuid.uuid4().hex[:8]}",
                            "type": "image",
                            "content": item["url"],
                            "order": len(blocks) + 1
                        })
                    elif kind == "table":
                        blocks.append({
                            "id": f"cb-{uuid.uuid4().hex[:8]}",
                            "type": "html",
                            "content": item["html"],
                            "order": len(blocks) + 1
                        })

                elif kind == "bullet":
                    h = item["html"]
                    clean_h = h
                    for prefix in ["- ", "&gt; ", "• ", "* ", "⇒ "]:
                        if clean_h.startswith(prefix):
                            clean_h = clean_h[len(prefix):]
                            break
                    bullet_group.append((item.get("numId"), item.get("ilvl", 0), clean_h))

                elif kind == "paragraph":
                    if bullet_group:
                        html_buffer.append(render_nested_list_group(bullet_group))
                        bullet_group = []
                        
                    h = item["html"]
                    plain_txt = item["text"]
                    if (h.startswith("<strong>") and h.endswith("</strong>")) or plain_txt.endswith(":") or h.startswith("<u>"):
                        html_buffer.append(f"<h3>{h}</h3>")
                    else:
                        html_buffer.append(f"<p>{h}</p>")

            if bullet_group:
                html_buffer.append(render_nested_list_group(bullet_group))
                bullet_group = []
            if html_buffer:
                blocks.append({
                    "id": f"cb-{uuid.uuid4().hex[:8]}",
                    "type": "html",
                    "content": "\n".join(html_buffer),
                    "order": len(blocks) + 1
                })
                html_buffer = []

            topic["content_blocks"] = blocks
            if "raw_elements" in topic:
                del topic["raw_elements"]

total_blocks = sum(len(t["content_blocks"]) for b in books_structure for c in b["chapters"] for t in c["topics"])
print(f"Multi-Level Nested Extraction Complete! Total Content Blocks: {total_blocks} across {total_topics_count} Topics.")

with open(output_json_path, "w", encoding="utf-8") as out_f:
    json.dump(books_structure, out_f, indent=2, ensure_ascii=False)

print(f"Saved refined JSON payload to {output_json_path}")

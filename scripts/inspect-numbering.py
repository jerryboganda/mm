import zipfile
import xml.etree.ElementTree as ET

z = zipfile.ZipFile("BOOK MATERNAL MIND BY DR.FARZANA MUNEER(FINAL).docx")
xml = z.read("word/numbering.xml")
root = ET.fromstring(xml)

print("=== NUMBERING.XML DEFINITIONS ===")
for num in root.findall("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}num"):
    num_id = num.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}numId")
    abstract_num_id = num.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}abstractNumId").attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val")
    print(f"numId: {num_id} -> abstractNumId: {abstract_num_id}")

for abstract_num in root.findall("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}abstractNum"):
    abstract_id = abstract_num.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}abstractNumId")
    print(f"\n--- abstractNumId: {abstract_id} ---")
    for lvl in abstract_num.findall("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}lvl"):
        ilvl = lvl.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ilvl")
        num_fmt = lvl.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}numFmt")
        num_fmt_val = num_fmt.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val") if num_fmt is not None else "none"
        lvl_text = lvl.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}lvlText")
        lvl_text_val = lvl_text.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val") if lvl_text is not None else ""
        rpr = lvl.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPr")
        rfonts = rpr.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rFonts") if rpr is not None else None
        font_hansi = rfonts.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}hAnsi") if rfonts is not None else ""
        print(f"  Level {ilvl}: fmt={num_fmt_val}, text='{lvl_text_val}', font='{font_hansi}', raw={ET.tostring(lvl, encoding='utf-8').decode('utf-8')[:180]}")

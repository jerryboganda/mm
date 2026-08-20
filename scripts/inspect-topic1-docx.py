import zipfile
import xml.etree.ElementTree as ET

z = zipfile.ZipFile("BOOK MATERNAL MIND BY DR.FARZANA MUNEER(FINAL).docx")
xml = z.read("word/document.xml")
root = ET.fromstring(xml)
body = root.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}body")

# Let's inspect the children of body around paragraph 752
children = list(body)
print(f"Total top-level body elements: {len(children)}")

# Find index of element containing paraId="218C0DAA"
target_idx = None
for i, el in enumerate(children):
    if "218C0DAA" in ET.tostring(el, encoding="utf-8").decode("utf-8"):
        target_idx = i
        break

print(f"Target body child index: {target_idx}")

for i in range(target_idx, min(target_idx + 35, len(children))):
    el = children[i]
    tag = el.tag.split("}")[-1]
    text = "".join(el.itertext()).strip()
    print(f"--- Child {i}: <{tag}> (text len: {len(text)}) ---")
    print(f"Text preview: {text[:120]}")
    xml_str = ET.tostring(el, encoding="utf-8").decode("utf-8")
    print(f"XML (first 400 chars): {xml_str[:400]}\n")

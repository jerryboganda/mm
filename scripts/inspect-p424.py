import zipfile
import xml.etree.ElementTree as ET

z = zipfile.ZipFile("BOOK MATERNAL MIND BY DR.FARZANA MUNEER(FINAL).docx")
xml = z.read("word/document.xml")
root = ET.fromstring(xml)
ps = root.findall(".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p")

for idx, p in enumerate(ps[424:445]):
    print(f"=== Paragraph {424+idx} ===")
    print(ET.tostring(p, encoding="utf-8").decode("utf-8"))
    print("\n" + "="*50 + "\n")

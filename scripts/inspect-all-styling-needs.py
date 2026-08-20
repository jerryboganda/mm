import sys
from pathlib import Path
sys.path.insert(0, ".")

from scripts.book_import.package import OOXMLPackage
from scripts.book_import.numbering import NumberingResolver
from scripts.book_import.styles import StyleResolver

pkg = OOXMLPackage.from_file(Path("BOOK MATERNAL MIND BY DR.FARZANA MUNEER(FINAL).docx"))
num_resolver = NumberingResolver(pkg)
style_resolver = StyleResolver(pkg)

body = pkg.document.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}body")
paragraphs = body.findall(".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p")

shd_count = 0
list_count = 0
unique_markers = set()
unique_shd = set()

for p in paragraphs:
    shd = p.find(".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}shd")
    if shd is not None:
        fill = shd.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill")
        if fill and fill.lower() not in ("auto", "none", "ffffff"):
            shd_count += 1
            unique_shd.add(fill.upper())
            
    num_lvl = num_resolver.resolve_paragraph(p)
    if num_lvl:
        list_count += 1
        if num_lvl.display_level_text:
            unique_markers.add(num_lvl.display_level_text)

print(f"Total paragraphs: {len(paragraphs)}")
print(f"Paragraphs with background shading: {shd_count}, Unique fills: {unique_shd}")
print(f"Paragraphs with list numbering/bullets: {list_count}")
print(f"Unique list markers found: {[m for m in unique_markers]}")

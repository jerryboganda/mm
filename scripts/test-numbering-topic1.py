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
children = list(body)

# Let's find paragraph 752 (Topic 1)
target_idx = None
for i, el in enumerate(children):
    if "218C0DAA" in str(el.attrib) or any("218C0DAA" in str(c.attrib) for c in el.iter()):
        target_idx = i
        break

print(f"Target body index: {target_idx}")

for i in range(target_idx, min(target_idx + 40, len(children))):
    el = children[i]
    tag = el.tag.split("}")[-1]
    if tag == "p":
        num_lvl = num_resolver.resolve_paragraph(el)
        p_style = style_resolver.resolve_paragraph(el)
        text = "".join(el.itertext()).strip()
        shd = el.find(".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}shd")
        shd_fill = shd.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill") if shd is not None else None
        print(f"P {i}: style='{p_style.style_id}', shd='{shd_fill}'")
        if num_lvl:
            print(f"     [LIST] numId={num_lvl.num_id}, level={num_lvl.level}, fmt={num_lvl.number_format}, marker='{num_lvl.display_level_text}', indent={num_lvl.left_indent_twips}")
        print(f"     text: {text[:80]}\n")
    elif tag == "tbl":
        print(f"TBL {i}: (table)\n")

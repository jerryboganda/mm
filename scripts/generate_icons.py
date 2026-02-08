"""
Generate all app icon variants from the new Maternal Mind logo.
Source: 2000x2000 RGB with deep navy blue background (~#0c1e2e)
"""
from PIL import Image
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'new maternalmind logo.png')
OUT = os.path.join(BASE, 'assets', 'images')

def save(img, name):
    path = os.path.join(OUT, name)
    img.save(path, 'PNG', quality=100)
    print(f"  OK  {name:40s} {img.size[0]}x{img.size[1]}")

def main():
    src = Image.open(SRC).convert('RGBA')
    print(f"Source: {src.size[0]}x{src.size[1]}\n")

    # 1. icon.png (1024x1024) - Main app icon
    save(src.resize((1024, 1024), Image.LANCZOS), 'icon.png')

    # 2. favicon.png (48x48)
    save(src.resize((48, 48), Image.LANCZOS), 'favicon.png')

    # 3. splash-icon.png (400x400)
    save(src.resize((400, 400), Image.LANCZOS), 'splash-icon.png')

    # 4. Android adaptive icon foreground (1024x1024)
    # Place logo in 70% safe zone, rest transparent
    fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    safe = int(1024 * 0.70)
    logo = src.resize((safe, safe), Image.LANCZOS)
    offset = (1024 - safe) // 2
    fg.paste(logo, (offset, offset), logo)
    save(fg, 'android-icon-foreground.png')

    # 5. Android adaptive icon background (1024x1024) - deep navy
    save(Image.new('RGBA', (1024, 1024), '#0c1e2e'), 'android-icon-background.png')

    # 6. Android monochrome (reuse foreground)
    save(fg, 'android-icon-monochrome.png')

    print("\nAll icons generated!")

if __name__ == '__main__':
    main()

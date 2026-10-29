#!/usr/bin/env python
"""Legt den Musterzettel einer Kalibrierung zweimal auf ein A4-Querblatt (je eine A5-Haelfte,
gestrichelte Schnittlinie in der Mitte) - zum Ausdrucken, Ankreuzen und Fotografieren.

    python scripts/erzeugeDruckvorlage.py Wahlen/<wahl>/kalibrierung.json

Ergebnis: Wahlen/<wahl>/druckvorlage-2xA5.pdf
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

DPI = 300
A4 = (3508, 2480)                       # quer, 297 x 210 mm
RAND = 70                               # Abstand zum Blattrand und zur Schnittlinie, rund 6 mm

root = Path(__file__).resolve().parent.parent
path = Path(sys.argv[1]).resolve()
kalibrierung = json.load(open(path, encoding='utf-8'))
zettel = Image.open(root / kalibrierung['quelle']).convert('RGBA')
weiss = Image.new('RGBA', zettel.size, 'white')
zettel = Image.alpha_composite(weiss, zettel).convert('RGB')

blatt = Image.new('RGB', A4, 'white')
draw = ImageDraw.Draw(blatt)
haelfte = A4[0] // 2
scale = min((haelfte - 2 * RAND) / zettel.width, (A4[1] - 2 * RAND) / zettel.height)
size = (round(zettel.width * scale), round(zettel.height * scale))
bild = zettel.resize(size, Image.LANCZOS)
for links in (0, haelfte):
    x, y = links + (haelfte - size[0]) // 2, (A4[1] - size[1]) // 2
    blatt.paste(bild, (x, y))
    # Duenner Rahmen als Papierkante: auf dem Foto hebt sich der Zettel so vom Tisch ab.
    draw.rectangle((x - 1, y - 1, x + size[0], y + size[1]), outline=(60, 60, 60), width=3)
for y in range(0, A4[1], 40): draw.line((haelfte, y, haelfte, y + 20), fill=(170, 170, 170), width=2)

ziel = path.parent / 'druckvorlage-2xA5.pdf'
blatt.save(ziel, resolution=DPI, quality=90)
print(f'{kalibrierung["name"]}: {size[0]}x{size[1]} px je Zettel -> {ziel.relative_to(root)}')

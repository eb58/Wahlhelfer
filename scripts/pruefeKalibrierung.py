#!/usr/bin/env python
"""Zeichnet eine Kalibrierungsdatei in ihren Musterzettel, damit die von Hand
abgelesenen Feldlagen mit blossem Auge geprueft werden koennen.

    python scripts/pruefeKalibrierung.py Kalibrierungen/<datei>.json [ausgabe.png]

Kein Erkennungsverfahren - reine Sichtkontrolle der eingetragenen Koordinaten.
"""
import json
import sys
from PIL import Image, ImageDraw

FARBEN = [(220, 20, 20), (20, 90, 220), (230, 140, 0), (140, 40, 200)]

pfad = sys.argv[1]
kal = json.load(open(pfad, encoding='utf-8'))
im = Image.open(kal['quelle']).convert('RGB')

if (im.width, im.height) != (kal['referenz']['breite'], kal['referenz']['hoehe']):
    sys.exit(f"Groesse passt nicht: Bild {im.size}, Kalibrierung {kal['referenz']}")

d = ImageDraw.Draw(im)
r = kal['radius']
for i, stimme in enumerate(kal['stimmen']):
    farbe = FARBEN[i % len(FARBEN)]
    for feld in stimme['felder']:
        x, y = feld['x'], feld['y']
        d.ellipse([x - r, y - r, x + r, y + r], outline=farbe, width=3)
        d.line([(x - 6, y), (x + 6, y)], fill=farbe, width=1)
        d.line([(x, y - 6), (x, y + 6)], fill=farbe, width=1)
        d.text((x + r + 6, y - 7), feld['id'], fill=farbe)

ziel = sys.argv[2] if len(sys.argv) > 2 else 'pruefung-tmp.png'
im.save(ziel)
felder = sum(len(s['felder']) for s in kal['stimmen'])
print(f"{kal['name']}: {len(kal['stimmen'])} Stimmen, {felder} Felder -> {ziel}")

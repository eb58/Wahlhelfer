#!/usr/bin/env python
"""Zeichnet eine Kalibrierungsdatei in ihren Musterzettel, damit die von Hand
abgelesenen Feldlagen mit blossem Auge geprueft werden koennen.

    python scripts/pruefeKalibrierung.py Kalibrierungen/<datei>.json [ausgabe.png]

Kein Erkennungsverfahren - reine Sichtkontrolle der eingetragenen Koordinaten.
"""
import json
import sys
from PIL import Image, ImageDraw

COLORS = [(220, 20, 20), (20, 90, 220), (230, 140, 0), (140, 40, 200)]

path = sys.argv[1]
calibration = json.load(open(path, encoding='utf-8'))
image = Image.open(calibration['quelle']).convert('RGB')

if (image.width, image.height) != (calibration['referenz']['breite'], calibration['referenz']['hoehe']):
    sys.exit(f"Groesse passt nicht: Bild {image.size}, Kalibrierung {calibration['referenz']}")

draw = ImageDraw.Draw(image)
radius = calibration['radius']
for i, stimme in enumerate(calibration['stimmen']):
    color = COLORS[i % len(COLORS)]
    for field in stimme['felder']:
        x, y = field['x'], field['y']
        draw.ellipse([x - radius, y - radius, x + radius, y + radius], outline=color, width=3)
        draw.line([(x - 6, y), (x + 6, y)], fill=color, width=1)
        draw.line([(x, y - 6), (x, y + 6)], fill=color, width=1)
        draw.text((x + radius + 6, y - 7), field['id'], fill=color)

for mark in calibration['textmarken']:
    x, y = mark['x'], mark['y']
    draw.line([(x - 10, y), (x + 10, y)], fill=(0, 150, 70), width=2)
    draw.line([(x, y - 10), (x, y + 10)], fill=(0, 150, 70), width=2)
    draw.text((x + 13, y - 7), mark['text'], fill=(0, 150, 70))

huelle = calibration.get('huelle')
if huelle:
    draw.rectangle([huelle['left'], huelle['top'], huelle['right'], huelle['bottom']], outline=(230, 0, 160), width=2)
    draw.text((huelle['left'] + 6, huelle['top'] - 16), 'huelle', fill=(230, 0, 160))

output = sys.argv[2] if len(sys.argv) > 2 else 'pruefung-tmp.png'
image.save(output)
field_count = sum(len(s['felder']) for s in calibration['stimmen'])
print(f"{calibration['name']}: {len(calibration['stimmen'])} Stimmen, {field_count} Felder, {len(calibration['textmarken'])} Textmarken -> {output}")

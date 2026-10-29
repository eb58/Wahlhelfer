#!/usr/bin/env python
"""Erzeugt den BVV-Stimmzettel Reinickendorf 2026 mit fiktiven Bewerbern: Musterzettel-PNG und
Kalibrierung aus denselben Koordinaten, damit beide immer zusammenpassen. Aufbau, Listennummern und
Parteinamen wie auf dem amtlichen Musterstimmzettel (berlin.de), aber schwarz-weiss.

    python scripts/erzeugeBvvMusterzettel.py

Parteien und Bewerber in PARTEIEN aendern, Skript ausfuehren, dann mit pruefeKalibrierung.py
kontrollieren und die synthetischen Fotos neu erzeugen (node scripts/erzeugeSynthetischeFotos.js).
Die Kalibrierung wird hier ausnahmsweise nicht abgelesen, weil der Zettel selbst erzeugt ist.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
# Arial (Windows) bzw. das metrisch gleiche Liberation Sans (Linux); abweichende Schrift verschiebt nur Text, keine Felder.
FONTS = {False: ['arial.ttf', 'LiberationSans-Regular.ttf'], True: ['arialbd.ttf', 'LiberationSans-Bold.ttf']}


def font(size, bold=False):
    for name in FONTS[bold]:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    raise SystemExit(f'Keine Schrift gefunden: {FONTS[bold]}')


# Listennummern, Kurz- und Langnamen wie auf dem amtlichen Musterstimmzettel vom 20.09.2026; Bewerber fiktiv.
PARTEIEN = [
    (1, 'CDU', 'Christlich Demokratische Union Deutschlands', [('Wendland', 'Katharina'), ('Brockmann', 'Thomas'), ('Ohlsen', 'Sabine')]),
    (2, 'SPD', 'Sozialdemokratische Partei Deutschlands', [('Hartwig', 'Jens'), ('Korkmaz', 'Aylin'), ('Lindemann', 'Peter')]),
    (3, 'GRÜNE', 'BÜNDNIS 90/DIE GRÜNEN', [('Marquardt', 'Lena'), ('Okafor', 'Daniel'), ('Kranich', 'Ute')]),
    (4, 'Die Linke', 'Die Linke', [('Kowalski', 'Nadine'), ('Burmeister', 'Ralf'), ('Arslan', 'Selin')]),
    (5, 'AfD', 'Alternative für Deutschland', [('Reimers', 'Frank'), ('Lammert', 'Doris'), ('Schaller', 'Uwe')]),
    (6, 'FDP', 'Freie Demokratische Partei', [('Albers', 'Christian'), ('Matthes', 'Julia'), ('Engel', 'Robert')]),
    (7, 'Tierschutzpartei', 'PARTEI MENSCH KLIMA TIERSCHUTZ', [('Rehberg', 'Simone'), ('Ostermann', 'Michael'), ('Winkler', 'Carola')]),
    (9, 'Volt', 'Volt Deutschland', [('Delacroix', 'Marie'), ('Hoffmeister', 'Lukas'), ('Popescu', 'Elena')]),
    (11, 'MIETERPARTEI', 'Mieterpartei', [('Wollschläger', 'Gerd'), ('Krämer', 'Bärbel'), ('Pohl', 'Renate')]),
    (24, 'BSW', 'Bündnis Sahra Wagenknecht - Vernunft und Gerechtigkeit', [('Grünberg', 'Olaf'), ('Neubert', 'Tanja'), ('Heinze', 'Wolfgang')]),
]

W, LEFT, RIGHT, TOP, ROW = 1241, 31, 1210, 330, 140
NUMMER, KREIS = 110, 1110         # rechte Kanten von Nummernspalte und Inhalt; rechts davon die Ankreuzspalte
RADIUS, CX = 31, 1160
H = TOP + ROW * len(PARTEIEN) + 110
BOTTOM = TOP + ROW * len(PARTEIEN)

image = Image.new('RGB', (W, H), 'white')
draw = ImageDraw.Draw(image)


def text(xy, value, size, bold=False, anchor='la'):
    draw.text(xy, value, font=font(size, bold), fill='black', anchor=anchor)


text((W / 2, 70), 'Stimmzettel', 44, True, 'mm')
text((W / 2, 120), 'für die Wahl zur Bezirksverordnetenversammlung', 28, True, 'mm')
text((W / 2, 158), 'am 20. September 2026', 28, True, 'mm')
text((W / 2, 196), 'im Bezirk Reinickendorf (12)', 26, False, 'mm')
text((W / 2, 236), 'Muster mit fiktiven Bewerberinnen und Bewerbern', 18, False, 'mm')
# Kennziffer des Bezirks an beiden Raendern, wie auf dem amtlichen Zettel
for x in (40, W - 40): text((x, 70), '12', 24, True, 'mm')
# Hinweis ueber der Ankreuzspalte: Kreuz im Kreis, darunter ein Pfeil, links daneben der Text
draw.ellipse((CX - 20, 196, CX + 20, 236), outline='black', width=4)
draw.line((CX - 11, 205, CX + 11, 227), fill='black', width=6)
draw.line((CX - 11, 227, CX + 11, 205), fill='black', width=6)
draw.line((CX, 238, CX, 262), fill='black', width=5)
draw.polygon([(CX - 10, 260), (CX + 10, 260), (CX, 274)], fill='black')
for y, zeile in [(202, 'bitte einmal'), (224, 'so ankreuzen'), (258, 'und nach innen'), (280, 'zusammenfalten')]:
    text((CX - 34, y), zeile, 18, False, 'rm')

felder = []
for index, (nummer, kurz, lang, bewerber) in enumerate(PARTEIEN):
    top = TOP + index * ROW
    draw.line((LEFT, top, RIGHT, top), fill='black', width=2)
    text(((LEFT + NUMMER) / 2, top + ROW / 2), str(nummer), 36, True, 'mm')
    text((NUMMER + 14, top + 14), lang, 21, True)
    for platz, (nachname, vorname) in enumerate(bewerber):
        x, y = NUMMER + 14, top + 52 + platz * 26
        text((x, y), f'{nachname},', 18, True)
        text((x + draw.textlength(f'{nachname}, ', font=font(18, True)), y), vorname, 18)
    text((KREIS - 14, top + ROW / 2), kurz, 30, True, 'rm')
    cy = top + ROW // 2
    draw.ellipse((CX - RADIUS, cy - RADIUS, CX + RADIUS, cy + RADIUS), outline='black', width=3)
    felder.append({'id': f'L{nummer}', 'nummer': nummer, 'x': CX, 'y': cy, 'beschriftung': kurz, 'name': lang,
                   'bewerber': [f'{nachname}, {vorname}' for nachname, vorname in bewerber]})
# Anders als das Original mit umlaufendem Rahmen: an ihm richtet sich die Scan-Erkennung aus.
for x in (NUMMER, KREIS): draw.line((x, TOP, x, BOTTOM), fill='black', width=2)
draw.rectangle((LEFT - 1, TOP - 1, RIGHT + 1, BOTTOM + 1), outline='black', width=3)

image.save(root / 'Wahlen/bvv-reinickendorf-2026/musterzettel.png', dpi=(150, 150))

kalibrierung = {
    'version': 4,
    'name': 'BVV-Wahl Reinickendorf 2026 (fiktive Bewerber)',
    'quelle': 'Wahlen/bvv-reinickendorf-2026/musterzettel.png',
    'vermessenAm': '2026-10-29',
    'referenz': {'breite': W, 'hoehe': H},
    'frame': {'left': LEFT, 'right': RIGHT, 'top': TOP, 'bottom': BOTTOM},
    'radius': RADIUS,
    'thresholds': {'angekreuzt': 0.10, 'zweifel': 0.03},
    'stimmen': [{'id': 'stimme', 'name': 'Stimme', 'auswahl': 1, 'felder': felder}],
}
one = lambda value: ('{ ' + ', '.join(f'"{key}": {one(item)}' for key, item in value.items()) + ' }'
                     if isinstance(value, dict) else json.dumps(value, ensure_ascii=False))
lines = ['{']
for key in ['version', 'name', 'quelle', 'vermessenAm', 'referenz', 'frame', 'radius', 'thresholds']:
    lines.append(f'  "{key}": {one(kalibrierung[key])},')
stimme = kalibrierung['stimmen'][0]
lines += ['  "stimmen": [', '    {', f'      "id": "{stimme["id"]}",', f'      "name": "{stimme["name"]}",', f'      "auswahl": {stimme["auswahl"]},', '      "felder": [']
lines += [f'        {one(feld)}{"," if i < len(stimme["felder"]) - 1 else ""}' for i, feld in enumerate(stimme['felder'])]
lines += ['      ]', '    }', '  ]', '}']
NL = chr(10)
open(root / 'Wahlen/bvv-reinickendorf-2026/kalibrierung.json', 'w', encoding='utf-8', newline=NL).write(NL.join(lines) + NL)

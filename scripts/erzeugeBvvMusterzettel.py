#!/usr/bin/env python
"""Erzeugt den fiktiven BVV-Stimmzettel Reinickendorf 2026: Musterzettel-PNG und Kalibrierung
aus denselben Koordinaten, damit beide immer zusammenpassen.

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

# Reihenfolge und Kurznamen wie auf dem amtlichen Ergebnis der BVV-Wahl Reinickendorf vom 20.09.2026; Bewerber fiktiv.
PARTEIEN = [
    ('CDU', 'Christlich Demokratische Union Deutschlands', [
        ('Dr. Katharina', 'Wendland', 'Rechtsanwältin', 'Frohnau'), ('Thomas', 'Brockmann', 'Handwerksmeister', 'Hermsdorf'),
        ('Sabine', 'Ohlsen', 'Lehrerin', 'Heiligensee'), ('Markus', 'Pietsch', 'Polizeibeamter', 'Tegel'),
        ('Henrike', 'Vogt', 'Kauffrau', 'Waidmannslust')]),
    ('SPD', 'Sozialdemokratische Partei Deutschlands', [
        ('Jens', 'Hartwig', 'Sozialarbeiter', 'Märkisches Viertel'), ('Aylin', 'Korkmaz', 'Krankenpflegerin', 'Reinickendorf'),
        ('Peter', 'Lindemann', 'Gewerkschaftssekretär', 'Wittenau'), ('Monika', 'Strauß', 'Verwaltungsangestellte', 'Tegel'),
        ('Felix', 'Rösler', 'Student', 'Borsigwalde')]),
    ('GRÜNE', 'BÜNDNIS 90/DIE GRÜNEN', [
        ('Lena', 'Marquardt', 'Stadtplanerin', 'Hermsdorf'), ('Daniel', 'Okafor', 'Ingenieur', 'Reinickendorf'),
        ('Ute', 'Kranich', 'Biologin', 'Lübars'), ('Jonas', 'Fiedler', 'Softwareentwickler', 'Tegel'),
        ('Miriam', 'Sauer', 'Erzieherin', 'Frohnau')]),
    ('Die Linke', 'Die Linke', [
        ('Nadine', 'Kowalski', 'Mieterberaterin', 'Märkisches Viertel'), ('Ralf', 'Burmeister', 'Busfahrer', 'Wittenau'),
        ('Selin', 'Arslan', 'Studentin', 'Reinickendorf'), ('Klaus', 'Dittmann', 'Rentner', 'Tegel'),
        ('Paula', 'Brandt', 'Altenpflegerin', 'Waidmannslust')]),
    ('AfD', 'Alternative für Deutschland', [
        ('Frank', 'Reimers', 'Kaufmann', 'Heiligensee'), ('Doris', 'Lammert', 'Bürokauffrau', 'Tegel'),
        ('Uwe', 'Schaller', 'Elektriker', 'Wittenau'), ('Bernd', 'Kühne', 'Taxiunternehmer', 'Konradshöhe'),
        ('Ilona', 'Fechner', 'Steuerfachangestellte', 'Borsigwalde')]),
    ('FDP', 'Freie Demokratische Partei', [
        ('Christian', 'Albers', 'Unternehmer', 'Frohnau'), ('Julia', 'Matthes', 'Apothekerin', 'Hermsdorf'),
        ('Robert', 'Engel', 'Steuerberater', 'Tegelort'), ('Anke', 'Seidel', 'Architektin', 'Lübars'),
        ('Tim', 'Gerlach', 'Student', 'Tegel')]),
    ('Tierschutzpartei', 'PARTEI MENSCH UMWELT TIERSCHUTZ', [
        ('Simone', 'Rehberg', 'Tierärztin', 'Konradshöhe'), ('Michael', 'Ostermann', 'Landschaftsgärtner', 'Lübars'),
        ('Carola', 'Winkler', 'Hundetrainerin', 'Heiligensee'), ('Sven', 'Lorenz', 'Koch', 'Wittenau'),
        ('Heike', 'Baumgart', 'Rentnerin', 'Tegel')]),
    ('Volt', 'Volt Deutschland', [
        ('Marie', 'Delacroix', 'Projektmanagerin', 'Reinickendorf'), ('Lukas', 'Hoffmeister', 'Doktorand', 'Tegel'),
        ('Elena', 'Popescu', 'Übersetzerin', 'Hermsdorf'), ('Niklas', 'Brandes', 'Informatiker', 'Wittenau'),
        ('Sophie', 'Lang', 'Studentin', 'Frohnau')]),
    ('MIETERPARTEI', '', [
        ('Gerd', 'Wollschläger', 'Hausmeister', 'Märkisches Viertel'), ('Bärbel', 'Krämer', 'Rentnerin', 'Reinickendorf'),
        ('Ahmet', 'Yıldız', 'Einzelhändler', 'Wittenau'), ('Renate', 'Pohl', 'Verkäuferin', 'Tegel'),
        ('Dennis', 'Hahn', 'Lagerist', 'Borsigwalde')]),
    ('BSW', '', [
        ('Olaf', 'Grünberg', 'Maschinenbauer', 'Wittenau'), ('Tanja', 'Neubert', 'Sachbearbeiterin', 'Märkisches Viertel'),
        ('Wolfgang', 'Heinze', 'Rentner', 'Tegel'), ('Katrin', 'Ebert', 'Friseurmeisterin', 'Waidmannslust'),
        ('Mario', 'Schütt', 'Kraftfahrer', 'Reinickendorf')]),
]

WAHLKREISE = [
    ('1201', 'Reinickendorf 1', 'Reinickendorf/Ost, Reinickendorf/West (teilweise)', '12101–12129', '121A–121R'),
    ('1202', 'Reinickendorf 2', 'Reinickendorf/West, Tegel-Süd (teilweise), Wittenau (teilweise), Mäckeritzwiesen', '12201–12229', '122A–122U'),
    ('1203', 'Reinickendorf 3', 'Heiligensee, Konradshöhe, Tegelort, Tegel (teilweise), Tegel-Süd (teilweise), Saatwinkel', '12301–12330', '123A–123ZC'),
    ('1204', 'Reinickendorf 4', 'Wittenau, Waidmannslust (teilweise), Borsigwalde, Tegel (teilweise)', '12401–12430', '124A–124ZC'),
    ('1205', 'Reinickendorf 5', 'Lübars, Märkisches Viertel', '12501–12528', '125A–125Q'),
    ('1206', 'Reinickendorf 6', 'Frohnau, Hermsdorf, Waidmannslust (teilweise), Freie Scholle', '12601–12631', '126A–126ZF'),
]

W, LEFT, RIGHT, TOP, ROW = 1241, 31, 1210, 300, 140
NUMMER, KREIS = 85, 1140          # rechte Kanten von Nummernspalte und Inhalt
RADIUS, CX = 31, 1175
H = TOP + ROW * len(PARTEIEN) + 110
BOTTOM = TOP + ROW * len(PARTEIEN)

image = Image.new('RGB', (W, H), 'white')
draw = ImageDraw.Draw(image)
center = lambda y, text, f: draw.text((W / 2, y), text, font=f, fill='black', anchor='mm')
center(110, 'Stimmzettel', font(46, True))
center(165, 'für die Wahl zur Bezirksverordnetenversammlung Reinickendorf', font(26, True))
center(200, 'am 20. September 2026 – Muster mit fiktiven Bewerberinnen und Bewerbern', font(22))
draw.text((W / 2 - 24, 250), 'Sie haben', font=font(30, True), fill='black', anchor='rm')
draw.text((W / 2, 250), '1', font=font(44, True), fill='black', anchor='mm')
draw.text((W / 2 + 24, 250), 'Stimme', font=font(30, True), fill='black', anchor='lm')
# Hinweis ueber der Ankreuzspalte: kleines Kreuz im Kreis, Pfeil, Text
draw.ellipse((CX - 18, 196, CX + 18, 232), outline='black', width=3)
draw.line((CX - 11, 203, CX + 11, 225), fill='black', width=4)
draw.line((CX - 11, 225, CX + 11, 203), fill='black', width=4)
draw.polygon([(CX - 8, 238), (CX + 8, 238), (CX, 250)], fill='black')
draw.text((CX, 262), 'Bitte hier', font=font(13), fill='black', anchor='mm')
draw.text((CX, 278), 'ankreuzen', font=font(13), fill='black', anchor='mm')

felder = []
for index, (kurz, lang, bewerber) in enumerate(PARTEIEN):
    top = TOP + index * ROW
    if index: draw.line((LEFT, top, RIGHT, top), fill='black', width=2)
    draw.text(((LEFT + NUMMER) / 2, top + ROW / 2), str(index + 1), font=font(36, True), fill='black', anchor='mm')
    draw.text((NUMMER + 10, top + 8), kurz, font=font(27, True), fill='black')
    if lang: draw.text((NUMMER + 18 + draw.textlength(kurz, font=font(27, True)), top + 15), lang, font=font(17, True), fill='black')
    draw.text((KREIS - 10, top + 15), '- Bezirksliste -', font=font(17, True), fill='black', anchor='ra')
    for platz, (vorname, nachname, beruf, ortsteil) in enumerate(bewerber):
        x, y = NUMMER + 10, top + 45 + platz * 18.5
        for text, bold in [(f'{platz + 1}.  {vorname} ', False), (nachname, True), (f', {beruf}, {ortsteil}', False)]:
            draw.text((x, y), text, font=font(16, bold), fill='black')
            x += draw.textlength(text, font=font(16, bold))
    cy = top + ROW // 2
    draw.ellipse((CX - RADIUS, cy - RADIUS, CX + RADIUS, cy + RADIUS), outline='black', width=3)
    felder.append({'id': f'L{index + 1}', 'nummer': index + 1, 'x': CX, 'y': cy, 'beschriftung': kurz,
                   **({'name': lang} if lang else {}),
                   'bewerber': [f'{vorname} {nachname}, {beruf}, {ortsteil}' for vorname, nachname, beruf, ortsteil in bewerber]})
for x in (NUMMER, KREIS): draw.line((x, TOP, x, BOTTOM), fill='black', width=2)
draw.rectangle((LEFT - 1, TOP - 1, RIGHT + 1, BOTTOM + 1), outline='black', width=3)

image.save(root / 'Kalibrierungen/bvv-reinickendorf-2026.png', dpi=(150, 150))

kalibrierung = {
    'version': 4,
    'name': 'BVV-Wahl Reinickendorf 2026 (fiktiv)',
    'quelle': 'Kalibrierungen/bvv-reinickendorf-2026.png',
    'vermessenAm': '2026-10-29',
    'referenz': {'breite': W, 'hoehe': H},
    'frame': {'left': LEFT, 'right': RIGHT, 'top': TOP, 'bottom': BOTTOM},
    'radius': RADIUS,
    'thresholds': {'angekreuzt': 0.10, 'zweifel': 0.03},
    'gebiet': {
        'bezirk': '12 Reinickendorf',
        'hinweis': 'Der BVV-Stimmzettel gilt im ganzen Bezirk; die Wahlkreise gliedern nur die Wahlbezirke. '
                   'Urnenwahlbezirke: Wahlkreisziffern + zweistellige Nummer, Briefwahlbezirke: Wahlkreisziffern + Buchstaben (ohne I und O).',
        'quelle': 'Landeswahlleiter Berlin, Wahlen am 20. September 2026',
        'wahlkreise': [{'nummer': nummer, 'name': name, 'beschreibung': beschreibung, 'urnenwahlbezirke': urne, 'briefwahlbezirke': brief}
                       for nummer, name, beschreibung, urne, brief in WAHLKREISE],
    },
    'stimmen': [{'id': 'stimme', 'name': 'Stimme', 'auswahl': 1, 'felder': felder}],
}
one = lambda value: ('{ ' + ', '.join(f'"{key}": {one(item)}' for key, item in value.items()) + ' }'
                     if isinstance(value, dict) else json.dumps(value, ensure_ascii=False))
lines = ['{']
for key in ['version', 'name', 'quelle', 'vermessenAm', 'referenz', 'frame', 'radius', 'thresholds']:
    lines.append(f'  "{key}": {one(kalibrierung[key])},')
gebiet = kalibrierung['gebiet']
lines += ['  "gebiet": {'] + [f'    "{key}": {one(gebiet[key])},' for key in ['bezirk', 'hinweis', 'quelle']]
lines += ['    "wahlkreise": ['] + [f'      {one(row)}{"," if i < len(gebiet["wahlkreise"]) - 1 else ""}' for i, row in enumerate(gebiet['wahlkreise'])] + ['    ]', '  },']
stimme = kalibrierung['stimmen'][0]
lines += ['  "stimmen": [', '    {', f'      "id": "{stimme["id"]}",', f'      "name": "{stimme["name"]}",', f'      "auswahl": {stimme["auswahl"]},', '      "felder": [']
lines += [f'        {one(feld)}{"," if i < len(stimme["felder"]) - 1 else ""}' for i, feld in enumerate(stimme['felder'])]
lines += ['      ]', '    }', '  ]', '}']
NL = chr(10)
open(root / 'Kalibrierungen/bvv-reinickendorf-2026.json', 'w', encoding='utf-8', newline=NL).write(NL.join(lines) + NL)

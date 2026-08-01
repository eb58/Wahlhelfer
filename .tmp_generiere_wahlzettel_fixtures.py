import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance


QUELLE = Path('Testdaten/Wahlzettel1-hochaufloesend.png')
ZIEL = Path('Testdaten/fixtures/wahlzettel1-hochaufloesend')
BREITE, HOEHE = 1248, 1748
MITTELPUNKTE = {
    **{f'E{i}': (572, y) for i, y in enumerate((728, 836, 945, 1051, 1160, 1485, 1592), 1)},
    **{f'Z{i}': (678, y) for i, y in enumerate((728, 836, 945, 1051, 1160, 1268, 1376), 1)},
}


def kreuz(image, feld, *, farbe=(0, 0, 0), laenge=19, breite=5, versatz=(0, 0)):
    x, y = MITTELPUNKTE[feld]
    x += versatz[0]
    y += versatz[1]
    zeichner = ImageDraw.Draw(image)
    zeichner.line((x - laenge, y - laenge, x + laenge, y + laenge), fill=farbe, width=breite)
    zeichner.line((x - laenge, y + laenge, x + laenge, y - laenge), fill=farbe, width=breite)


def verrausche(image, seed, staerke=10, anzahl=5000):
    zufall = random.Random(seed)
    pixel = image.load()
    for _ in range(anzahl):
        x, y = zufall.randrange(image.width), zufall.randrange(image.height)
        wert = zufall.choice((-staerke, staerke))
        r, g, b = pixel[x, y]
        pixel[x, y] = tuple(max(0, min(255, wert + farbe)) for farbe in (r, g, b))


def verschiebe(image, x, y):
    ausgabe = Image.new('RGB', image.size, (255, 255, 255))
    ausgabe.paste(image, (x, y))
    return ausgabe


def erzeuge(image, markierungen, stil=None, *, seed=0, verrauscht=False, transform=None):
    ausgabe = image.copy()
    for feld in markierungen:
        kreuz(ausgabe, feld, **(stil or {}))
    if verrauscht:
        verrausche(ausgabe, seed)
    if transform == 'heller':
        ausgabe = ImageEnhance.Brightness(ausgabe).enhance(1.04)
    elif transform == 'verschoben':
        ausgabe = verschiebe(ausgabe, 7, -5)
    elif transform == 'beschnitten':
        ausgabe = ausgabe.crop((80, 45, BREITE - 80, HOEHE - 45))
    elif transform == 'verkleinert':
        ausgabe = ausgabe.resize((936, 1311), Image.Resampling.LANCZOS)
    elif transform == 'vergroessert':
        ausgabe = ausgabe.resize((1560, 2185), Image.Resampling.LANCZOS)
    elif transform == 'gedreht':
        ausgabe = ausgabe.rotate(0.6, resample=Image.Resampling.BICUBIC, fillcolor=(255, 255, 255))
    return ausgabe


def main():
    vorlage = Image.open(QUELLE).convert('RGB')
    ZIEL.mkdir(parents=True, exist_ok=True)
    faelle = []

    def fuege_hinzu(markierungen, kategorie, *, stil=None, verrauscht=False, transform=None):
        nummer = len(faelle) + 1
        dateiname = f'{nummer:03d}-{kategorie}.png'
        bild = erzeuge(vorlage, markierungen, stil, seed=nummer, verrauscht=verrauscht, transform=transform)
        bild.save(ZIEL / dateiname, format='PNG', optimize=True)
        faelle.append({
            'datei': dateiname,
            'markierungen': markierungen,
            'kategorie': kategorie,
            'verarbeitung': 'robust' if transform == 'gedreht' else 'direkt',
        })

    fuege_hinzu([], 'leer')

    einzel = [f'E{i}' for i in range(1, 10)] + [f'Z{i}' for i in range(1, 8)]
    for feld in einzel:
        fuege_hinzu([feld], f'einzeln-{feld.lower()}')

    paare = [(f'E{i}', f'Z{j}') for i, j in (
        (1, 1), (1, 4), (1, 7), (2, 2), (2, 5), (3, 1), (3, 3), (3, 6),
        (4, 2), (4, 7), (5, 3), (5, 5), (6, 1), (6, 4), (6, 7), (7, 2),
        (7, 6), (8, 1), (8, 4), (8, 7), (9, 2), (9, 5), (9, 7), (2, 1),
        (4, 4), (5, 1), (7, 3), (8, 6), (9, 4), (3, 7),
    ))]
    for erst, zweit in paare:
        fuege_hinzu([erst, zweit], f'gueltig-{erst.lower()}-{zweit.lower()}')

    mehrfach = [
        ['E1', 'E2'], ['E4', 'E5'], ['E8', 'E9'], ['Z1', 'Z2'], ['Z5', 'Z6'],
        ['Z2', 'Z4', 'Z7'], ['E1', 'E3', 'E5'], ['E2', 'E6', 'E9'],
        ['E1', 'E2', 'Z1'], ['E3', 'Z3', 'Z4'], ['E1', 'E5', 'Z2', 'Z6'],
        ['E2', 'E4', 'E6', 'Z1', 'Z7'], ['E7', 'E8', 'E9'], ['Z1', 'Z3', 'Z5', 'Z7'],
        ['E1', 'E4', 'E9', 'Z2', 'Z5'],
    ]
    for markierungen in mehrfach:
        fuege_hinzu(markierungen, f'mehrfach-{len(faelle) + 1:03d}')

    qualitaeten = [
        (['E1'], {'farbe': (90, 90, 90), 'laenge': 18, 'breite': 4}),
        (['E5'], {'farbe': (120, 120, 120), 'laenge': 16, 'breite': 3}),
        (['E9'], {'farbe': (150, 150, 150), 'laenge': 14, 'breite': 3}),
        (['Z1'], {'farbe': (70, 70, 70), 'laenge': 11, 'breite': 3}),
        (['Z4'], {'farbe': (110, 110, 110), 'laenge': 20, 'breite': 2}),
        (['Z7'], {'farbe': (145, 145, 145), 'laenge': 11, 'breite': 2}),
        (['E2', 'Z2'], {'farbe': (100, 100, 100), 'laenge': 17, 'breite': 3}),
        (['E3', 'Z5'], {'farbe': (130, 130, 130), 'laenge': 15, 'breite': 3}),
        (['E6'], {'farbe': (35, 35, 35), 'laenge': 22, 'breite': 7}),
        (['E7'], {'farbe': (0, 0, 0), 'laenge': 8, 'breite': 2}),
        (['Z3'], {'farbe': (50, 50, 50), 'laenge': 24, 'breite': 5}),
        (['Z6'], {'farbe': (100, 100, 100), 'laenge': 9, 'breite': 2}),
        (['E4', 'Z4'], {'farbe': (85, 85, 85), 'laenge': 18, 'breite': 4, 'versatz': (3, -2)}),
        (['E8', 'Z6'], {'farbe': (115, 115, 115), 'laenge': 16, 'breite': 3, 'versatz': (-3, 2)}),
        (['E9', 'Z1'], {'farbe': (40, 40, 40), 'laenge': 20, 'breite': 4, 'versatz': (2, 1)}),
        (['E2', 'Z7'], {'farbe': (135, 135, 135), 'laenge': 13, 'breite': 3, 'versatz': (-2, 1)}),
    ]
    for markierungen, stil in qualitaeten:
        fuege_hinzu(markierungen, f'qualitaet-{len(faelle) + 1:03d}', stil=stil)

    verrauschte = [
        ['E1', 'Z1'], ['E2', 'Z3'], ['E3', 'Z5'], ['E4', 'Z7'], ['E5', 'Z2'],
        ['E6', 'Z4'], ['E7', 'Z6'], ['E8', 'Z1'], ['E9', 'Z3'], ['E1', 'E9'],
        ['Z2', 'Z6'], ['E4', 'E8', 'Z4'],
    ]
    for markierungen in verrauschte:
        fuege_hinzu(markierungen, f'verrauscht-{len(faelle) + 1:03d}', verrauscht=True)

    geometrie = [
        (['E1', 'Z7'], 'heller'), (['E2', 'Z6'], 'verschoben'), (['E3', 'Z5'], 'beschnitten'),
        (['E4', 'Z4'], 'verkleinert'), (['E5', 'Z3'], 'vergroessert'), (['E6', 'Z2'], 'gedreht'),
        (['E7', 'Z1'], 'heller'), (['E8', 'Z4'], 'verschoben'), (['E9', 'Z5'], 'beschnitten'),
        (['E1', 'E8', 'Z2', 'Z6'], 'gedreht'),
    ]
    for markierungen, transform in geometrie:
        fuege_hinzu(markierungen, f'{transform}-{len(faelle) + 1:03d}', transform=transform)

    if len(faelle) != 100:
        raise RuntimeError(f'Unerwartete Fallzahl: {len(faelle)}')
    (ZIEL / 'manifest.json').write_text(json.dumps({
        'vorlage': '../../../Testdaten/Wahlzettel1-hochaufloesend.png',
        'bildgroesse_vorlage': [BREITE, HOEHE],
        'anzahl': len(faelle),
        'faelle': faelle,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


main()

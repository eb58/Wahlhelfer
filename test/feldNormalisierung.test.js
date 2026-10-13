import test from 'node:test';
import assert from 'node:assert/strict';
import {
  determineRingTransformation, transformRing, normalizeField, findRoughRingShift,
} from '../src/feldNormalisierung.js';

// perspectivePoint wird zur Identitaet, wenn die Bildecken exakt dem Kalibrierungsrahmen entsprechen -
// so lassen sich Ring-Suche und -Normalisierung unabhaengig von der perspektivischen Projektion testen.
const identitaetsRahmen = { left: 0, right: 200, top: 0, bottom: 600 };
const identitaetsEcken = {
  corners: {
    topLeft: { x: 0, y: 0 }, topRight: { x: 200, y: 0 },
    bottomLeft: { x: 0, y: 600 }, bottomRight: { x: 200, y: 600 },
  },
};

const leereKarte = (width, height) => ({ width, height, values: new Float32Array(width * height) });

const zeichneRing = (map, cx, cy, radius, dicke = 1.5, wert = 1) => {
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++)
      if (Math.abs(Math.hypot(x - cx, y - cy) - radius) <= dicke) map.values[y * map.width + x] = wert;
};

test('determineRingTransformation lehnt zu wenige Kandidaten ab', () => {
  const treffer = [
    { source: { x: 0, y: 0 }, target: { x: 0, y: 0 }, ringScore: 0.5 },
    { source: { x: 100, y: 0 }, target: { x: 100, y: 0 }, ringScore: 0.5 },
  ];
  assert.throws(() => determineRingTransformation(treffer), /zu wenige/i);
});

test('determineRingTransformation lehnt zu wenige Inlier ab (unter sechs uebereinstimmenden Ringen)', () => {
  // Nicht kollinear (x alterniert), sonst wird schon die Regression selbst singulaer.
  const treffer = [0, 1, 2, 3].map(i => {
    const source = { x: (i % 2) * 30, y: i * 90 };
    return { source, target: source, ringScore: 0.5 };
  });
  assert.throws(() => determineRingTransformation(treffer), /zu wenige/i);
});

// x-Spanne 90px, y-Spanne 300px - erfuellt knapp beide Mindestabstaende der Ring-Ausrichtung.
const punktRaster = (n, transform = ({ x, y }) => ({ x, y }), ringScore = 0.5) =>
  Array.from({ length: n }, (_, i) => {
    const source = { x: (i % 4) * 30, y: Math.floor(i / 4) * 300 };
    return { source, target: transform(source), ringScore };
  });

test('determineRingTransformation lehnt zu geringen Kontrast ab', () => {
  const treffer = punktRaster(8, p => p, 0.25);
  assert.throws(() => determineRingTransformation(treffer), /kontrast/i);
});

test('determineRingTransformation lehnt zu wenig verteilte Ringe ab', () => {
  // y-Spanne bleibt unter 300px, obwohl genug Punkte mit gutem Score vorliegen. Eine schmale
  // x-Spanne allein ist dagegen der Spaltenfall (siehe unten) und wird ausgerichtet.
  const treffer = Array.from({ length: 8 }, (_, i) => {
    const source = { x: (i % 4) * 100, y: Math.floor(i / 4) * 200 };
    return { source, target: source, ringScore: 0.5 };
  });
  assert.throws(() => determineRingTransformation(treffer), /verteilt/i);
});

test('determineRingTransformation lehnt eine geometrisch unplausible Ausrichtung ab', () => {
  const treffer = punktRaster(8, ({ x, y }) => ({ x: x * 1.5, y: y * 1.5 }), 0.5);
  assert.throws(() => determineRingTransformation(treffer), /unplausibel/i);
});

test('determineRingTransformation findet aus gut verteilten, konsistenten Ringen eine Identitaets-Transformation', () => {
  const treffer = punktRaster(8, p => p, 0.5);
  const { transformation, treffer: inlier } = determineRingTransformation(treffer);
  assert.equal(inlier.length, 8);
  for (const { source, target } of treffer)
    assert.deepEqual(transformRing(transformation, source), target);
});

test('normalizeField rastet auf einen leicht versetzten gedruckten Ring ein', () => {
  const map = leereKarte(200, 200);
  zeichneRing(map, 100, 100, 20);
  const messung = normalizeField(map, identitaetsEcken, identitaetsRahmen, { x: 102, y: 97 }, 20);
  assert.ok(Math.hypot(messung.x - 100, messung.y - 100) <= 1);
  assert.ok(messung.ringScore >= 0.24);
  assert.ok(messung.fuellgrad < 0.2, 'leeres Feld darf keinen hohen Fuellgrad zeigen');
});

test('normalizeField meldet ein deutlich gefuelltes Feld', () => {
  const map = leereKarte(200, 200);
  zeichneRing(map, 100, 100, 20);
  for (let y = 90; y <= 110; y++)
    for (let x = 90; x <= 110; x++) map.values[y * map.width + x] = 1;
  const messung = normalizeField(map, identitaetsEcken, identitaetsRahmen, { x: 100, y: 100 }, 20);
  assert.ok(messung.fuellgrad > 0.5);
});

test('findRoughRingShift findet die gemeinsame Verschiebung mehrerer Ringe', () => {
  const map = leereKarte(300, 700);
  const referenzen = [{ x: 100, y: 60 }, { x: 100, y: 300 }, { x: 100, y: 560 }];
  const dx0 = 18, dy0 = -32;
  for (const { x, y } of referenzen) zeichneRing(map, x + dx0, y + dy0, 20);
  const verschiebung = findRoughRingShift(map, identitaetsEcken, identitaetsRahmen, referenzen, 20);
  assert.equal(verschiebung.dx, dx0);
  assert.equal(verschiebung.dy, dy0);
});

test('findRoughRingShift schlaegt auf einer leeren Karte fehl', () => {
  const map = leereKarte(300, 700);
  const referenzen = [{ x: 100, y: 60 }, { x: 100, y: 300 }, { x: 100, y: 560 }];
  assert.throws(() => findRoughRingShift(map, identitaetsEcken, identitaetsRahmen, referenzen, 20), /nicht sicher gefunden/i);
});

test('determineRingTransformation richtet auch Zettel mit nur einer Ringspalte aus', () => {
  // Europawahl: alle Ringe untereinander. Quer zur Spalte bleibt die Streckung beim Rahmen.
  const soll = { a: 1, b: 0, c: 0.02, d: 0.97, e: 6, f: -12 };
  const treffer = [...Array(12).keys()].map(i => {
    const source = { x: 1175, y: 350 + i * 120 };
    return { source, target: transformRing(soll, source), ringScore: 0.5 };
  });
  const { transformation } = determineRingTransformation(treffer);
  for (const key of Object.keys(soll)) assert.ok(Math.abs(transformation[key] - soll[key]) < 1e-6, key);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { findPaper, paperToFrame } from '../src/paper.js';

const hintergrund = [30, 30, 80];
const papierfarbe = [245, 245, 245];

const bild = (width, height, istPapier) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [r, g, b] = istPapier(x, y) ? papierfarbe : hintergrund;
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  return { width, height, data };
};

test('findPaper findet ein achsenparalleles, helles Papierrechteck auf dunklem Untergrund', () => {
  const width = 200, height = 300;
  const image = bild(width, height, (x, y) => x >= 30 && x <= 170 && y >= 40 && y <= 260);
  const papier = findPaper(image);
  assert.ok(papier);
  assert.deepEqual([papier.left, papier.right, papier.top, papier.bottom], [30, 170, 40, 260]);
  assert.ok(Math.abs(papier.horizontalSlope) < 1e-9, `horizontalSlope ${papier.horizontalSlope}`);
});

test('findPaper erkennt kein Papier auf gleichfoermigem Untergrund', () => {
  const image = bild(200, 300, () => false);
  assert.equal(findPaper(image), undefined);
});

test('findPaper verwirft ein Papierstueck, das zu wenig vom Bild ausfuellt', () => {
  const width = 200, height = 300;
  // 40x40 Fleck: erfuellt lokal die 15%-Mindestdichte je Zeile/Spalte, aber nicht die 45%-Gesamtausdehnung.
  const image = bild(width, height, (x, y) => x >= 80 && x <= 120 && y >= 130 && y <= 170);
  assert.equal(findPaper(image), undefined);
});

test('findPaper erkennt eine geneigte obere Papierkante', () => {
  const width = 300, height = 400;
  const links = 40, rechts = 260, unten = 350, cx = (links + rechts) / 2, steigung = 0.05, basis = 100;
  const obenBei = x => basis + steigung * (x - cx);
  const image = bild(width, height, (x, y) => x >= links && x <= rechts && y >= obenBei(x) && y <= unten);

  const papier = findPaper(image);
  assert.ok(papier);
  assert.ok(Math.abs(papier.left - links) <= 2, `left ${papier.left}`);
  assert.ok(Math.abs(papier.right - rechts) <= 2, `right ${papier.right}`);
  assert.ok(Math.abs(papier.bottom - unten) <= 2, `bottom ${papier.bottom}`);
  assert.ok(papier.horizontalSlope > 0.02 && papier.horizontalSlope < 0.08, `horizontalSlope ${papier.horizontalSlope}`);
});

test('paperToFrame skaliert die Kalibrierungs-Rahmenlage auf die gefundene Papierlage', () => {
  const kalibrierung = { frame: { left: 100, right: 900, top: 50, bottom: 1450 }, referenz: { breite: 1000, hoehe: 1500 } };
  const papier = { left: 20, right: 220, top: 10, bottom: 310 };
  const frame = paperToFrame(papier, kalibrierung);
  assert.deepEqual(frame, {
    left: 20 + 200 * 0.1, right: 20 + 200 * 0.9,
    top: 10 + 300 * (50 / 1500), bottom: 10 + 300 * (1450 / 1500),
  });
});

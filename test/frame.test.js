import test from 'node:test';
import assert from 'node:assert/strict';
import { perspectivePoint, findPerspectiveFrame } from '../src/frame.js';

test('perspectivePoint ist die Identitaet, wenn Bildecken und Kalibrierungsrahmen deckungsgleich sind', () => {
  const rahmen = { left: 10, right: 90, top: 5, bottom: 205 };
  const perspectiveFrame = {
    ecken: {
      obenLinks: { x: 10, y: 5 }, obenRechts: { x: 90, y: 5 },
      untenLinks: { x: 10, y: 205 }, untenRechts: { x: 90, y: 205 },
    },
  };
  for (const punkt of [{ x: 10, y: 5 }, { x: 50, y: 100 }, { x: 90, y: 205 }, { x: 33, y: 61 }]) {
    const abgebildet = perspectivePoint(perspectiveFrame, rahmen, punkt);
    assert.ok(Math.abs(abgebildet.x - punkt.x) < 1e-9 && Math.abs(abgebildet.y - punkt.y) < 1e-9, JSON.stringify(abgebildet));
  }
});

test('perspectivePoint bildet die vier Ecken eines schraegen Vierecks exakt ab', () => {
  const rahmen = { left: 0, right: 100, top: 0, bottom: 100 };
  const ecken = {
    obenLinks: { x: 50, y: 0 }, obenRechts: { x: 150, y: 0 },
    untenLinks: { x: 0, y: 100 }, untenRechts: { x: 200, y: 100 },
  };
  const perspectiveFrame = { ecken };
  assert.deepEqual(perspectivePoint(perspectiveFrame, rahmen, { x: rahmen.left, y: rahmen.top }), ecken.obenLinks);
  assert.deepEqual(perspectivePoint(perspectiveFrame, rahmen, { x: rahmen.right, y: rahmen.top }), ecken.obenRechts);
  assert.deepEqual(perspectivePoint(perspectiveFrame, rahmen, { x: rahmen.left, y: rahmen.bottom }), ecken.untenLinks);
  assert.deepEqual(perspectivePoint(perspectiveFrame, rahmen, { x: rahmen.right, y: rahmen.bottom }), ecken.untenRechts);
});

test('perspectivePoint wendet echte perspektivische Verzerrung an, nicht nur bilineare Interpolation', () => {
  // Symmetrisches Trapez: die Bildmitte muesste bei reiner bilinearer Interpolation auf (100,50)
  // fallen. Die perspektivische Korrektur verschiebt sie zur (in der Aufnahme) naeheren, breiteren
  // Kante hin - hier exakt von Hand nachgerechnet (a=100, b=-50, d=0, e=50, g=0, h=-0.5).
  const rahmen = { left: 0, right: 100, top: 0, bottom: 100 };
  const ecken = {
    obenLinks: { x: 50, y: 0 }, obenRechts: { x: 150, y: 0 },
    untenLinks: { x: 0, y: 100 }, untenRechts: { x: 200, y: 100 },
  };
  const mitte = perspectivePoint({ ecken }, rahmen, { x: 50, y: 50 });
  assert.ok(Math.abs(mitte.x - 100) < 1e-9);
  assert.ok(Math.abs(mitte.y - 100 / 3) < 1e-9);
});

const leereKarte = (width, height) => ({ width, height, values: new Float32Array(width * height) });

const zeichneWaagerecht = (map, y, x0, x1, dicke = 2) => {
  for (let py = y - dicke; py <= y + dicke; py++)
    for (let px = x0; px <= x1; px++)
      if (py >= 0 && py < map.height && px >= 0 && px < map.width) map.values[py * map.width + px] = 1;
};

const zeichneSenkrecht = (map, x, y0, y1, dicke = 2) => {
  for (let px = x - dicke; px <= x + dicke; px++)
    for (let py = y0; py <= y1; py++)
      if (py >= 0 && py < map.height && px >= 0 && px < map.width) map.values[py * map.width + px] = 1;
};

test('findPerspectiveFrame findet einen achsenparallelen gedruckten Rahmen', () => {
  const map = leereKarte(400, 800);
  const papier = { left: 20, right: 380, top: 40, bottom: 760, horizontalSlope: 0 };
  const { left, right, top, bottom } = papier;
  const oben = top + (bottom - top) * 0.05, unten = top + (bottom - top) * 0.9;
  const links = left + (right - left) * 0.05, rechts = right - (right - left) * 0.05;
  zeichneWaagerecht(map, oben, left + 10, right - 10);
  zeichneWaagerecht(map, unten, left + 10, right - 10);
  zeichneSenkrecht(map, links, top + 10, bottom - 10);
  zeichneSenkrecht(map, rechts, top + 10, bottom - 10);

  const frame = findPerspectiveFrame(map, papier);
  assert.ok(frame, 'Rahmen haette gefunden werden muessen');
  // Die Liniensuche ist grob gerastert (Steigung in 0.01-Schritten, Mitte in 2px-Schritten) und
  // bei einer perfekt geraden, dicken Testlinie gibt es dadurch mehrere gleich gute Kandidaten -
  // die Toleranz bildet dieses Rasterspiel ab, keine echte Foto-Praezision.
  assert.ok(Math.abs(frame.left - links) < 4, `left ${frame.left} vs ${links}`);
  assert.ok(Math.abs(frame.right - rechts) < 4, `right ${frame.right} vs ${rechts}`);
  assert.ok(Math.abs(frame.top - oben) < 15, `top ${frame.top} vs ${oben}`);
  assert.ok(Math.abs(frame.bottom - unten) < 15, `bottom ${frame.bottom} vs ${unten}`);
  assert.ok(Math.abs(frame.horizontalSlope) < 0.06, `horizontalSlope ${frame.horizontalSlope}`);
});

test('findPerspectiveFrame gibt ohne erkennbare Linien nichts zurueck', () => {
  const map = leereKarte(400, 800);
  const papier = { left: 20, right: 380, top: 40, bottom: 760, horizontalSlope: 0 };
  assert.equal(findPerspectiveFrame(map, papier), undefined);
});

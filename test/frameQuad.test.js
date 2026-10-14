import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptiveInk, components, findFrameCandidates, reframe } from '../src/erkennung/frameQuad.js';

const kalibrierungsFrame = { left: 0, right: 100, top: 0, bottom: 140 };

const karte = (width, height, wert = 0) => ({ width, height, values: new Float32Array(width * height).fill(wert) });

// Zeichnet ein Viereck als duenne Linie: so liegt der Druckrahmen im Foto.
const zeichneViereck = (map, ecken, wert = 0.8) => ecken.forEach((von, i) => {
  const nach = ecken[(i + 1) % 4], schritte = Math.ceil(Math.hypot(nach.x - von.x, nach.y - von.y) * 2);
  for (let s = 0; s <= schritte; s++) {
    const x = Math.round(von.x + (nach.x - von.x) * s / schritte), y = Math.round(von.y + (nach.y - von.y) * s / schritte);
    for (let d = -1; d <= 1; d++) map.values[y * map.width + x + d] = wert;
  }
});

test('adaptiveInk findet eine Linie auch auf ungleichmaessig beleuchtetem Papier', () => {
  const map = karte(60, 20);
  // Links helles, rechts deutlich graues Papier - ein globaler Schwellwert faende die Linie nur links.
  for (let y = 0; y < 20; y++) for (let x = 0; x < 60; x++) map.values[y * 60 + x] = x / 60 * 0.5;
  for (let x = 0; x < 60; x++) map.values[10 * 60 + x] += 0.25;
  const ink = adaptiveInk(map, 4);
  assert.ok([5, 30, 55].every(x => ink[10 * 60 + x]));
  assert.ok([5, 30, 55].every(x => !ink[3 * 60 + x]));
});

test('components liefert die Ecken eines gedrehten Vierecks ueber die Diagonal-Extrempunkte', () => {
  const map = karte(120, 160);
  const ecken = [{ x: 30, y: 15 }, { x: 105, y: 30 }, { x: 90, y: 145 }, { x: 12, y: 130 }];
  zeichneViereck(map, ecken);
  const ink = map.values.map(wert => wert > 0.5 ? 1 : 0);
  const [rahmen] = components(ink, 120, 160);
  const { topLeft, topRight, bottomRight, bottomLeft } = rahmen.corners;
  [topLeft, topRight, bottomRight, bottomLeft].forEach((ecke, i) =>
    assert.ok(Math.hypot(ecke.x - ecken[i].x, ecke.y - ecken[i].y) <= 2, JSON.stringify({ ecke, soll: ecken[i] })));
});

test('findFrameCandidates findet den perspektivisch verzerrten Rahmen', () => {
  const map = karte(400, 500, 0.05);
  const ecken = [{ x: 90, y: 60 }, { x: 330, y: 75 }, { x: 370, y: 440 }, { x: 40, y: 420 }];
  zeichneViereck(map, ecken);
  const [rahmen] = findFrameCandidates(map, kalibrierungsFrame);
  const { topLeft, topRight, bottomRight, bottomLeft } = rahmen.corners;
  [topLeft, topRight, bottomRight, bottomLeft].forEach((ecke, i) =>
    assert.ok(Math.hypot(ecke.x - ecken[i].x, ecke.y - ecken[i].y) <= 4, JSON.stringify({ ecke, soll: ecken[i] })));
});

test('findFrameCandidates verwirft Komponenten am Bildrand und entartete Vierecke', () => {
  const map = karte(400, 500, 0.05);
  // Tischkante: beruehrt den Bildrand.
  zeichneViereck(map, [{ x: 1, y: 1 }, { x: 398, y: 1 }, { x: 398, y: 498 }, { x: 1, y: 498 }]);
  // Dreieck: zwei Ecken fallen zusammen.
  zeichneViereck(map, [{ x: 100, y: 50 }, { x: 300, y: 50 }, { x: 300, y: 50 }, { x: 100, y: 450 }]);
  assert.deepEqual(findFrameCandidates(map, kalibrierungsFrame), []);
});

test('findFrameCandidates verwirft Vierecke mit falschem Seitenverhaeltnis', () => {
  const map = karte(500, 300, 0.05);
  zeichneViereck(map, [{ x: 30, y: 60 }, { x: 470, y: 60 }, { x: 470, y: 240 }, { x: 30, y: 240 }]);
  assert.deepEqual(findFrameCandidates(map, kalibrierungsFrame), []);
});

test('findFrameCandidates bildet die Huelle getrennter Tabellen auf dem Papier', () => {
  // Zwei Tabellen nebeneinander ohne umlaufenden Rahmen (wie Erst- und Zweitstimme in Neuwied).
  const map = karte(400, 500, 0.05);
  zeichneViereck(map, [{ x: 60, y: 70 }, { x: 190, y: 70 }, { x: 190, y: 430 }, { x: 60, y: 430 }]);
  zeichneViereck(map, [{ x: 210, y: 70 }, { x: 340, y: 70 }, { x: 340, y: 430 }, { x: 210, y: 430 }]);
  const paper = { left: 30, right: 370, top: 40, bottom: 460 };
  const kalibrierung = { left: 0, right: 280, top: 0, bottom: 360 };
  const [rahmen] = findFrameCandidates(map, kalibrierung, { paper });
  const { topLeft, topRight, bottomRight, bottomLeft } = rahmen.corners;
  [[topLeft, 60, 70], [topRight, 340, 70], [bottomRight, 340, 430], [bottomLeft, 60, 430]].forEach(([ecke, x, y]) =>
    assert.ok(Math.hypot(ecke.x - x, ecke.y - y) <= 3, JSON.stringify({ ecke, x, y })));
  // Ohne Papierlage keine Huelle - sonst koennte Tischmaserung hineingeraten.
  assert.deepEqual(findFrameCandidates(map, kalibrierung), []);
});

test('findFrameCandidates trifft die Ecken langer, leicht gedrehter Zettel auf wenige Pixel', () => {
  // 1:4 wie die Europawahl - hier verschiebt schon ein Pixel an einer Ecke die Ringe am anderen Ende.
  const map = karte(600, 2200, 0.05);
  const winkel = 3 * Math.PI / 180;
  const ecken = [[-200, -900], [200, -900], [200, 900], [-200, 900]].map(([dx, dy]) => ({
    x: 300 + dx * Math.cos(winkel) - dy * Math.sin(winkel), y: 1100 + dx * Math.sin(winkel) + dy * Math.cos(winkel),
  }));
  zeichneViereck(map, ecken);
  const [rahmen] = findFrameCandidates(map, { left: 0, right: 400, top: 0, bottom: 1800 });
  const { topLeft, topRight, bottomRight, bottomLeft } = rahmen.corners;
  [topLeft, topRight, bottomRight, bottomLeft].forEach((ecke, i) =>
    assert.ok(Math.hypot(ecke.x - ecken[i].x, ecke.y - ecken[i].y) <= 2.5, JSON.stringify({ ecke, soll: ecken[i] })));
});

test('reframe rechnet die Ecken der Huelle auf den Kalibrierungsrahmen um', () => {
  // Wie bei MV: der Kalibrierungsrahmen endet vor der rechten Nummernspalte.
  const huelle = { left: 0, right: 120, top: 0, bottom: 400 }, frame = { left: 0, right: 100, top: 0, bottom: 400 };
  const quad = {
    corners: {
      topLeft: { x: 10, y: 20 }, topRight: { x: 250, y: 20 },
      bottomRight: { x: 250, y: 820 }, bottomLeft: { x: 10, y: 820 },
    },
  };
  const { corners } = reframe(quad, huelle, frame);
  assert.ok(Math.abs(corners.topRight.x - 210) < 1e-9 && Math.abs(corners.bottomRight.x - 210) < 1e-9);
  assert.deepEqual(corners.topLeft, { x: 10, y: 20 });
});

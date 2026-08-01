/**
 * Geometrie und Wortabgleich der Ausrichtung - ohne OCR, damit schnell und genau pruefbar.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  similarityTransform, transformScale, transformAngle,
  anchorMatches, editDistance, ocrNormalize, learnAnchors, findTransform,
} from '../src/alignment.js';

const word = (text, x, y, confidence = 90) =>
  ({ text, confidence, bbox: { x0: x - 10, x1: x + 10, y0: y - 4, y1: y + 4 } });

/* --- Wortabgleich -------------------------------------------------------- */

test('normalisiert Umlaute, Schaerfe und Satzzeichen weg', () => {
  assert.equal(ocrNormalize('Jürgen,'), 'jurgen');
  assert.equal(ocrNormalize('Straße'), 'strasse');
});

test('Editierdistanz zaehlt Einzelaenderungen', () => {
  assert.equal(editDistance('partei', 'partei'), 0);
  assert.equal(editDistance('partei', 'partel'), 1);
  assert.equal(editDistance('', 'abc'), 3);
});

test('lange Woerter duerfen Lesefehler haben, kurze nicht', () => {
  assert.ok(anchorMatches('Musterfrau', 'Musterfrau'));
  assert.ok(anchorMatches('Musterfrsu', 'Musterfrau'), 'ein Fehler in langem Wort ist erlaubt');
  assert.equal(anchorMatches('Bund', 'Bond'), false, 'kurzes Wort muss exakt sitzen');
});

/* --- Ankerauswahl -------------------------------------------------------- */

test('mehrfach vorkommende Woerter taugen nicht als Anker', () => {
  const anchors = learnAnchors([word('PARTEI', 10, 10), word('PARTEI', 10, 50), word('Musterfrau', 20, 30)]);
  assert.deepEqual(anchors.map(a => a.text), ['Musterfrau']);
});

test('kurze und unsichere Lesungen fallen als Anker weg', () => {
  const anchors = learnAnchors([word('am', 10, 10), word('Zweitstimme', 20, 20, 30), word('Erststimme', 30, 30)]);
  assert.deepEqual(anchors.map(a => a.text), ['Erststimme']);
});

test('Ankerlagen werden auf das Referenzbild zurueckgerechnet', () => {
  const [anchor] = learnAnchors([word('Erststimme', 300, 600)], { scale: 3 });
  assert.deepEqual({ x: anchor.x, y: anchor.y }, { x: 100, y: 200 });
});

/* --- Transformation ------------------------------------------------------ */

const rotatePoint = ({ x, y }, degrees, factor, shift) => {
  const b = (degrees * Math.PI) / 180;
  return {
    x: shift.x + factor * (x * Math.cos(b) - y * Math.sin(b)),
    y: shift.y + factor * (x * Math.sin(b) + y * Math.cos(b)),
  };
};

test('findet Drehung, Massstab und Verschiebung zurueck', () => {
  const reference = [{ x: 10, y: 20 }, { x: 200, y: 40 }, { x: 120, y: 300 }];
  const pairs = reference.map(ref => ({ ref, px: rotatePoint(ref, 7, 1.5, { x: 30, y: -12 }) }));
  const transform = similarityTransform(pairs);

  assert.ok(Math.abs(transformAngle(transform) - 7) < 0.001);
  assert.ok(Math.abs(transformScale(transform) - 1.5) < 0.001);
  const target = transform({ x: 50, y: 50 });
  const expected = rotatePoint({ x: 50, y: 50 }, 7, 1.5, { x: 30, y: -12 });
  assert.ok(Math.hypot(target.x - expected.x, target.y - expected.y) < 0.001);
});

test('ein einzelner Anker reicht nicht', () => {
  assert.equal(similarityTransform([{ ref: { x: 0, y: 0 }, px: { x: 1, y: 1 } }]), undefined);
  assert.equal(similarityTransform([]), undefined);
});

test('ein Ausreisser verzieht die Transformation nicht', () => {
  const anchors = [{ text: 'Erststimme', x: 50, y: 50 }, { text: 'Zweitstimme', x: 250, y: 60 }, { text: 'Musterfrau', x: 100, y: 300 }];
  const truth = point => rotatePoint(point, 4, 1, { x: 5, y: 5 });
  const words = [
    ...anchors.map(a => word(a.text, truth(a).x, truth(a).y)),
    word('Erststimme', 20, 560), // Fehllesung weit weg vom erwarteten Ort
  ];

  const { transform, pairs } = findTransform(words, anchors, { width: 400, height: 600 }, { width: 400, height: 600 });
  assert.equal(pairs.length, 3);
  assert.ok(Math.abs(transformAngle(transform) - 4) < 0.5);
});

test('ohne Ankertreffer gibt es keine Transformation', () => {
  const anchors = [{ text: 'Erststimme', x: 50, y: 50 }, { text: 'Zweitstimme', x: 250, y: 60 }];
  const { transform } = findTransform([word('Unbekannt', 10, 10)], anchors, { width: 400, height: 600 }, { width: 400, height: 600 });
  assert.equal(transform, undefined);
});

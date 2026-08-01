/**
 * OCR-Tests. Sie laufen ueber tesseract.js und brauchen deutlich laenger als die
 * Pixeltests; deshalb ein eigener Lauf. Geprueft wird die Zuordnung Text -> Ankreuzfeld,
 * nicht die Lesequalitaet von tesseract selbst.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registriereWahlzettel } from '../src/wahlzettelTyp.js';
import { beschrifteFelder } from '../src/beschriftung.js';
import { localOcrOptions } from '../src/ocrPaths.js';
import { writePng } from '../src/png.js';
import { musterZettel, scale } from './zettelWerkstatt.js';

const factor = 3;
const path = join(tmpdir(), `wahlzettel-ocr-${process.pid}.png`);
writeFileSync(path, writePng(scale(musterZettel(), factor)));
test.after(() => rmSync(path, { force: true }));

const typ = await registriereWahlzettel(musterZettel(), {
  name: 'Musterzettel mit OCR',
  ocr: { source: path, scale: factor, ...localOcrOptions() },
});
const feld = id => typ.felder.find(f => f.id === id);

test('OCR aendert die geometrisch gefundenen Felder nicht', () => {
  assert.equal(typ.felder.length, 14);
});

test('beschriftet die Erststimme mit dem Kandidatenkasten', () => {
  assert.match(feld('E1').beschriftung, /Musterfrau/);
  assert.match(feld('E2').beschriftung, /Jedermann/);
  assert.match(feld('E4').beschriftung, /Soundso/);
});

test('beschriftet die Zweitstimme mit der Landesliste', () => {
  assert.match(feld('Z1').beschriftung, /PARTEI A/);
  assert.match(feld('Z2').beschriftung, /PARTEI B/);
});

test('ordnet Text der richtigen Spaltenseite zu', () => {
  assert.doesNotMatch(feld('Z1').beschriftung, /Musterfrau/, 'Kandidatenname gehoert zur Erststimme');
});

test('Satzzeichenrauschen landet nicht in der Beschriftung', () => {
  assert.ok(typ.felder.every(f => !/^[^\p{L}\p{N}]/u.test(f.beschriftung ?? 'x')), 'Beschriftung beginnt mit Text');
});

test('schlecht lesbare Zeilen kosten kein Ankreuzfeld', () => {
  // tesseract liest die unteren Zeilen dieses Musterzettels nicht zuverlaessig und
  // liefert dort teils Unsinn. Entscheidend ist, dass die Felder trotzdem vollstaendig
  // bleiben - die Beschriftung ist Beiwerk, die Ankreuzerkennung haengt nicht an ihr.
  assert.equal(typ.felder.length, 14);
  assert.ok(typ.felder.filter(f => f.beschriftung).length >= 8, 'lesbare Zeilen muessen ankommen');
});

test('ohne OCR bleiben die Felder unbeschriftet', async () => {
  const ohne = await registriereWahlzettel(musterZettel());
  assert.ok(ohne.felder.every(f => f.beschriftung === undefined));
});

test('beschrifteFelder ist ohne Woerter gefahrlos', () => {
  const frame = { left: 0, right: 100, top: 0, bottom: 100 };
  const felder = [{ id: 'E1', stimme: 'erststimme', x: 0.5, y: 0.5 }];
  assert.deepEqual(beschrifteFelder(felder, [], frame), felder);
});

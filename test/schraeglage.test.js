/**
 * Schraeg fotografierte Zettel: die Rahmenlinien versagen, die Ankerwoerter muessen tragen.
 * Laeuft ueber echtes OCR und dauert daher deutlich laenger als die Pixeltests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerWahlzettel } from '../src/wahlzettelTyp.js';
import { localOcrOptions } from '../src/ocrPaths.js';
import { writePng } from '../src/png.js';
import { toDarkness } from '../src/image.js';
import { findFrame } from '../src/frame.js';
import { musterZettel, kreuzeAn, scale, rotate } from './zettelWerkstatt.js';

const factor = 3;
const files = [];
const asFile = (image, name) => {
  const path = join(tmpdir(), `wahlzettel-${name}-${process.pid}.png`);
  writeFileSync(path, writePng(image));
  files.push(path);
  return path;
};
test.after(() => files.forEach(path => rmSync(path, { force: true })));

const muster = musterZettel();
const typ = await registerWahlzettel(muster, {
  name: 'Musterzettel mit Ankern',
  ocr: { source: asFile(scale(muster, factor), 'muster'), scale: factor, ...localOcrOptions() },
});

/** OCR braucht die vergroesserte Fassung; die Ankreuzerkennung misst im Originalmassstab. */
const recognizeSchraeg = (image, name) =>
  typ.recognizeRobust(image, { ocr: { source: asFile(scale(image, factor), name), scale: factor, ...localOcrOptions() } });

test('Registrierung lernt Ankerwoerter aus dem Musterzettel', () => {
  assert.ok(typ.anchors.length >= 4, `zu wenige Anker: ${typ.anchors.length}`);
  assert.equal(new Set(typ.anchors.map(a => a.text)).size, typ.anchors.length, 'Anker muessen eindeutig sein');
});

test('gerader Zettel geht weiterhin ohne OCR ueber den Rahmen', async () => {
  const ergebnis = await recognizeSchraeg(kreuzeAn(muster, typ, ['E3', 'Z5']), 'gerade');
  assert.equal(ergebnis.method, 'rahmen');
  assert.deepEqual(ergebnis.erststimme.treffer, ['E3']);
});

test('gedrehter Zettel verliert die Rahmenlinien', () => {
  const gedreht = rotate(kreuzeAn(muster, typ, ['E3', 'Z5']), 4);
  assert.equal(findFrame(toDarkness(gedreht)), undefined, 'sonst pruefte dieser Test nichts');
});

test('gedrehter Zettel wird ueber die Ankerwoerter erkannt', async () => {
  const ergebnis = await recognizeSchraeg(rotate(kreuzeAn(muster, typ, ['E3', 'Z5']), 4), 'gedreht');
  assert.equal(ergebnis.method, 'anker');
  assert.ok(Math.abs(ergebnis.drehung - 4) < 1.5, `Drehung falsch geschaetzt: ${ergebnis.drehung}`);
  assert.deepEqual(ergebnis.erststimme, { treffer: ['E3'], status: 'gueltig' });
  assert.deepEqual(ergebnis.zweitstimme, { treffer: ['Z5'], status: 'gueltig' });
});

test('auch die Gegenrichtung wird ausgeglichen', async () => {
  const ergebnis = await recognizeSchraeg(rotate(kreuzeAn(muster, typ, ['E1', 'Z7']), -3), 'gegen');
  assert.equal(ergebnis.method, 'anker');
  assert.deepEqual(ergebnis.erststimme.treffer, ['E1']);
  assert.deepEqual(ergebnis.zweitstimme.treffer, ['Z7']);
});

test('leerer gedrehter Zettel bleibt leer - keine Scheintreffer durch Schraeglage', async () => {
  const ergebnis = await recognizeSchraeg(rotate(muster, 4), 'leer');
  assert.equal(ergebnis.method, 'anker');
  assert.ok(ergebnis.felder.every(f => f.status === 'leer'), 'Schraeglage darf keine Markierung erfinden');
});

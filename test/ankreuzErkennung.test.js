import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ladeKalibrierung } from '../src/kalibrierung.js';
import { musterZettel, kreuzeAn, scale, crop } from './zettelWerkstatt.js';

const muster = musterZettel();
const typ = ladeKalibrierung(readFileSync(new URL('../Kalibrierungen/bundestagswahl-2017-muster.json', import.meta.url), 'utf8'));
const erkenne = image => typ.recognize(image, { textjustierung: false });
const status = (ergebnis, id) => ergebnis.felder.find(feld => feld.id === id).status;
const wertung = (ergebnis, id) => ergebnis.stimmen.find(stimme => stimme.id === id);

test('leerer Zettel enthaelt keine Markierung', async () => {
  const ergebnis = await erkenne(muster);
  assert.ok(ergebnis.felder.every(feld => feld.status === 'leer'));
  assert.ok(ergebnis.stimmen.every(stimme => stimme.status === 'leer'));
});

test('erkennt je ein Kreuz in Erst- und Zweitstimme', async () => {
  const ergebnis = await erkenne(kreuzeAn(muster, typ, ['E3', 'Z5']));
  assert.deepEqual(wertung(ergebnis, 'erststimme').treffer, ['E3']);
  assert.equal(wertung(ergebnis, 'erststimme').status, 'gueltig');
  assert.deepEqual(wertung(ergebnis, 'zweitstimme').treffer, ['Z5']);
  assert.equal(wertung(ergebnis, 'zweitstimme').status, 'gueltig');
});

test('markiert nur das angekreuzte Feld, nicht die Nachbarn', async () => {
  const ergebnis = await erkenne(kreuzeAn(muster, typ, ['E4']));
  assert.equal(status(ergebnis, 'E4'), 'angekreuzt');
  assert.deepEqual(['E3', 'E5', 'Z4'].map(id => status(ergebnis, id)), ['leer', 'leer', 'leer']);
});

test('jedes einzelne Feld ist sicher ansprechbar', async () => {
  for (const { id } of typ.felder) {
    const ergebnis = await erkenne(kreuzeAn(muster, typ, [id]));
    assert.equal(status(ergebnis, id), 'angekreuzt', `${id} wurde nicht erkannt`);
    assert.equal(ergebnis.felder.filter(feld => feld.status !== 'leer').length, 1, `${id} faerbt auf Nachbarfelder ab`);
  }
});

test('zwei Kreuze in einer Spalte gelten als mehrfach', async () => {
  const ergebnis = await erkenne(kreuzeAn(muster, typ, ['Z2', 'Z6']));
  assert.equal(wertung(ergebnis, 'zweitstimme').status, 'mehrfach');
  assert.deepEqual(wertung(ergebnis, 'zweitstimme').treffer, ['Z2', 'Z6']);
});

test('blasse Markierung wird zum Zweifelsfall statt zur stillen Wertung', async () => {
  // Ein kleines, graues Kreuz: Fuellgrad rund 0,12 - deutlich zwischen beiden Schwellen.
  const ergebnis = await erkenne(kreuzeAn(muster, typ, ['E2'], { strength: 150, size: 0.2, thickness: 1 }));
  assert.equal(status(ergebnis, 'E2'), 'unklar');
  assert.equal(wertung(ergebnis, 'erststimme').status, 'zweifelsfall');
});

test('erkennt unabhaengig von der Aufloesung', async () => {
  const ergebnis = await erkenne(scale(kreuzeAn(muster, typ, ['E1', 'Z7']), 2));
  assert.deepEqual(wertung(ergebnis, 'erststimme').treffer, ['E1']);
  assert.deepEqual(wertung(ergebnis, 'zweitstimme').treffer, ['Z7']);
});

test('erkennt trotz beschnittenem Rand', async () => {
  const gekreuzt = kreuzeAn(muster, typ, ['E5', 'Z3']);
  // Anteilig beschneiden statt in festen Pixeln - sonst haengt der Test an einer Aufloesung.
  // Mehr als hier geht nicht: findFrame verwirft Linien innerhalb von `edgeRatio` (2 %) vom
  // Bildrand, und die Rahmenlinie dieses Zettels liegt nur 4 % der Breite vom Rand entfernt.
  const links = Math.round(gekreuzt.width * 0.02), oben = Math.round(gekreuzt.height * 0.005);
  const ergebnis = await erkenne(crop(gekreuzt, links, oben, gekreuzt.width - 2 * links, gekreuzt.height - 2 * oben));
  assert.deepEqual(wertung(ergebnis, 'erststimme').treffer, ['E5']);
  assert.deepEqual(wertung(ergebnis, 'zweitstimme').treffer, ['Z3']);
});

test('meldet einen unbrauchbaren Bildausschnitt statt zu raten', async () => {
  const weiss = { width: 60, height: 60, data: new Uint8ClampedArray(60 * 60 * 4).fill(255) };
  await assert.rejects(() => erkenne(weiss), /rahmen/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWahlzettel } from '../src/wahlzettelTyp.js';
import { musterZettel, kreuzeAn, scale, crop } from './zettelWerkstatt.js';

const muster = musterZettel();
const typ = await registerWahlzettel(muster, { name: 'Testzettel' });
const status = (ergebnis, id) => ergebnis.felder.find(f => f.id === id).status;

test('leerer Zettel enthaelt keine Markierung', () => {
  const ergebnis = typ.recognize(muster);
  assert.ok(ergebnis.felder.every(f => f.status === 'leer'));
  assert.equal(ergebnis.erststimme.status, 'leer');
  assert.equal(ergebnis.zweitstimme.status, 'leer');
});

test('erkennt je ein Kreuz in Erst- und Zweitstimme', () => {
  const ergebnis = typ.recognize(kreuzeAn(muster, typ, ['E3', 'Z5']));
  assert.deepEqual(ergebnis.erststimme, { treffer: ['E3'], status: 'gueltig' });
  assert.deepEqual(ergebnis.zweitstimme, { treffer: ['Z5'], status: 'gueltig' });
});

test('markiert nur das angekreuzte Feld, nicht die Nachbarn', () => {
  const ergebnis = typ.recognize(kreuzeAn(muster, typ, ['E4']));
  assert.equal(status(ergebnis, 'E4'), 'angekreuzt');
  assert.deepEqual(['E3', 'E5', 'Z4'].map(id => status(ergebnis, id)), ['leer', 'leer', 'leer']);
});

test('jedes einzelne Feld ist sicher ansprechbar', () => {
  for (const { id } of typ.felder) {
    const ergebnis = typ.recognize(kreuzeAn(muster, typ, [id]));
    assert.equal(status(ergebnis, id), 'angekreuzt', `${id} wurde nicht erkannt`);
    assert.equal(ergebnis.felder.filter(f => f.status !== 'leer').length, 1, `${id} faerbt auf Nachbarfelder ab`);
  }
});

test('zwei Kreuze in einer Spalte gelten als mehrfach', () => {
  const ergebnis = typ.recognize(kreuzeAn(muster, typ, ['Z2', 'Z6']));
  assert.equal(ergebnis.zweitstimme.status, 'mehrfach');
  assert.deepEqual(ergebnis.zweitstimme.treffer, ['Z2', 'Z6']);
});

test('blasse Markierung wird zum Zweifelsfall statt zur stillen Wertung', () => {
  const ergebnis = typ.recognize(kreuzeAn(muster, typ, ['E2'], { strength: 150, size: 0.4, thickness: 0 }));
  assert.equal(status(ergebnis, 'E2'), 'unklar');
  assert.equal(ergebnis.erststimme.status, 'zweifelsfall');
});

test('erkennt unabhaengig von der Aufloesung', () => {
  const ergebnis = typ.recognize(scale(kreuzeAn(muster, typ, ['E1', 'Z7']), 2));
  assert.deepEqual(ergebnis.erststimme.treffer, ['E1']);
  assert.deepEqual(ergebnis.zweitstimme.treffer, ['Z7']);
});

test('erkennt trotz beschnittenem Rand', () => {
  const gekreuzt = kreuzeAn(muster, typ, ['E5', 'Z3']);
  // Anteilig beschneiden statt in festen Pixeln - sonst haengt der Test an einer Aufloesung.
  // Mehr als hier geht nicht: findFrame verwirft Linien innerhalb von `edgeRatio` (2 %) vom
  // Bildrand, und die Rahmenlinie dieses Zettels liegt nur 4 % der Breite vom Rand entfernt.
  const links = Math.round(gekreuzt.width * 0.02), oben = Math.round(gekreuzt.height * 0.005);
  const ergebnis = typ.recognize(crop(gekreuzt, links, oben, gekreuzt.width - 2 * links, gekreuzt.height - 2 * oben));
  assert.deepEqual(ergebnis.erststimme.treffer, ['E5']);
  assert.deepEqual(ergebnis.zweitstimme.treffer, ['Z3']);
});

test('meldet einen unbrauchbaren Bildausschnitt statt zu raten', () => {
  const weiss = { width: 60, height: 60, data: new Uint8ClampedArray(60 * 60 * 4).fill(255) };
  assert.throws(() => typ.recognize(weiss), /rahmen/i);
});

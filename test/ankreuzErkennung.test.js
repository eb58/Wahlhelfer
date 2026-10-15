import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadKalibrierung } from '../src/erfassungsplatz/erkennung/kalibrierung.js';
import { computeImageThresholds } from '../src/erfassungsplatz/erkennung/ankreuzErkennung.js';
import { musterZettel, kreuzeAn, scale, crop } from './zettelWerkstatt.js';

const muster = await musterZettel();
const typ = loadKalibrierung(readFileSync(new URL('../Kalibrierungen/bundestagswahl-2017.json', import.meta.url), 'utf8'));
const recognize = image => typ.recognize(image);
const status = (result, id) => result.felder.find(feld => feld.id === id).status;
const wertung = (result, id) => result.stimmen.find(stimme => stimme.id === id);

test('leerer Zettel enthaelt keine Markierung', async () => {
  const result = await recognize(muster);
  assert.ok(result.felder.every(feld => feld.status === 'leer'));
  assert.ok(result.stimmen.every(stimme => stimme.status === 'leer'));
});

test('erkennt je ein Kreuz in Erst- und Zweitstimme', async () => {
  const result = await recognize(kreuzeAn(muster, typ, ['E3', 'Z5']));
  assert.deepEqual(wertung(result, 'erststimme').treffer, ['E3']);
  assert.equal(wertung(result, 'erststimme').status, 'gueltig');
  assert.deepEqual(wertung(result, 'zweitstimme').treffer, ['Z5']);
  assert.equal(wertung(result, 'zweitstimme').status, 'gueltig');
});

test('markiert nur das angekreuzte Feld, nicht die Nachbarn', async () => {
  const result = await recognize(kreuzeAn(muster, typ, ['E4']));
  assert.equal(status(result, 'E4'), 'angekreuzt');
  assert.deepEqual(['E3', 'E5', 'Z4'].map(id => status(result, id)), ['leer', 'leer', 'leer']);
});

test('jedes einzelne Feld ist sicher ansprechbar', async () => {
  for (const { id } of typ.felder) {
    const result = await recognize(kreuzeAn(muster, typ, [id]));
    assert.equal(status(result, id), 'angekreuzt', `${id} wurde nicht erkannt`);
    assert.equal(result.felder.filter(feld => feld.status !== 'leer').length, 1, `${id} faerbt auf Nachbarfelder ab`);
  }
});

test('zwei Kreuze in einer Spalte gelten als mehrfach', async () => {
  const result = await recognize(kreuzeAn(muster, typ, ['Z2', 'Z6']));
  assert.equal(wertung(result, 'zweitstimme').status, 'mehrfach');
  assert.deepEqual(wertung(result, 'zweitstimme').treffer, ['Z2', 'Z6']);
});

test('blasse Markierung wird zum Zweifelsfall statt zur stillen Wertung', async () => {
  // Ein kleines, graues Kreuz: Fuellgrad rund 0,12 - deutlich zwischen beiden Schwellen.
  const result = await recognize(kreuzeAn(muster, typ, ['E2'], { strength: 150, size: 0.2, thickness: 1 }));
  assert.equal(status(result, 'E2'), 'unklar');
  assert.equal(wertung(result, 'erststimme').status, 'zweifelsfall');
});

test('erkennt unabhaengig von der Aufloesung', async () => {
  const result = await recognize(scale(kreuzeAn(muster, typ, ['E1', 'Z7']), 2));
  assert.deepEqual(wertung(result, 'erststimme').treffer, ['E1']);
  assert.deepEqual(wertung(result, 'zweitstimme').treffer, ['Z7']);
});

test('erkennt trotz beschnittenem Rand', async () => {
  const gekreuzt = kreuzeAn(muster, typ, ['E5', 'Z3']);
  // Anteilig beschneiden statt in festen Pixeln - sonst haengt der Test an einer Aufloesung.
  // Mehr als hier geht nicht: findFrame verwirft Linien innerhalb von `edgeRatio` (2 %) vom
  // Bildrand, und die Rahmenlinie dieses Zettels liegt nur 4 % der Breite vom Rand entfernt.
  const links = Math.round(gekreuzt.width * 0.02), oben = Math.round(gekreuzt.height * 0.005);
  const result = await recognize(crop(gekreuzt, links, oben, gekreuzt.width - 2 * links, gekreuzt.height - 2 * oben));
  assert.deepEqual(wertung(result, 'erststimme').treffer, ['E5']);
  assert.deepEqual(wertung(result, 'zweitstimme').treffer, ['Z3']);
});

test('meldet einen unbrauchbaren Bildausschnitt statt zu raten', async () => {
  const weiss = { width: 60, height: 60, data: new Uint8ClampedArray(60 * 60 * 4).fill(255) };
  await assert.rejects(() => recognize(weiss), /rahmen/i);
});

const felderMit = fuellgrade => fuellgrade.map(fuellgrad => ({ fuellgrad }));

test('computeImageThresholds laesst die Schwellen unveraendert ohne Ringlage', () => {
  const thresholds = { angekreuzt: 0.18, zweifel: 0.06 };
  assert.deepEqual(computeImageThresholds(felderMit([0.9, 0.01]), thresholds, {}), thresholds);
});

test('computeImageThresholds hebt beide Schwellen an, behaelt aber den Mindestabstand', () => {
  const thresholds = { angekreuzt: 0.18, zweifel: 0.06 };
  // Hoher Rauschsockel: alle Felder liegen weit ueber den konfigurierten Schwellen.
  const fuellgrade = Array.from({ length: 20 }, (_, i) => 0.3 + i * 0.01);

  const result = computeImageThresholds(felderMit(fuellgrade), thresholds, { ringAlignment: true });
  assert.ok(result.angekreuzt > thresholds.angekreuzt, 'angekreuzt haette steigen muessen');
  assert.ok(result.zweifel > thresholds.zweifel, 'zweifel haette steigen muessen');
  // Regression: eine fruehere Fassung liess zweifel === angekreuzt werden und damit keinen
  // Bereich mehr uebrig, in dem ein Feld als "unklar" statt "angekreuzt" gilt.
  assert.ok(result.zweifel < result.angekreuzt, `zweifel (${result.zweifel}) muss unter angekreuzt (${result.angekreuzt}) bleiben`);
});

test('computeImageThresholds greift nicht ein, wenn der Rauschsockel unter den Schwellen bleibt', () => {
  const thresholds = { angekreuzt: 0.18, zweifel: 0.06 };
  const fuellgrade = Array.from({ length: 20 }, () => 0.01);
  assert.deepEqual(computeImageThresholds(felderMit(fuellgrade), thresholds, { ringAlignment: true }), thresholds);
});

test('ein Foto ohne erkennbare Ankreuzringe wird abgelehnt statt geraten', async () => {
  // Musterzettel mit Rand auf dunklem Grund (also ein Foto), die Ringe weiss uebermalt.
  const rand = 150, width = muster.width + 2 * rand, height = muster.height + 2 * rand;
  const data = new Uint8ClampedArray(width * height * 4).fill(40);
  for (let y = 0; y < muster.height; y++)
    data.set(muster.data.subarray(y * muster.width * 4, (y + 1) * muster.width * 4), ((y + rand) * width + rand) * 4);
  const r = typ.referenzRadius * 1.6;
  for (const { referenz } of typ.felder)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const i = ((Math.round(referenz.y + rand + dy)) * width + Math.round(referenz.x + rand + dx)) * 4;
        data.fill(255, i, i + 3);
      }
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const foto = kreuzeAn({ width, height, data }, typ, ['E3']);
  await assert.rejects(recognize(foto), /Ankreuzfelder nicht sicher gefunden/);
});

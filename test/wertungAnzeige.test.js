import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stimmRows, summary, isUnambiguous, drawFelder } from '../src/erfassungsplatz/wertungAnzeige.js';
import { loadKalibrierung } from '../src/erfassungsplatz/erkennung/kalibrierung.js';
import { musterZettel, kreuzeAn } from './zettelWerkstatt.js';

const read = file => readFileSync(new URL(`../Wahlen/${file}`, import.meta.url), 'utf8');
const muster = await musterZettel();
const typ = loadKalibrierung(read('bundestagswahl-2017/kalibrierung.json'));
const recognize = image => typ.recognize(image);

test('eindeutiger Zettel wird als Wertung angezeigt', async () => {
  const result = await recognize(kreuzeAn(muster, typ, ['E2', 'Z4']));
  assert.ok(isUnambiguous(result));
  assert.equal(summary(result), 'Erststimme: Jedermann, Jürgen (PARTEI B) | Zweitstimme: PARTEI D');
});

test('Zweifelsfall wird nicht als Wertung ausgegeben', async () => {
  const result = await recognize(kreuzeAn(muster, typ, ['E1', 'Z1', 'Z5']));
  assert.equal(isUnambiguous(result), false);
  assert.match(summary(result), /Wahlvorstand/);
});

test('eine sicher leere Stimme gilt als eindeutig', async () => {
  const result = await recognize(kreuzeAn(muster, typ, ['E3']));
  assert.ok(isUnambiguous(result));
  assert.equal(summary(result), 'Erststimme: Mustermann, Manuel (PARTEI C) | Zweitstimme: Keine Markierung');
});

test('ganz leerer Zettel gilt nicht als eindeutig', async () => {
  assert.equal(isUnambiguous(await recognize(muster)), false);
});

test('Mehrfachmarkierung gilt nicht als eindeutig', async () => {
  assert.equal(isUnambiguous(await recognize(kreuzeAn(muster, typ, ['E1', 'E2', 'Z1']))), false);
});

test('Zeilen nennen Stimme, Wertung und Treffer', async () => {
  const [erst, zweit] = stimmRows(await recognize(kreuzeAn(muster, typ, ['E5'])));
  assert.deepEqual({ title: erst.title, status: erst.status, treffer: erst.treffer },
    { title: 'Erststimme', status: 'gueltig', treffer: ['Musterherr, Manfred (PARTEI E)'] });
  assert.deepEqual({ status: zweit.status, treffer: zweit.treffer }, { status: 'leer', treffer: [] });
});

test('ein Zettel mit nur einer Stimme ergibt genau eine Zeile', () => {
  // Die Stimmen stehen in der Kalibrierung: die BVV-Wahl kennt nur eine.
  const bvv = loadKalibrierung(read('bvv-reinickendorf-2026/kalibrierung.json'));
  const rows = stimmRows({ felder: bvv.felder, stimmen: [{ id: 'stimme', name: 'Stimme', status: 'leer', treffer: [] }] });
  assert.deepEqual(rows.map(row => row.title), ['Stimme']);
});

test('drawFelder malt einen Ring je Feld', async () => {
  const calls = [];
  const context = new Proxy({}, {
    get: (_, name) => (name === 'arc' ? (...args) => calls.push(args) : () => {}),
    set: () => true,
  });
  drawFelder(context, await recognize(muster));
  assert.equal(calls.length, 14);
});

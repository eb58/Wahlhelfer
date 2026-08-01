import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stimmZeilen, summary, istEindeutig, drawFelder } from '../src/wertungAnzeige.js';
import { ladeKalibrierung } from '../src/kalibrierung.js';
import { musterZettel, kreuzeAn } from './zettelWerkstatt.js';

const lies = datei => readFileSync(new URL(`../Kalibrierungen/${datei}`, import.meta.url), 'utf8');
const muster = musterZettel();
const typ = ladeKalibrierung(lies('bundestagswahl-2017-muster.json'));

test('eindeutiger Zettel wird als Wertung angezeigt', () => {
  const ergebnis = typ.recognize(kreuzeAn(muster, typ, ['E2', 'Z4']));
  assert.ok(istEindeutig(ergebnis));
  assert.equal(summary(ergebnis), 'Erststimme: Jedermann, Jürgen (PARTEI B) | Zweitstimme: PARTEI D');
});

test('Zweifelsfall wird nicht als Wertung ausgegeben', () => {
  const ergebnis = typ.recognize(kreuzeAn(muster, typ, ['E1', 'Z1', 'Z5']));
  assert.equal(istEindeutig(ergebnis), false);
  assert.match(summary(ergebnis), /Wahlvorstand/);
});

test('leerer Zettel gilt nicht als eindeutig', () => {
  assert.equal(istEindeutig(typ.recognize(muster)), false);
});

test('Zeilen nennen Stimme, Wertung und Treffer', () => {
  const [erst, zweit] = stimmZeilen(typ.recognize(kreuzeAn(muster, typ, ['E5'])));
  assert.deepEqual({ titel: erst.titel, status: erst.status, treffer: erst.treffer },
    { titel: 'Erststimme', status: 'gueltig', treffer: ['Musterherr, Manfred (PARTEI E)'] });
  assert.deepEqual({ status: zweit.status, treffer: zweit.treffer }, { status: 'leer', treffer: [] });
});

test('ein Zettel mit nur einer Stimme ergibt genau eine Zeile', () => {
  // Die Stimmen stehen in der Kalibrierung: die Europawahl kennt nur eine.
  const europa = ladeKalibrierung(lies('europawahl-sh-2024.json'));
  const zeilen = stimmZeilen({ felder: europa.felder, stimmen: [{ id: 'stimme', name: 'Stimme', status: 'leer', treffer: [] }] });
  assert.deepEqual(zeilen.map(zeile => zeile.titel), ['Stimme']);
});

test('drawFelder malt einen Ring je Feld', () => {
  const calls = [];
  const context = new Proxy({}, {
    get: (_, name) => (name === 'arc' ? (...args) => calls.push(args) : () => {}),
    set: () => true,
  });
  drawFelder(context, typ.recognize(muster));
  assert.equal(calls.length, 14);
});

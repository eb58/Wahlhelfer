import test from 'node:test';
import assert from 'node:assert/strict';
import { stimmZeilen, summary, istEindeutig, drawFelder } from '../src/wertungAnzeige.js';
import { storeTyp, loadTyp, forgetTyp, STORAGE_KEY } from '../src/storage.js';
import { registerWahlzettel } from '../src/wahlzettelTyp.js';
import { musterZettel, kreuzeAn } from './zettelWerkstatt.js';

const muster = musterZettel();
const typ = await registerWahlzettel(muster, { name: 'Anzeigetest' });

test('eindeutiger Zettel wird als Wertung angezeigt', () => {
  const ergebnis = typ.recognize(kreuzeAn(muster, typ, ['E2', 'Z4']));
  assert.ok(istEindeutig(ergebnis));
  assert.equal(summary(ergebnis), 'Erststimme: E2 | Zweitstimme: Z4');
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
  assert.deepEqual({ titel: erst.titel, status: erst.status, treffer: erst.treffer }, { titel: 'Erststimme', status: 'gueltig', treffer: ['E5'] });
  assert.deepEqual({ status: zweit.status, treffer: zweit.treffer }, { status: 'leer', treffer: [] });
});

test('Beschriftung ersetzt die Feld-ID, wenn vorhanden', () => {
  const ergebnis = typ.recognize(kreuzeAn(muster, typ, ['Z3']));
  const beschriftet = { ...ergebnis, felder: ergebnis.felder.map(f => (f.id === 'Z3' ? { ...f, beschriftung: 'PARTEI C' } : f)) };
  assert.deepEqual(stimmZeilen(beschriftet)[1].treffer, ['PARTEI C']);
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

/* --- Ablage ------------------------------------------------------------- */

const fakeStorage = () => {
  const content = new Map();
  return {
    getItem: key => content.get(key) ?? null,
    setItem: (key, value) => content.set(key, value),
    removeItem: key => content.delete(key),
  };
};

test('gespeicherter Typ kommt als Erkenner zurueck', () => {
  const storage = fakeStorage();
  storeTyp(typ, storage);
  const geladen = loadTyp(storage);
  assert.equal(geladen.name, 'Anzeigetest');
  assert.deepEqual(geladen.recognize(muster).erststimme, { treffer: [], status: 'leer' });
});

test('ohne Eintrag gibt es keinen Typ', () => {
  assert.equal(loadTyp(fakeStorage()), undefined);
});

test('unlesbarer Eintrag blockiert die Anwendung nicht', () => {
  const storage = fakeStorage();
  storage.setItem(STORAGE_KEY, '{kein json');
  assert.equal(loadTyp(storage), undefined);
  assert.equal(storage.getItem(STORAGE_KEY), null, 'kaputter Eintrag wird entfernt');
});

test('forgetTyp entfernt den Eintrag', () => {
  const storage = fakeStorage();
  storeTyp(typ, storage);
  forgetTyp(storage);
  assert.equal(loadTyp(storage), undefined);
});

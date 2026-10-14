import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getWahllokalStatus, selectWahllokale } from '../src/wahllokalAnzeige.js';

test('Wahllokale ohne Eingang und laufende Erfassung sind unterscheidbar', () => {
  assert.equal(getWahllokalStatus({ zettel: 0, erwartet: 500, prueffaelle: 0 }), 'Noch nicht begonnen');
  assert.equal(getWahllokalStatus({ zettel: 100, erwartet: 500, prueffaelle: 2 }), 'Erfassung läuft');
});

test('Erreichte Sollzahl mit offenen Prüffällen gilt nicht als abschließend freigegeben', () => {
  assert.equal(getWahllokalStatus({ zettel: 500, erwartet: 500, prueffaelle: 20 }), 'Erfasst – Prüffälle offen');
  assert.equal(getWahllokalStatus({ zettel: 500, erwartet: 500, prueffaelle: 0 }), 'Erfasst');
  assert.equal(getWahllokalStatus({ zettel: 501, erwartet: 500, prueffaelle: 0 }), 'Über Soll – prüfen');
});

test('Die Wahllokalliste steht vor Gesamtergebnis und Registrierung', () => {
  const html = readFileSync(new URL('../ergebnisse.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('id="wahllokalListe"') < html.indexOf('id="gesamt"'));
  assert.ok(html.indexOf('id="wahllokalListe"') < html.indexOf('id="wahllokalForm"'));
});

test('Bezirksansicht enthält auch Wahllokale ohne Stapel; Wahllokalansicht zeigt genau das gewählte Wahllokal', () => {
  const wahllokale = [{ nummer: '518', zettel: 500 }, { nummer: '519', zettel: 0 }];
  assert.deepEqual(selectWahllokale(wahllokale, null), wahllokale);
  assert.deepEqual(selectWahllokale(wahllokale, '519'), [wahllokale[1]]);
  assert.throws(() => selectWahllokale(wahllokale, '520'), /nicht registriert/);
});

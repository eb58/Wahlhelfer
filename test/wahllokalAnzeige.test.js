import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getWahllokalStatus } from '../shared/wahllokalAnzeige.js';
import { getFortschritt, selectWahllokale } from '../erfassungsplatz/wahllokal.js';

const readPage = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('Wahllokale ohne Eingang und laufende Erfassung sind unterscheidbar', () => {
  assert.equal(getWahllokalStatus({ zettel: 0, erwartet: 500, prueffaelle: 0 }), 'Noch nicht begonnen');
  assert.equal(getWahllokalStatus({ zettel: 100, erwartet: 500, prueffaelle: 2 }), 'Erfassung läuft');
});

test('Erreichte Sollzahl mit offenen Prüffällen gilt nicht als abschließend freigegeben', () => {
  assert.equal(getWahllokalStatus({ zettel: 500, erwartet: 500, prueffaelle: 20 }), 'Erfasst – Prüffälle offen');
  assert.equal(getWahllokalStatus({ zettel: 500, erwartet: 500, prueffaelle: 0 }), 'Erfasst');
  assert.equal(getWahllokalStatus({ zettel: 501, erwartet: 500, prueffaelle: 0 }), 'Über Soll – prüfen');
});

test('Monitor am Erfassungsplatz nennt Zettel, Stapel und Prüffälle', () => {
  assert.equal(getFortschritt({ zettel: 40, erwartet: 500, stapel: 2, prueffaelle: 3 }), '40 von 500 Stimmzetteln · 2 Stapel · 3 Zettel mit Prüfbedarf');
});

test('Erfassungsplatz und ControlCenter liegen getrennt und verweisen nicht aufeinander', () => {
  for (const page of ['index.html', 'erfassungsplatz/index.html']) assert.doesNotMatch(readPage(page), /controlcenter/i);
  assert.doesNotMatch(readPage('controlcenter/index.html'), /erfassungsplatz/i);
  assert.match(readPage('erfassungsplatz/index.html'), /id="monitor"/);
  assert.match(readPage('index.html'), /url=erfassungsplatz\//);
});

test('Ohne ?wahllokal= bleiben alle Wahllokale wählbar, sonst genau das gewählte', () => {
  const wahllokale = [{ nummer: '518', zettel: 500 }, { nummer: '519', zettel: 0 }];
  assert.deepEqual(selectWahllokale(wahllokale, null), wahllokale);
  assert.deepEqual(selectWahllokale(wahllokale, '519'), [wahllokale[1]]);
  assert.throws(() => selectWahllokale(wahllokale, '520'), /nicht registriert/);
});

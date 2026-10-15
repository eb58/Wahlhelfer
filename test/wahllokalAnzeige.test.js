import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getWahllokalStatus } from '../src/api/wahllokalAnzeige.js';
import { findWahllokal, getFortschritt } from '../src/erfassungsplatz/wahllokal.js';

const readPage = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('Wahllokale ohne Eingang und laufende Erfassung sind unterscheidbar', () => {
  assert.equal(getWahllokalStatus({ zettel: 0, erwartet: null, prueffaelle: 0 }), 'Stimmzettelzahl noch nicht gemeldet');
  assert.equal(getWahllokalStatus({ zettel: 0, erwartet: 500, prueffaelle: 0 }), 'Noch nicht begonnen');
  assert.equal(getWahllokalStatus({ zettel: 100, erwartet: 500, prueffaelle: 2 }), 'Erfassung läuft');
});

test('Erreichte Sollzahl mit offenen Prüffällen gilt nicht als abschließend freigegeben', () => {
  assert.equal(getWahllokalStatus({ zettel: 500, erwartet: 500, prueffaelle: 20 }), 'Erfasst – Prüffälle offen');
  assert.equal(getWahllokalStatus({ zettel: 500, erwartet: 500, prueffaelle: 0 }), 'Erfasst');
  assert.equal(getWahllokalStatus({ zettel: 501, erwartet: 500, prueffaelle: 0 }), 'Über Soll – prüfen');
});

test('Monitor am Erfassungsplatz nennt Zettel, Stapel und Prüffälle', () => {
  assert.equal(getFortschritt({ zettel: 0, erwartet: null, stapel: 0, prueffaelle: 0 }), '0 Stimmzettel · 0 Stapel · 0 Zettel mit Prüfbedarf');
  assert.equal(getFortschritt({ zettel: 40, erwartet: 500, stapel: 2, prueffaelle: 3 }), '40 von 500 Stimmzetteln · 2 Stapel · 3 Zettel mit Prüfbedarf');
});

test('Erfassungsplatz und ControlCenter liegen getrennt und verweisen nicht aufeinander', () => {
  assert.doesNotMatch(readPage('erfassungsplatz/index.html'), /controlcenter/i);
  assert.doesNotMatch(readPage('controlcenter/index.html'), /erfassungsplatz/i);
  assert.match(readPage('erfassungsplatz/index.html'), /id="monitor"/);
});

test('Das Wahllokal kommt aus dem Link; ohne oder mit fremder Nummer wird nicht erfasst', () => {
  const wahllokale = [{ nummer: '518', zettel: 500 }, { nummer: '519', zettel: 0 }];
  assert.equal(findWahllokal(wahllokale, '519'), wahllokale[1]);
  assert.throws(() => findWahllokal(wahllokale, null), /Im Link fehlt das Wahllokal/);
  assert.throws(() => findWahllokal(wahllokale, '520'), /nicht registriert oder für dieses Konto nicht freigegeben/);
});

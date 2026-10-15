import test from 'node:test';
import assert from 'node:assert/strict';
import { findEncodingProblem, isTextFile } from '../scripts/pruefeTextkodierung.js';

const utf8 = text => Buffer.from(text, 'utf8');

test('sauberes UTF-8 mit Umlauten ist in Ordnung', () => {
  assert.equal(findEncodingProblem(utf8('Stimmzettel für die Wahl – Größe ß € ✓')), undefined);
});

test('Latin-1-Bytes sind kein gueltiges UTF-8', () => {
  assert.equal(findEncodingProblem(Buffer.from('f\xfcr', 'latin1')), 'kein gueltiges UTF-8');
});

test('doppelt kodierte Umlaute werden mit Zeile gemeldet', () => {
  const mojibake = Buffer.from(utf8('Zeile eins\nfür').toString('latin1'), 'utf8');
  assert.equal(findEncodingProblem(mojibake), 'Mojibake in Zeile 2: "\u00c3\u00bc"');
  assert.match(findEncodingProblem(utf8('\u00e2\u20ac\u201c Gedankenstrich')), /Mojibake/);
  assert.match(findEncodingProblem(utf8('kaputt \uFFFD')), /Mojibake/);
});

test('nur Textdateien werden geprueft', () => {
  assert.ok(isTextFile('erfassungsplatz/main.js'));
  assert.ok(isTextFile('server/schema.sql'));
  assert.ok(!isTextFile('Testdaten/bundestagswahl-2017/musterzettel.png'));
});

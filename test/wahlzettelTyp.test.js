import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWahlzettel, fromJson, beschreibe } from '../src/wahlzettelTyp.js';
import { musterZettel } from './zettelWerkstatt.js';

const typ = await registerWahlzettel(musterZettel(), { name: 'Bundestagswahl 2017 Muster' });

test('registriert beide Stimmenspalten aus dem Musterzettel', () => {
  assert.equal(typ.felder.filter(f => f.stimme === 'erststimme').length, 7);
  assert.equal(typ.felder.filter(f => f.stimme === 'zweitstimme').length, 7);
});

test('Felder sind je Spalte von oben nach unten nummeriert', () => {
  const erst = typ.felder.filter(f => f.stimme === 'erststimme');
  assert.deepEqual(erst.map(f => f.id), ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7']);
  assert.ok(erst.every((f, i) => i === 0 || f.y > erst[i - 1].y), 'y-Lagen muessen aufsteigen');
});

test('Zweitstimme liegt rechts von der Erststimme', () => {
  const mittel = stimme => typ.felder.filter(f => f.stimme === stimme).reduce((s, f) => s + f.x, 0) / 7;
  assert.ok(mittel('zweitstimme') > mittel('erststimme'));
});

test('leere Felder haben keinen Fuellgrad', () => {
  assert.ok(typ.felder.every(f => f.leerFuellgrad < 0.02), 'Musterzettel darf keine Markierung enthalten');
});

test('Kopfzeilen-Symbole gelten nicht als Ankreuzfeld', () => {
  assert.ok(typ.felder.every(f => f.y > -0.1), 'Kreise oberhalb der Tabelle muessen verworfen werden');
});

test('durchsichtige Bildbereiche zaehlen als Papier, nicht als Druck', async () => {
  // Canvas liefert transparente Pixel als Schwarz. Wuerde das als Druck gelten,
  // fande die Rahmensuche Linien am Bildrand und das Kopfzeilen-Symbol wuerde zum Feld.
  const image = musterZettel();
  for (let i = 0; i < 40 * image.width; i++) {
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = 0;
    image.data[i * 4 + 3] = 0;
  }
  const durchsichtig = await registerWahlzettel(image);
  assert.equal(durchsichtig.felder.length, 14);
});

test('Typ ueberlebt Speichern und Laden', () => {
  const geladen = fromJson(typ.toJson());
  assert.deepEqual(geladen.felder, typ.felder);
  assert.equal(geladen.name, typ.name);
  assert.equal(typeof geladen.recognize, 'function');
});

test('fromJson weist fremde Versionen zurueck', () => {
  assert.throws(() => fromJson(JSON.stringify({ version: 99, felder: [] })), /Version/);
});

test('beschreibe fasst den Typ fuer das Admin-Modul zusammen', () => {
  const kurz = beschreibe(typ);
  assert.equal(kurz.felder, 14);
  assert.deepEqual(kurz.stimmen.map(s => s.stimme), ['erststimme', 'zweitstimme']);
});

test('ohne erkennbaren Zettel schlaegt die Registrierung fehl', async () => {
  const leer = { width: 40, height: 40, data: new Uint8ClampedArray(40 * 40 * 4).fill(255) };
  await assert.rejects(() => registerWahlzettel(leer), /rahmen|Ankreuzfelder/i);
});

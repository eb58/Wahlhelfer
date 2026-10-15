import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStapel, addZettel, saveStapel } from '../src/erfassungsplatz/stapel.js';
import { getWahlDefinition } from '../src/erfassungsplatz/wahl.js';
import { sha256 } from '../src/api/serverApi.js';

const kalibrierung = name => JSON.parse(readFileSync(new URL(`../Kalibrierungen/${name}.json`, import.meta.url), 'utf8'));
const wahlHash = name => sha256(new TextEncoder().encode(JSON.stringify(getWahlDefinition(kalibrierung(name)))));

test('Der Wahl-Hash des Browsers entspricht dem der PHP-API', async () => {
  // Dieselben Werte prueft test/php/WahlTest.php fuer getWahlDefinition() aus server/lib.php.
  assert.equal(await wahlHash('bundestagswahl-2017'), 'ec7521371a58afa0d5c2224474793391bec2643aea9ecbe3f350a93bbc57e4c5');
  assert.equal(await wahlHash('europawahl-sh-2024'), 'e5a1e30c74deded4ddabea95ae317d42ed8d047352d877a35a0e54a608f72c77');
});

test('Die Wahl-Definition enthält nur Namen, Auswahlzahlen und Wahlvorschläge', () => {
  const definition = getWahlDefinition(kalibrierung('bundestagswahl-2017'));
  assert.deepEqual(Object.keys(definition), ['name', 'stimmen']);
  assert.deepEqual(Object.keys(definition.stimmen[0]), ['id', 'name', 'auswahl', 'wahlvorschlaege']);
  assert.deepEqual(Object.keys(definition.stimmen[0].wahlvorschlaege[0]), ['id', 'nummer', 'beschriftung']);
});

test('Stapelmodell begrenzt Sollzahl und gibt Speicherfehler weiter', () => {
  assert.throws(() => createStapel('lokal', 0, 'hash', 'typ'), /Stapelgröße/);
  const stapel = createStapel('lokal', 1, 'hash', 'typ');
  const filled = addZettel(stapel, { stimmen: [{ id: 'stimme', status: 'leer', treffer: [] }] });
  assert.equal(stapel.zettel.length, 0);
  assert.equal(filled.zettel.length, 1);
  assert.throws(() => addZettel(filled, { stimmen: [] }), /vollständig/);
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  saveStapel(storage, filled);
  assert.equal(JSON.parse(values.get('wahlassistent-stapel')).id, filled.id);
  saveStapel(storage, undefined);
  assert.equal(values.size, 0);
  assert.throws(() => saveStapel({ setItem: () => { throw new Error('voll'); } }, filled), /voll/);
  const measured = addZettel(stapel, { stimmen: [], felder: [{ id: 'E1', stimme: 'erststimme', fuellgrad: 0.3, status: 'angekreuzt', x: 15 }] });
  assert.equal('felder' in measured.zettel[0], false);
  assert.equal('kalibrierung' in measured, false);
});

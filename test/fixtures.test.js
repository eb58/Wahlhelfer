import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadKalibrierung } from '../src/kalibrierung.js';
import { readPng } from '../src/png.js';

const fixtureFolder = new URL('../Testdaten/bundestagswahl-2017/scans/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixtureFolder), 'utf8'));
const typ = loadKalibrierung(readFileSync(new URL('../Kalibrierungen/bundestagswahl-2017.json', import.meta.url), 'utf8'));
const pngFiles = readdirSync(fixtureFolder).filter(datei => datei.endsWith('.png')).sort();
const sorted = values => [...values].sort();

const status = (result, id) => result.felder.find(feld => feld.id === id)?.status;
const expectedStimmStatus = (stimme, markierungen) => {
  const count = markierungen.filter(id => typ.felder.find(feld => feld.id === id)?.stimme === stimme.id).length;
  return count > stimme.auswahl ? 'mehrfach' : count === stimme.auswahl ? 'gueltig' : 'leer';
};

test('Manifest und Fixture-Ordner enthalten dieselben 100 Fälle', () => {
  assert.equal(manifest.anzahl, 100);
  assert.equal(manifest.faelle.length, manifest.anzahl);
  assert.deepEqual(pngFiles, sorted(manifest.faelle.map(testCase => testCase.datei)));
});

for (const testCase of manifest.faelle) {
  test(`Fixture ${testCase.datei} entspricht dem Manifest`, async () => {
    const image = readPng(readFileSync(new URL(testCase.datei, fixtureFolder)));
    const expected = sorted(testCase.markierungen);
    const category = testCase.kategorie.split('-')[0];
    let result;

    try {
      result = await typ.recognize(image, { textjustierung: false });
    } catch (error) {
      assert.ok(['beschnitten', 'gedreht'].includes(category),
        `${testCase.datei} darf nicht an der Rahmensuche scheitern: ${error.message}`);
      assert.match(error.message, /Zettelrahmen/);
      return;
    }

    const nonEmpty = sorted(result.felder.filter(feld => feld.status !== 'leer').map(feld => feld.id));
    assert.deepEqual(nonEmpty, expected, 'abweichende markierte Felder');

    if (category !== 'qualitaet') {
      assert.deepEqual(sorted(result.felder.filter(feld => feld.status === 'angekreuzt').map(feld => feld.id)), expected,
        'abweichende sicher erkannte Felder');
      for (const stimme of result.stimmen)
        assert.equal(stimme.status, expectedStimmStatus(stimme, testCase.markierungen), `${stimme.id} hat den falschen Status`);
    } else {
      assert.ok(result.felder.filter(feld => feld.status === 'unklar').every(feld => expected.includes(feld.id)),
        'unklare Markierung außerhalb der erwarteten Felder');
    }
  });
}

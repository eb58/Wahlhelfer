import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ladeKalibrierung } from '../src/kalibrierung.js';
import { readPng } from '../src/png.js';

const fixtureOrdner = new URL('../Testdaten/fixtures/wahlzettel1/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixtureOrdner), 'utf8'));
const typ = ladeKalibrierung(readFileSync(new URL('../Kalibrierungen/bundestagswahl-2017-muster.json', import.meta.url), 'utf8'));
const pngDateien = readdirSync(fixtureOrdner).filter(datei => datei.endsWith('.png')).sort();
const sortiert = werte => [...werte].sort();

const status = (ergebnis, id) => ergebnis.felder.find(feld => feld.id === id)?.status;
const erwarteterStimmenstatus = (stimme, markierungen) => {
  const anzahl = markierungen.filter(id => typ.felder.find(feld => feld.id === id)?.stimme === stimme.id).length;
  return anzahl > stimme.auswahl ? 'mehrfach' : anzahl === stimme.auswahl ? 'gueltig' : 'leer';
};

test('Manifest und Fixture-Ordner enthalten dieselben 100 Fälle', () => {
  assert.equal(manifest.anzahl, 100);
  assert.equal(manifest.faelle.length, manifest.anzahl);
  assert.deepEqual(pngDateien, sortiert(manifest.faelle.map(fall => fall.datei)));
});

for (const fall of manifest.faelle) {
  test(`Fixture ${fall.datei} entspricht dem Manifest`, async () => {
    const image = readPng(readFileSync(new URL(fall.datei, fixtureOrdner)));
    const erwartete = sortiert(fall.markierungen);
    const kategorie = fall.kategorie.split('-')[0];
    let ergebnis;

    try {
      ergebnis = await typ.recognize(image, { textjustierung: false });
    } catch (fehler) {
      assert.ok(['beschnitten', 'gedreht'].includes(kategorie),
        `${fall.datei} darf nicht an der Rahmensuche scheitern: ${fehler.message}`);
      assert.match(fehler.message, /Zettelrahmen/);
      return;
    }

    const nichtLeere = sortiert(ergebnis.felder.filter(feld => feld.status !== 'leer').map(feld => feld.id));
    assert.deepEqual(nichtLeere, erwartete, 'abweichende markierte Felder');

    if (kategorie !== 'qualitaet') {
      assert.deepEqual(sortiert(ergebnis.felder.filter(feld => feld.status === 'angekreuzt').map(feld => feld.id)), erwartete,
        'abweichende sicher erkannte Felder');
      for (const stimme of ergebnis.stimmen)
        assert.equal(stimme.status, erwarteterStimmenstatus(stimme, fall.markierungen), `${stimme.id} hat den falschen Status`);
    } else {
      assert.ok(ergebnis.felder.filter(feld => feld.status === 'unklar').every(feld => erwartete.includes(feld.id)),
        'unklare Markierung außerhalb der erwarteten Felder');
    }
  });
}

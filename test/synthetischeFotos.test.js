import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadKalibrierung } from '../src/kalibrierung.js';
import { readJpeg } from './fotoWerkstatt.js';

// Erzeugt mit scripts/erzeugeSynthetischeFotos.js: je Zettelart drei Lagen (gerade, schraeg, gedreht).
const folder = new URL('../Testdaten/fixtures/synthetische_fotos/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8'));
const sorted = values => [...values].sort();
const ohneOcr = async () => { throw new Error('Synthetische Fotos muessen ueber die Ankreuzringe erkannt werden'); };

test('Manifest der synthetischen Fotos ist vollstaendig', () => {
  const files = readdirSync(folder).filter(datei => datei.endsWith('.jpg'));
  assert.equal(manifest.faelle.length, manifest.anzahl);
  assert.deepEqual(sorted(files), sorted(manifest.faelle.map(fall => fall.datei)));
});

for (const fall of manifest.faelle) {
  test(`${fall.datei} wird ohne OCR wie im Manifest gewertet`, async () => {
    const typ = loadKalibrierung(readFileSync(new URL(`../Kalibrierungen/${fall.kalibrierung}`, import.meta.url), 'utf8'));
    const result = await typ.recognize(readJpeg(readFileSync(new URL(fall.datei, folder))), { ocr: ohneOcr });
    const markiert = result.felder.filter(feld => feld.status !== 'leer');
    assert.deepEqual(sorted(markiert.map(feld => feld.id)), sorted(fall.markierungen));
    assert.ok(markiert.every(feld => feld.status === 'angekreuzt'));
  });
}

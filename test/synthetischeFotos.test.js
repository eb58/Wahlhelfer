import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { loadKalibrierung } from '../erfassungsplatz/erkennung/kalibrierung.js';
import { readFoto } from './fotoWerkstatt.js';

// Erzeugt mit scripts/erzeugeSynthetischeFotos.js: je Zettelart drei Lagen (gerade, schraeg, gedreht)
// unter Testdaten/<kalibrierung>/synthetisch/.
const sorted = values => [...values].sort();
const ohneOcr = async () => { throw new Error('Synthetische Fotos muessen ueber die Ankreuzringe erkannt werden'); };
const kalibrierungen = readdirSync(new URL('../Kalibrierungen/', import.meta.url)).filter(datei => datei.endsWith('.json'));

for (const kalibrierung of kalibrierungen) {
  const folder = new URL(`../Testdaten/${kalibrierung.replace('.json', '')}/synthetisch/`, import.meta.url);

  test(`${kalibrierung}: synthetische Fotos sind vollstaendig`, () => {
    assert.ok(existsSync(new URL('manifest.json', folder)), 'node scripts/erzeugeSynthetischeFotos.js ausfuehren');
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8'));
    assert.equal(manifest.kalibrierung, kalibrierung);
    assert.equal(manifest.faelle.length, manifest.anzahl);
    assert.deepEqual(sorted(readdirSync(folder).filter(datei => datei.endsWith('.jpg'))), sorted(manifest.faelle.map(fall => fall.datei)));
  });
  if (!existsSync(new URL('manifest.json', folder))) continue;

  const typ = loadKalibrierung(readFileSync(new URL(`../Kalibrierungen/${kalibrierung}`, import.meta.url), 'utf8'));
  for (const fall of JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8')).faelle) {
    test(`${kalibrierung}: ${fall.datei} wird ohne OCR wie im Manifest gewertet`, async () => {
      const result = await typ.recognize(await readFoto(readFileSync(new URL(fall.datei, folder))), { ocr: ohneOcr });
      const markiert = result.felder.filter(feld => feld.status !== 'leer');
      assert.deepEqual(sorted(markiert.map(feld => feld.id)), sorted(fall.markierungen));
      assert.ok(markiert.every(feld => feld.status === 'angekreuzt'));
    });
  }
}

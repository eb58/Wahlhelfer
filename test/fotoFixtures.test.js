import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ladeKalibrierung } from '../src/kalibrierung.js';
import { readJpeg, begrenzeBreite } from './fotoWerkstatt.js';
import { createFotoOcr } from './fotoOcr.js';

const fixtureOrdner = new URL('../Testdaten/fixtures/wahlzettel1_fotos/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixtureOrdner), 'utf8'));
const typ = ladeKalibrierung(readFileSync(new URL('../Kalibrierungen/bundestagswahl-2017-muster.json', import.meta.url), 'utf8'));
const sortiert = werte => [...werte].sort();

test('Foto-Manifest enthaelt alle 20 JPEG-Aufnahmen', () => {
  const dateien = readdirSync(fixtureOrdner).filter(datei => datei.endsWith('.jpg')).sort();
  assert.equal(manifest.anzahl, 20);
  assert.equal(manifest.faelle.length, manifest.anzahl);
  assert.deepEqual(dateien, sortiert(manifest.faelle.map(fall => fall.datei)));
});

test('alle Smartphone-Fotos werden wie im Manifest gewertet', async () => {
  const ocr = await createFotoOcr(fileURLToPath(new URL('../', import.meta.url)));
  try {
    for (const fall of manifest.faelle) {
      const image = begrenzeBreite(readJpeg(readFileSync(new URL(fall.datei, fixtureOrdner))));
      const ergebnis = await typ.recognize(image, { ocr: ocr.erkenneWoerter });
      const erkannt = sortiert(ergebnis.felder.filter(feld => feld.status !== 'leer').map(feld => feld.id));
      assert.deepEqual(erkannt, sortiert(fall.markierungen), fall.datei);
      assert.ok(ergebnis.felder.filter(feld => feld.status !== 'leer').every(feld => feld.status === 'angekreuzt'), fall.datei);
    }
  } finally {
    await ocr.terminate();
  }
});

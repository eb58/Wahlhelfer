import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ladeKalibrierung } from '../src/kalibrierung.js';
import { readJpeg, begrenzeBreite } from './fotoWerkstatt.js';
import { createFotoOcr } from './fotoOcr.js';

const fixtureOrdner = new URL('../Testdaten/fixtures/wahlzettel1_fotos/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixtureOrdner), 'utf8'));
const fixtureOrdner2 = new URL('../Testdaten/fixtures/wahlzettel2_fotos/', import.meta.url);
const manifest2 = JSON.parse(readFileSync(new URL('manifest.json', fixtureOrdner2), 'utf8'));
const typ = ladeKalibrierung(readFileSync(new URL('../Kalibrierungen/bundestagswahl-2017-muster.json', import.meta.url), 'utf8'));
const sortiert = werte => [...werte].sort();

const pruefeManifest = (fixtureOrdner, manifest, anzahl) => {
  const dateien = readdirSync(fixtureOrdner).filter(datei => datei.endsWith('.jpg')).sort();
  assert.equal(manifest.anzahl, anzahl);
  assert.equal(manifest.faelle.length, manifest.anzahl);
  assert.deepEqual(dateien, sortiert(manifest.faelle.map(fall => fall.datei)));
};

test('Foto-Manifest 1 enthaelt alle 20 JPEG-Aufnahmen', () => pruefeManifest(fixtureOrdner, manifest, 20));
test('Foto-Manifest 2 enthaelt alle 33 JPEG-Aufnahmen', () => pruefeManifest(fixtureOrdner2, manifest2, 33));

const pruefeFotos = async (t, fixtureOrdner, manifest) => {
  const ocr = await createFotoOcr(fileURLToPath(new URL('../', import.meta.url)));
  try {
    for (const fall of manifest.faelle) {
      await t.test(fall.datei, async () => {
        const image = begrenzeBreite(readJpeg(readFileSync(new URL(fall.datei, fixtureOrdner))));
        const ergebnis = await typ.recognize(image, { ocr: ocr.erkenneWoerter });
        const erkannt = sortiert(ergebnis.felder.filter(feld => feld.status !== 'leer').map(feld => feld.id));
        assert.deepEqual(erkannt, sortiert(fall.markierungen));
        assert.ok(ergebnis.felder.filter(feld => feld.status !== 'leer').every(feld => feld.status === 'angekreuzt'));
      });
    }
  } finally {
    await ocr.terminate();
  }
};

test('alle Smartphone-Fotos aus Serie 1 werden wie im Manifest gewertet', t => pruefeFotos(t, fixtureOrdner, manifest));

test('alle Smartphone-Fotos aus Serie 2 werden wie im Manifest gewertet', t => pruefeFotos(t, fixtureOrdner2, manifest2));

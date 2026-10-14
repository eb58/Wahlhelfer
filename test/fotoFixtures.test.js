import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadKalibrierung } from '../src/erkennung/kalibrierung.js';
import { readFoto } from './fotoWerkstatt.js';
import { createFotoOcr } from './fotoOcr.js';

const fixtureFolder = new URL('../Testdaten/bundestagswahl-2017/fotos-serie1/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixtureFolder), 'utf8'));
const fixtureFolder2 = new URL('../Testdaten/bundestagswahl-2017/fotos-serie2/', import.meta.url);
const manifest2 = JSON.parse(readFileSync(new URL('manifest.json', fixtureFolder2), 'utf8'));
const typ = loadKalibrierung(readFileSync(new URL('../Kalibrierungen/bundestagswahl-2017.json', import.meta.url), 'utf8'));
const sorted = values => [...values].sort();

const checkManifest = (fixtureFolder, manifest, anzahl) => {
  const files = readdirSync(fixtureFolder).filter(datei => datei.endsWith('.jpg')).sort();
  assert.equal(manifest.anzahl, anzahl);
  assert.equal(manifest.faelle.length, manifest.anzahl);
  assert.deepEqual(files, sorted(manifest.faelle.map(testCase => testCase.datei)));
};

test('Foto-Manifest 1 enthaelt alle 20 JPEG-Aufnahmen', () => checkManifest(fixtureFolder, manifest, 20));
test('Foto-Manifest 2 enthaelt alle 33 JPEG-Aufnahmen', () => checkManifest(fixtureFolder2, manifest2, 33));

const checkPhotos = async (t, fixtureFolder, manifest) => {
  const ocr = await createFotoOcr(fileURLToPath(new URL('../', import.meta.url)));
  try {
    for (const testCase of manifest.faelle) {
      await t.test(testCase.datei, async () => {
        const image = await readFoto(readFileSync(new URL(testCase.datei, fixtureFolder)));
        const result = await typ.recognize(image, { ocr: ocr.recognizeWords });
        const found = sorted(result.felder.filter(feld => feld.status !== 'leer').map(feld => feld.id));
        assert.deepEqual(found, sorted(testCase.markierungen));
        assert.ok(result.felder.filter(feld => feld.status !== 'leer').every(feld => feld.status === 'angekreuzt'));
      });
    }
  } finally {
    await ocr.terminate();
  }
};

test('alle Smartphone-Fotos aus Serie 1 werden wie im Manifest gewertet', t => checkPhotos(t, fixtureFolder, manifest));

test('alle Smartphone-Fotos aus Serie 2 werden wie im Manifest gewertet', t => checkPhotos(t, fixtureFolder2, manifest2));

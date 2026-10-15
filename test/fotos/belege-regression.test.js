import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadKalibrierung } from '../../src/erfassungsplatz/erkennung/kalibrierung.js';
import { readImage } from '../fotoWerkstatt.js';

const folder = new URL('../../Testdaten/bundestagswahl-2017/belege-regression/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8'));
const typ = loadKalibrierung(readFileSync(new URL('../../Kalibrierungen/bundestagswahl-2017.json', import.meta.url), 'utf8'));

for (const fall of manifest.faelle) test(`Gespeicherter Beleg: ${fall.datei}`, async () => {
  const bytes = readFileSync(new URL(fall.datei, folder));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), fall.sha256);
  // Bereits gespeicherte Belege direkt dekodieren, nicht erneut verkleinern oder als JPEG kodieren.
  const result = await typ.recognize(await readImage(bytes));
  assert.deepEqual(result.felder.filter(feld => feld.status !== 'leer').map(feld => feld.id).sort(), [...fall.markierungen].sort());
  assert.ok(result.stimmen.every(stimme => stimme.status === 'gueltig'));
});

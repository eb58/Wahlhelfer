/**
 * Gedreht aufgenommene Zettel: quer wird aufgerichtet, kopfueber abgelehnt. Kopfueber liegen beim
 * Bundestagszettel viele Ringe fast symmetrisch auf anderen - ohne Pruefung jedes Feldrings wurde
 * so frueher ohne Meldung falsch gewertet. Das echte quer gespeicherte Foto steht in fotos-serie3.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadKalibrierung } from '../../src/erfassungsplatz/erkennung/kalibrierung.js';
import { rotateImage } from '../../src/erfassungsplatz/erkennung/image.js';
import { readFoto } from '../fotoWerkstatt.js';

const typ = loadKalibrierung(readFileSync(new URL('../../Kalibrierungen/bundestagswahl-2017.json', import.meta.url), 'utf8'));
// E1 + Z4
const foto = readFoto(readFileSync(new URL('../../Testdaten/bundestagswahl-2017/fotos-serie1/PXL_20260803_190650402.jpg', import.meta.url)));

test('ein um 270 Grad gedrehtes Foto wird aufgerichtet und richtig gewertet', async () => {
  const result = await typ.recognize(rotateImage(await foto, 3));
  assert.equal(result.rotation, 1);
  assert.deepEqual(result.felder.filter(feld => feld.status !== 'leer').map(feld => feld.id), ['E1', 'Z4']);
});

test('ein kopfueber liegendes Foto wird abgelehnt statt falsch gewertet', async () => {
  await assert.rejects(typ.recognize(rotateImage(await foto, 2)), /nicht sicher gefunden/);
});

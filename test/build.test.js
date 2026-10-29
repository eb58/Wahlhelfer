import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { getWahlAssets } from '../vite.config.js';

test('der Build liefert je Wahl nur Kalibrierung und Gebiet aus, keine Testdaten', () => {
  const wahlen = readdirSync(new URL('../Wahlen/', import.meta.url));
  assert.deepEqual(getWahlAssets().sort(), wahlen.flatMap(wahl => [`${wahl}/gebiet.json`, `${wahl}/kalibrierung.json`]).sort());
});

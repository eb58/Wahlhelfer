import test from 'node:test';
import assert from 'node:assert/strict';
import { belegSize } from '../src/erfassungsplatz/browserImage.js';

test('belegSize begrenzt bei Hochkant-Fotos die Breite', () => {
  assert.deepEqual(belegSize(2268, 4032), { width: 1600, height: 2844 });
  // Langer Zettel (Europawahl): die Breite bleibt, die Hoehe wird nicht auf 1600 gedrueckt.
  assert.deepEqual(belegSize(2000, 8000), { width: 1600, height: 6400 });
});

test('belegSize laesst quer gespeicherte Fotos gross genug zum Aufrichten', () => {
  assert.deepEqual(belegSize(4032, 2268), { width: 2844, height: 1600 });
});

test('belegSize vergroessert nie', () => {
  assert.deepEqual(belegSize(800, 1200), { width: 800, height: 1200 });
});

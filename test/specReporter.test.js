import test from 'node:test';
import assert from 'node:assert/strict';
import { rundeZeiten } from './tools/specReporter.mjs';

test('rundeZeiten zeigt ganze Millisekunden', () => {
  assert.equal(rundeZeiten('✔ Fixture 056-mehrfach-056.png entspricht dem Manifest (63.4847ms)\n'), '✔ Fixture 056-mehrfach-056.png entspricht dem Manifest (63 ms)\n');
  assert.equal(rundeZeiten('✖ scheitert (12ms)'), '✖ scheitert (12 ms)');
  assert.equal(rundeZeiten('✔ knapp (63.9ms)'), '✔ knapp (64 ms)');
  assert.equal(rundeZeiten('ℹ duration_ms 8564.3552'), 'ℹ duration_ms 8564');
  assert.equal(rundeZeiten('Wert (0.5 mm) bleibt'), 'Wert (0.5 mm) bleibt');
});

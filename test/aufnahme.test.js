import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('Aufnahme-Knopf ist fuer die rueckseitige Kamera eingerichtet', () => {
  assert.match(html, /id="erfassenEingabe"[^>]*accept="image\/\*"[^>]*capture="environment"/);
  assert.match(html, /id="dateiEingabe"[^>]*accept="image\/\*,application\/pdf"/);
});

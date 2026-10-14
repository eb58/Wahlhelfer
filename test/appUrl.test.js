import test from 'node:test';
import assert from 'node:assert/strict';
import { appUrl } from '../src/appUrl.js';

test('appUrl führt aus dem Unterordner der Seite zum App-Root', () => {
  assert.equal(appUrl('./Kalibrierungen/a.json'), 'Kalibrierungen/a.json');
  globalThis.document = { documentElement: { dataset: { appBase: '../' } } };
  try {
    assert.equal(appUrl('./Kalibrierungen/a.json'), '../Kalibrierungen/a.json');
    assert.equal(appUrl('php-api/index.php/api/session'), '../php-api/index.php/api/session');
  } finally { delete globalThis.document; }
});

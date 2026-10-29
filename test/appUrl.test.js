import test from 'node:test';
import assert from 'node:assert/strict';
import { appUrl } from '../src/api/appUrl.js';

test('appUrl führt aus dem Unterordner der Seite zum App-Root', () => {
  assert.equal(appUrl('./Wahlen/a/kalibrierung.json'), '../Wahlen/a/kalibrierung.json');
  assert.equal(appUrl('php-api/index.php/api/session'), '../php-api/index.php/api/session');
});

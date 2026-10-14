import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { loadStapel, saveStapel, toUpload } from '../erfassungsplatz/stapelStorage.js';

test('Originalbilder und Ergebnisse werden dauerhaft zusammen gespeichert und erst nach Bestätigung gelöscht', async () => {
  globalThis.indexedDB = new IDBFactory();
  const bild = new Blob(['originalbytes'], { type: 'image/png' });
  const stapel = { id: 'stapel', zettel: [{ id: 'zettel', bild, stimmen: [] }] };
  await saveStapel(stapel, undefined);
  const restored = await loadStapel();
  assert.equal(await restored.zettel[0].bild.text(), 'originalbytes');
  const upload = await toUpload(restored);
  const hash = createHash('sha256').update('originalbytes').digest('hex');
  assert.deepEqual(upload.stapel.zettel[0].bild, { hash, type: 'image/png' });
  assert.equal(await upload.bilder.get(hash).text(), 'originalbytes');
  await saveStapel(undefined, restored);
  assert.equal(await loadStapel(), undefined);
});

test('Gleichzeitige Tabs können einen gespeicherten Stapel nicht überschreiben', async () => {
  globalThis.indexedDB = new IDBFactory();
  const first = { id: 'first', zettel: [] };
  const second = { id: 'second', zettel: [] };
  const results = await Promise.allSettled([saveStapel(first, undefined), saveStapel(second, undefined)]);
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  assert.match(results.find(row => row.status === 'rejected').reason.message, /anderen Tab/);
  assert.equal((await loadStapel()).id, 'first');
});

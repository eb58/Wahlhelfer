/**
 * Prueft jede Gebietsdatei unter Wahlen/: jeder Wahlbezirk (= Wahllokal) hat Nummer und Name und
 * gehoert zu genau einem Wahlkreis - sonst zeigte das Dashboard ihn doppelt oder gar nicht.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const folder = new URL('../Wahlen/', import.meta.url);

test('das eingestellte Gebiet ist vorhanden', async () => {
  const { GEBIET } = await import('../configuration.js');
  assert.ok(existsSync(new URL(`../${GEBIET}`, folder)), `${GEBIET} fehlt`);
});

for (const wahl of readdirSync(folder)) {
  const gebiet = JSON.parse(readFileSync(new URL(`${wahl}/gebiet.json`, folder), 'utf8'));

  test(`${wahl}: Wahlkreise und Wahlbezirke sind vollständig und eindeutig`, () => {
    assert.equal(gebiet.version, 1);
    assert.ok(gebiet.name && gebiet.wahlkreise.length > 0);
    const wahlkreise = gebiet.wahlkreise.map(wahlkreis => wahlkreis.nummer);
    assert.equal(new Set(wahlkreise).size, wahlkreise.length, 'Wahlkreisnummer doppelt');
    const bezirke = gebiet.wahlkreise.flatMap(wahlkreis => {
      assert.ok(wahlkreis.nummer && wahlkreis.name, `Wahlkreis ohne Nummer oder Name: ${JSON.stringify(wahlkreis).slice(0, 80)}`);
      return [...wahlkreis.urnenwahlbezirke, ...wahlkreis.briefwahlbezirke];
    });
    for (const bezirk of bezirke) assert.ok(bezirk.nummer?.trim() && bezirk.name?.trim(), `Wahlbezirk ohne Nummer oder Name: ${JSON.stringify(bezirk)}`);
    const nummern = bezirke.map(bezirk => bezirk.nummer);
    assert.deepEqual(nummern.filter((nummer, index) => nummern.indexOf(nummer) !== index), [], 'Wahlbezirk doppelt');
  });
}

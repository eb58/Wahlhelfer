/**
 * Prueft jede mitgelieferte Kalibrierung gegen ihren Musterzettel.
 * Die Feldlagen sind von Hand vermessen - dieser Test haelt fest, dass sie stimmen:
 * jedes Feld sitzt auf einem gedruckten Ring, und auf dem Muster ist kein Feld markiert.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadKalibrierung, FORMAT_VERSION } from '../erfassungsplatz/erkennung/kalibrierung.js';
import { readPng } from '../erfassungsplatz/erkennung/png.js';
import { toDarkness, ringDarkness, darkRatio } from '../erfassungsplatz/erkennung/image.js';
import { innerRadius } from '../erfassungsplatz/erkennung/ankreuzErkennung.js';
import { kreuzeAn } from './zettelWerkstatt.js';

const folder = new URL('../Kalibrierungen/', import.meta.url);
const read = file => JSON.parse(readFileSync(new URL(file, folder), 'utf8'));
const files = readdirSync(folder).filter(file => file.endsWith('.json'));

test('die eingestellte Kalibrierung ist vorhanden', async () => {
  const { KALIBRIERUNG } = await import('../configuration.js');
  assert.ok(files.includes(KALIBRIERUNG.split('/').pop()), `${KALIBRIERUNG} fehlt in Kalibrierungen/`);
});

for (const file of files) {
  const content = read(file);
  const typ = loadKalibrierung(content);
  const image = readPng(readFileSync(new URL(`../${content.quelle}`, folder)));
  const map = toDarkness(image);

  test(`${file}: passt zum hinterlegten Musterzettel`, () => {
    assert.deepEqual({ breite: image.width, hoehe: image.height }, content.referenz);
  });

  test(`${file}: jedes Feld sitzt auf einem gedruckten Ring`, () => {
    for (const stimme of content.stimmen)
      for (const feld of stimme.felder)
        assert.ok(ringDarkness(map, feld.x, feld.y, content.radius) > 0.5,
          `${feld.id} bei ${feld.x}/${feld.y} liegt nicht auf einem Ring`);
  });

  if (content.huelle) test(`${file}: die Huelle liegt auf den aeusseren Tabellenlinien`, () => {
    // An jeder Seite muss eine gedruckte Linie entlanglaufen - sonst passt die Huelle nicht zum Muster.
    const { left, right, top, bottom } = content.huelle;
    const along = (from, to, point) => [...Array(21).keys()].map(i => point(from + (to - from) * (0.05 + 0.9 * i / 20)));
    const darkest = ({ x, y }) => Math.max(...[-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => map.values[Math.round(y + dy) * map.width + Math.round(x + dx)])));
    for (const [seite, points] of Object.entries({
      oben: along(left, right, x => ({ x, y: top })), unten: along(left, right, x => ({ x, y: bottom })),
      links: along(top, bottom, y => ({ x: left, y })), rechts: along(top, bottom, y => ({ x: right, y })),
    })) assert.ok(points.filter(point => darkest(point) > 0.5).length >= 18, `Huelle ${seite} liegt nicht auf einer Linie`);
  });

  test(`${file}: der Musterzettel ist leer`, () => {
    for (const stimme of content.stimmen)
      for (const feld of stimme.felder)
        assert.ok(darkRatio(map, feld.x, feld.y, innerRadius(content.radius)) < 0.02, `${feld.id} ist nicht leer`);
  });

  test(`${file}: Feld-IDs sind eindeutig und beschriftet`, () => {
    const ids = typ.felder.map(feld => feld.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(typ.felder.every(feld => feld.beschriftung), 'jedes Feld braucht eine Beschriftung');
  });

  test(`${file}: Textmarken sind ueber den Musterzettel verteilt`, () => {
    assert.ok(typ.textmarken.length >= 3);
    assert.ok(Math.max(...typ.textmarken.map(mark => mark.y)) - Math.min(...typ.textmarken.map(mark => mark.y)) > image.height * 0.4);
  });

  test(`${file}: erkennt am eigenen Musterzettel keine Markierung`, async () => {
    const result = await typ.recognize(image, { textjustierung: false });
    assert.ok(result.felder.every(feld => feld.status === 'leer'));
    assert.ok(result.stimmen.every(stimme => stimme.status === 'leer'));
  });

  test(`${file}: ein Kreuz trifft genau sein Feld`, async () => {
    // Je Stimme das erste, ein mittleres und das letzte Feld - so ist auch das untere
    // Ende eines sehr langen Zettels abgedeckt, wo sich ein Lagefehler am staerksten zeigt.
    for (const stimme of typ.stimmen) {
      const own = typ.felder.filter(feld => feld.stimme === stimme.id);
      for (const feld of [own[0], own[Math.floor(own.length / 2)], own.at(-1)]) {
        const result = await typ.recognize(kreuzeAn(image, typ, [feld.id]), { textjustierung: false });
        assert.deepEqual(result.felder.filter(f => f.status !== 'leer').map(f => f.id), [feld.id],
          `${feld.id} (${feld.beschriftung}) wurde nicht sauber getroffen`);
      }
    }
  });
}

test('fremde Versionen und unvollstaendige Dateien werden abgewiesen', () => {
  assert.throws(() => loadKalibrierung(JSON.stringify({ version: 99 })), /Version/);
  assert.throws(() => loadKalibrierung({ version: FORMAT_VERSION, radius: 10, stimmen: [] }), /Rahmen/);
  const mv = JSON.parse(readFileSync(new URL('ltw-mv-2021-wk24.json', folder), 'utf8'));
  assert.throws(() => loadKalibrierung({ ...mv, huelle: { left: 1, right: 2 } }), /Huelle/);
});

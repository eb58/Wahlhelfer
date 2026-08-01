/**
 * Prueft jede mitgelieferte Kalibrierung gegen ihren Musterzettel.
 * Die Feldlagen sind von Hand vermessen - dieser Test haelt fest, dass sie stimmen:
 * jedes Feld sitzt auf einem gedruckten Ring, und auf dem Muster ist kein Feld markiert.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ladeKalibrierung, FORMAT_VERSION } from '../src/kalibrierung.js';
import { readPng } from '../src/png.js';
import { toDarkness, ringDarkness, darkRatio } from '../src/image.js';
import { innerRadius } from '../src/ankreuzErkennung.js';
import { kreuzeAn } from './zettelWerkstatt.js';

const ordner = new URL('../Kalibrierungen/', import.meta.url);
const lies = datei => JSON.parse(readFileSync(new URL(datei, ordner), 'utf8'));
const dateien = readdirSync(ordner).filter(datei => datei.endsWith('.json'));

test('die eingestellte Kalibrierung ist vorhanden', async () => {
  const { KALIBRIERUNG } = await import('../konfiguration.js');
  assert.ok(dateien.includes(KALIBRIERUNG.split('/').pop()), `${KALIBRIERUNG} fehlt in Kalibrierungen/`);
});

for (const datei of dateien) {
  const inhalt = lies(datei);
  const typ = ladeKalibrierung(inhalt);
  const image = readPng(readFileSync(new URL(`../${inhalt.quelle}`, ordner)));
  const map = toDarkness(image);

  test(`${datei}: passt zum hinterlegten Musterzettel`, () => {
    assert.deepEqual({ breite: image.width, hoehe: image.height }, inhalt.referenz);
  });

  test(`${datei}: jedes Feld sitzt auf einem gedruckten Ring`, () => {
    for (const stimme of inhalt.stimmen)
      for (const feld of stimme.felder)
        assert.ok(ringDarkness(map, feld.x, feld.y, inhalt.radius) > 0.5,
          `${feld.id} bei ${feld.x}/${feld.y} liegt nicht auf einem Ring`);
  });

  test(`${datei}: der Musterzettel ist leer`, () => {
    for (const stimme of inhalt.stimmen)
      for (const feld of stimme.felder)
        assert.ok(darkRatio(map, feld.x, feld.y, innerRadius(inhalt.radius)) < 0.02, `${feld.id} ist nicht leer`);
  });

  test(`${datei}: Feld-IDs sind eindeutig und beschriftet`, () => {
    const ids = typ.felder.map(feld => feld.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(typ.felder.every(feld => feld.beschriftung), 'jedes Feld braucht eine Beschriftung');
  });

  test(`${datei}: erkennt am eigenen Musterzettel keine Markierung`, () => {
    const ergebnis = typ.recognize(image);
    assert.ok(ergebnis.felder.every(feld => feld.status === 'leer'));
    assert.ok(ergebnis.stimmen.every(stimme => stimme.status === 'leer'));
  });

  test(`${datei}: ein Kreuz trifft genau sein Feld`, () => {
    // Je Stimme das erste, ein mittleres und das letzte Feld - so ist auch das untere
    // Ende eines sehr langen Zettels abgedeckt, wo sich ein Lagefehler am staerksten zeigt.
    for (const stimme of typ.stimmen) {
      const eigene = typ.felder.filter(feld => feld.stimme === stimme.id);
      for (const feld of [eigene[0], eigene[Math.floor(eigene.length / 2)], eigene.at(-1)]) {
        const ergebnis = typ.recognize(kreuzeAn(image, typ, [feld.id]));
        assert.deepEqual(ergebnis.felder.filter(f => f.status !== 'leer').map(f => f.id), [feld.id],
          `${feld.id} (${feld.beschriftung}) wurde nicht sauber getroffen`);
      }
    }
  });
}

test('fremde Versionen und unvollstaendige Dateien werden abgewiesen', () => {
  assert.throws(() => ladeKalibrierung(JSON.stringify({ version: 99 })), /Version/);
  assert.throws(() => ladeKalibrierung({ version: FORMAT_VERSION, radius: 10, stimmen: [] }), /Rahmen/);
});

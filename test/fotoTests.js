/**
 * Fototests, aufgeteilt auf mehrere Testdateien unter test/fotos/. node --test laesst Dateien
 * parallel laufen, die Tests einer Datei aber nacheinander - mit einer einzigen Datei bestimmten die
 * echten Fotos allein die Laufzeit von npm test. Jede Datei prueft nur ihren Teil: jedes
 * `von`-te Foto bzw. jede `von`-te Zettelart, beginnend bei `teil`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { loadKalibrierung } from '../src/erfassungsplatz/erkennung/kalibrierung.js';
import { rotateImage } from '../src/erfassungsplatz/erkennung/image.js';
import { readImage } from './fotoWerkstatt.js';

const sorted = values => [...values].sort();
const imTeil = (teil, von) => (_, index) => index % von === teil - 1;
const readManifest = folder => JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8'));

/**
 * Die Fixtures sind bereits die vom Erfassungsplatz gespeicherten Beleg-JPEGs.
 */
const pruefeWertung = async (typ, datei) => {
  const image = await readImage(readFileSync(datei));
  const erste = await typ.recognize(image);
  const result = erste.rotation ? await typ.recognize(rotateImage(image, erste.rotation)) : erste;
  assert.equal(result.rotation, 0, 'der aufrechte Beleg traegt ohne weitere Drehung');
  return result.felder.filter(feld => feld.status !== 'leer');
};

const fotoFolder = new URL('../Testdaten/bundestagswahl-2017/fotos/', import.meta.url);
const ANZAHL_FOTOS = 58;

/**
 * Echte Smartphone-Fotos vom Bundestagszettel (`serie` im Manifest nennt die Aufnahmeserie). Das
 * Manifest prueft nur Teil 1. Ein `todo` im Manifest kennzeichnet eine bekannte Luecke der Erkennung
 * samt Begruendung.
 */
export const testeEchteFotos = (teil, von) => {
  const typ = loadKalibrierung(readFileSync(new URL('../Kalibrierungen/bundestagswahl-2017.json', import.meta.url), 'utf8'));
  const manifest = readManifest(fotoFolder);
  if (teil === 1)
    test(`Manifest enthaelt alle ${ANZAHL_FOTOS} JPEG-Aufnahmen`, () => {
      assert.equal(manifest.anzahl, ANZAHL_FOTOS);
      assert.equal(manifest.faelle.length, manifest.anzahl);
      assert.deepEqual(sorted(readdirSync(fotoFolder).filter(datei => datei.endsWith('.jpg'))), sorted(manifest.faelle.map(fall => fall.datei)));
    });

  for (const fall of manifest.faelle.filter(imTeil(teil, von)))
    test(`Foto ${fall.datei} wird wie im Manifest gewertet`, { todo: fall.todo }, async () => {
      const markiert = await pruefeWertung(typ, new URL(fall.datei, fotoFolder));
      assert.deepEqual(sorted(markiert.map(feld => feld.id)), sorted(fall.markierungen));
      assert.ok(markiert.every(feld => feld.status === 'angekreuzt'));
    });
};

/**
 * Synthetische Fotos, erzeugt mit scripts/erzeugeSynthetischeFotos.js: je Zettelart drei Lagen
 * (gerade, schraeg, gedreht) unter Testdaten/<kalibrierung>/synthetisch/ (`art: 'foto'`; die Scans
 * im selben Ordner prueft fixtures.test.js).
 */
export const testeSynthetischeFotos = (teil, von) => {
  const kalibrierungen = readdirSync(new URL('../Kalibrierungen/', import.meta.url)).filter(datei => datei.endsWith('.json'));
  for (const kalibrierung of kalibrierungen.filter(imTeil(teil, von))) {
    const folder = new URL(`../Testdaten/${kalibrierung.replace('.json', '')}/synthetisch/`, import.meta.url);

    test(`${kalibrierung}: synthetische Fotos sind vollstaendig`, () => {
      assert.ok(existsSync(new URL('manifest.json', folder)), 'node scripts/erzeugeSynthetischeFotos.js ausfuehren');
      const manifest = readManifest(folder);
      assert.equal(manifest.kalibrierung, kalibrierung);
      assert.equal(manifest.faelle.length, manifest.anzahl);
      assert.deepEqual(sorted(readdirSync(folder).filter(datei => datei.endsWith('.jpg'))), sorted(manifest.faelle.filter(fall => fall.art === 'foto').map(fall => fall.datei)));
    });
    if (!existsSync(new URL('manifest.json', folder))) continue;

    const typ = loadKalibrierung(readFileSync(new URL(`../Kalibrierungen/${kalibrierung}`, import.meta.url), 'utf8'));
    for (const fall of readManifest(folder).faelle.filter(fall => fall.art === 'foto'))
      test(`${kalibrierung}: ${fall.datei} wird wie im Manifest gewertet`, async () => {
        const markiert = await pruefeWertung(typ, new URL(fall.datei, folder));
        assert.deepEqual(sorted(markiert.map(feld => feld.id)), sorted(fall.markierungen));
        assert.ok(markiert.every(feld => feld.status === 'angekreuzt'));
      });
  }
};

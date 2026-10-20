/**
 * Fototests, aufgeteilt auf mehrere Testdateien unter test/fotos/. node --test laesst Dateien
 * parallel laufen, die Tests einer Datei aber nacheinander - mit einer einzigen Datei bestimmten die
 * 53 echten Fotos allein die Laufzeit von npm test. Jede Datei prueft nur ihren Teil: jedes
 * `von`-te Foto bzw. jede `von`-te Zettelart, beginnend bei `teil`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { loadKalibrierung } from '../src/erfassungsplatz/erkennung/kalibrierung.js';
import { readFoto } from './fotoWerkstatt.js';

const sorted = values => [...values].sort();
const imTeil = (teil, von) => (_, index) => index % von === teil - 1;
const readManifest = folder => JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8'));

/** Wie der Erfassungsplatz: ein quer gespeichertes Foto wird als aufrechter Beleg neu erzeugt und erneut erkannt. */
const pruefeWertung = async (typ, datei) => {
  const bytes = readFileSync(datei);
  const erste = await typ.recognize(await readFoto(bytes));
  const result = erste.rotation ? await typ.recognize(await readFoto(bytes, { rotation: erste.rotation })) : erste;
  assert.equal(result.rotation, 0, 'der aufrechte Beleg traegt ohne weitere Drehung');
  return result.felder.filter(feld => feld.status !== 'leer');
};

const serien = [['fotos-serie1', 20], ['fotos-serie2', 33], ['fotos-serie3', 4]]
  .map(([name, anzahl]) => ({ name, anzahl, folder: new URL(`../Testdaten/bundestagswahl-2017/${name}/`, import.meta.url) }));

/**
 * Echte Smartphone-Fotos vom Bundestagszettel. Die Manifeste prueft nur Teil 1. Ein `todo` im
 * Manifest kennzeichnet eine bekannte Luecke der Erkennung samt Begruendung.
 */
export const testeEchteFotos = (teil, von) => {
  const typ = loadKalibrierung(readFileSync(new URL('../Kalibrierungen/bundestagswahl-2017.json', import.meta.url), 'utf8'));
  if (teil === 1)
    for (const { name, anzahl, folder } of serien)
      test(`${name}: Manifest enthaelt alle ${anzahl} JPEG-Aufnahmen`, () => {
        const manifest = readManifest(folder);
        assert.equal(manifest.anzahl, anzahl);
        assert.equal(manifest.faelle.length, manifest.anzahl);
        assert.deepEqual(sorted(readdirSync(folder).filter(datei => datei.endsWith('.jpg'))), sorted(manifest.faelle.map(fall => fall.datei)));
      });

  const faelle = serien.flatMap(({ name, folder }) => readManifest(folder).faelle.map(fall => ({ ...fall, name, folder })));
  for (const fall of faelle.filter(imTeil(teil, von)))
    test(`${fall.name}: ${fall.datei} wird wie im Manifest gewertet`, { todo: fall.todo }, async () => {
      const markiert = await pruefeWertung(typ, new URL(fall.datei, fall.folder));
      assert.deepEqual(sorted(markiert.map(feld => feld.id)), sorted(fall.markierungen));
      assert.ok(markiert.every(feld => feld.status === 'angekreuzt'));
    });
};

/**
 * Synthetische Fotos, erzeugt mit scripts/erzeugeSynthetischeFotos.js: je Zettelart drei Lagen
 * (gerade, schraeg, gedreht) unter Testdaten/<kalibrierung>/synthetisch/.
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
      assert.deepEqual(sorted(readdirSync(folder).filter(datei => datei.endsWith('.jpg'))), sorted(manifest.faelle.map(fall => fall.datei)));
    });
    if (!existsSync(new URL('manifest.json', folder))) continue;

    const typ = loadKalibrierung(readFileSync(new URL(`../Kalibrierungen/${kalibrierung}`, import.meta.url), 'utf8'));
    for (const fall of readManifest(folder).faelle)
      test(`${kalibrierung}: ${fall.datei} wird wie im Manifest gewertet`, async () => {
        const markiert = await pruefeWertung(typ, new URL(fall.datei, folder));
        assert.deepEqual(sorted(markiert.map(feld => feld.id)), sorted(fall.markierungen));
        assert.ok(markiert.every(feld => feld.status === 'angekreuzt'));
      });
  }
};

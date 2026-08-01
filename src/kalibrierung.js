/**
 * Kalibrierung: die von Hand vermessene Beschreibung einer Zettelart.
 *
 * Die Dateien unter `Kalibrierungen/` werden am leeren Musterzettel abgelesen, nicht berechnet -
 * es gibt kein Verfahren mehr, das Ankreuzfelder selbst sucht. Eine Datei nennt je Stimme ihre
 * Ankreuzfelder in Pixeln des Musterzettels und unter `frame` dessen Rahmenlinien. Erst aus
 * beidem zusammen wird die Feldlage rahmenrelativ - und damit unabhaengig von Aufloesung und
 * Bildausschnitt der spaeteren Aufnahme.
 */
import { toRelative, frameWidth } from './frame.js';
import { recognizeAnkreuzungen } from './ankreuzErkennung.js';

export const FORMAT_VERSION = 3;

/**
 * Musterzettel-Pixel -> rahmenrelative Lagen; die Stimme wandert dabei ins Feld.
 * Danach kennt die Erkennung nur noch eine flache Feldliste.
 */
const aufbereiten = kalibrierung => ({
  name: kalibrierung.name,
  thresholds: kalibrierung.thresholds,
  radius: kalibrierung.radius / frameWidth(kalibrierung.frame),
  stimmen: kalibrierung.stimmen.map(({ id, name, auswahl = 1 }) => ({ id, name, auswahl })),
  felder: kalibrierung.stimmen.flatMap(stimme =>
    stimme.felder.map(feld => ({ ...feld, stimme: stimme.id, ...toRelative(kalibrierung.frame, feld) }))),
});

const pruefe = datei => {
  if (datei.version !== FORMAT_VERSION) throw new Error(`Unbekannte Kalibrierungs-Version: ${datei.version}`);
  if (!datei.frame || !datei.radius) throw new Error('Kalibrierung ohne Rahmen oder Radius');
  if (!datei.stimmen?.length) throw new Error('Kalibrierung ohne Stimmen');
  return datei;
};

/**
 * Macht aus einer Kalibrierungsdatei den Erkenner fuer genau diese Zettelart.
 * @param {string|object} json Inhalt einer Datei aus `Kalibrierungen/`
 */
export const ladeKalibrierung = json => {
  const datei = pruefe(typeof json === 'string' ? JSON.parse(json) : json);
  const kalibrierung = aufbereiten(datei);
  return {
    ...kalibrierung,
    /** @param {{width:number,height:number,data:Uint8ClampedArray}} image Aufnahme des Zettels */
    recognize: (image, options) => recognizeAnkreuzungen(image, kalibrierung, options),
    toJson: () => JSON.stringify(datei),
  };
};

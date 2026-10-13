/**
 * Kalibrierung: die von Hand vermessene Beschreibung einer Zettelart.
 *
 * Die Dateien unter `Kalibrierungen/` werden am leeren Musterzettel abgelesen, nicht berechnet -
 * es gibt kein Verfahren mehr, das Ankreuzfelder selbst sucht. Eine Datei nennt je Stimme ihre
 * Ankreuzfelder in Pixeln des Musterzettels und unter `frame` dessen Rahmenlinien. Weicht der
 * aeussere Rand aller Tabellen davon ab (MV: `frame` endet vor der Nummernspalte), steht er
 * zusaetzlich unter `huelle` - so findet die Fotoerkennung auch dort ihren Bezug. Erst aus
 * beidem zusammen wird die Feldlage rahmenrelativ - und damit unabhaengig von Aufloesung und
 * Bildausschnitt der spaeteren Aufnahme.
 */
import { toRelative, frameWidth } from './frame.js';
import { recognizeAnkreuzungen } from './ankreuzErkennung.js';

export const FORMAT_VERSION = 4;

/**
 * Musterzettel-Pixel -> rahmenrelative Lagen; die Stimme wandert dabei ins Feld.
 * Danach kennt die Erkennung nur noch eine flache Feldliste.
 */
const prepare = kalibrierung => ({
  name: kalibrierung.name,
  referenz: kalibrierung.referenz,
  frame: kalibrierung.frame,
  huelle: kalibrierung.huelle,
  textmarken: kalibrierung.textmarken,
  thresholds: kalibrierung.thresholds,
  radius: kalibrierung.radius / frameWidth(kalibrierung.frame),
  referenzRadius: kalibrierung.radius,
  stimmen: kalibrierung.stimmen.map(({ id, name, auswahl = 1 }) => ({ id, name, auswahl })),
  felder: kalibrierung.stimmen.flatMap(stimme =>
    stimme.felder.map(feld => ({
      ...feld,
      stimme: stimme.id,
      referenz: { x: feld.x, y: feld.y },
      ...toRelative(kalibrierung.frame, feld),
    }))),
});

const validate = file => {
  if (file.version !== FORMAT_VERSION) throw new Error(`Unbekannte Kalibrierungs-Version: ${file.version}`);
  if (!file.frame || !file.radius) throw new Error('Kalibrierung ohne Rahmen oder Radius');
  if (file.huelle && ['left', 'right', 'top', 'bottom'].some(key => !Number.isFinite(file.huelle[key])))
    throw new Error('Kalibrierung mit unvollstaendiger Huelle');
  if (!file.referenz?.breite || !file.referenz?.hoehe) throw new Error('Kalibrierung ohne Referenzgroesse');
  if (file.textmarken?.length < 3 || file.textmarken.some(mark => !mark.text || !Number.isFinite(mark.x) || !Number.isFinite(mark.y)))
    throw new Error('Kalibrierung braucht mindestens drei vollstaendige Textmarken');
  if (!file.stimmen?.length) throw new Error('Kalibrierung ohne Stimmen');
  return file;
};

/**
 * Macht aus einer Kalibrierungsdatei den Erkenner fuer genau diese Zettelart.
 * @param {string|object} json Inhalt einer Datei aus `Kalibrierungen/`
 */
export const loadKalibrierung = json => {
  const file = validate(typeof json === 'string' ? JSON.parse(json) : json);
  const kalibrierung = prepare(file);
  return {
    ...kalibrierung,
    /** @param {{width:number,height:number,data:Uint8ClampedArray}} image Aufnahme des Zettels */
    recognize: (image, options) => recognizeAnkreuzungen(image, kalibrierung, options),
    toJson: () => JSON.stringify(file),
  };
};

/**
 * Admin-Modul "Neuen Wahlzettel registrieren".
 *
 * `registerWahlzettel(musterBild)` lernt einen Zetteltyp aus einem leeren Musterzettel
 * und liefert einen fertigen Erkenner fuer genau diesen Typ zurueck. Nichts an dieser
 * Datei kennt einen konkreten Stimmzettel - Spaltenzahl, Feldanzahl, Radius und Rahmen
 * stammen ausschliesslich aus dem uebergebenen Bild.
 */
import { kalibriere } from './kalibrierung.js';
import { recognizeAnkreuzungen, recognizeAnkreuzungenRobust, defaultThresholds } from './ankreuzErkennung.js';
import { beschrifteFelder, readWords, recommendedScale } from './beschriftung.js';
import { learnAnchors } from './alignment.js';
import { log } from './log.js';

const FORMAT_VERSION = 2;

/** Bindet einen gelernten Typ an die Erkennung - das ist die "generierte" Funktion. */
const buildRecognizer = typ => ({
  ...typ,
  /**
   * Schnellweg ueber die Rahmenlinien, ohne OCR.
   * @param {{width:number,height:number,data:Uint8ClampedArray}} image ausgefuellter Zettel
   */
  recognize: (image, options) => recognizeAnkreuzungen(image, typ, { thresholds: typ.thresholds, ...options }),

  /**
   * Wie `recognize`, weicht bei schraeger Aufnahme aber auf die Ankerwoerter aus.
   * OCR laeuft nur, wenn die Rahmenlinien versagen.
   * @param {object} ocr Optionen fuer readWords (source, lang, langPath ...)
   */
  recognizeRobust: (image, { ocr = {}, ...options } = {}) =>
    recognizeAnkreuzungenRobust(image, typ, () => readWords(ocr.source ?? image, ocr), {
      thresholds: typ.thresholds,
      scale: ocr.scale ?? 1,
      ...options,
    }),

  toJson: () => JSON.stringify(typ),
});

/**
 * Registriert einen Wahlzetteltyp anhand eines leeren Musterzettels.
 *
 * @param {{width:number,height:number,data:Uint8ClampedArray}} musterBild leerer Zettel
 * @param {object} options
 * @param {string} [options.name] Bezeichnung des Typs
 * @param {object} [options.thresholds] Erkennungsschwellen, sonst Standardwerte
 * @param {object} [options.ocr] Texterkennung: `{ source, scale, lang, langPath, worker }`
 *   `source` ist das Bild fuer tesseract.js (bei scale > 1 das vergroesserte Bild).
 * @returns {Promise<{recognize:Function, felder:Array, toJson:Function}>}
 */
export const registerWahlzettel = async (musterBild, { name = 'Unbenannter Wahlzettel', thresholds = defaultThresholds, ocr, ...options } = {}) => {
  const kalibrierung = kalibriere(musterBild, options);

  // Ein einziger OCR-Lauf deckt beides ab: Beschriftung der Felder und die Ankerwoerter,
  // mit denen sich spaeter auch schraege Aufnahmen ausrichten lassen.
  const ocrSettings = { ...ocr, scale: ocr?.scale ?? recommendedScale };
  log(`Registrierung "${name}": Texterkennung ${ocr ? 'an' : 'aus'}`);
  const words = ocr ? await readWords(ocr.source ?? musterBild, ocr) : [];
  const anchors = ocr ? learnAnchors(words, ocrSettings) : [];
  if (ocr) log(`Registrierung: ${words.length} Woerter gelesen, ${anchors.length} davon als Anker brauchbar`);

  return buildRecognizer({
    version: FORMAT_VERSION,
    name,
    thresholds,
    radius: kalibrierung.radius,
    radiusRef: kalibrierung.radiusRef,
    reference: kalibrierung.reference,
    felder: ocr ? beschrifteFelder(kalibrierung.felder, words, kalibrierung.frame, ocrSettings) : kalibrierung.felder,
    anchors,
    learnedAt: new Date().toISOString(),
  });
};

/** Laedt einen zuvor registrierten Typ wieder als Erkenner - Registrierung erfolgt einmalig. */
export const fromJson = json => {
  const typ = typeof json === 'string' ? JSON.parse(json) : json;
  if (typ.version !== FORMAT_VERSION) throw new Error(`Unbekannte Wahlzettel-Version: ${typ.version}`);
  return buildRecognizer(typ);
};

/** Kurzfassung fuer die Anzeige im Admin-Modul. */
export const beschreibe = typ => ({
  name: typ.name,
  felder: typ.felder.length,
  stimmen: [...new Set(typ.felder.map(f => f.stimme))].map(stimme => ({
    stimme,
    felder: typ.felder.filter(f => f.stimme === stimme).map(f => f.beschriftung ?? f.id),
  })),
});

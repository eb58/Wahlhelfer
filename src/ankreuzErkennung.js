/**
 * Ankreuzerkennung: prueft je Ankreuzfeld, ob es markiert ist.
 *
 * Die Feldlagen kommen aus einem von zwei Wegen:
 *   1. Rahmen - schnell, ohne OCR, setzt eine gerade gehaltene Aufnahme voraus.
 *   2. Anker  - Ankerwoerter per OCR, dann Aehnlichkeitstransformation; vertraegt Schraeglage.
 * Gemessen wird in beiden Faellen gleich: Fuellgrad im Kreisinneren.
 */
import { toDarkness, darkRatio } from './image.js';
import { findFrame, toAbsolute, frameWidth } from './frame.js';
import { innerRadius, adjustFeld } from './kalibrierung.js';
import { findTransform, transformScale, transformAngle } from './alignment.js';
import { log, round } from './log.js';

/** Ab diesem Fuellgrad ueber dem Leerwert gilt ein Feld als angekreuzt bzw. als Zweifelsfall. */
export const defaultThresholds = { angekreuzt: 0.18, zweifel: 0.06 };

const bewerte = (fuellung, thresholds) =>
  fuellung >= thresholds.angekreuzt ? 'angekreuzt' : fuellung >= thresholds.zweifel ? 'unklar' : 'leer';

/** Genau eine Markierung je Stimme ist gueltig; nichts oder mehreres muss der Wahlvorstand entscheiden. */
const werteStimme = (felder, stimme) => {
  const eigene = felder.filter(f => f.stimme === stimme);
  const treffer = eigene.filter(f => f.status === 'angekreuzt');
  const unklare = eigene.filter(f => f.status === 'unklar');
  return {
    treffer: treffer.map(f => f.id),
    status: treffer.length === 1 && !unklare.length ? 'gueltig'
      : treffer.length > 1 ? 'mehrfach'
      : unklare.length ? 'zweifelsfall'
      : 'leer',
  };
};

/** Ausrichtung ueber die durchgehenden Drucklinien - ohne OCR, aber nur bei gerader Aufnahme. */
const viaFrame = (map, kalibrierung, options) => {
  const frame = findFrame(map, options);
  if (!frame) {
    log('Ausrichtung: keine durchgehenden Rahmenlinien gefunden');
    return undefined;
  }
  log(`Ausrichtung ueber Rahmen: x ${round(frame.left)}..${round(frame.right)}, y ${round(frame.top)}..${round(frame.bottom)}`);
  return {
    method: 'rahmen',
    frame,
    radius: Math.max(3, Math.round(kalibrierung.radius * frameWidth(frame))),
    position: feld => toAbsolute(frame, feld),
  };
};

/** Ausrichtung ueber gelernte Ankerwoerter - vertraegt Drehung, braucht aber OCR-Treffer. */
const viaAnchors = (map, kalibrierung, words, options) => {
  if (!kalibrierung.anchors?.length) {
    log('Ausrichtung: keine Ankerwoerter gelernt - Rueckfallweg nicht moeglich');
    return undefined;
  }
  const { transform, pairs } = findTransform(
    words, kalibrierung.anchors, kalibrierung.reference, { width: map.width, height: map.height }, options,
  );
  if (!transform) {
    log(`Ausrichtung: ${words.length} Woerter gelesen, aber kein Anker sicher zuzuordnen`);
    return undefined;
  }
  log(`Ausrichtung ueber Anker: ${pairs.length} von ${kalibrierung.anchors.length} zugeordnet, `
    + `Drehung ${round(transformAngle(transform))} Grad, Massstab ${round(transformScale(transform))}`);
  return {
    method: 'anker',
    anchors: pairs.length,
    drehung: transformAngle(transform),
    radius: Math.max(3, Math.round(kalibrierung.radiusRef * transformScale(transform))),
    position: feld => transform({ x: feld.refX, y: feld.refY }),
  };
};

const messe = (map, kalibrierung, alignment, { thresholds, adjust }) => {
  const measureRadius = innerRadius(alignment.radius);

  const felder = kalibrierung.felder.map(feld => {
    const rough = alignment.position(feld);
    const { x, y } = adjust ? adjustFeld(map, Math.round(rough.x), Math.round(rough.y), alignment.radius) : rough;
    const fuellgrad = darkRatio(map, x, y, measureRadius);
    const fuellung = Math.max(0, fuellgrad - feld.leerFuellgrad);
    return { ...feld, x, y, fuellgrad, fuellung, status: bewerte(fuellung, thresholds) };
  });

  // Nur auffaellige Felder protokollieren - 14 Zeilen je Zettel waeren nicht mehr lesbar.
  const auffaellig = felder.filter(f => f.status !== 'leer')
    .map(f => `${f.id} ${round(f.fuellung)} (${f.status})`);
  log(`Markierungen: ${auffaellig.join(', ') || 'keine'}`);

  const erststimme = werteStimme(felder, 'erststimme');
  const zweitstimme = werteStimme(felder, 'zweitstimme');
  log(`Wertung: Erststimme ${erststimme.status} ${erststimme.treffer.join('+') || '-'}, `
    + `Zweitstimme ${zweitstimme.status} ${zweitstimme.treffer.join('+') || '-'}`);

  const { position, ...angaben } = alignment;
  return { felder, ...angaben, erststimme, zweitstimme };
};

/**
 * Erkennt die Ankreuzungen eines ausgefuellten Stimmzettels ueber die Rahmenlinien.
 * @param {{width:number,height:number,data:Uint8ClampedArray}} image Aufnahme des Zettels
 * @param {object} kalibrierung Ergebnis von kalibriere()
 */
export const recognizeAnkreuzungen = (image, kalibrierung, { thresholds = defaultThresholds, adjust = true, ...options } = {}) => {
  const map = toDarkness(image);
  const alignment = viaFrame(map, kalibrierung, options);
  if (!alignment) throw new Error('Kein Zettelrahmen erkannt - Aufnahme zeigt den Stimmzettel nicht vollstaendig.');
  return messe(map, kalibrierung, alignment, { thresholds, adjust });
};

/**
 * Wie recognizeAnkreuzungen, faellt aber auf die Ankerwoerter zurueck, wenn die
 * Rahmenlinien fehlen - etwa weil der Zettel schraeg fotografiert wurde.
 *
 * @param {Function} readWords liefert die OCR-Woerter der Aufnahme (nur bei Bedarf aufgerufen)
 */
export const recognizeAnkreuzungenRobust = async (image, kalibrierung, readWords, { thresholds = defaultThresholds, adjust = true, ...options } = {}) => {
  const map = toDarkness(image);
  const alignment = viaFrame(map, kalibrierung, options)
    ?? viaAnchors(map, kalibrierung, await readWords(), options);

  if (!alignment) {
    throw new Error(kalibrierung.anchors?.length
      ? 'Zettel nicht erkannt - weder Rahmenlinien noch genug Ankerwoerter gefunden.'
      : 'Kein Zettelrahmen erkannt - Aufnahme zeigt den Stimmzettel nicht vollstaendig.');
  }
  return messe(map, kalibrierung, alignment, { thresholds, adjust });
};

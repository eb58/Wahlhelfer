/**
 * Ankreuzerkennung: prueft je Ankreuzfeld, ob es markiert ist.
 *
 * Ausgerichtet wird ueber die durchgehenden Drucklinien (`frame.js`). Die Kalibrierung sagt,
 * wo die Felder relativ zu diesen Linien liegen; gemessen wird der Fuellgrad im Kreisinneren.
 * Eine gerade gehaltene Aufnahme ist damit Voraussetzung - dafuer braucht es keine Texterkennung.
 */
import { toDarkness, darkRatio, ringDarkness } from './image.js';
import { findFrame, toAbsolute, frameWidth } from './frame.js';
import { log, round } from './log.js';

/** Innenradius, auf dem der Fuellgrad gemessen wird - haelt Abstand zum gedruckten Ring. */
export const innerRadius = radius => Math.max(2, Math.round(radius * 0.68));

/**
 * Feinjustierung: das Ankreuzfeld im kleinen Umkreis auf den gedruckten Ring einrasten lassen.
 * Bewertet wird nur der Ring, nicht das Innere - sonst wuerde ein Kreuz die Suche stoeren.
 * Der Suchradius bleibt klein genug, dass nicht auf das Nachbarfeld gesprungen wird.
 */
export const adjustFeld = (map, x, y, radius, ratio = 0.5) => {
  const span = Math.round(radius * ratio);
  let best = { x, y, score: ringDarkness(map, x, y, radius) };
  for (let dy = -span; dy <= span; dy++)
    for (let dx = -span; dx <= span; dx++) {
      const score = ringDarkness(map, x + dx, y + dy, radius);
      if (score > best.score) best = { x: x + dx, y: y + dy, score };
    }
  return best;
};

const bewerte = (fuellgrad, thresholds) =>
  fuellgrad >= thresholds.angekreuzt ? 'angekreuzt' : fuellgrad >= thresholds.zweifel ? 'unklar' : 'leer';

/** Genau `auswahl` Markierungen sind gueltig; alles andere muss der Wahlvorstand entscheiden. */
const werteStimme = (felder, { id, auswahl }) => {
  const eigene = felder.filter(feld => feld.stimme === id);
  const treffer = eigene.filter(feld => feld.status === 'angekreuzt');
  const unklare = eigene.filter(feld => feld.status === 'unklar');
  return {
    treffer: treffer.map(feld => feld.id),
    status: treffer.length > auswahl ? 'mehrfach'
      : unklare.length ? 'zweifelsfall'
      : treffer.length === auswahl ? 'gueltig'
      : 'leer',
  };
};

/**
 * Erkennt die Ankreuzungen eines ausgefuellten Stimmzettels.
 * @param {{width:number,height:number,data:Uint8ClampedArray}} image Aufnahme des Zettels
 * @param {object} kalibrierung aufbereitete Kalibrierung (siehe kalibrierung.js)
 */
export const recognizeAnkreuzungen = (image, kalibrierung, { thresholds = kalibrierung.thresholds, adjust = true, ...options } = {}) => {
  const map = toDarkness(image);
  const frame = findFrame(map, options);
  if (!frame) throw new Error('Kein Zettelrahmen erkannt - Aufnahme zeigt den Stimmzettel nicht vollstaendig.');
  log(`Ausrichtung ueber Rahmen: x ${round(frame.left)}..${round(frame.right)}, y ${round(frame.top)}..${round(frame.bottom)}`);

  const radius = Math.max(3, Math.round(kalibrierung.radius * frameWidth(frame)));
  const messRadius = innerRadius(radius);

  const felder = kalibrierung.felder.map(feld => {
    const grob = toAbsolute(frame, feld);
    const { x, y } = adjust ? adjustFeld(map, Math.round(grob.x), Math.round(grob.y), radius) : grob;
    const fuellgrad = darkRatio(map, x, y, messRadius);
    return { ...feld, x, y, fuellgrad, status: bewerte(fuellgrad, thresholds) };
  });

  // Nur auffaellige Felder protokollieren - eine Zeile je Feld waere nicht mehr lesbar.
  const auffaellig = felder.filter(feld => feld.status !== 'leer').map(feld => `${feld.id} ${round(feld.fuellgrad)} (${feld.status})`);
  log(`Markierungen: ${auffaellig.join(', ') || 'keine'}`);

  const stimmen = kalibrierung.stimmen.map(stimme => ({ ...stimme, ...werteStimme(felder, stimme) }));
  const wertung = stimmen.map(stimme => [stimme.name, stimme.status, stimme.treffer.join('+') || '-'].join(' '));
  log(`Wertung: ${wertung.join(', ')}`);

  return { felder, frame, radius, stimmen };
};

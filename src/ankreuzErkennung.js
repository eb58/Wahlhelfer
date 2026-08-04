/**
 * Ankreuzerkennung: prueft je Ankreuzfeld, ob es markiert ist.
 *
 * Der Druckrahmen liefert eine grobe Lage. OCR-Textmarken bestimmen danach die affine
 * Feinjustierung; gemessen wird der Fuellgrad im Kreisinneren.
 */
import { toDarkness, darkRatio, ringDarkness } from './image.js';
import { findFrame, toAbsolute, frameWidth } from './frame.js';
import { bestimmeTextTransformation, transformiere, transformationsScale } from './textJustierung.js';
import { berechneOcrBereiche } from './ocrBereiche.js';
import { findPapier, papierZuFrame } from './papier.js';
import { log, round } from './log.js';

/** Innenradius, auf dem der Fuellgrad gemessen wird - haelt Abstand zum gedruckten Ring. */
export const innerRadius = radius => Math.max(2, Math.round(radius * 0.68));

/**
 * Feinjustierung: das Ankreuzfeld im kleinen Umkreis auf den gedruckten Ring einrasten lassen.
 * Bewertet wird nur der Ring, nicht das Innere - sonst wuerde ein Kreuz die Suche stoeren.
 * Auf Fotos darf die vertikale Suche wegen der Perspektive groesser sein als die horizontale;
 * beide Spannen bleiben kleiner als der Abstand zum Nachbarfeld.
 */
export const adjustFeld = (map, x, y, radius, ratio = 0.5) => {
  const spanX = Math.round(radius * (ratio.x ?? ratio));
  const spanY = Math.round(radius * (ratio.y ?? ratio));
  let best = { x, y, score: ringDarkness(map, x, y, radius) };
  for (let dy = -spanY; dy <= spanY; dy++)
    for (let dx = -spanX; dx <= spanX; dx++) {
      const score = ringDarkness(map, x + dx, y + dy, radius);
      if (score > best.score) best = { x: x + dx, y: y + dy, score };
    }
  return best;
};

const bewerte = (fuellgrad, thresholds) =>
  fuellgrad >= thresholds.angekreuzt ? 'angekreuzt' : fuellgrad >= thresholds.zweifel ? 'unklar' : 'leer';

// Bei Aufnahmen mit viel Umgebung kann die Rahmensuche eine innere Linie als
// Unterkante waehlen. Fuer OCR und die affine Feinjustierung ist dann die
// bildgroessenbasierte Lagevermutung verlaesslicher.
const brauchbarerFrame = (frame, kalibrierung, image) => {
  if (!frame) return undefined;
  const breite = (frame.right - frame.left) / image.width;
  const hoehe = (frame.bottom - frame.top) / image.height;
  const referenzBreite = (kalibrierung.frame.right - kalibrierung.frame.left) / kalibrierung.referenz.breite;
  const referenzHoehe = (kalibrierung.frame.bottom - kalibrierung.frame.top) / kalibrierung.referenz.hoehe;
  return hoehe >= referenzHoehe * 0.78 && hoehe <= referenzHoehe * 1.25
    && breite >= referenzBreite * 0.72 && breite <= referenzBreite * 1.2
    ? frame : undefined;
};

const rahmenFürBild = (kalibrierung, image) => ({
  left: image.width * kalibrierung.frame.left / kalibrierung.referenz.breite,
  right: image.width * kalibrierung.frame.right / kalibrierung.referenz.breite,
  top: image.height * kalibrierung.frame.top / kalibrierung.referenz.hoehe,
  bottom: image.height * kalibrierung.frame.bottom / kalibrierung.referenz.hoehe,
});

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
export const recognizeAnkreuzungen = async (image, kalibrierung, {
  thresholds = kalibrierung.thresholds,
  adjust = true,
  textjustierung = true,
  ocr,
  ...options
} = {}) => {
  const map = toDarkness(image);
  const frame = findFrame(map, options);
  if (frame) log(`Grobe Ausrichtung ueber Rahmen: x ${round(frame.left)}..${round(frame.right)}, y ${round(frame.top)}..${round(frame.bottom)}`);
  const papier = findPapier(image);
  const istFoto = papier && (papier.right - papier.left < image.width * 0.96
    || papier.bottom - papier.top < image.height * 0.96);
  const textFrame = papier
    ? papierZuFrame(papier, kalibrierung)
    : brauchbarerFrame(frame, kalibrierung, image) ?? rahmenFürBild(kalibrierung, image);
  if (papier) log(`Grobe Papierlage: x ${round(papier.left)}..${round(papier.right)}, y ${round(papier.top)}..${round(papier.bottom)}`);
  if (frame && textFrame !== frame) log('Rahmen fuer OCR verworfen: unplausible Ausdehnung');

  const textLage = textjustierung ? await (async () => {
    const erkenne = ocr ?? (await import('./ocr.js')).erkenneWoerter;
    const bestimme = woerter => bestimmeTextTransformation(
      kalibrierung.textmarken, woerter, kalibrierung.frame, textFrame,
      { horizontalSlope: papier?.horizontalSlope },
    );
    const bereiche = berechneOcrBereiche(kalibrierung, image, textFrame);
    const bereichsLage = await (async () => {
      try {
        return bestimme(await erkenne(image, bereiche));
      } catch (fehler) {
        log(`OCR-Bereiche reichen nicht aus: ${fehler.message}`);
        return undefined;
      }
    })();
    const lagefehler = bereichsLage && Math.max(...bereichsLage.treffer.map(treffer => {
      const erwartet = transformiere(bereichsLage.transformation, treffer.muster);
      return Math.hypot(erwartet.x - treffer.aufnahme.x, erwartet.y - treffer.aufnahme.y);
    }));
    const verteilt = bereichsLage && (() => {
      const xs = bereichsLage.treffer.map(treffer => treffer.muster.x);
      const ys = bereichsLage.treffer.map(treffer => treffer.muster.y);
      return Math.max(...xs) - Math.min(...xs) >= frameWidth(kalibrierung.frame) * 0.2
        && Math.max(...ys) - Math.min(...ys) >= (kalibrierung.frame.bottom - kalibrierung.frame.top) * 0.2;
    })();
    if (bereichsLage && verteilt && lagefehler <= Math.hypot(image.width, image.height) * 0.06) return bereichsLage;
    log(`OCR-Fallback auf Gesamtbild${lagefehler ? `: Lagefehler ${round(lagefehler)} px` : ''}`);
    return bestimme(await erkenne(image));
  })() : undefined;
  if (!textLage && !frame) throw new Error('Kein Zettelrahmen erkannt - Aufnahme zeigt den Stimmzettel nicht vollstaendig.');
  if (textLage) log(`Affine Feinjustierung ueber ${textLage.treffer.length} Textmarken`);

  const radius = Math.max(3, Math.round(textLage
    ? kalibrierung.radius * frameWidth(kalibrierung.frame) * transformationsScale(textLage.transformation)
    : kalibrierung.radius * frameWidth(frame)));
  const messRadius = innerRadius(radius);

  const gemesseneFelder = kalibrierung.felder.map(feld => {
    const grob = textLage ? transformiere(textLage.transformation, feld.referenz) : toAbsolute(frame, feld);
    const { x, y } = adjust
      ? adjustFeld(map, Math.round(grob.x), Math.round(grob.y), radius, istFoto ? { x: 2, y: 2.5 } : 0.5)
      : grob;
    const fuellgrad = darkRatio(map, x, y, messRadius);
    return { ...feld, x, y, fuellgrad };
  });
  const bildThresholds = textLage
    ? (() => {
      const adaptiveGrenze = gemesseneFelder.map(feld => feld.fuellgrad)
        .sort((a, b) => a - b)[Math.floor(gemesseneFelder.length * 0.8)] + 0.04;
      return {
        ...thresholds,
        angekreuzt: Math.max(thresholds.angekreuzt, adaptiveGrenze),
        zweifel: Math.max(thresholds.zweifel, adaptiveGrenze),
      };
    })()
    : thresholds;
  const felder = gemesseneFelder.map(feld => ({ ...feld, status: bewerte(feld.fuellgrad, bildThresholds) }));

  // Nur auffaellige Felder protokollieren - eine Zeile je Feld waere nicht mehr lesbar.
  const auffaellig = felder.filter(feld => feld.status !== 'leer').map(feld => `${feld.id} ${round(feld.fuellgrad)} (${feld.status})`);
  log(`Markierungen: ${auffaellig.join(', ') || 'keine'}`);

  const stimmen = kalibrierung.stimmen.map(stimme => ({ ...stimme, ...werteStimme(felder, stimme) }));
  const wertung = stimmen.map(stimme => [stimme.name, stimme.status, stimme.treffer.join('+') || '-'].join(' '));
  log(`Wertung: ${wertung.join(', ')}`);

  return { felder, frame, radius, stimmen, transformation: textLage?.transformation, textmarken: textLage?.treffer };
};

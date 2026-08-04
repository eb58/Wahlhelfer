/**
 * Ankreuzerkennung: prueft je Ankreuzfeld, ob es markiert ist.
 *
 * Der perspektivische Druckrahmen liefert die grobe Lage. Mehrere gedruckte Ankreuzringe
 * bestimmen danach robust die Feinjustierung; OCR bleibt der Rueckfall fuer kontrastarme
 * Aufnahmen. Gemessen wird lokal normalisiert im Kreisinneren.
 */
import { toDarkness, darkRatio, ringDarkness } from './image.js';
import { findFrame, findPerspectiveFrame, toAbsolute, frameWidth } from './frame.js';
import { determineTextTransformation, transform, transformScale } from './textJustierung.js';
import { computeOcrRegions } from './ocrRegions.js';
import { findPaper, paperToFrame } from './paper.js';
import {
  determineRingTransformation, findRoughRingShift, normalizeField, transformRing,
} from './feldNormalisierung.js';
import { log, round } from './log.js';

const now = () => globalThis.performance?.now?.() ?? Date.now();
const logDuration = (text, start) => log(`${text}: ${round(now() - start)} ms`);

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

const classify = (fuellgrad, thresholds) =>
  fuellgrad >= thresholds.angekreuzt ? 'angekreuzt' : fuellgrad >= thresholds.zweifel ? 'unklar' : 'leer';

/**
 * Hebt die konfigurierten Schwellen an, wenn das Bild (Papierschatten, JPEG-Rauschen) einen
 * hoeheren Fuellgrad-Sockel hat als der Musterzettel. `angekreuzt` und `zweifel` behalten dabei
 * denselben Mindestabstand wie in den konfigurierten Schwellen - sonst faellt die Zweifelsfall-
 * Zone weg und blasse Markierungen werden ohne Vorlage fuer den Wahlvorstand durchgewinkt.
 */
export const computeImageThresholds = (measuredFelder, thresholds, { ringAlignment, textAlignment } = {}) => {
  if (!ringAlignment && !textAlignment) return thresholds;
  const fuellgrade = measuredFelder.map(feld => feld.fuellgrad).sort((a, b) => a - b);
  const [percentile, angekreuztGap, zweifelGap] = ringAlignment ? [0.65, 0.06, 0.045] : [0.8, 0.04, 0.025];
  const baseline = fuellgrade[Math.floor(fuellgrade.length * percentile)];
  return {
    ...thresholds,
    angekreuzt: Math.max(thresholds.angekreuzt, baseline + angekreuztGap),
    zweifel: Math.max(thresholds.zweifel, baseline + zweifelGap),
  };
};

const describeTextMarks = (textmarken, treffer = []) => [
  'Erwartete Textmarken:',
  ...textmarken.map((mark, index) => {
    const found = treffer.some(treffer => treffer.muster.x === mark.x && treffer.muster.y === mark.y);
    return `  ${found ? '✓' : '–'} ${index + 1}. ${mark.text} (${round(mark.x)}/${round(mark.y)})`;
  }),
].join('\n');

const plausiblePerspectiveCorrection = ({ correction }, image) => correction
  && Math.abs(correction.a - 1) <= 0.25
  && Math.abs(correction.d - 1) <= 0.25
  && Math.abs(correction.b) <= 0.08
  && Math.abs(correction.c) <= 0.08
  && Math.abs(correction.e) <= image.width * 0.1
  && Math.abs(correction.f) <= image.height * 0.1;

// Bei Aufnahmen mit viel Umgebung kann die Rahmensuche eine innere Linie als
// Unterkante waehlen. Fuer OCR und die affine Feinjustierung ist dann die
// bildgroessenbasierte Lagevermutung verlaesslicher.
const usableFrame = (frame, kalibrierung, image) => {
  if (!frame) return undefined;
  const width = (frame.right - frame.left) / image.width;
  const height = (frame.bottom - frame.top) / image.height;
  const referenceWidth = (kalibrierung.frame.right - kalibrierung.frame.left) / kalibrierung.referenz.breite;
  const referenceHeight = (kalibrierung.frame.bottom - kalibrierung.frame.top) / kalibrierung.referenz.hoehe;
  return height >= referenceHeight * 0.78 && height <= referenceHeight * 1.25
    && width >= referenceWidth * 0.72 && width <= referenceWidth * 1.2
    ? frame : undefined;
};

const frameForImage = (kalibrierung, image) => ({
  left: image.width * kalibrierung.frame.left / kalibrierung.referenz.breite,
  right: image.width * kalibrierung.frame.right / kalibrierung.referenz.breite,
  top: image.height * kalibrierung.frame.top / kalibrierung.referenz.hoehe,
  bottom: image.height * kalibrierung.frame.bottom / kalibrierung.referenz.hoehe,
});

/** Genau `auswahl` Markierungen sind gueltig; alles andere muss der Wahlvorstand entscheiden. */
const evaluateStimme = (felder, { id, auswahl }) => {
  const own = felder.filter(feld => feld.stimme === id);
  const treffer = own.filter(feld => feld.status === 'angekreuzt');
  const unclear = own.filter(feld => feld.status === 'unklar');
  return {
    treffer: treffer.map(feld => feld.id),
    status: treffer.length > auswahl ? 'mehrfach'
      : unclear.length ? 'zweifelsfall'
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
  const started = now();
  log(`Bildverarbeitung gestartet: ${image.width}x${image.height} Pixel`);
  const darknessStart = now();
  const map = toDarkness(image);
  logDuration('Dunkelheitskarte', darknessStart);
  const frameStart = now();
  const frame = findFrame(map, options);
  logDuration('Rahmensuche', frameStart);
  if (frame) log(`Grobe Ausrichtung ueber Rahmen: x ${round(frame.left)}..${round(frame.right)}, y ${round(frame.top)}..${round(frame.bottom)}`);
  const paperStart = now();
  const paper = findPaper(image);
  logDuration('Papierlage', paperStart);
  const isPhoto = paper && (paper.right - paper.left < image.width * 0.96
    || paper.bottom - paper.top < image.height * 0.96);
  const perspectiveStart = now();
  const perspectiveFrame = isPhoto ? findPerspectiveFrame(map, paper) : undefined;
  logDuration('Perspektivischer Druckrahmen', perspectiveStart);
  const textFrame = perspectiveFrame ?? (paper
    ? paperToFrame(paper, kalibrierung)
    : usableFrame(frame, kalibrierung, image) ?? frameForImage(kalibrierung, image));
  if (paper) log(`Grobe Papierlage: x ${round(paper.left)}..${round(paper.right)}, y ${round(paper.top)}..${round(paper.bottom)}`);
  if (perspectiveFrame) log('Perspektivischer Druckrahmen erkannt');
  else if (frame && textFrame !== frame) log('Rahmen fuer OCR verworfen: unplausible Ausdehnung');

  const ringAlignment = perspectiveFrame ? (() => {
    try {
      const ringStart = now();
      const shift = findRoughRingShift(
        map, perspectiveFrame, kalibrierung.frame,
        kalibrierung.felder.map(feld => feld.referenz), kalibrierung.referenzRadius,
      );
      const anchors = kalibrierung.felder.map(feld => {
        const base = {
          x: feld.referenz.x + shift.dx,
          y: feld.referenz.y + shift.dy,
        };
        const measurement = normalizeField(
          map, perspectiveFrame, kalibrierung.frame, base, kalibrierung.referenzRadius,
          { search: Math.round(kalibrierung.referenzRadius * 1.2) },
        );
        return { source: feld.referenz, target: measurement.referenz, ringScore: measurement.ringScore };
      });
      const alignment = determineRingTransformation(anchors);
      logDuration(`Ausrichtung ueber ${alignment.treffer.length} Ankreuzringe`, ringStart);
      return alignment;
    } catch (error) {
      log(`Ringbasierte Ausrichtung nicht ausreichend: ${error.message}`);
      return undefined;
    }
  })() : undefined;

  const textAlignment = textjustierung && !ringAlignment ? await (async () => {
    log('OCR-Rueckfall: Aussenrahmen wird maskiert');
    const recognize = ocr ?? (await import('./ocr.js')).recognizeWords;
    const determine = words => {
      const alignment = determineTextTransformation(
        kalibrierung.textmarken, words, kalibrierung.frame, textFrame,
        { horizontalSlope: perspectiveFrame?.horizontalSlope ?? paper?.horizontalSlope, perspectiveFrame },
      );
      if (!perspectiveFrame || plausiblePerspectiveCorrection(alignment.transformation, image)) return alignment;
      log('Perspektivischer Druckrahmen unplausibel: affine OCR-Transformation wird verwendet');
      return determineTextTransformation(
        kalibrierung.textmarken, words, kalibrierung.frame, textFrame,
        { horizontalSlope: paper?.horizontalSlope },
      );
    };
    const logTextMarks = treffer => log(`OCR-Textmarken:\n${describeTextMarks(kalibrierung.textmarken, treffer)}`);
    const regions = computeOcrRegions(kalibrierung, image, textFrame, { perspectiveFrame });
    const regionAlignment = await (async () => {
      try {
        const ocrStart = now();
        const words = await recognize(image, regions, textFrame);
        logDuration(`OCR in ${regions.length} Bereichen`, ocrStart);
        try {
          const alignment = determine(words);
          logTextMarks(alignment.treffer);
          return alignment;
        } catch (error) {
          log(`OCR-Bereiche reichen nicht aus: ${error.message}`);
          logTextMarks(error.treffer);
          return undefined;
        }
      } catch (error) {
        log(`OCR-Bereiche reichen nicht aus: ${error.message}`);
        return undefined;
      }
    })();
    const alignmentError = regionAlignment && Math.max(...regionAlignment.treffer.map(treffer => {
      const expected = transform(regionAlignment.transformation, treffer.muster);
      return Math.hypot(expected.x - treffer.aufnahme.x, expected.y - treffer.aufnahme.y);
    }));
    const distributed = regionAlignment && (() => {
      const xs = regionAlignment.treffer.map(treffer => treffer.muster.x);
      const ys = regionAlignment.treffer.map(treffer => treffer.muster.y);
      return Math.max(...xs) - Math.min(...xs) >= frameWidth(kalibrierung.frame) * 0.2
        && Math.max(...ys) - Math.min(...ys) >= (kalibrierung.frame.bottom - kalibrierung.frame.top) * 0.2;
    })();
    if (regionAlignment && distributed && alignmentError <= Math.hypot(image.width, image.height) * 0.06) return regionAlignment;
    log(`OCR-Fallback auf Gesamtbild${alignmentError ? `: Lagefehler ${round(alignmentError)} px` : ''}`);
    const ocrStart = now();
    const words = await recognize(image, undefined, textFrame);
    logDuration('OCR im Gesamtbild', ocrStart);
    try {
      const alignment = determine(words);
      logTextMarks(alignment.treffer);
      return alignment;
    } catch (error) {
      logTextMarks(error.treffer);
      throw error;
    }
  })() : undefined;
  if (!ringAlignment && !textAlignment && !frame) throw new Error('Kein Zettelrahmen erkannt - Aufnahme zeigt den Stimmzettel nicht vollstaendig.');
  if (textAlignment) log(`Affine Feinjustierung ueber ${textAlignment.treffer.length} Textmarken`);

  const ringScale = ringAlignment && Math.sqrt(Math.abs(
    ringAlignment.transformation.a * ringAlignment.transformation.d - ringAlignment.transformation.b * ringAlignment.transformation.c,
  ));
  const radius = Math.max(3, Math.round(ringAlignment
    ? kalibrierung.referenzRadius * ringScale * frameWidth(perspectiveFrame) / frameWidth(kalibrierung.frame)
    : textAlignment ? kalibrierung.radius * frameWidth(kalibrierung.frame) * transformScale(textAlignment.transformation)
    : kalibrierung.radius * frameWidth(frame)));
  const measureRadius = innerRadius(radius);

  const felderStart = now();
  const measuredFelder = ringAlignment ? kalibrierung.felder.map(feld => {
    const point = transformRing(ringAlignment.transformation, feld.referenz);
    const { referenz: ringReferenz, ...measurement } = normalizeField(
      map, perspectiveFrame, kalibrierung.frame, point, kalibrierung.referenzRadius * ringScale,
    );
    return { ...feld, ...measurement, ringReferenz };
  }) : kalibrierung.felder.map(feld => {
    const rough = textAlignment ? transform(textAlignment.transformation, feld.referenz) : toAbsolute(frame, feld);
    const { x, y } = adjust
      ? adjustFeld(map, Math.round(rough.x), Math.round(rough.y), radius, isPhoto ? { x: 2, y: 2.5 } : 0.5)
      : rough;
    const fuellgrad = darkRatio(map, x, y, measureRadius);
    return { ...feld, x, y, fuellgrad };
  });
  logDuration(`Ankreuzfelder (${measuredFelder.length})`, felderStart);
  const imageThresholds = computeImageThresholds(measuredFelder, thresholds, { ringAlignment, textAlignment });
  const felder = measuredFelder.map(feld => ({ ...feld, status: classify(feld.fuellgrad, imageThresholds) }));

  // Nur auffaellige Felder protokollieren - eine Zeile je Feld waere nicht mehr lesbar.
  const notable = felder.filter(feld => feld.status !== 'leer').map(feld => `${feld.id} ${round(feld.fuellgrad)} (${feld.status})`);
  log(`Markierungen: ${notable.join(', ') || 'keine'}`);

  const stimmen = kalibrierung.stimmen.map(stimme => ({ ...stimme, ...evaluateStimme(felder, stimme) }));
  const wertung = stimmen.map(stimme => [stimme.name, stimme.status, stimme.treffer.join('+') || '-'].join(' '));
  log(`Wertung: ${wertung.join(', ')}`);
  logDuration('Bildverarbeitung gesamt', started);

  return {
    felder, frame, radius, stimmen,
    transformation: ringAlignment?.transformation ?? textAlignment?.transformation,
    textmarken: textAlignment?.treffer ?? [],
  };
};

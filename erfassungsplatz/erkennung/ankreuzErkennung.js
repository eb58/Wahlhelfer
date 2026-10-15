/**
 * Ankreuzerkennung: prueft je Ankreuzfeld, ob es markiert ist.
 *
 * Der perspektivische Druckrahmen liefert die grobe Lage. Mehrere gedruckte Ankreuzringe
 * bestimmen danach robust die Feinjustierung; OCR bleibt der Rueckfall fuer kontrastarme
 * Aufnahmen. Gemessen wird lokal normalisiert im Kreisinneren.
 */
import { toDarkness, darkRatio, ringDarkness } from './image.js';
import { findFrame, findPerspectiveFrame, toAbsolute, frameWidth } from './frame.js';
import { alignByText, transform, transformScale } from './ocr.js';
import { findPaper } from './paper.js';
import {
  determineRingTransformation, findRoughRingShift, normalizeField, scoreFrame, transformRing,
} from './feldNormalisierung.js';
import { findFrameCandidates, reframe } from './frameQuad.js';
import { log, logDuration, now, round } from './log.js';

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
  if (paper) log(`Grobe Papierlage: x ${round(paper.left)}..${round(paper.right)}, y ${round(paper.top)}..${round(paper.bottom)}`);

  const referenzen = kalibrierung.felder.map(feld => feld.referenz);
  const alignRings = candidate => {
    try {
      const ringStart = now();
      const shift = findRoughRingShift(map, candidate, kalibrierung.frame, referenzen, kalibrierung.referenzRadius);
      const anchors = kalibrierung.felder.map(feld => {
        const base = {
          x: feld.referenz.x + shift.dx,
          y: feld.referenz.y + shift.dy,
        };
        const measurement = normalizeField(
          map, candidate, kalibrierung.frame, base, kalibrierung.referenzRadius,
          { search: Math.round(kalibrierung.referenzRadius * 1.2) },
        );
        return { source: feld.referenz, target: measurement.referenz, ringScore: measurement.ringScore };
      });
      const alignment = determineRingTransformation(anchors);
      logDuration(`Ausrichtung ueber ${alignment.treffer.length} Ankreuzringe`, ringStart);
      return { ...alignment, frame: candidate };
    } catch (error) {
      log(`Ringbasierte Ausrichtung nicht ausreichend: ${error.message}`);
      return undefined;
    }
  };

  // Wie im Sudoku-Scanner: mehrere Rahmenkandidaten, bestaetigt am Musterzettel. Der Rahmen als
  // geschlossene Komponente ist meist am genauesten. Mit Huelle in der Kalibrierung kann jedes
  // Viereck auch deren Rand sein; welche Deutung passt, entscheidet ebenfalls scoreFrame.
  const candidateStart = now();
  const quads = isPhoto ? findFrameCandidates(map, kalibrierung.frame, { paper }) : [];
  const huellen = kalibrierung.huelle ? quads.map(quad => reframe(quad, kalibrierung.huelle, kalibrierung.frame)) : [];
  const frameCandidates = [...quads, ...huellen]
    .map(candidate => ({ candidate, score: scoreFrame(map, candidate, kalibrierung.frame, referenzen, kalibrierung.referenzRadius) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  logDuration(`Rahmenkandidaten (${frameCandidates.length})`, candidateStart);
  const quadAlignment = frameCandidates.reduce((found, { candidate }) => found ?? alignRings(candidate), undefined);

  // Die Linien-Suche ist teuer und nur noch Ersatz: gerechnet wird sie erst, wenn kein Viereck
  // traegt - dann als weiterer Ringkandidat und als Lage fuer den OCR-Rueckfall.
  const perspectiveStart = now();
  const perspectiveFrame = isPhoto && !quadAlignment ? findPerspectiveFrame(map, paper) : undefined;
  if (perspectiveFrame) logDuration('Perspektivischer Druckrahmen erkannt', perspectiveStart);
  const ringAlignment = quadAlignment ?? (perspectiveFrame && alignRings(perspectiveFrame));
  const ringFrame = ringAlignment?.frame;
  const textAlignment = textjustierung && !ringAlignment
    ? await alignByText(image, kalibrierung, { frame, paper, perspectiveFrame }, ocr)
    : undefined;
  if (!ringAlignment && !textAlignment && !frame) throw new Error('Kein Zettelrahmen erkannt - Aufnahme zeigt den Stimmzettel nicht vollstaendig.');
  if (textAlignment) log(`Affine Feinjustierung ueber ${textAlignment.treffer.length} Textmarken`);

  const ringScale = ringAlignment && Math.sqrt(Math.abs(
    ringAlignment.transformation.a * ringAlignment.transformation.d - ringAlignment.transformation.b * ringAlignment.transformation.c,
  ));
  const radius = Math.max(3, Math.round(ringAlignment
    ? kalibrierung.referenzRadius * ringScale * frameWidth(ringFrame) / frameWidth(kalibrierung.frame)
    : textAlignment ? kalibrierung.radius * frameWidth(kalibrierung.frame) * transformScale(textAlignment.transformation)
    : kalibrierung.radius * frameWidth(frame)));
  const measureRadius = innerRadius(radius);

  const felderStart = now();
  const measuredFelder = ringAlignment ? kalibrierung.felder.map(feld => {
    const point = transformRing(ringAlignment.transformation, feld.referenz);
    const { referenz: ringReferenz, ...measurement } = normalizeField(
      map, ringFrame, kalibrierung.frame, point, kalibrierung.referenzRadius * ringScale,
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

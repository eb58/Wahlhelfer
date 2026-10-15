/**
 * Ankreuzerkennung: prueft je Ankreuzfeld, ob es markiert ist.
 *
 * Bei Fotos liefert der perspektivische Druckrahmen die grobe Lage, mehrere gedruckte Ankreuzringe
 * bestimmen danach robust die Feinjustierung. Findet sich keine Ringlage, wird das Foto abgelehnt
 * statt geraten. Scans richten sich nach dem geraden Rahmen. Gemessen wird lokal normalisiert im
 * Kreisinneren.
 */
import { toDarkness, darkRatio, ringDarkness } from './image.js';
import { findFrame, findPerspectiveFrame, toAbsolute, frameWidth } from './frame.js';
import { findPaper } from './paper.js';
import {
  determineRingTransformation, findRoughRingShift, normalizeField, scoreFrame, transformRing,
} from './feldNormalisierung.js';
import { findFrameCandidates, reframe } from './frameQuad.js';

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
export const computeImageThresholds = (measuredFelder, thresholds, { ringAlignment } = {}) => {
  if (!ringAlignment) return thresholds;
  const fuellgrade = measuredFelder.map(feld => feld.fuellgrad).sort((a, b) => a - b);
  const baseline = fuellgrade[Math.floor(fuellgrade.length * 0.65)];
  return {
    ...thresholds,
    angekreuzt: Math.max(thresholds.angekreuzt, baseline + 0.06),
    zweifel: Math.max(thresholds.zweifel, baseline + 0.045),
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
  ...options
} = {}) => {
  const map = toDarkness(image);
  const frame = findFrame(map, options);
  const paper = findPaper(image);
  const isPhoto = paper && (paper.right - paper.left < image.width * 0.96
    || paper.bottom - paper.top < image.height * 0.96);

  const referenzen = kalibrierung.felder.map(feld => feld.referenz);
  const alignRings = candidate => {
    try {
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
      return { ...determineRingTransformation(anchors), frame: candidate };
    } catch {
      return undefined;
    }
  };

  // Wie im Sudoku-Scanner: mehrere Rahmenkandidaten, bestaetigt am Musterzettel. Der Rahmen als
  // geschlossene Komponente ist meist am genauesten. Mit Huelle in der Kalibrierung kann jedes
  // Viereck auch deren Rand sein; welche Deutung passt, entscheidet ebenfalls scoreFrame.
  const quads = isPhoto ? findFrameCandidates(map, kalibrierung.frame, { paper }) : [];
  const huellen = kalibrierung.huelle ? quads.map(quad => reframe(quad, kalibrierung.huelle, kalibrierung.frame)) : [];
  const frameCandidates = [...quads, ...huellen]
    .map(candidate => ({ candidate, score: scoreFrame(map, candidate, kalibrierung.frame, referenzen, kalibrierung.referenzRadius) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const quadAlignment = frameCandidates.reduce((found, { candidate }) => found ?? alignRings(candidate), undefined);

  // Die Linien-Suche ist teuer und nur noch Ersatz: gerechnet wird sie erst, wenn kein Viereck
  // traegt - dann als weiterer Ringkandidat.
  const perspectiveFrame = isPhoto && !quadAlignment ? findPerspectiveFrame(map, paper) : undefined;
  const ringAlignment = quadAlignment ?? (perspectiveFrame && alignRings(perspectiveFrame));
  const ringFrame = ringAlignment?.frame;
  // Ohne Ringlage ist ein Foto nicht sicher zu werten: lieber ablehnen als raten.
  if (!ringAlignment && isPhoto) throw new Error('Ankreuzfelder nicht sicher gefunden - Aufnahme bitte gerade, scharf und vollstaendig wiederholen.');
  if (!ringAlignment && !frame) throw new Error('Kein Zettelrahmen erkannt - Aufnahme zeigt den Stimmzettel nicht vollstaendig.');

  const ringScale = ringAlignment && Math.sqrt(Math.abs(
    ringAlignment.transformation.a * ringAlignment.transformation.d - ringAlignment.transformation.b * ringAlignment.transformation.c,
  ));
  const radius = Math.max(3, Math.round(ringAlignment
    ? kalibrierung.referenzRadius * ringScale * frameWidth(ringFrame) / frameWidth(kalibrierung.frame)
    : kalibrierung.radius * frameWidth(frame)));
  const measureRadius = innerRadius(radius);

  const measuredFelder = ringAlignment ? kalibrierung.felder.map(feld => {
    const point = transformRing(ringAlignment.transformation, feld.referenz);
    // Papierwoelbung kann lokal staerker von der gemeinsamen affinen Lage abweichen.
    // Wie bei den Ankern auf den gedruckten Ring einrasten, ohne das Kreisinnere zu bewerten.
    const { referenz: ringReferenz, ...measurement } = normalizeField(
      map, ringFrame, kalibrierung.frame, point, kalibrierung.referenzRadius * ringScale,
      { search: Math.round(kalibrierung.referenzRadius * ringScale * 1.2) },
    );
    return { ...feld, ...measurement, ringReferenz };
  }) : kalibrierung.felder.map(feld => {
    const rough = toAbsolute(frame, feld);
    const { x, y } = adjust ? adjustFeld(map, Math.round(rough.x), Math.round(rough.y), radius) : rough;
    const fuellgrad = darkRatio(map, x, y, measureRadius);
    return { ...feld, x, y, fuellgrad };
  });
  const imageThresholds = computeImageThresholds(measuredFelder, thresholds, { ringAlignment });
  const felder = measuredFelder.map(feld => ({ ...feld, status: classify(feld.fuellgrad, imageThresholds) }));
  const stimmen = kalibrierung.stimmen.map(stimme => ({ ...stimme, ...evaluateStimme(felder, stimme) }));

  return {
    felder, frame, radius, stimmen,
    transformation: ringAlignment?.transformation,
  };
};

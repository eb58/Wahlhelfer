/**
 * Ankreuzerkennung: prueft je Ankreuzfeld, ob es markiert ist.
 *
 * Bei Fotos liefert der perspektivische Druckrahmen die grobe Lage, mehrere gedruckte Ankreuzringe
 * bestimmen danach robust die Feinjustierung. Findet sich keine Ringlage, wird das Foto abgelehnt
 * statt geraten. Scans richten sich nach dem geraden Rahmen. Gemessen wird lokal normalisiert im
 * Kreisinneren.
 */
import { toDarkness, darkRatio, ringDarkness, rotateImage } from './image.js';
import { findFrame, findPerspectiveFrame, toAbsolute, frameWidth } from './frame.js';
import { findPaper } from './paper.js';
import {
  determineRingTransformation, findRoughRingShift, normalizeField, scoreFrame, transformRing,
} from './feldNormalisierung.js';
import { findFrameCandidates, reframe } from './frameQuad.js';

/** So deutlich muss sich an jedem Feld ein gedruckter Ring abzeichnen (normalizeField). */
const MIN_RING_SCORE = 0.3;
/** Ab diesem ringScore genuegt die enge Ringsuche bei der Messung; darunter wird weit gesucht. */
const SICHERER_RING_SCORE = 0.45;

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
  const paper = findPaper(image);
  const isPhoto = paper && (paper.right - paper.left < image.width * 0.96
    || paper.bottom - paper.top < image.height * 0.96);
  // Den geraden Rahmen braucht nur der Scan-Pfad; Fotos tragen Rahmenkandidaten und Ringe.
  const frame = isPhoto ? undefined : findFrame(map, options);

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
    // Wie bei den Ankern auf den gedruckten Ring einrasten, ohne das Kreisinnere zu bewerten. Meist
    // liegt er nach der Ausrichtung schon fast genau dort (99 % innerhalb von 0,14 Radien), deshalb
    // erst eng suchen. Papierwoelbung kann ihn lokal aber um mehr als einen Radius verschieben: Liegt
    // der beste Ring am Rand des engen Fensters oder ist er schwach, wird weit gesucht.
    const ringRadius = kalibrierung.referenzRadius * ringScale;
    const measure = factor => {
      const search = Math.max(2, Math.round(ringRadius * factor));
      const { referenz: ringReferenz, ...measurement } = normalizeField(map, ringFrame, kalibrierung.frame, point, ringRadius, { search });
      const amRand = Math.max(Math.abs(ringReferenz.x - point.x), Math.abs(ringReferenz.y - point.y)) >= search - 1;
      return { ...feld, ...measurement, ringReferenz, sicher: !amRand && measurement.ringScore >= SICHERER_RING_SCORE };
    };
    const { sicher, ...eng } = measure(0.3);
    if (sicher) return eng;
    const { sicher: _, ...weit } = measure(1.2);
    return weit;
  }) : kalibrierung.felder.map(feld => {
    const rough = toAbsolute(frame, feld);
    const { x, y } = adjust ? adjustFeld(map, Math.round(rough.x), Math.round(rough.y), radius) : rough;
    const fuellgrad = darkRatio(map, x, y, measureRadius);
    return { ...feld, x, y, fuellgrad };
  });
  // Jedes Feld muss auf einem gedruckten Ring liegen. Die gemeinsame Ausrichtung braucht nur einige
  // Ringe; kopfueber liegen beim Bundestagszettel 8-10 von 14 Ringen fast symmetrisch auf anderen.
  // Dort fehlt an manchen Feldern der Ring (ringScore hoechstens 0,2), aufrecht nie (mindestens 0,4).
  if (ringAlignment && measuredFelder.some(feld => feld.ringScore < MIN_RING_SCORE))
    throw new Error('Ankreuzfelder nicht sicher gefunden - Aufnahme bitte gerade, scharf und vollstaendig wiederholen.');
  const imageThresholds = computeImageThresholds(measuredFelder, thresholds, { ringAlignment });
  const felder = measuredFelder.map(feld => ({ ...feld, status: classify(feld.fuellgrad, imageThresholds) }));
  const stimmen = kalibrierung.stimmen.map(stimme => ({ ...stimme, ...evaluateStimme(felder, stimme) }));

  return {
    felder, frame, radius, stimmen,
    transformation: ringAlignment?.transformation,
  };
};

/**
 * Wie recognizeAnkreuzungen, aber auch fuer quer aufgenommene Zettel: Liegt der Zettel flach,
 * raet das Smartphone die Lage oft falsch und speichert das Foto quer. Erst wenn die Aufnahme so
 * nicht traegt, werden beide Vierteldrehungen versucht (kopfueber wird nicht aufgenommen). Genommen
 * wird eine Drehung nur, wenn genau eine traegt - sonst lieber ablehnen als eine falsche Lage werten. `rotation` sagt dann,
 * um wie viele Vierteldrehungen im Uhrzeigersinn das Bild gedreht wurde; die Koordinaten im Ergebnis
 * gehoeren zum gedrehten Bild.
 */
export const recognizeInAnyRotation = async (image, kalibrierung, options) => {
  try {
    return { ...await recognizeAnkreuzungen(image, kalibrierung, options), rotation: 0 };
  } catch (error) {
    const rotated = [];
    for (const rotation of [1, 3])
      try {
        rotated.push({ ...await recognizeAnkreuzungen(rotateImage(image, rotation), kalibrierung, options), rotation });
      } catch { /* diese Lage traegt nicht */ }
    if (rotated.length !== 1) throw error;
    return rotated[0];
  }
};

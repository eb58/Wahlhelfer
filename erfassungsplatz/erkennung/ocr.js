/**
 * OCR-Rueckfall: alles, was die Erkennung ueber Text statt ueber Ankreuzringe ausrichtet.
 *
 * Aus der groben Zettellage werden kleine Ausschnitte um die vermessenen Textmarken
 * geschnitten, lokal mit Tesseract gelesen und den Textmarken zugeordnet. Daraus folgt eine
 * affine Abbildung von Muster- auf Aufnahmepixel. Reichen die Ausschnitte nicht, wird die
 * ganze Aufnahme gelesen. Worker, WebAssembly und deutsches Sprachmodell kommen aus dem Build;
 * Tesseract wird erst beim ersten Rueckfall geladen.
 */
import { toAbsolute, toRelative, frameWidth, perspectivePoint } from './frame.js';
import { paperToFrame } from './paper.js';
import { regressPlane } from './leastSquares.js';
import { log, round } from './log.js';
import { appUrl } from '../../shared/appUrl.js';

const now = () => globalThis.performance?.now?.() ?? Date.now();
const logDuration = (text, start) => log(`${text}: ${round(now() - start)} ms`);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

// --- Zuordnung der Textmarken und affine Textlage -------------------------------------------

const normalizeText = text => text
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const levenshtein = (left, right) => {
  const previousRow = [...Array(right.length + 1).keys()];
  for (let i = 1; i <= left.length; i++) {
    const currentRow = [i];
    for (let j = 1; j <= right.length; j++)
      currentRow[j] = Math.min(currentRow[j - 1] + 1, previousRow[j] + 1, previousRow[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    previousRow.splice(0, previousRow.length, ...currentRow);
  }
  return previousRow.at(-1);
};

const similarity = (left, right) => {
  const a = normalizeText(left), b = normalizeText(right);
  return a && b ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 0;
};

const midpoint = ({ bbox, x, y }) => bbox
  ? { x: (bbox.x0 + bbox.x1) / 2, y: (bbox.y0 + bbox.y1) / 2 }
  : { x, y };

const roughPosition = (textmarke, kalibrierungsFrame, aufnahmeFrame) => ({
  x: aufnahmeFrame.left + (textmarke.x - kalibrierungsFrame.left)
    / (kalibrierungsFrame.right - kalibrierungsFrame.left) * (aufnahmeFrame.right - aufnahmeFrame.left),
  y: aufnahmeFrame.top + (textmarke.y - kalibrierungsFrame.top)
    / (kalibrierungsFrame.bottom - kalibrierungsFrame.top) * (aufnahmeFrame.bottom - aufnahmeFrame.top),
});

const matchTextMarks = (textmarken, words, kalibrierungsFrame, aufnahmeFrame, used = new Set(), transformation, project) => {
  const diagonal = aufnahmeFrame
    ? Math.hypot(aufnahmeFrame.right - aufnahmeFrame.left, aufnahmeFrame.bottom - aufnahmeFrame.top)
    : 1;

  return textmarken.flatMap(({ mark: textmarke, index: textmarkeIndex }) => {
    const base = project?.(textmarke) ?? textmarke;
    const expected = transformation
      ? transform(transformation, base)
      : project ? base
      : aufnahmeFrame ? roughPosition(textmarke, kalibrierungsFrame, aufnahmeFrame) : undefined;
    const candidates = words
      .map((word, index) => ({ word, index, point: midpoint(word), similarity: similarity(textmarke.text, word.text) }))
      .filter(candidate => !used.has(candidate.index) && candidate.similarity >= 0.75
        && (candidate.word.textmarke === undefined || candidate.word.textmarke === textmarkeIndex))
      .filter(candidate => !transformation || Math.hypot(candidate.point.x - expected.x, candidate.point.y - expected.y) <= diagonal * 0.06)
      .map(candidate => ({
        ...candidate,
        score: candidate.similarity - (expected ? Math.hypot(candidate.point.x - expected.x, candidate.point.y - expected.y) / diagonal * 0.2 : 0),
      }))
      .sort((a, b) => b.score - a.score);
    const [best] = candidates;
    if (!best) return [];
    used.add(best.index);
    return [{ text: textmarke.text, muster: { x: textmarke.x, y: textmarke.y }, base, aufnahme: best.point, score: best.score }];
  });
};

const regress = (treffer, axis) => {
  const result = regressPlane(treffer, ({ muster, base = muster }) => base, ({ aufnahme }) => aufnahme, axis);
  if (!result) throw new Error('Textmarken liegen nicht ausreichend verteilt.');
  return result;
};

export const transform = (transformation, point) => {
  if (transformation.perspectiveFrame) {
    const base = perspectivePoint(transformation.perspectiveFrame, transformation.kalibrierungsFrame, point);
    return transform(transformation.correction, base);
  }
  const { a, b, c, d, e, f } = transformation;
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
};

export const transformScale = transformation => {
  if (!transformation.perspectiveFrame) {
    const { a, b, c, d } = transformation;
    return Math.sqrt(Math.abs(a * d - b * c));
  }
  const { kalibrierungsFrame: frame } = transformation;
  const center = { x: (frame.left + frame.right) / 2, y: (frame.top + frame.bottom) / 2 };
  const point = transform(transformation, center);
  const x = transform(transformation, { ...center, x: center.x + 1 });
  const y = transform(transformation, { ...center, y: center.y + 1 });
  return Math.sqrt(Math.abs((x.x - point.x) * (y.y - point.y) - (x.y - point.y) * (y.x - point.x)));
};

const regressLine = (treffer, valueOf) => {
  const sums = treffer.reduce((sum, treffer) => ({
    y: sum.y + (treffer.base ?? treffer.muster).y,
    yy: sum.yy + (treffer.base ?? treffer.muster).y ** 2,
    z: sum.z + valueOf(treffer),
    zy: sum.zy + valueOf(treffer) * (treffer.base ?? treffer.muster).y,
  }), { y: 0, yy: 0, z: 0, zy: 0 });
  const denominator = treffer.length * sums.yy - sums.y ** 2;
  if (Math.abs(denominator) < 1e-8) throw new Error('Textmarken liegen nicht ausreichend verteilt.');
  const d = (treffer.length * sums.zy - sums.y * sums.z) / denominator;
  return [d, (sums.z - d * sums.y) / treffer.length];
};

const regressTransformation = (treffer, horizontalSlope, yTreffer = treffer) => {
  const [a, c, e] = regress(treffer, 'x');
  const [b, d, f] = Number.isFinite(horizontalSlope)
    ? (() => {
      const b = horizontalSlope * a;
      const [d, f] = regressLine(yTreffer, treffer => treffer.aufnahme.y - b * (treffer.base ?? treffer.muster).x);
      return [b, d, f];
    })()
    : regress(yTreffer, 'y');
  return { a, b, c, d, e, f };
};

export const determineTextTransformation = (textmarken, words, kalibrierungsFrame, aufnahmeFrame, { horizontalSlope, perspectiveFrame } = {}) => {
  const entries = textmarken.map((mark, index) => ({ mark, index }));
  const frequency = textmarken.reduce((values, mark) => ({ ...values, [normalizeText(mark.text)]: (values[normalizeText(mark.text)] ?? 0) + 1 }), {});
  const unique = entries.filter(({ mark }) => frequency[normalizeText(mark.text)] === 1);
  const duplicates = entries.filter(({ mark }) => frequency[normalizeText(mark.text)] > 1);
  const used = new Set();
  const project = perspectiveFrame ? point => perspectivePoint(perspectiveFrame, kalibrierungsFrame, point) : undefined;
  const slope = perspectiveFrame ? undefined : horizontalSlope;
  const firstTreffer = matchTextMarks(unique, words, kalibrierungsFrame, aufnahmeFrame, used, undefined, project);
  const preliminary = firstTreffer.length >= 3 ? regressTransformation(firstTreffer, slope) : undefined;
  const treffer = [
    ...firstTreffer,
    ...matchTextMarks(duplicates, words, kalibrierungsFrame, aufnahmeFrame, used, preliminary, project),
  ];
  if (treffer.length < 3) {
    const error = new Error(`Zu wenige Textmarken erkannt (${treffer.length}/${textmarken.length}) - Aufnahme bitte gerade und scharf wiederholen.`);
    error.treffer = treffer;
    throw error;
  }
  const feldBoundary = kalibrierungsFrame.top + (kalibrierungsFrame.bottom - kalibrierungsFrame.top) * 0.3;
  const feldTreffer = firstTreffer.filter(treffer => treffer.muster.y >= feldBoundary);
  const yTreffer = feldTreffer.length >= 2 ? feldTreffer : firstTreffer;
  const correction = regressTransformation(treffer, slope, yTreffer);
  const transformation = perspectiveFrame
    ? { perspectiveFrame, kalibrierungsFrame, correction }
    : correction;
  return { transformation, treffer };
};

// --- OCR-Bereiche ---------------------------------------------------------------------------

const markerPoint = (kalibrierung, mark, image, frame, perspectiveFrame) => perspectiveFrame
  ? perspectivePoint(perspectiveFrame, kalibrierung.frame, mark)
  : frame ? toAbsolute(frame, toRelative(kalibrierung.frame, mark))
  : {
    x: mark.x / kalibrierung.referenz.breite * image.width,
    y: mark.y / kalibrierung.referenz.hoehe * image.height,
  };

/**
 * Je Textmarke ein Ausschnitt um ihre erwartete Lage. Die Ausschnitte bleiben in
 * Originalaufloesung; nur die weissen Zwischenraeume des Zettels fallen aus dem OCR-Bild.
 */
export const computeOcrRegions = (kalibrierung, image, frame, { perspectiveFrame } = {}) => {
  const boxWidth = Math.min(image.width, Math.max(180, Math.round((frame ? frameWidth(frame) : image.width) * 0.18)));
  const boxHeight = Math.min(image.height, Math.max(160, Math.round(boxWidth * 0.3)));
  return kalibrierung.textmarken.map((mark, textmarke) => {
    const point = markerPoint(kalibrierung, mark, image, frame, perspectiveFrame);
    return {
      left: clamp(Math.round(point.x - boxWidth / 2), 0, image.width - boxWidth),
      top: clamp(Math.round(point.y - boxHeight / 2), 0, image.height - boxHeight),
      width: boxWidth,
      height: boxHeight,
      textmarke,
    };
  });
};

// --- Tesseract ------------------------------------------------------------------------------

/** Woerter aus dem Tesseract-Ergebnis (`blocks: true`). */
export const readWords = blocks => (blocks ?? [])
  .flatMap(block => block.paragraphs)
  .flatMap(paragraph => paragraph.lines)
  .flatMap(line => line.words)
  .map(({ text, confidence, bbox }) => ({ text, confidence, bbox }));

/** Rechnet ein Wort aus dem Streifenbild in Aufnahme-Pixel zurueck; `offsets` von packRegions. */
export const moveBbox = (word, offsets) => {
  const y = (word.bbox.y0 + word.bbox.y1) / 2;
  const offset = offsets.find(region => y >= region.top && y < region.top + region.height);
  return offset && {
    ...word,
    textmarke: offset.textmarke,
    bbox: {
      x0: word.bbox.x0 + offset.left,
      x1: word.bbox.x1 + offset.left,
      y0: word.bbox.y0 - offset.top + offset.sourceTop,
      y1: word.bbox.y1 - offset.top + offset.sourceTop,
    },
  };
};

const state = {};
const assetPath = path => appUrl(`vendor/${path}`);

const loadWorker = () => state.worker ??= import('tesseract.js').then(({ createWorker }) => createWorker('deu', 1, {
  workerPath: assetPath('tesseract/worker.min.js'),
  corePath: assetPath('tesseract-core'),
  langPath: assetPath('tessdata'),
}));

const createCanvas = (width, height) =>
  typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height });

const toBlobUrl = async canvas => {
  const blob = await (canvas.convertToBlob?.({ type: 'image/png' })
    ?? new Promise(done => canvas.toBlob(done, 'image/png')));
  return globalThis.URL.createObjectURL(blob);
};

/** Entfernt den gedruckten Aussenrahmen aus dem Bild, bevor Tesseract es sieht. */
const removeFrame = (context, { width, height }, frame) => {
  if (!frame) return;
  const band = Math.max(3, Math.round(Math.min(width, height) * 0.004));
  if (frame.corners) {
    const { topLeft, topRight, bottomRight, bottomLeft } = frame.corners;
    context.strokeStyle = '#fff';
    context.lineWidth = band * 2;
    context.beginPath();
    context.moveTo(topLeft.x, topLeft.y);
    context.lineTo(topRight.x, topRight.y);
    context.lineTo(bottomRight.x, bottomRight.y);
    context.lineTo(bottomLeft.x, bottomLeft.y);
    context.closePath();
    context.stroke();
    return;
  }
  context.fillStyle = '#fff';
  context.fillRect(Math.max(0, frame.left - band), 0, band * 2, height);
  context.fillRect(Math.max(0, frame.right - band), 0, band * 2, height);
  context.fillRect(0, Math.max(0, frame.top - band), width, band * 2);
  context.fillRect(0, Math.max(0, frame.bottom - band), width, band * 2);
};

const toFrameFreeCanvas = (imageData, frame) => {
  const canvas = createCanvas(imageData.width, imageData.height);
  const context = canvas.getContext('2d');
  context.putImageData(imageData, 0, 0);
  removeFrame(context, imageData, frame);
  return canvas;
};

/**
 * Setzt die unverkleinerten Ausschnitte untereinander zu einem kompakten OCR-Bild zusammen.
 * `offsets` beschreibt, wo jeder Streifen im Ausgangsbild lag.
 */
const toTextStripUrl = async (imageData, regions, frame) => {
  const source = toFrameFreeCanvas(imageData, frame);
  const gap = 20;
  const canvasWidth = Math.max(...regions.map(region => region.width));
  const canvasHeight = regions.reduce((sum, region) => sum + region.height, 0) + gap * Math.max(0, regions.length - 1);
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  const offsets = [];
  let top = 0;
  for (const region of regions) {
    context.drawImage(source, region.left, region.top, region.width, region.height, 0, top, region.width, region.height);
    offsets.push({ ...region, sourceTop: region.top, top });
    top += region.height + gap;
  }
  return { imageUrl: await toBlobUrl(canvas), offsets };
};

const saveDebugImage = (imageUrl, regions) => {
  if (new URLSearchParams(globalThis.location?.search ?? '').get('ocrDebug') !== '1') return;
  const link = globalThis.document?.createElement('a');
  if (!link) return;
  state.debugImage = (state.debugImage ?? 0) + 1;
  link.href = imageUrl;
  link.download = `wahl-ocr-${regions ? 'regions' : 'full'}-${state.debugImage}.png`;
  link.click();
  log(`OCR-Bild gespeichert: ${link.download}`);
};

/**
 * Lokale Browser-OCR, wahlweise nur in den Ausschnitten oder im ganzen Bild.
 * @returns {Promise<Array<{text:string,confidence:number,bbox:object}>>}
 */
export const recognizeWords = async (image, regions, frame) => {
  const source = regions
    ? await toTextStripUrl(image, regions, frame)
    : { imageUrl: await toBlobUrl(toFrameFreeCanvas(image, frame)) };
  saveDebugImage(source.imageUrl, regions);
  try {
    const worker = await loadWorker();
    const { data } = await worker.recognize(
      source.imageUrl,
      { tessedit_pageseg_mode: '11' },
      { text: false, blocks: true },
    );
    const words = readWords(data.blocks).filter(word => word.confidence >= 20);
    const output = words.slice(0, 20)
      .map(word => `${word.text.trim()} (${round(word.confidence)}%)`)
      .filter(word => word.startsWith('(') === false)
      .join(', ');
    log(`OCR erkannte ${words.length} Woerter${output ? `: ${output}${words.length > 20 ? ', ...' : ''}` : ''}`);
    return source.offsets ? words.map(word => moveBbox(word, source.offsets)).filter(Boolean) : words;
  } finally {
    globalThis.URL.revokeObjectURL(source.imageUrl);
  }
};

// --- Ablauf des Rueckfalls ------------------------------------------------------------------

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

/**
 * Richtet die Aufnahme ueber die Textmarken aus: erst OCR in den Ausschnitten, bei zu wenigen,
 * schlecht verteilten oder ungenauen Treffern im ganzen Bild. Wirft, wenn auch das nicht reicht.
 * @param {object} lage grobe Lage aus der Bildverarbeitung: `frame` (Rahmenlinien),
 *   `paper` (Papierflaeche), `perspectiveFrame` (perspektivischer Druckrahmen)
 * @param {Function} [recognize] Ersatz fuer recognizeWords (Node, Tests)
 * @returns {Promise<{transformation:object,treffer:Array}>}
 */
export const alignByText = async (image, kalibrierung, { frame, paper, perspectiveFrame }, recognize = recognizeWords) => {
  const textFrame = perspectiveFrame ?? (paper
    ? paperToFrame(paper, kalibrierung)
    : usableFrame(frame, kalibrierung, image) ?? frameForImage(kalibrierung, image));
  if (!perspectiveFrame && frame && textFrame !== frame) log('Rahmen fuer OCR verworfen: unplausible Ausdehnung');
  log('OCR-Rueckfall: Aussenrahmen wird maskiert');
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
};

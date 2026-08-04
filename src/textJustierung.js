/**
 * Textbasierte Feinjustierung: ordnet vermessene Textmarken erkannten OCR-Woertern zu
 * und bestimmt daraus eine affine Abbildung von Muster- auf Aufnahmepixel.
 */
import { perspectivePoint } from './frame.js';
import { regressPlane } from './leastSquares.js';

const normalizeText = text => text
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
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

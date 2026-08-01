/**
 * Ausrichtung einer Aufnahme auf das gelernte Referenzlayout.
 *
 * Aus den per OCR gelieferten Wortkoordinaten wird eine Aehnlichkeitstransformation
 * (Verschiebung, Drehung, Massstab) gefittet. Anders als die Rahmensuche vertraegt das
 * schraeg gehaltene Aufnahmen.
 *
 * Verfahren uebernommen aus dem Projekt `gratulationsdienst`
 * (`modules/sokoQuestionnaireLegacy.js`). Dort sind die Ankerwoerter fest vermessen,
 * hier werden sie beim Registrieren aus dem Musterzettel gelernt.
 */

export const ocrNormalize = value =>
  String(value ?? '').normalize('NFKD').toLowerCase().replaceAll('ß', 'ss').replace(/[^\p{L}\p{N}]+/gu, '');

/** Levenshtein-Distanz - toleriert die ueblichen Lesefehler kurzer Woerter. */
export const editDistance = (left, right) => [...left].reduce((previous, char, row) => {
  const current = [row + 1];
  [...right].forEach((other, column) => current.push(Math.min(
    current[column] + 1,
    previous[column + 1] + 1,
    previous[column] + (char === other ? 0 : 1),
  )));
  return current;
}, Array.from({ length: right.length + 1 }, (_, i) => i)).at(-1);

/** Laengere Woerter duerfen Lesefehler haben, kurze muessen exakt sitzen. */
export const anchorMatches = (found, expected) => {
  const a = ocrNormalize(found), b = ocrNormalize(expected);
  if (!a || !b) return false;
  const tolerance = b.length >= 10 ? 2 : b.length >= 6 ? 1 : 0;
  return Math.abs(a.length - b.length) <= tolerance && editDistance(a, b) <= tolerance;
};

/**
 * Wortmitte im Referenzmassstab. OCR laeuft auf einer vergroesserten Fassung,
 * die Feldlagen stehen im Originalmassstab - ohne `scale` passt beides nicht zusammen.
 */
export const wordCenter = ({ bbox }, scale = 1) =>
  ({ x: (bbox.x0 + bbox.x1) / 2 / scale, y: (bbox.y0 + bbox.y1) / 2 / scale });

/**
 * Aehnlichkeitstransformation (Massstab, Drehung, Verschiebung) im Sinne kleinster Quadrate.
 * @param {Array<{ref:{x,y}, px:{x,y}}>} pairs mindestens zwei
 * @returns {Function|undefined} Punkt im Referenzlayout -> Punkt in der Aufnahme
 */
export const similarityTransform = pairs => {
  if (!pairs || pairs.length < 2) return undefined;
  const mean = key => pairs.reduce(
    (sum, pair) => ({ x: sum.x + pair[key].x / pairs.length, y: sum.y + pair[key].y / pairs.length }),
    { x: 0, y: 0 },
  );
  const ref = mean('ref'), px = mean('px');
  const sum = pairs.reduce((acc, pair) => {
    const u = { x: pair.ref.x - ref.x, y: pair.ref.y - ref.y };
    const v = { x: pair.px.x - px.x, y: pair.px.y - px.y };
    return {
      dot: acc.dot + u.x * v.x + u.y * v.y,
      cross: acc.cross + u.x * v.y - u.y * v.x,
      norm: acc.norm + u.x * u.x + u.y * u.y,
    };
  }, { dot: 0, cross: 0, norm: 0 });

  if (!sum.norm) return undefined;
  const cos = sum.dot / sum.norm, sin = sum.cross / sum.norm;
  return point => ({
    x: px.x + (point.x - ref.x) * cos - (point.y - ref.y) * sin,
    y: px.y + (point.x - ref.x) * sin + (point.y - ref.y) * cos,
  });
};

/** Massstab der Transformation in Aufnahme-Pixeln je Referenz-Pixel. */
export const transformScale = transform => {
  const origin = transform({ x: 0, y: 0 }), unit = transform({ x: 10, y: 0 });
  return Math.hypot(unit.x - origin.x, unit.y - origin.y) / 10;
};

export const transformAngle = transform => {
  const origin = transform({ x: 0, y: 0 }), unit = transform({ x: 10, y: 0 });
  return Math.atan2(unit.y - origin.y, unit.x - origin.x) * 180 / Math.PI;
};

/**
 * Je Ankerwort den naechstgelegenen Lesetreffer innerhalb der Toleranz nehmen.
 * Das verhindert, dass eine Fehllesung am anderen Blattende die Transformation verzieht.
 */
export const anchorPairs = (words, anchors, transform, refTolerance, scale = 1) => {
  const tolerance = refTolerance * transformScale(transform);
  return anchors.flatMap(expected => {
    const target = transform(expected);
    const best = (words ?? [])
      .filter(word => anchorMatches(word.text, expected.text))
      .map(word => ({ pair: { ref: { x: expected.x, y: expected.y }, px: wordCenter(word, scale), text: expected.text } }))
      .map(({ pair }) => ({ pair, distance: Math.hypot(pair.px.x - target.x, pair.px.y - target.y) }))
      .sort((a, b) => a.distance - b.distance)[0];
    return best && best.distance <= tolerance ? [best.pair] : [];
  });
};

/**
 * Zweistufig: eine grobe Groessenanpassung liefert die erste Zuordnung,
 * deren Fit engt die Toleranz fuer den zweiten Durchlauf ein.
 *
 * @param {Array} words Lesetreffer der Aufnahme
 * @param {Array<{text,x,y}>} anchors gelernte Ankerwoerter im Referenzlayout
 * @param {{width:number,height:number}} reference Groesse des Musterzettels
 * @param {{width:number,height:number}} image Groesse der Aufnahme
 */
export const findTransform = (words, anchors, reference, image, { coarseTolerance = 0.08, fineTolerance = 0.03, scale = 1 } = {}) => {
  const coarse = point => ({ x: point.x * image.width / reference.width, y: point.y * image.height / reference.height });
  const span = Math.max(reference.width, reference.height);
  const pairsAt = (transform, tolerance) => anchorPairs(words, anchors, transform, span * tolerance, scale);

  const first = similarityTransform(pairsAt(coarse, coarseTolerance));
  if (!first) return { transform: undefined, pairs: [] };

  const transform = similarityTransform(pairsAt(first, fineTolerance)) ?? first;
  return { transform, pairs: pairsAt(transform, fineTolerance) };
};

/**
 * Waehlt aus den Woertern eines Musterzettels brauchbare Anker.
 * Mehrfach vorkommende Woerter taugen nicht - auf einem Stimmzettel steht "PARTEI"
 * in jeder Zeile. Nur eindeutige, ausreichend lange Woerter bleiben uebrig.
 */
export const learnAnchors = (words, { minLength = 4, minConfidence = 60, scale = 1 } = {}) => {
  const usable = words.filter(w => ocrNormalize(w.text).length >= minLength && w.confidence >= minConfidence);
  const frequency = usable.reduce((counter, w) => {
    const key = ocrNormalize(w.text);
    return counter.set(key, (counter.get(key) ?? 0) + 1);
  }, new Map());

  return usable
    .filter(w => frequency.get(ocrNormalize(w.text)) === 1)
    .map(w => ({ text: w.text, ...wordCenter(w, scale) }));
};

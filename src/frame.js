/**
 * Bezugsrahmen des Stimmzettels: die durchgehenden Drucklinien.
 * Er macht Kalibrierung und Ankreuzerkennung unabhaengig von Bildgroesse und Bildausschnitt.
 */

const group = (positions, gap = 3) =>
  positions.reduce((groups, p) => {
    const last = groups.at(-1);
    if (last && p - last.at(-1) <= gap) last.push(p); else groups.push([p]);
    return groups;
  }, []).map(g => g.reduce((a, b) => a + b, 0) / g.length);

const lines = (length, across, count, minRatio) =>
  group([...Array(length).keys()].filter(i => count(i) >= across * minRatio));

/**
 * Sucht die aeusseren Senkrechten und die oberste/unterste waagerechte Tabellenlinie.
 * @returns {{left:number,right:number,top:number,bottom:number}|undefined}
 */
/**
 * `verticalRatio` bewusst deutlich unter 1: bei langen Streifenzetteln (Landtagswahl,
 * Europawahl) unterbrechen Kopf- und Fussbereich die Seitenlinien. Gemessen erreicht die
 * laengste Senkrechte dort nur 85 % der Bildhoehe. Zwischen 0,8 und 0,6 aendert sich am
 * gefundenen Rahmen aller Musterzettel nichts - der Wert ist also unkritisch.
 */
export const findFrame = ({ width, height, values }, { darkThreshold = 0.4, verticalRatio = 0.75, horizontalRatio = 0.6, edgeRatio = 0.02 } = {}) => {
  const dark = (x, y) => (values[y * width + x] > darkThreshold ? 1 : 0);
  const column = x => { let s = 0; for (let y = 0; y < height; y++) { s += dark(x, y); } return s; };
  const row = y => { let s = 0; for (let x = 0; x < width; x++) { s += dark(x, y); } return s; };

  // Ein dunkler Bildrand ist keine Drucklinie. Der Abstand waechst mit der Aufloesung mit,
  // damit dieselbe Aufnahme in jeder Groesse denselben Rahmen ergibt.
  const offEdge = (value, length) => value > length * edgeRatio && value < length * (1 - edgeRatio);

  const vertical = lines(width, height, column, verticalRatio).filter(x => offEdge(x, width));
  const horizontal = lines(height, width, row, horizontalRatio).filter(y => offEdge(y, height));

  return vertical.length >= 2 && horizontal.length >= 2
    ? { left: vertical[0], right: vertical.at(-1), top: horizontal[0], bottom: horizontal.at(-1) }
    : undefined;
};

const maxDarkness = ({ width, height, values }, x, y, vertical) => {
  let maximum = 0;
  for (let offset = -2; offset <= 2; offset++) {
    const px = Math.round(x + (vertical ? offset : 0)), py = Math.round(y + (vertical ? 0 : offset));
    if (px >= 0 && py >= 0 && px < width && py < height) maximum = Math.max(maximum, values[py * width + px]);
  }
  return maximum;
};

const findHorizontalLine = (map, paper, from, to, slopeFrom, slopeTo, direction = 'best') => {
  const centerX = (paper.left + paper.right) / 2;
  const startX = Math.round(paper.left + (paper.right - paper.left) * 0.06);
  const endX = Math.round(paper.right - (paper.right - paper.left) * 0.06);
  let best;
  const candidates = [];
  for (let slope = slopeFrom; slope <= slopeTo + 1e-8; slope += 0.01)
    for (let centerY = Math.round(from); centerY <= to; centerY += 2) {
      let sum = 0, count = 0;
      for (let x = startX; x <= endX; x += 4) {
        sum += maxDarkness(map, x, centerY + slope * (x - centerX), false);
        count++;
      }
      const score = sum / count;
      if (!best || score > best.score) best = { a: slope, b: centerY - slope * centerX, center: centerY, score };
      if (score >= 0.25) candidates.push({ a: slope, b: centerY - slope * centerX, center: centerY, score });
    }
  if (direction === 'best' || !best) return best;
  const threshold = Math.max(0.28, best.score * 0.65);
  return candidates
    .filter(candidate => candidate.score >= threshold)
    .sort((a, b) => direction === 'bottom' ? b.center - a.center : a.center - b.center)[0] ?? best;
};

const findVerticalLine = (map, paper, top, bottom, from, to) => {
  const centerY = (top.center + bottom.center) / 2;
  const startY = Math.round(top.center + (bottom.center - top.center) * 0.03);
  const endY = Math.round(bottom.center - (bottom.center - top.center) * 0.03);
  let best;
  for (let slope = -0.2; slope <= 0.2 + 1e-8; slope += 0.01)
    for (let centerX = Math.round(from); centerX <= to; centerX += 2) {
      let sum = 0, count = 0;
      for (let y = startY; y <= endY; y += 4) {
        sum += maxDarkness(map, centerX + slope * (y - centerY), y, true);
        count++;
      }
      const score = sum / count;
      if (!best || score > best.score) best = { a: slope, b: centerX - slope * centerY, center: centerX, score };
    }
  return best;
};

const intersectLines = (horizontal, vertical) => {
  const y = (horizontal.a * vertical.b + horizontal.b) / (1 - horizontal.a * vertical.a);
  return { x: vertical.a * y + vertical.b, y };
};

const median = values => {
  const sorted = [...values].sort((a, b) => a - b), center = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[center] : (sorted[center - 1] + sorted[center]) / 2;
};

const regressLine = (points, independent, dependent, slopeFrom, slopeTo, preferred = 0) => {
  if (points.length < 20) return undefined;
  let best;
  for (let a = slopeFrom; a <= slopeTo + 1e-8; a += 0.005) {
    const b = median(points.map(point => point[dependent] - a * point[independent]));
    const treffer = points.filter(point => Math.abs(point[dependent] - a * point[independent] - b) <= 4);
    const score = treffer.length - Math.abs(a - preferred) * 0.01;
    if (!best || score > best.score) best = { a, b, treffer, score };
  }
  if (best.treffer.length < points.length * 0.45) return undefined;
  const n = best.treffer.length;
  const sums = best.treffer.reduce((sum, point) => ({
    x: sum.x + point[independent],
    y: sum.y + point[dependent],
    xx: sum.xx + point[independent] ** 2,
    xy: sum.xy + point[independent] * point[dependent],
  }), { x: 0, y: 0, xx: 0, xy: 0 });
  const denominator = n * sums.xx - sums.x ** 2;
  const a = Math.abs(denominator) > 1e-8 ? (n * sums.xy - sums.x * sums.y) / denominator : best.a;
  return { a, b: (sums.y - a * sums.x) / n, score: best.treffer.length / points.length };
};

const edgePoints = (map, paper, orientation, direction) => {
  const paperWidth = paper.right - paper.left, paperHeight = paper.bottom - paper.top;
  const horizontal = orientation === 'horizontal';
  const from = horizontal ? paper.left + paperWidth * 0.08 : paper.top + paperHeight * 0.08;
  const to = horizontal ? paper.right - paperWidth * 0.08 : paper.bottom - paperHeight * 0.08;
  const searchFrom = horizontal
    ? paper.top + paperHeight * (direction === 'forward' ? 0.015 : 0.985)
    : paper.left + paperWidth * (direction === 'forward' ? 0.015 : 0.985);
  const searchTo = horizontal
    ? paper.top + paperHeight * (direction === 'forward' ? 0.14 : 0.68)
    : paper.left + paperWidth * (direction === 'forward' ? 0.18 : 0.82);
  const step = direction === 'forward' ? 1 : -1;
  const points = [];
  for (let fixed = Math.round(from); fixed <= to; fixed += 4)
    for (let scanning = Math.round(searchFrom); step > 0 ? scanning <= searchTo : scanning >= searchTo; scanning += step) {
      const x = horizontal ? fixed : scanning, y = horizontal ? scanning : fixed;
      if (maxDarkness(map, x, y, !horizontal) < 0.35) continue;
      points.push({ x, y });
      break;
    }
  return points;
};

/** Sucht die vier perspektivischen Druckrahmenlinien innerhalb der groben Papierlage. */
export const findPerspectiveFrame = (map, paper) => {
  if (!paper) return undefined;
  const paperWidth = paper.right - paper.left, paperHeight = paper.bottom - paper.top;
  const top = findHorizontalLine(
    map, paper, paper.top + paperHeight * 0.025, paper.top + paperHeight * 0.12,
    paper.horizontalSlope - 0.06, paper.horizontalSlope + 0.06, 'top',
  );
  const bottomEdgePoints = edgePoints(map, paper, 'horizontal', 'backward');
  const bottomOuterLine = regressLine(bottomEdgePoints, 'x', 'y', -0.2, 0.2, paper.horizontalSlope);
  const bottom = bottomOuterLine ? {
    ...bottomOuterLine,
    center: bottomOuterLine.a * (paper.left + paper.right) / 2 + bottomOuterLine.b,
  } : findHorizontalLine(
    map, paper, paper.top + paperHeight * 0.72, paper.bottom - paperHeight * 0.02,
    top.a - 0.08, top.a + 0.08, 'bottom',
  );
  if (!top || !bottom || top.score < 0.3 || bottom.score < 0.3 || bottom.center <= top.center) return undefined;
  const left = findVerticalLine(map, paper, top, bottom, paper.left, paper.left + paperWidth * 0.3);
  const right = findVerticalLine(map, paper, top, bottom, paper.right - paperWidth * 0.3, paper.right);
  if (!left || !right || left.score < 0.3 || right.score < 0.3 || right.center <= left.center) return undefined;
  const corners = {
    topLeft: intersectLines(top, left),
    topRight: intersectLines(top, right),
    bottomLeft: intersectLines(bottom, left),
    bottomRight: intersectLines(bottom, right),
  };
  const xs = Object.values(corners).map(corner => corner.x), ys = Object.values(corners).map(corner => corner.y);
  return {
    left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys),
    horizontalSlope: top.a, corners,
  };
};

/** Projiziert einen Punkt aus dem Kalibrierungsrahmen in den perspektivischen Fotorahmen. */
export const perspectivePoint = ({ corners }, kalibrierungsFrame, { x, y }) => {
  const { topLeft, topRight, bottomLeft, bottomRight } = corners;
  const dx1 = topRight.x - bottomRight.x, dx2 = bottomLeft.x - bottomRight.x;
  const dx3 = topLeft.x - topRight.x + bottomRight.x - bottomLeft.x;
  const dy1 = topRight.y - bottomRight.y, dy2 = bottomLeft.y - bottomRight.y;
  const dy3 = topLeft.y - topRight.y + bottomRight.y - bottomLeft.y;
  const denominator = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(denominator) > 1e-8 ? (dx3 * dy2 - dx2 * dy3) / denominator : 0;
  const h = Math.abs(denominator) > 1e-8 ? (dx1 * dy3 - dx3 * dy1) / denominator : 0;
  const a = topRight.x - topLeft.x + g * topRight.x;
  const b = bottomLeft.x - topLeft.x + h * bottomLeft.x;
  const d = topRight.y - topLeft.y + g * topRight.y;
  const e = bottomLeft.y - topLeft.y + h * bottomLeft.y;
  const u = (x - kalibrierungsFrame.left) / (kalibrierungsFrame.right - kalibrierungsFrame.left);
  const v = (y - kalibrierungsFrame.top) / (kalibrierungsFrame.bottom - kalibrierungsFrame.top);
  const z = g * u + h * v + 1;
  return { x: (a * u + b * v + topLeft.x) / z, y: (d * u + e * v + topLeft.y) / z };
};

export const toRelative = (frame, { x, y }) => ({
  x: (x - frame.left) / (frame.right - frame.left),
  y: (y - frame.top) / (frame.bottom - frame.top),
});

export const toAbsolute = (frame, { x, y }) => ({
  x: frame.left + x * (frame.right - frame.left),
  y: frame.top + y * (frame.bottom - frame.top),
});

export const frameWidth = frame => frame.right - frame.left;

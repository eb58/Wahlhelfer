/**
 * Druckrahmen als geschlossenes Viereck - Vorgehen wie die Rastersuche im Sudoku-Scanner.
 *
 * Ein adaptiver Schwellwert (Vergleich mit dem lokalen Mittel ueber ein Integralbild) trennt
 * Drucklinien auch bei Schatten und Helligkeitsverlauf vom Papier. Der aeussere Rahmen ist dann
 * eine einzige zusammenhaengende, nur duenn gefuellte Komponente; die Extrempunkte entlang der
 * beiden Diagonalen (x+y, x-y) sind seine vier Ecken - auch bei starker Perspektive und Drehung.
 * Welche Komponente der Rahmen ist, entscheidet der Aufrufer durch Verifikation am Musterzettel.
 */

import { intersectLines, perspectivePoint } from './frame.js';
import { regressLine } from './leastSquares.js';

/** Darkness-Karte -> Tinte, wenn ein Pixel deutlich dunkler ist als seine Umgebung. */
export const adaptiveInk = ({ width, height, values }, radius, offset = 0.12) => {
  const stride = width + 1, integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += 1 - values[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + rowSum;
    }
  }
  const ink = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const top = Math.max(0, y - radius), bottom = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const left = Math.max(0, x - radius), right = Math.min(width, x + radius + 1);
      const sum = integral[bottom * stride + right] - integral[top * stride + right]
        - integral[bottom * stride + left] + integral[top * stride + left];
      const mean = sum / ((bottom - top) * (right - left));
      ink[y * width + x] = 1 - values[y * width + x] < mean * (1 - offset) ? 1 : 0;
    }
  }
  return ink;
};

/** Zusammenhaengende Tintenbereiche (8er-Nachbarschaft) mit Begrenzung, Pixeln und Diagonal-Ecken. */
export const components = (ink, width, height) => {
  const labels = new Uint8Array(ink.length), stack = new Int32Array(ink.length);
  const result = [];
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || labels[start]) continue;
    const component = { minX: width, minY: height, maxX: 0, maxY: 0, count: 0, pixels: [] };
    const extreme = { topLeft: [0, 0, Infinity], topRight: [0, 0, -Infinity], bottomRight: [0, 0, -Infinity], bottomLeft: [0, 0, Infinity] };
    let size = 0;
    stack[size++] = start;
    labels[start] = 1;
    while (size) {
      const index = stack[--size], x = index % width, y = (index - x) / width;
      component.count++;
      component.pixels.push(index);
      component.minX = Math.min(component.minX, x); component.maxX = Math.max(component.maxX, x);
      component.minY = Math.min(component.minY, y); component.maxY = Math.max(component.maxY, y);
      if (x + y < extreme.topLeft[2]) extreme.topLeft = [x, y, x + y];
      if (x + y > extreme.bottomRight[2]) extreme.bottomRight = [x, y, x + y];
      if (x - y > extreme.topRight[2]) extreme.topRight = [x, y, x - y];
      if (x - y < extreme.bottomLeft[2]) extreme.bottomLeft = [x, y, x - y];
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, neighbor = ny * width + nx;
          if (nx < 0 || nx >= width || !ink[neighbor] || labels[neighbor]) continue;
          labels[neighbor] = 1;
          stack[size++] = neighbor;
        }
      }
    }
    component.corners = Object.fromEntries(Object.entries(extreme).map(([key, [x, y]]) => [key, { x, y }]));
    result.push(component);
  }
  return result;
};

const quadArea = ({ topLeft, topRight, bottomRight, bottomLeft }) => Math.abs(
  [topLeft, topRight, bottomRight, bottomLeft].reduce((sum, point, i, all) => {
    const next = all[(i + 1) % 4];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;

/**
 * Verkleinert die Darkness-Karte per Flaechenmittel auf hoechstens `maxWidth` Pixel Breite.
 * Begrenzt wird die Breite, nicht die laengste Kante - sonst bleibt von langen Streifenzetteln
 * (Europawahl rund 1:4) so wenig Breite, dass die Drucklinien verschwinden.
 */
export const shrink = ({ width, height, values }, maxWidth) => {
  const factor = Math.max(1, Math.ceil(width / maxWidth));
  const outWidth = Math.ceil(width / factor), outHeight = Math.ceil(height / factor);
  const sums = new Float32Array(outWidth * outHeight), counts = new Uint16Array(outWidth * outHeight);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const target = Math.floor(y / factor) * outWidth + Math.floor(x / factor);
      sums[target] += values[y * width + x];
      counts[target]++;
    }
  return { width: outWidth, height: outHeight, values: sums.map((sum, i) => sum / counts[i]), factor };
};

/** Fasst Komponenten zu einer zusammen: Begrenzung, Pixelzahl und Diagonal-Ecken der Vereinigung. */
export const unite = parts => {
  const all = parts.flatMap(part => Object.values(part.corners));
  const pick = (score, sign) => all.reduce((best, point) => sign * score(point) < sign * score(best) ? point : best);
  return {
    minX: Math.min(...parts.map(part => part.minX)), minY: Math.min(...parts.map(part => part.minY)),
    maxX: Math.max(...parts.map(part => part.maxX)), maxY: Math.max(...parts.map(part => part.maxY)),
    count: parts.reduce((sum, part) => sum + part.count, 0),
    pixels: parts.flatMap(part => part.pixels),
    corners: {
      topLeft: pick(({ x, y }) => x + y, 1), topRight: pick(({ x, y }) => x - y, -1),
      bottomRight: pick(({ x, y }) => x + y, -1), bottomLeft: pick(({ x, y }) => x - y, 1),
    },
  };
};

/**
 * Gerade durch die Randpunkte nahe der groben Kante `rough`. Wo die Rahmenlinie Luecken hat, ist der
 * aeusserste Pixel eine innere Linie - solche Punkte liegen weit ab und bleiben unberuecksichtigt.
 */
const fitEdge = (points, along, across, rough) => {
  const near = (line, tolerance) => points.filter(point => Math.abs(across(point) - line.a * along(point) - line.b) <= tolerance);
  const fit = candidates => {
    const line = candidates.length >= 10 && regressLine(candidates, along, across);
    return line && { a: line[0], b: line[1] };
  };
  const first = fit(near(rough, 3));
  return first && (fit(near(first, 1.5)) ?? first);
};

/** Grobe Kante durch zwei Diagonal-Ecken, als Gerade across = a * along + b. */
const roughLine = (from, to, along, across) => {
  const a = (across(to) - across(from)) / (along(to) - along(from));
  return { a, b: across(from) - a * along(from) };
};

/**
 * Die Diagonal-Extrempunkte sind nur auf einen Pixel genau. Bei langen Zetteln (1:4) reicht das
 * nicht: schon wenige Pixel an einer Ecke verschieben die Ringe am anderen Ende deutlich. Daher
 * wird je Seite eine Gerade durch die aeussersten Pixel gelegt; die Ecken sind ihre Schnittpunkte.
 */
export const refineCorners = ({ pixels, corners }, width) => {
  const { topLeft, topRight, bottomRight, bottomLeft } = corners;
  const top = new Map(), bottom = new Map(), left = new Map(), right = new Map();
  for (const index of pixels) {
    const x = index % width, y = (index - x) / width;
    if (!(top.get(x) <= y)) top.set(x, y);
    if (!(bottom.get(x) >= y)) bottom.set(x, y);
    if (!(left.get(y) <= x)) left.set(y, x);
    if (!(right.get(y) >= x)) right.set(y, x);
  }
  // Nur das mittlere Stueck jeder Seite: an den Ecken biegt der Rand bereits um.
  const inner = (profile, from, to) => [...profile]
    .filter(([position]) => position > from + (to - from) * 0.1 && position < to - (to - from) * 0.1);
  const horizontal = (profile, from, to) => fitEdge(inner(profile, from.x, to.x), ([x]) => x, ([, y]) => y,
    roughLine(from, to, point => point.x, point => point.y));
  const vertical = (profile, from, to) => fitEdge(inner(profile, from.y, to.y), ([y]) => y, ([, x]) => x,
    roughLine(from, to, point => point.y, point => point.x));
  const lines = {
    top: horizontal(top, topLeft, topRight), bottom: horizontal(bottom, bottomLeft, bottomRight),
    left: vertical(left, topLeft, bottomLeft), right: vertical(right, topRight, bottomRight),
  };
  if (Object.values(lines).some(line => !line)) return corners;
  return {
    topLeft: intersectLines(lines.top, lines.left), topRight: intersectLines(lines.top, lines.right),
    bottomRight: intersectLines(lines.bottom, lines.right), bottomLeft: intersectLines(lines.bottom, lines.left),
  };
};

const fill = ({ minX, minY, maxX, maxY, count }) => count / ((maxX - minX + 1) * (maxY - minY + 1));

const insideImage = ({ minX, minY, maxX, maxY }, width, height) =>
  minX > 0 && minY > 0 && maxX < width - 1 && maxY < height - 1;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Ein Druckrahmen liegt ganz im Bild und hat vier echte Seiten im Seitenverhaeltnis des Musterzettels.
 * Holzmaserung oder Tischkanten ergeben dagegen Komponenten am Bildrand oder entartete Vierecke.
 */
const plausibleQuad = ({ minX, minY, maxX, maxY, count, corners }, width, height, expected) => {
  const { topLeft, topRight, bottomRight, bottomLeft } = corners;
  const top = distance(topLeft, topRight), bottom = distance(bottomLeft, bottomRight);
  const left = distance(topLeft, bottomLeft), right = distance(topRight, bottomRight);
  const minSide = Math.min(width, height) * 0.25;
  const ratio = (top + bottom) / (left + right) / expected;
  return insideImage({ minX, minY, maxX, maxY }, width, height)
    && Math.min(top, bottom, left, right) >= minSide && ratio > 0.6 && ratio < 1.6
    && fill({ minX, minY, maxX, maxY, count }) < 0.4;
};

/**
 * Moegliche Druckrahmen, groesste zuerst: duenn gefuellte Komponenten, deren Viereck zum Rahmen
 * des Musterzettels passt. Viele Zettel haben keinen umlaufenden Rahmen, sondern mehrere getrennte
 * Tabellen (Erst-/Zweitstimme, Tabellenbloecke); ihr Rahmen ist die Huelle aller groesseren Teile
 * auf dem Papier. Ohne bekannte Papierlage (`paper` aus paper.js) entfaellt diese Huelle, damit
 * keine Tischmaserung hineingeraet. Ecken in Aufnahme-Pixeln.
 */
export const findFrameCandidates = (map, kalibrierungsFrame, { paper, maxWidth = 600, maxCandidates = 6 } = {}) => {
  const work = shrink(map, maxWidth);
  const ink = adaptiveInk(work, Math.max(4, Math.round(Math.min(work.width, work.height) / 100)));
  const expected = (kalibrierungsFrame.right - kalibrierungsFrame.left) / (kalibrierungsFrame.bottom - kalibrierungsFrame.top);
  const parts = components(ink, work.width, work.height).filter(component => insideImage(component, work.width, work.height)
    && Math.max(component.maxX - component.minX, component.maxY - component.minY) >= Math.min(work.width, work.height) * 0.1
    && fill(component) < 0.4);
  // Fuer die Huelle nur Linienwerk: Tabellen sind zu wenigen Prozent gefuellt, Kopfgrafiken (Pfeile, Balken) deutlich mehr.
  // Die Papierlage ist nur ein grobes Rechteck; bei schraegen Fotos ragen Tabellen etwas darueber hinaus.
  const marginX = paper ? (paper.right - paper.left) * 0.05 : 0, marginY = paper ? (paper.bottom - paper.top) * 0.05 : 0;
  const onPaper = paper ? parts.filter(part => fill(part) < 0.12).filter(({ minX, minY, maxX, maxY }) => minX * work.factor >= paper.left - marginX && maxX * work.factor <= paper.right + marginX
    && minY * work.factor >= paper.top - marginY && maxY * work.factor <= paper.bottom + marginY) : [];
  return [...parts, ...onPaper.length > 1 ? [unite(onPaper)] : []]
    .filter(component => plausibleQuad(component, work.width, work.height, expected))
    .map(component => Object.fromEntries(Object.entries(refineCorners(component, work.width))
      .map(([key, { x, y }]) => [key, { x: (x + 0.5) * work.factor, y: (y + 0.5) * work.factor }])))
    .sort((a, b) => quadArea(b) - quadArea(a))
    .slice(0, maxCandidates)
    .map(toCandidate);
};

const toCandidate = corners => {
  const xs = Object.values(corners).map(c => c.x), ys = Object.values(corners).map(c => c.y);
  return {
    left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys),
    horizontalSlope: (corners.topRight.y - corners.topLeft.y) / (corners.topRight.x - corners.topLeft.x),
    corners,
  };
};

/**
 * Deutet einen Kandidaten, dessen Ecken zum Rechteck `from` des Musterzettels gehoeren (z. B. der
 * Huelle), um: Ergebnis sind die Ecken des Rechtecks `to` (des Kalibrierungsrahmens) in der Aufnahme.
 */
export const reframe = (candidate, from, to) => toCandidate({
  topLeft: perspectivePoint(candidate, from, { x: to.left, y: to.top }),
  topRight: perspectivePoint(candidate, from, { x: to.right, y: to.top }),
  bottomRight: perspectivePoint(candidate, from, { x: to.right, y: to.bottom }),
  bottomLeft: perspectivePoint(candidate, from, { x: to.left, y: to.bottom }),
});

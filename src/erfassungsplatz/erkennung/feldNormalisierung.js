/** Perspektivisch normalisierte kleine Ausschnitte rund um die erwarteten Ankreuzringe. */
import { perspectivePoint } from './frame.js';
import { darknessAt, ringDarkness } from './image.js';
import { regressLine, regressPlane } from './leastSquares.js';

const regressTransformation = treffer => {
  const x = regressPlane(treffer, t => t.source, t => t.target, 'x');
  const y = regressPlane(treffer, t => t.source, t => t.target, 'y');
  return x && y ? { a: x[0], c: x[1], e: x[2], b: y[0], d: y[1], f: y[2] } : undefined;
};

/**
 * Liegen alle Ringe in einer Spalte (z. B. Europawahl), ist die Streckung quer zur Spalte nicht
 * bestimmbar. Sie bleibt dann wie vom Rahmen vorgegeben; justiert werden Lage, Neigung und Laengsstreckung.
 */
const regressColumn = treffer => {
  const x = regressLine(treffer, t => t.source.y, t => t.target.x - t.source.x);
  const y = regressLine(treffer, t => t.source.y, t => t.target.y);
  return x && y ? { a: 1, c: x[0], e: x[1], b: 0, d: y[0], f: y[1] } : undefined;
};

const spread = values => Math.max(...values) - Math.min(...values);

export const transformRing = ({ a, b, c, d, e, f }, { x, y }) => ({
  x: a * x + c * y + e,
  y: b * x + d * y + f,
});

const combinations2 = values => values.flatMap((a, i) => values.slice(i + 1).map(b => [a, b]));

const combinations3 = values => values.flatMap((a, i) => values.slice(i + 1).flatMap((b, j) =>
  values.slice(i + j + 2).map(c => [a, b, c])));

const residual = (transformation, { source, target }) => {
  const point = transformRing(transformation, source);
  return Math.hypot(point.x - target.x, point.y - target.y);
};

export const determineRingTransformation = treffer => {
  const candidates = treffer.filter(({ ringScore }) => ringScore >= 0.24);
  const column = candidates.length && spread(candidates.map(({ source }) => source.x)) < 80;
  const regress = column ? regressColumn : regressTransformation;
  let best;
  for (const probe of column ? combinations2(candidates) : combinations3(candidates)) {
    const transformation = regress(probe);
    if (!transformation) continue;
    const inlier = candidates.filter(treffer => residual(transformation, treffer) <= 10);
    const score = inlier.length * 100 - inlier.reduce((sum, treffer) => sum + residual(transformation, treffer), 0);
    if (!best || score > best.score) best = { transformation, inlier, score };
  }
  if (!best || best.inlier.length < 6) throw new Error('Zu wenige Ankreuzringe fuer eine sichere Ausrichtung erkannt.');
  if (best.inlier.reduce((sum, treffer) => sum + treffer.ringScore, 0) / best.inlier.length < 0.32)
    throw new Error('Kontrast der gefundenen Ankreuzringe ist zu gering.');
  if ((!column && spread(best.inlier.map(({ source }) => source.x)) < 80) || spread(best.inlier.map(({ source }) => source.y)) < 300)
    throw new Error('Erkannte Ankreuzringe liegen nicht ausreichend verteilt.');
  const transformation = regress(best.inlier);
  if (Math.abs(transformation.a - 1) > 0.2 || Math.abs(transformation.d - 1) > 0.2
    || Math.abs(transformation.b) > 0.12 || Math.abs(transformation.c) > 0.12)
    throw new Error('Ausrichtung der Ankreuzringe ist geometrisch unplausibel.');
  return { transformation, treffer: best.inlier };
};

const interpolatedDarkness = (map, x, y) => {
  const x0 = Math.floor(x), y0 = Math.floor(y), dx = x - x0, dy = y - y0;
  return darknessAt(map, x0, y0) * (1 - dx) * (1 - dy)
    + darknessAt(map, x0 + 1, y0) * dx * (1 - dy)
    + darknessAt(map, x0, y0 + 1) * (1 - dx) * dy
    + darknessAt(map, x0 + 1, y0 + 1) * dx * dy;
};

const perspectiveRingDarkness = (map, perspectiveFrame, kalibrierungsFrame, point, radius, samples = 48) => {
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const angle = 2 * Math.PI * i / samples;
    const source = perspectivePoint(perspectiveFrame, kalibrierungsFrame, {
      x: point.x + radius * Math.cos(angle),
      y: point.y + radius * Math.sin(angle),
    });
    sum += interpolatedDarkness(map, source.x, source.y);
  }
  return sum / samples;
};

const perspectiveRingScore = (map, perspectiveFrame, kalibrierungsFrame, point, radius) => {
  const ring = perspectiveRingDarkness(map, perspectiveFrame, kalibrierungsFrame, point, radius, 48);
  const background = (perspectiveRingDarkness(map, perspectiveFrame, kalibrierungsFrame, point, radius * 0.7, 48)
    + perspectiveRingDarkness(map, perspectiveFrame, kalibrierungsFrame, point, radius * 1.3, 48)) / 2;
  return ring - background * 0.55;
};

const scoreShift = (map, perspectiveFrame, kalibrierungsFrame, points, radius, dx, dy) => {
  const ys = points.map(point => point.y), minY = Math.min(...ys), maxY = Math.max(...ys);
  const weighted = points.map(point => ({
    point,
    weight: point.y <= minY + radius * 2 || point.y >= maxY - radius * 6 ? 3 : 1,
  }));
  const weight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  return weighted.reduce((sum, { point, weight }) => sum + weight * perspectiveRingScore(
    map, perspectiveFrame, kalibrierungsFrame, { x: point.x + dx, y: point.y + dy }, radius,
  ), 0) / weight;
};

/** Wie gut liegen die gedruckten Ringe dort, wo ein Rahmenkandidat sie erwarten laesst? */
export const scoreFrame = (map, perspectiveFrame, kalibrierungsFrame, points, radius) =>
  scoreShift(map, perspectiveFrame, kalibrierungsFrame, points, radius, 0, 0);

export const findRoughRingShift =(map, perspectiveFrame, kalibrierungsFrame, points, radius) => {
  let best;
  for (let dy = -radius * 4; dy <= radius; dy += 6)
    for (let dx = -90; dx <= 90; dx += 6) {
      const score = scoreShift(map, perspectiveFrame, kalibrierungsFrame, points, radius, dx, dy);
      if (!best || score > best.score) best = { dx, dy, score };
    }
  const rough = best;
  for (let dy = rough.dy - 6; dy <= rough.dy + 6; dy++)
    for (let dx = rough.dx - 6; dx <= rough.dx + 6; dx++) {
      const score = scoreShift(map, perspectiveFrame, kalibrierungsFrame, points, radius, dx, dy);
      if (score > best.score) best = { dx, dy, score };
    }
  if (best.score < 0.15) throw new Error('Gedruckte Ankreuzringe nicht sicher gefunden.');
  return best;
};

const normalizeCrop = (map, perspectiveFrame, kalibrierungsFrame, point, radius, search) => {
  const margin = radius + search + 2, width = margin * 2 + 1, height = width;
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const source = perspectivePoint(perspectiveFrame, kalibrierungsFrame, {
        x: point.x + x - margin,
        y: point.y + y - margin,
      });
      values[y * width + x] = interpolatedDarkness(map, source.x, source.y);
    }
  return { map: { width, height, values }, center: margin };
};

const findRing = (map, center, radius, search) => {
  const scoreAt = (x, y) => {
    const ring = ringDarkness(map, x, y, radius, 72);
    const background = (ringDarkness(map, x, y, radius * 0.7, 72)
      + ringDarkness(map, x, y, radius * 1.3, 72)) / 2;
    return { ring, score: ring - background * 0.55 };
  };
  const start = scoreAt(center, center);
  let best = { x: center, y: center, ...start };
  const probe = (x, y) => {
    const rating = scoreAt(x, y);
    if (rating.score > best.score) best = { x, y, ...rating };
  };
  // Grob nach fein: erst jeder zweite Punkt im ganzen Fenster, dann pixelgenau um den besten.
  // Gleich weites Fenster, aber nur gut ein Viertel der Rechenschritte.
  for (let dy = -search; dy <= search; dy += 2)
    for (let dx = -search; dx <= search; dx += 2) probe(center + dx, center + dy);
  const coarse = best;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (Math.abs(coarse.x + dx - center) <= search && Math.abs(coarse.y + dy - center) <= search) probe(coarse.x + dx, coarse.y + dy);
  return best;
};

/**
 * Papierhelligkeit als schraege Ebene, geschaetzt auf einem Kranz ausserhalb des gedruckten Rings:
 * je Sektor ein niedriges Perzentil, damit Tabellenlinien und ueber den Ring hinausgehende Striche
 * nicht zaehlen. So wird ein Schattenverlauf quer ueber das Feld nicht zum Strich, und ein ganz
 * ausgemaltes Feld hebt seinen eigenen Hintergrund nicht an.
 */
const paperPlane = (crop, cx, cy, radius) => {
  const sectors = [...Array(8)].map(() => []);
  for (let y = 0; y < crop.height; y++)
    for (let x = 0; x < crop.width; x++) {
      const distance = Math.hypot(x - cx, y - cy);
      if (distance < radius * 1.15 || distance > radius * 1.4) continue;
      const sector = Math.floor(((Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI)) * 8) % 8;
      sectors[sector].push({ x, y, d: crop.values[y * crop.width + x] });
    }
  const points = sectors.filter(sector => sector.length).map(sector => {
    const sorted = sector.map(point => point.d).sort((a, b) => a - b);
    const mean = axis => sector.reduce((sum, point) => sum + point[axis], 0) / sector.length;
    return { x: mean('x'), y: mean('y'), d: sorted[Math.floor(sorted.length * 0.3)] };
  });
  const plane = points.length >= 3 && regressPlane(points, point => point, point => point, 'd');
  const level = Math.min(...points.map(point => point.d));
  return plane ? (x, y) => plane[0] * x + plane[1] * y + plane[2] : () => level;
};

/**
 * Wie viel dunkler als das Papier an seiner Stelle ein Pixel sein muss, um als Strich zu zaehlen.
 * Gegen die Hintergrundebene gemessen reicht wenig: blasse, duenne Kugelschreiberkreuze liegen nur
 * rund 0,1 ueber dem Papier, leere Felder auf allen echten Fotos erst ab 0,03 ueberhaupt darueber.
 */
const PAPER_CONTRAST = 0.07;

/** Anteil der Pixel im Kreisinneren, die deutlich dunkler sind als das Papier an ihrer Stelle. */
const measureFuellgrad = (crop, cx, cy, ringRadius) => {
  const paper = paperPlane(crop, cx, cy, ringRadius);
  const r = Math.max(2, Math.round(ringRadius * 0.68));
  let hits = 0, count = 0;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const threshold = Math.max(0.22, Math.min(0.7, paper(cx + dx, cy + dy) + PAPER_CONTRAST));
      hits += darknessAt(crop, cx + dx, cy + dy) > threshold ? 1 : 0;
      count++;
    }
  return hits / count;
};

export const normalizeField = (map, perspectiveFrame, kalibrierungsFrame, point, radius, options = {}) => {
  const normalRadius = Math.max(3, Math.round(radius));
  const search = options.search ?? Math.max(2, Math.round(normalRadius * 0.2));
  const { map: crop, center } = normalizeCrop(
    map, perspectiveFrame, kalibrierungsFrame, point, normalRadius, search,
  );
  const ring = findRing(crop, center, normalRadius, search);
  const referenz = { x: point.x + ring.x - center, y: point.y + ring.y - center };
  const aufnahme = perspectivePoint(perspectiveFrame, kalibrierungsFrame, referenz);
  return {
    ...aufnahme,
    referenz,
    ringScore: ring.score,
    ringDarkness: ring.ring,
    fuellgrad: measureFuellgrad(crop, ring.x, ring.y, normalRadius),
  };
};

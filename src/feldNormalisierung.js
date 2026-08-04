/** Perspektivisch normalisierte kleine Ausschnitte rund um die erwarteten Ankreuzringe. */
import { perspectivePoint } from './frame.js';
import { darknessAt, darkRatio, ringDarkness } from './image.js';
import { regressPlane } from './leastSquares.js';

const regressTransformation = treffer => {
  const x = regressPlane(treffer, t => t.quelle, t => t.ziel, 'x');
  const y = regressPlane(treffer, t => t.quelle, t => t.ziel, 'y');
  return x && y ? { a: x[0], c: x[1], e: x[2], b: y[0], d: y[1], f: y[2] } : undefined;
};

export const transformRing = ({ a, b, c, d, e, f }, { x, y }) => ({
  x: a * x + c * y + e,
  y: b * x + d * y + f,
});

const kombinationen3 = werte => werte.flatMap((a, i) => werte.slice(i + 1).flatMap((b, j) =>
  werte.slice(i + j + 2).map(c => [a, b, c])));

const residual = (transformation, { quelle, ziel }) => {
  const punkt = transformRing(transformation, quelle);
  return Math.hypot(punkt.x - ziel.x, punkt.y - ziel.y);
};

export const determineRingTransformation = treffer => {
  const kandidaten = treffer.filter(({ ringScore }) => ringScore >= 0.24);
  let beste;
  for (const probe of kombinationen3(kandidaten)) {
    const transformation = regressTransformation(probe);
    if (!transformation) continue;
    const inlier = kandidaten.filter(treffer => residual(transformation, treffer) <= 10);
    const score = inlier.length * 100 - inlier.reduce((summe, treffer) => summe + residual(transformation, treffer), 0);
    if (!beste || score > beste.score) beste = { transformation, inlier, score };
  }
  if (!beste || beste.inlier.length < 6) throw new Error('Zu wenige Ankreuzringe fuer eine sichere Ausrichtung erkannt.');
  if (beste.inlier.reduce((summe, treffer) => summe + treffer.ringScore, 0) / beste.inlier.length < 0.32)
    throw new Error('Kontrast der gefundenen Ankreuzringe ist zu gering.');
  const xs = beste.inlier.map(({ quelle }) => quelle.x), ys = beste.inlier.map(({ quelle }) => quelle.y);
  if (Math.max(...xs) - Math.min(...xs) < 80 || Math.max(...ys) - Math.min(...ys) < 300)
    throw new Error('Erkannte Ankreuzringe liegen nicht ausreichend verteilt.');
  const transformation = regressTransformation(beste.inlier);
  if (Math.abs(transformation.a - 1) > 0.2 || Math.abs(transformation.d - 1) > 0.2
    || Math.abs(transformation.b) > 0.12 || Math.abs(transformation.c) > 0.12)
    throw new Error('Ausrichtung der Ankreuzringe ist geometrisch unplausibel.');
  return { transformation, treffer: beste.inlier };
};

const interpolatedDarkness = (map, x, y) => {
  const x0 = Math.floor(x), y0 = Math.floor(y), dx = x - x0, dy = y - y0;
  return darknessAt(map, x0, y0) * (1 - dx) * (1 - dy)
    + darknessAt(map, x0 + 1, y0) * dx * (1 - dy)
    + darknessAt(map, x0, y0 + 1) * (1 - dx) * dy
    + darknessAt(map, x0 + 1, y0 + 1) * dx * dy;
};

const perspectiveRingDarkness = (map, perspectiveFrame, kalibrierungsFrame, punkt, radius, samples = 48) => {
  let summe = 0;
  for (let i = 0; i < samples; i++) {
    const winkel = 2 * Math.PI * i / samples;
    const quelle = perspectivePoint(perspectiveFrame, kalibrierungsFrame, {
      x: punkt.x + radius * Math.cos(winkel),
      y: punkt.y + radius * Math.sin(winkel),
    });
    summe += interpolatedDarkness(map, quelle.x, quelle.y);
  }
  return summe / samples;
};

const perspectiveRingScore = (map, perspectiveFrame, kalibrierungsFrame, punkt, radius) => {
  const ring = perspectiveRingDarkness(map, perspectiveFrame, kalibrierungsFrame, punkt, radius, 48);
  const umfeld = (perspectiveRingDarkness(map, perspectiveFrame, kalibrierungsFrame, punkt, radius * 0.7, 48)
    + perspectiveRingDarkness(map, perspectiveFrame, kalibrierungsFrame, punkt, radius * 1.3, 48)) / 2;
  return ring - umfeld * 0.55;
};

const scoreShift = (map, perspectiveFrame, kalibrierungsFrame, punkte, radius, dx, dy) => {
  const ys = punkte.map(punkt => punkt.y), minY = Math.min(...ys), maxY = Math.max(...ys);
  const gewichtet = punkte.map(punkt => ({
    punkt,
    gewicht: punkt.y <= minY + radius * 2 || punkt.y >= maxY - radius * 6 ? 3 : 1,
  }));
  const gewicht = gewichtet.reduce((summe, eintrag) => summe + eintrag.gewicht, 0);
  return gewichtet.reduce((summe, { punkt, gewicht }) => summe + gewicht * perspectiveRingScore(
    map, perspectiveFrame, kalibrierungsFrame, { x: punkt.x + dx, y: punkt.y + dy }, radius,
  ), 0) / gewicht;
};

export const findRoughRingShift = (map, perspectiveFrame, kalibrierungsFrame, punkte, radius) => {
  let beste;
  for (let dy = -radius * 4; dy <= radius; dy += 6)
    for (let dx = -90; dx <= 90; dx += 6) {
      const score = scoreShift(map, perspectiveFrame, kalibrierungsFrame, punkte, radius, dx, dy);
      if (!beste || score > beste.score) beste = { dx, dy, score };
    }
  const grob = beste;
  for (let dy = grob.dy - 6; dy <= grob.dy + 6; dy++)
    for (let dx = grob.dx - 6; dx <= grob.dx + 6; dx++) {
      const score = scoreShift(map, perspectiveFrame, kalibrierungsFrame, punkte, radius, dx, dy);
      if (score > beste.score) beste = { dx, dy, score };
    }
  if (beste.score < 0.15) throw new Error('Gedruckte Ankreuzringe nicht sicher gefunden.');
  return beste;
};

const normalizeCrop = (map, perspectiveFrame, kalibrierungsFrame, punkt, radius, suche) => {
  const rand = radius + suche + 2, width = rand * 2 + 1, height = width;
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const quelle = perspectivePoint(perspectiveFrame, kalibrierungsFrame, {
        x: punkt.x + x - rand,
        y: punkt.y + y - rand,
      });
      values[y * width + x] = interpolatedDarkness(map, quelle.x, quelle.y);
    }
  return { map: { width, height, values }, mitte: rand };
};

const findRing = (map, mitte, radius, suche) => {
  const scoreBei = (x, y) => {
    const ring = ringDarkness(map, x, y, radius, 72);
    const umfeld = (ringDarkness(map, x, y, radius * 0.7, 72)
      + ringDarkness(map, x, y, radius * 1.3, 72)) / 2;
    return { ring, score: ring - umfeld * 0.55 };
  };
  const start = scoreBei(mitte, mitte);
  let beste = { x: mitte, y: mitte, ...start };
  for (let dy = -suche; dy <= suche; dy++)
    for (let dx = -suche; dx <= suche; dx++) {
      const wertung = scoreBei(mitte + dx, mitte + dy);
      if (wertung.score > beste.score) beste = { x: mitte + dx, y: mitte + dy, ...wertung };
    }
  return beste;
};

const localThreshold = ({ values }) => {
  const sortiert = [...values].sort((a, b) => a - b);
  const papier = sortiert[Math.floor(sortiert.length * 0.2)];
  return Math.max(0.22, Math.min(0.7, papier + 0.18));
};

export const normalizeField = (map, perspectiveFrame, kalibrierungsFrame, punkt, radius, options = {}) => {
  const normalRadius = Math.max(3, Math.round(radius));
  const suche = options.suche ?? Math.max(2, Math.round(normalRadius * 0.2));
  const { map: ausschnitt, mitte } = normalizeCrop(
    map, perspectiveFrame, kalibrierungsFrame, punkt, normalRadius, suche,
  );
  const ring = findRing(ausschnitt, mitte, normalRadius, suche);
  const referenz = { x: punkt.x + ring.x - mitte, y: punkt.y + ring.y - mitte };
  const aufnahme = perspectivePoint(perspectiveFrame, kalibrierungsFrame, referenz);
  return {
    ...aufnahme,
    referenz,
    ringScore: ring.score,
    ringDarkness: ring.ring,
    fuellgrad: darkRatio(
      ausschnitt, ring.x, ring.y, Math.max(2, Math.round(normalRadius * 0.68)), localThreshold(ausschnitt),
    ),
  };
};

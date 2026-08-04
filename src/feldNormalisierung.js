/** Perspektivisch normalisierte kleine Ausschnitte rund um die erwarteten Ankreuzringe. */
import { perspectivePoint } from './frame.js';
import { darknessAt, darkRatio, ringDarkness } from './image.js';

const loese3x3 = (matrix, werte) => {
  const zeilen = matrix.map((zeile, i) => [...zeile, werte[i]]);
  for (let spalte = 0; spalte < 3; spalte++) {
    const pivot = [...Array(3 - spalte).keys()]
      .map(offset => spalte + offset)
      .sort((a, b) => Math.abs(zeilen[b][spalte]) - Math.abs(zeilen[a][spalte]))[0];
    if (Math.abs(zeilen[pivot][spalte]) < 1e-8) return undefined;
    [zeilen[spalte], zeilen[pivot]] = [zeilen[pivot], zeilen[spalte]];
    const teiler = zeilen[spalte][spalte];
    zeilen[spalte] = zeilen[spalte].map(wert => wert / teiler);
    for (let zeile = 0; zeile < 3; zeile++) {
      if (zeile === spalte) continue;
      const faktor = zeilen[zeile][spalte];
      zeilen[zeile] = zeilen[zeile].map((wert, i) => wert - faktor * zeilen[spalte][i]);
    }
  }
  return zeilen.map(zeile => zeile[3]);
};

const regressiere = (treffer, achse) => {
  const summen = treffer.reduce((summe, { quelle, ziel }) => ({
    xx: summe.xx + quelle.x ** 2,
    xy: summe.xy + quelle.x * quelle.y,
    yy: summe.yy + quelle.y ** 2,
    x: summe.x + quelle.x,
    y: summe.y + quelle.y,
    zx: summe.zx + ziel[achse] * quelle.x,
    zy: summe.zy + ziel[achse] * quelle.y,
    z: summe.z + ziel[achse],
  }), { xx: 0, xy: 0, yy: 0, x: 0, y: 0, zx: 0, zy: 0, z: 0 });
  return loese3x3(
    [[summen.xx, summen.xy, summen.x], [summen.xy, summen.yy, summen.y], [summen.x, summen.y, treffer.length]],
    [summen.zx, summen.zy, summen.z],
  );
};

const regressiereTransformation = treffer => {
  const x = regressiere(treffer, 'x'), y = regressiere(treffer, 'y');
  return x && y ? { a: x[0], c: x[1], e: x[2], b: y[0], d: y[1], f: y[2] } : undefined;
};

export const transformiereRing = ({ a, b, c, d, e, f }, { x, y }) => ({
  x: a * x + c * y + e,
  y: b * x + d * y + f,
});

const kombinationen3 = werte => werte.flatMap((a, i) => werte.slice(i + 1).flatMap((b, j) =>
  werte.slice(i + j + 2).map(c => [a, b, c])));

const fehler = (transformation, { quelle, ziel }) => {
  const punkt = transformiereRing(transformation, quelle);
  return Math.hypot(punkt.x - ziel.x, punkt.y - ziel.y);
};

export const bestimmeRingTransformation = treffer => {
  const kandidaten = treffer.filter(({ ringScore }) => ringScore >= 0.24);
  let beste;
  for (const probe of kombinationen3(kandidaten)) {
    const transformation = regressiereTransformation(probe);
    if (!transformation) continue;
    const inlier = kandidaten.filter(treffer => fehler(transformation, treffer) <= 10);
    const score = inlier.length * 100 - inlier.reduce((summe, treffer) => summe + fehler(transformation, treffer), 0);
    if (!beste || score > beste.score) beste = { transformation, inlier, score };
  }
  if (!beste || beste.inlier.length < 6) throw new Error('Zu wenige Ankreuzringe fuer eine sichere Ausrichtung erkannt.');
  if (beste.inlier.reduce((summe, treffer) => summe + treffer.ringScore, 0) / beste.inlier.length < 0.32)
    throw new Error('Kontrast der gefundenen Ankreuzringe ist zu gering.');
  const xs = beste.inlier.map(({ quelle }) => quelle.x), ys = beste.inlier.map(({ quelle }) => quelle.y);
  if (Math.max(...xs) - Math.min(...xs) < 80 || Math.max(...ys) - Math.min(...ys) < 300)
    throw new Error('Erkannte Ankreuzringe liegen nicht ausreichend verteilt.');
  const transformation = regressiereTransformation(beste.inlier);
  if (Math.abs(transformation.a - 1) > 0.2 || Math.abs(transformation.d - 1) > 0.2
    || Math.abs(transformation.b) > 0.12 || Math.abs(transformation.c) > 0.12)
    throw new Error('Ausrichtung der Ankreuzringe ist geometrisch unplausibel.');
  return { transformation, treffer: beste.inlier };
};

const interpolierteDarkness = (map, x, y) => {
  const x0 = Math.floor(x), y0 = Math.floor(y), dx = x - x0, dy = y - y0;
  return darknessAt(map, x0, y0) * (1 - dx) * (1 - dy)
    + darknessAt(map, x0 + 1, y0) * dx * (1 - dy)
    + darknessAt(map, x0, y0 + 1) * (1 - dx) * dy
    + darknessAt(map, x0 + 1, y0 + 1) * dx * dy;
};

const ringDarknessPerspektivisch = (map, perspectiveFrame, kalibrierungsFrame, punkt, radius, samples = 48) => {
  let summe = 0;
  for (let i = 0; i < samples; i++) {
    const winkel = 2 * Math.PI * i / samples;
    const quelle = perspectivePoint(perspectiveFrame, kalibrierungsFrame, {
      x: punkt.x + radius * Math.cos(winkel),
      y: punkt.y + radius * Math.sin(winkel),
    });
    summe += interpolierteDarkness(map, quelle.x, quelle.y);
  }
  return summe / samples;
};

const ringScorePerspektivisch = (map, perspectiveFrame, kalibrierungsFrame, punkt, radius) => {
  const ring = ringDarknessPerspektivisch(map, perspectiveFrame, kalibrierungsFrame, punkt, radius, 48);
  const umfeld = (ringDarknessPerspektivisch(map, perspectiveFrame, kalibrierungsFrame, punkt, radius * 0.7, 48)
    + ringDarknessPerspektivisch(map, perspectiveFrame, kalibrierungsFrame, punkt, radius * 1.3, 48)) / 2;
  return ring - umfeld * 0.55;
};

const scoreVerschiebung = (map, perspectiveFrame, kalibrierungsFrame, punkte, radius, dx, dy) => {
  const ys = punkte.map(punkt => punkt.y), minY = Math.min(...ys), maxY = Math.max(...ys);
  const gewichtet = punkte.map(punkt => ({
    punkt,
    gewicht: punkt.y <= minY + radius * 2 || punkt.y >= maxY - radius * 6 ? 3 : 1,
  }));
  const gewicht = gewichtet.reduce((summe, eintrag) => summe + eintrag.gewicht, 0);
  return gewichtet.reduce((summe, { punkt, gewicht }) => summe + gewicht * ringScorePerspektivisch(
    map, perspectiveFrame, kalibrierungsFrame, { x: punkt.x + dx, y: punkt.y + dy }, radius,
  ), 0) / gewicht;
};

export const findeGrobeRingVerschiebung = (map, perspectiveFrame, kalibrierungsFrame, punkte, radius) => {
  let beste;
  for (let dy = -radius * 4; dy <= radius; dy += 6)
    for (let dx = -90; dx <= 90; dx += 6) {
      const score = scoreVerschiebung(map, perspectiveFrame, kalibrierungsFrame, punkte, radius, dx, dy);
      if (!beste || score > beste.score) beste = { dx, dy, score };
    }
  const grob = beste;
  for (let dy = grob.dy - 6; dy <= grob.dy + 6; dy++)
    for (let dx = grob.dx - 6; dx <= grob.dx + 6; dx++) {
      const score = scoreVerschiebung(map, perspectiveFrame, kalibrierungsFrame, punkte, radius, dx, dy);
      if (score > beste.score) beste = { dx, dy, score };
    }
  if (beste.score < 0.15) throw new Error('Gedruckte Ankreuzringe nicht sicher gefunden.');
  return beste;
};

const normalisiereAusschnitt = (map, perspectiveFrame, kalibrierungsFrame, punkt, radius, suche) => {
  const rand = radius + suche + 2, width = rand * 2 + 1, height = width;
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const quelle = perspectivePoint(perspectiveFrame, kalibrierungsFrame, {
        x: punkt.x + x - rand,
        y: punkt.y + y - rand,
      });
      values[y * width + x] = interpolierteDarkness(map, quelle.x, quelle.y);
    }
  return { map: { width, height, values }, mitte: rand };
};

const findeRing = (map, mitte, radius, suche) => {
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

const lokalerThreshold = ({ values }) => {
  const sortiert = [...values].sort((a, b) => a - b);
  const papier = sortiert[Math.floor(sortiert.length * 0.2)];
  return Math.max(0.22, Math.min(0.7, papier + 0.18));
};

export const normalisiereFeld = (map, perspectiveFrame, kalibrierungsFrame, punkt, radius, options = {}) => {
  const normalRadius = Math.max(3, Math.round(radius));
  const suche = options.suche ?? Math.max(2, Math.round(normalRadius * 0.2));
  const { map: ausschnitt, mitte } = normalisiereAusschnitt(
    map, perspectiveFrame, kalibrierungsFrame, punkt, normalRadius, suche,
  );
  const ring = findeRing(ausschnitt, mitte, normalRadius, suche);
  const referenz = { x: punkt.x + ring.x - mitte, y: punkt.y + ring.y - mitte };
  const aufnahme = perspectivePoint(perspectiveFrame, kalibrierungsFrame, referenz);
  return {
    ...aufnahme,
    referenz,
    ringScore: ring.score,
    ringDarkness: ring.ring,
    fuellgrad: darkRatio(
      ausschnitt, ring.x, ring.y, Math.max(2, Math.round(normalRadius * 0.68)), lokalerThreshold(ausschnitt),
    ),
  };
};

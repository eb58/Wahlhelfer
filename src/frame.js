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

const maxDarkness = ({ width, height, values }, x, y, senkrecht) => {
  let maximum = 0;
  for (let offset = -2; offset <= 2; offset++) {
    const px = Math.round(x + (senkrecht ? offset : 0)), py = Math.round(y + (senkrecht ? 0 : offset));
    if (px >= 0 && py >= 0 && px < width && py < height) maximum = Math.max(maximum, values[py * width + px]);
  }
  return maximum;
};

const findWaagerechte = (map, papier, von, bis, slopeVon, slopeBis, richtung = 'beste') => {
  const mitteX = (papier.left + papier.right) / 2;
  const startX = Math.round(papier.left + (papier.right - papier.left) * 0.06);
  const endeX = Math.round(papier.right - (papier.right - papier.left) * 0.06);
  let beste;
  const kandidaten = [];
  for (let slope = slopeVon; slope <= slopeBis + 1e-8; slope += 0.01)
    for (let mitteY = Math.round(von); mitteY <= bis; mitteY += 2) {
      let summe = 0, anzahl = 0;
      for (let x = startX; x <= endeX; x += 4) {
        summe += maxDarkness(map, x, mitteY + slope * (x - mitteX), false);
        anzahl++;
      }
      const score = summe / anzahl;
      if (!beste || score > beste.score) beste = { a: slope, b: mitteY - slope * mitteX, mitte: mitteY, score };
      if (score >= 0.25) kandidaten.push({ a: slope, b: mitteY - slope * mitteX, mitte: mitteY, score });
    }
  if (richtung === 'beste' || !beste) return beste;
  const grenze = Math.max(0.28, beste.score * 0.65);
  return kandidaten
    .filter(kandidat => kandidat.score >= grenze)
    .sort((a, b) => richtung === 'unten' ? b.mitte - a.mitte : a.mitte - b.mitte)[0] ?? beste;
};

const findSenkrechte = (map, papier, oben, unten, von, bis) => {
  const mitteY = (oben.mitte + unten.mitte) / 2;
  const startY = Math.round(oben.mitte + (unten.mitte - oben.mitte) * 0.03);
  const endeY = Math.round(unten.mitte - (unten.mitte - oben.mitte) * 0.03);
  let beste;
  for (let slope = -0.2; slope <= 0.2 + 1e-8; slope += 0.01)
    for (let mitteX = Math.round(von); mitteX <= bis; mitteX += 2) {
      let summe = 0, anzahl = 0;
      for (let y = startY; y <= endeY; y += 4) {
        summe += maxDarkness(map, mitteX + slope * (y - mitteY), y, true);
        anzahl++;
      }
      const score = summe / anzahl;
      if (!beste || score > beste.score) beste = { a: slope, b: mitteX - slope * mitteY, mitte: mitteX, score };
    }
  return beste;
};

const schneide = (waagerecht, senkrecht) => {
  const y = (waagerecht.a * senkrecht.b + waagerecht.b) / (1 - waagerecht.a * senkrecht.a);
  return { x: senkrecht.a * y + senkrecht.b, y };
};

const median = werte => {
  const sortiert = [...werte].sort((a, b) => a - b), mitte = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 ? sortiert[mitte] : (sortiert[mitte - 1] + sortiert[mitte]) / 2;
};

const regressiereLinie = (punkte, unabhaengig, abhaengig, slopeVon, slopeBis, bevorzugt = 0) => {
  if (punkte.length < 20) return undefined;
  let beste;
  for (let a = slopeVon; a <= slopeBis + 1e-8; a += 0.005) {
    const b = median(punkte.map(punkt => punkt[abhaengig] - a * punkt[unabhaengig]));
    const treffer = punkte.filter(punkt => Math.abs(punkt[abhaengig] - a * punkt[unabhaengig] - b) <= 4);
    const score = treffer.length - Math.abs(a - bevorzugt) * 0.01;
    if (!beste || score > beste.score) beste = { a, b, treffer, score };
  }
  if (beste.treffer.length < punkte.length * 0.45) return undefined;
  const n = beste.treffer.length;
  const summen = beste.treffer.reduce((summe, punkt) => ({
    x: summe.x + punkt[unabhaengig],
    y: summe.y + punkt[abhaengig],
    xx: summe.xx + punkt[unabhaengig] ** 2,
    xy: summe.xy + punkt[unabhaengig] * punkt[abhaengig],
  }), { x: 0, y: 0, xx: 0, xy: 0 });
  const nenner = n * summen.xx - summen.x ** 2;
  const a = Math.abs(nenner) > 1e-8 ? (n * summen.xy - summen.x * summen.y) / nenner : beste.a;
  return { a, b: (summen.y - a * summen.x) / n, score: beste.treffer.length / punkte.length };
};

const randPunkte = (map, papier, art, richtung) => {
  const breite = papier.right - papier.left, hoehe = papier.bottom - papier.top;
  const waagerecht = art === 'waagerecht';
  const von = waagerecht ? papier.left + breite * 0.08 : papier.top + hoehe * 0.08;
  const bis = waagerecht ? papier.right - breite * 0.08 : papier.bottom - hoehe * 0.08;
  const sucheVon = waagerecht
    ? papier.top + hoehe * (richtung === 'vorwaerts' ? 0.015 : 0.985)
    : papier.left + breite * (richtung === 'vorwaerts' ? 0.015 : 0.985);
  const sucheBis = waagerecht
    ? papier.top + hoehe * (richtung === 'vorwaerts' ? 0.14 : 0.68)
    : papier.left + breite * (richtung === 'vorwaerts' ? 0.18 : 0.82);
  const schritt = richtung === 'vorwaerts' ? 1 : -1;
  const punkte = [];
  for (let fest = Math.round(von); fest <= bis; fest += 4)
    for (let variabel = Math.round(sucheVon); schritt > 0 ? variabel <= sucheBis : variabel >= sucheBis; variabel += schritt) {
      const x = waagerecht ? fest : variabel, y = waagerecht ? variabel : fest;
      if (maxDarkness(map, x, y, !waagerecht) < 0.35) continue;
      punkte.push({ x, y });
      break;
    }
  return punkte;
};

/** Sucht die vier perspektivischen Druckrahmenlinien innerhalb der groben Papierlage. */
export const findPerspectiveFrame = (map, papier) => {
  if (!papier) return undefined;
  const breite = papier.right - papier.left, hoehe = papier.bottom - papier.top;
  const oben = findWaagerechte(
    map, papier, papier.top + hoehe * 0.025, papier.top + hoehe * 0.12,
    papier.horizontalSlope - 0.06, papier.horizontalSlope + 0.06, 'oben',
  );
  const untereRandpunkte = randPunkte(map, papier, 'waagerecht', 'rueckwaerts');
  const untereAussenlinie = regressiereLinie(untereRandpunkte, 'x', 'y', -0.2, 0.2, papier.horizontalSlope);
  const unten = untereAussenlinie ? {
    ...untereAussenlinie,
    mitte: untereAussenlinie.a * (papier.left + papier.right) / 2 + untereAussenlinie.b,
  } : findWaagerechte(
    map, papier, papier.top + hoehe * 0.72, papier.bottom - hoehe * 0.02,
    oben.a - 0.08, oben.a + 0.08, 'unten',
  );
  if (!oben || !unten || oben.score < 0.3 || unten.score < 0.3 || unten.mitte <= oben.mitte) return undefined;
  const links = findSenkrechte(map, papier, oben, unten, papier.left, papier.left + breite * 0.3);
  const rechts = findSenkrechte(map, papier, oben, unten, papier.right - breite * 0.3, papier.right);
  if (!links || !rechts || links.score < 0.3 || rechts.score < 0.3 || rechts.mitte <= links.mitte) return undefined;
  const ecken = {
    obenLinks: schneide(oben, links),
    obenRechts: schneide(oben, rechts),
    untenLinks: schneide(unten, links),
    untenRechts: schneide(unten, rechts),
  };
  const xs = Object.values(ecken).map(ecke => ecke.x), ys = Object.values(ecken).map(ecke => ecke.y);
  return {
    left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys),
    horizontalSlope: oben.a, ecken,
  };
};

/** Projiziert einen Punkt aus dem Kalibrierungsrahmen in den perspektivischen Fotorahmen. */
export const perspectivePoint = ({ ecken }, kalibrierungsFrame, { x, y }) => {
  const { obenLinks, obenRechts, untenLinks, untenRechts } = ecken;
  const dx1 = obenRechts.x - untenRechts.x, dx2 = untenLinks.x - untenRechts.x;
  const dx3 = obenLinks.x - obenRechts.x + untenRechts.x - untenLinks.x;
  const dy1 = obenRechts.y - untenRechts.y, dy2 = untenLinks.y - untenRechts.y;
  const dy3 = obenLinks.y - obenRechts.y + untenRechts.y - untenLinks.y;
  const nenner = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(nenner) > 1e-8 ? (dx3 * dy2 - dx2 * dy3) / nenner : 0;
  const h = Math.abs(nenner) > 1e-8 ? (dx1 * dy3 - dx3 * dy1) / nenner : 0;
  const a = obenRechts.x - obenLinks.x + g * obenRechts.x;
  const b = untenLinks.x - obenLinks.x + h * untenLinks.x;
  const d = obenRechts.y - obenLinks.y + g * obenRechts.y;
  const e = untenLinks.y - obenLinks.y + h * untenLinks.y;
  const u = (x - kalibrierungsFrame.left) / (kalibrierungsFrame.right - kalibrierungsFrame.left);
  const v = (y - kalibrierungsFrame.top) / (kalibrierungsFrame.bottom - kalibrierungsFrame.top);
  const z = g * u + h * v + 1;
  return { x: (a * u + b * v + obenLinks.x) / z, y: (d * u + e * v + obenLinks.y) / z };
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

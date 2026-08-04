/**
 * Textbasierte Feinjustierung: ordnet vermessene Textmarken erkannten OCR-Woertern zu
 * und bestimmt daraus eine affine Abbildung von Muster- auf Aufnahmepixel.
 */

const normalisiere = text => text
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const levenshtein = (links, rechts) => {
  const vorher = [...Array(rechts.length + 1).keys()];
  for (let i = 1; i <= links.length; i++) {
    const aktuell = [i];
    for (let j = 1; j <= rechts.length; j++)
      aktuell[j] = Math.min(aktuell[j - 1] + 1, vorher[j] + 1, vorher[j - 1] + (links[i - 1] === rechts[j - 1] ? 0 : 1));
    vorher.splice(0, vorher.length, ...aktuell);
  }
  return vorher.at(-1);
};

const aehnlichkeit = (links, rechts) => {
  const a = normalisiere(links), b = normalisiere(rechts);
  return a && b ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 0;
};

const mittelpunkt = ({ bbox, x, y }) => bbox
  ? { x: (bbox.x0 + bbox.x1) / 2, y: (bbox.y0 + bbox.y1) / 2 }
  : { x, y };

const grobeLage = (textmarke, kalibrierungsFrame, aufnahmeFrame) => ({
  x: aufnahmeFrame.left + (textmarke.x - kalibrierungsFrame.left)
    / (kalibrierungsFrame.right - kalibrierungsFrame.left) * (aufnahmeFrame.right - aufnahmeFrame.left),
  y: aufnahmeFrame.top + (textmarke.y - kalibrierungsFrame.top)
    / (kalibrierungsFrame.bottom - kalibrierungsFrame.top) * (aufnahmeFrame.bottom - aufnahmeFrame.top),
});

const ordneZu = (textmarken, woerter, kalibrierungsFrame, aufnahmeFrame, genutzt = new Set(), transformation) => {
  const diagonale = aufnahmeFrame
    ? Math.hypot(aufnahmeFrame.right - aufnahmeFrame.left, aufnahmeFrame.bottom - aufnahmeFrame.top)
    : 1;

  return textmarken.flatMap(({ marke: textmarke, index: textmarkeIndex }) => {
    const erwartet = transformation
      ? transformiere(transformation, textmarke)
      : aufnahmeFrame ? grobeLage(textmarke, kalibrierungsFrame, aufnahmeFrame) : undefined;
    const kandidaten = woerter
      .map((wort, index) => ({ wort, index, punkt: mittelpunkt(wort), aehnlichkeit: aehnlichkeit(textmarke.text, wort.text) }))
      .filter(kandidat => !genutzt.has(kandidat.index) && kandidat.aehnlichkeit >= 0.75
        && (kandidat.wort.textmarke === undefined || kandidat.wort.textmarke === textmarkeIndex))
      .filter(kandidat => !transformation || Math.hypot(kandidat.punkt.x - erwartet.x, kandidat.punkt.y - erwartet.y) <= diagonale * 0.06)
      .map(kandidat => ({
        ...kandidat,
        score: kandidat.aehnlichkeit - (erwartet ? Math.hypot(kandidat.punkt.x - erwartet.x, kandidat.punkt.y - erwartet.y) / diagonale * 0.2 : 0),
      }))
      .sort((a, b) => b.score - a.score);
    const [bester] = kandidaten;
    if (!bester) return [];
    genutzt.add(bester.index);
    return [{ text: textmarke.text, muster: { x: textmarke.x, y: textmarke.y }, aufnahme: bester.punkt, score: bester.score }];
  });
};

const loese3x3 = (matrix, werte) => {
  const zeilen = matrix.map((zeile, i) => [...zeile, werte[i]]);
  for (let spalte = 0; spalte < 3; spalte++) {
    const pivot = [...Array(3 - spalte).keys()]
      .map(offset => spalte + offset)
      .sort((a, b) => Math.abs(zeilen[b][spalte]) - Math.abs(zeilen[a][spalte]))[0];
    if (Math.abs(zeilen[pivot][spalte]) < 1e-8) throw new Error('Textmarken liegen nicht ausreichend verteilt.');
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
  const summen = treffer.reduce((summe, { muster, aufnahme }) => ({
    xx: summe.xx + muster.x * muster.x,
    xy: summe.xy + muster.x * muster.y,
    yy: summe.yy + muster.y * muster.y,
    x: summe.x + muster.x,
    y: summe.y + muster.y,
    zx: summe.zx + aufnahme[achse] * muster.x,
    zy: summe.zy + aufnahme[achse] * muster.y,
    z: summe.z + aufnahme[achse],
  }), { xx: 0, xy: 0, yy: 0, x: 0, y: 0, zx: 0, zy: 0, z: 0 });
  return loese3x3(
    [[summen.xx, summen.xy, summen.x], [summen.xy, summen.yy, summen.y], [summen.x, summen.y, treffer.length]],
    [summen.zx, summen.zy, summen.z],
  );
};

export const transformiere = ({ a, b, c, d, e, f }, { x, y }) => ({
  x: a * x + c * y + e,
  y: b * x + d * y + f,
});

export const transformationsScale = ({ a, b, c, d }) => Math.sqrt(Math.abs(a * d - b * c));

const regressiereLinie = (treffer, wert) => {
  const summen = treffer.reduce((summe, treffer) => ({
    y: summe.y + treffer.muster.y,
    yy: summe.yy + treffer.muster.y ** 2,
    z: summe.z + wert(treffer),
    zy: summe.zy + wert(treffer) * treffer.muster.y,
  }), { y: 0, yy: 0, z: 0, zy: 0 });
  const nenner = treffer.length * summen.yy - summen.y ** 2;
  if (Math.abs(nenner) < 1e-8) throw new Error('Textmarken liegen nicht ausreichend verteilt.');
  const d = (treffer.length * summen.zy - summen.y * summen.z) / nenner;
  return [d, (summen.z - d * summen.y) / treffer.length];
};

const regressiereTransformation = (treffer, horizontalSlope, yTreffer = treffer) => {
  const [a, c, e] = regressiere(treffer, 'x');
  const [b, d, f] = Number.isFinite(horizontalSlope)
    ? (() => {
      const b = horizontalSlope * a;
      const [d, f] = regressiereLinie(yTreffer, treffer => treffer.aufnahme.y - b * treffer.muster.x);
      return [b, d, f];
    })()
    : regressiere(yTreffer, 'y');
  return { a, b, c, d, e, f };
};

export const bestimmeTextTransformation = (textmarken, woerter, kalibrierungsFrame, aufnahmeFrame, { horizontalSlope } = {}) => {
  const eintraege = textmarken.map((marke, index) => ({ marke, index }));
  const haeufigkeit = textmarken.reduce((werte, marke) => ({ ...werte, [normalisiere(marke.text)]: (werte[normalisiere(marke.text)] ?? 0) + 1 }), {});
  const eindeutig = eintraege.filter(({ marke }) => haeufigkeit[normalisiere(marke.text)] === 1);
  const mehrfach = eintraege.filter(({ marke }) => haeufigkeit[normalisiere(marke.text)] > 1);
  const genutzt = new Set();
  const ersteTreffer = ordneZu(eindeutig, woerter, kalibrierungsFrame, aufnahmeFrame, genutzt);
  const vorlaeufig = ersteTreffer.length >= 3 ? regressiereTransformation(ersteTreffer, horizontalSlope) : undefined;
  const treffer = [
    ...ersteTreffer,
    ...ordneZu(mehrfach, woerter, kalibrierungsFrame, aufnahmeFrame, genutzt, vorlaeufig),
  ];
  if (treffer.length < 3)
    throw new Error(`Zu wenige Textmarken erkannt (${treffer.length}/${textmarken.length}) - Aufnahme bitte gerade und scharf wiederholen.`);
  const feldGrenze = kalibrierungsFrame.top + (kalibrierungsFrame.bottom - kalibrierungsFrame.top) * 0.3;
  const feldTreffer = ersteTreffer.filter(treffer => treffer.muster.y >= feldGrenze);
  const yTreffer = feldTreffer.length >= 2 ? feldTreffer : ersteTreffer;
  return { transformation: regressiereTransformation(treffer, horizontalSlope, yTreffer), treffer };
};

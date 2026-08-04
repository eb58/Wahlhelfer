/**
 * Textbasierte Feinjustierung: ordnet vermessene Textmarken erkannten OCR-Woertern zu
 * und bestimmt daraus eine affine Abbildung von Muster- auf Aufnahmepixel.
 */
import { perspectivePoint } from './frame.js';

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

const ordneZu = (textmarken, woerter, kalibrierungsFrame, aufnahmeFrame, genutzt = new Set(), transformation, project) => {
  const diagonale = aufnahmeFrame
    ? Math.hypot(aufnahmeFrame.right - aufnahmeFrame.left, aufnahmeFrame.bottom - aufnahmeFrame.top)
    : 1;

  return textmarken.flatMap(({ marke: textmarke, index: textmarkeIndex }) => {
    const basis = project?.(textmarke) ?? textmarke;
    const erwartet = transformation
      ? transformiere(transformation, basis)
      : project ? basis
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
    return [{ text: textmarke.text, muster: { x: textmarke.x, y: textmarke.y }, basis, aufnahme: bester.punkt, score: bester.score }];
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
  const summen = treffer.reduce((summe, { muster, basis = muster, aufnahme }) => ({
    xx: summe.xx + basis.x * basis.x,
    xy: summe.xy + basis.x * basis.y,
    yy: summe.yy + basis.y * basis.y,
    x: summe.x + basis.x,
    y: summe.y + basis.y,
    zx: summe.zx + aufnahme[achse] * basis.x,
    zy: summe.zy + aufnahme[achse] * basis.y,
    z: summe.z + aufnahme[achse],
  }), { xx: 0, xy: 0, yy: 0, x: 0, y: 0, zx: 0, zy: 0, z: 0 });
  return loese3x3(
    [[summen.xx, summen.xy, summen.x], [summen.xy, summen.yy, summen.y], [summen.x, summen.y, treffer.length]],
    [summen.zx, summen.zy, summen.z],
  );
};

export const transformiere = (transformation, punkt) => {
  if (transformation.perspectiveFrame) {
    const basis = perspectivePoint(transformation.perspectiveFrame, transformation.kalibrierungsFrame, punkt);
    return transformiere(transformation.korrektur, basis);
  }
  const { a, b, c, d, e, f } = transformation;
  return { x: a * punkt.x + c * punkt.y + e, y: b * punkt.x + d * punkt.y + f };
};

export const transformationsScale = transformation => {
  if (!transformation.perspectiveFrame) {
    const { a, b, c, d } = transformation;
    return Math.sqrt(Math.abs(a * d - b * c));
  }
  const { kalibrierungsFrame: frame } = transformation;
  const mitte = { x: (frame.left + frame.right) / 2, y: (frame.top + frame.bottom) / 2 };
  const punkt = transformiere(transformation, mitte);
  const x = transformiere(transformation, { ...mitte, x: mitte.x + 1 });
  const y = transformiere(transformation, { ...mitte, y: mitte.y + 1 });
  return Math.sqrt(Math.abs((x.x - punkt.x) * (y.y - punkt.y) - (x.y - punkt.y) * (y.x - punkt.x)));
};

const regressiereLinie = (treffer, wert) => {
  const summen = treffer.reduce((summe, treffer) => ({
    y: summe.y + (treffer.basis ?? treffer.muster).y,
    yy: summe.yy + (treffer.basis ?? treffer.muster).y ** 2,
    z: summe.z + wert(treffer),
    zy: summe.zy + wert(treffer) * (treffer.basis ?? treffer.muster).y,
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
      const [d, f] = regressiereLinie(yTreffer, treffer => treffer.aufnahme.y - b * (treffer.basis ?? treffer.muster).x);
      return [b, d, f];
    })()
    : regressiere(yTreffer, 'y');
  return { a, b, c, d, e, f };
};

export const bestimmeTextTransformation = (textmarken, woerter, kalibrierungsFrame, aufnahmeFrame, { horizontalSlope, perspectiveFrame } = {}) => {
  const eintraege = textmarken.map((marke, index) => ({ marke, index }));
  const haeufigkeit = textmarken.reduce((werte, marke) => ({ ...werte, [normalisiere(marke.text)]: (werte[normalisiere(marke.text)] ?? 0) + 1 }), {});
  const eindeutig = eintraege.filter(({ marke }) => haeufigkeit[normalisiere(marke.text)] === 1);
  const mehrfach = eintraege.filter(({ marke }) => haeufigkeit[normalisiere(marke.text)] > 1);
  const genutzt = new Set();
  const project = perspectiveFrame ? punkt => perspectivePoint(perspectiveFrame, kalibrierungsFrame, punkt) : undefined;
  const slope = perspectiveFrame ? undefined : horizontalSlope;
  const ersteTreffer = ordneZu(eindeutig, woerter, kalibrierungsFrame, aufnahmeFrame, genutzt, undefined, project);
  const vorlaeufig = ersteTreffer.length >= 3 ? regressiereTransformation(ersteTreffer, slope) : undefined;
  const treffer = [
    ...ersteTreffer,
    ...ordneZu(mehrfach, woerter, kalibrierungsFrame, aufnahmeFrame, genutzt, vorlaeufig, project),
  ];
  if (treffer.length < 3) {
    const fehler = new Error(`Zu wenige Textmarken erkannt (${treffer.length}/${textmarken.length}) - Aufnahme bitte gerade und scharf wiederholen.`);
    fehler.treffer = treffer;
    throw fehler;
  }
  const feldGrenze = kalibrierungsFrame.top + (kalibrierungsFrame.bottom - kalibrierungsFrame.top) * 0.3;
  const feldTreffer = ersteTreffer.filter(treffer => treffer.muster.y >= feldGrenze);
  const yTreffer = feldTreffer.length >= 2 ? feldTreffer : ersteTreffer;
  const korrektur = regressiereTransformation(treffer, slope, yTreffer);
  const transformation = perspectiveFrame
    ? { perspectiveFrame, kalibrierungsFrame, korrektur }
    : korrektur;
  return { transformation, treffer };
};

/**
 * Grobe Papierlage fuer Smartphone-Fotos. Sie dient nur zum Platzieren der OCR-Bereiche;
 * die genaue affine Ausrichtung liefern anschliessend die Textmarken.
 */

const papierPixel = (r, g, b) => {
  const hell = Math.min(r, g, b) >= 130;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return hell && (chroma < 45 || b >= r - 15);
};

const bereich = (werte, minimum) => {
  const positionen = [...werte.keys()].filter(i => werte[i] >= minimum);
  return positionen.length ? [positionen[0], positionen.at(-1)] : undefined;
};

const linie = punkte => {
  const summen = punkte.reduce((summe, { x, y }) => ({
    x: summe.x + x,
    y: summe.y + y,
    xx: summe.xx + x * x,
    xy: summe.xy + x * y,
  }), { x: 0, y: 0, xx: 0, xy: 0 });
  const nenner = punkte.length * summen.xx - summen.x * summen.x;
  return nenner ? (punkte.length * summen.xy - summen.x * summen.y) / nenner : 0;
};

const findHorizontalSlope = (maske, width, height, { left, right, top, bottom }) => {
  const papierHoehe = bottom - top;
  const kandidaten = [];
  for (let x = Math.round(left + (right - left) * 0.05); x <= right - (right - left) * 0.05; x += 4) {
    const ende = Math.min(height - 12, Math.round(top + papierHoehe * 0.3));
    for (let y = Math.max(0, Math.round(top - papierHoehe * 0.08)); y <= ende; y++) {
      let treffer = 0;
      for (let offset = 0; offset < 12; offset++) treffer += maske[(y + offset) * width + x];
      if (treffer >= 10) {
        kandidaten.push({ x, y });
        break;
      }
    }
  }
  if (kandidaten.length < 10) return 0;
  const ySortiert = kandidaten.map(punkt => punkt.y).sort((a, b) => a - b);
  const mitte = ySortiert[Math.floor(ySortiert.length * 0.3)];
  const punkte = kandidaten.filter(punkt => Math.abs(punkt.y - mitte) <= Math.max(30, papierHoehe * 0.06));
  const slope = punkte.length >= 10 ? linie(punkte) : 0;
  return Math.abs(slope) <= 0.3 ? slope : 0;
};

/** @returns {{left:number,right:number,top:number,bottom:number,horizontalSlope:number}|undefined} */
export const findPapier = ({ width, height, data }, mindestAnteil = 0.15) => {
  const zeilen = new Uint32Array(height), spalten = new Uint32Array(width);
  const maske = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (papierPixel(data[i], data[i + 1], data[i + 2])) {
        maske[y * width + x] = 1;
        zeilen[y]++;
        spalten[x]++;
      }
    }
  const horizontal = bereich(spalten, height * mindestAnteil);
  const vertikal = bereich(zeilen, width * mindestAnteil);
  if (!horizontal || !vertikal) return undefined;
  const [left, right] = horizontal, [top, bottom] = vertikal;
  const papier = { left, right, top, bottom };
  return right - left >= width * 0.45 && bottom - top >= height * 0.45
    ? { ...papier, horizontalSlope: findHorizontalSlope(maske, width, height, papier) }
    : undefined;
};

/** Papierkante -> Lage des in der Kalibrierung vermessenen Druckrahmens. */
export const papierZuFrame = (papier, kalibrierung) => ({
  left: papier.left + (papier.right - papier.left) * kalibrierung.frame.left / kalibrierung.referenz.breite,
  right: papier.left + (papier.right - papier.left) * kalibrierung.frame.right / kalibrierung.referenz.breite,
  top: papier.top + (papier.bottom - papier.top) * kalibrierung.frame.top / kalibrierung.referenz.hoehe,
  bottom: papier.top + (papier.bottom - papier.top) * kalibrierung.frame.bottom / kalibrierung.referenz.hoehe,
});

/**
 * Grobe Papierlage fuer Smartphone-Fotos. Sie dient nur zum Platzieren der OCR-Bereiche;
 * die genaue affine Ausrichtung liefern anschliessend die Textmarken.
 */

const paperPixel = (r, g, b) => {
  const bright = Math.min(r, g, b) >= 130;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return bright && (chroma < 45 || b >= r - 15);
};

const range = (values, minimum) => {
  const positions = [...values.keys()].filter(i => values[i] >= minimum);
  return positions.length ? [positions[0], positions.at(-1)] : undefined;
};

const fitLine = points => {
  const sums = points.reduce((sum, { x, y }) => ({
    x: sum.x + x,
    y: sum.y + y,
    xx: sum.xx + x * x,
    xy: sum.xy + x * y,
  }), { x: 0, y: 0, xx: 0, xy: 0 });
  const denominator = points.length * sums.xx - sums.x * sums.x;
  return denominator ? (points.length * sums.xy - sums.x * sums.y) / denominator : 0;
};

const findHorizontalSlope = (mask, width, height, { left, right, top, bottom }) => {
  const paperHeight = bottom - top;
  const candidates = [];
  for (let x = Math.round(left + (right - left) * 0.05); x <= right - (right - left) * 0.05; x += 4) {
    const end = Math.min(height - 12, Math.round(top + paperHeight * 0.3));
    for (let y = Math.max(0, Math.round(top - paperHeight * 0.08)); y <= end; y++) {
      let hits = 0;
      for (let offset = 0; offset < 12; offset++) hits += mask[(y + offset) * width + x];
      if (hits >= 10) {
        candidates.push({ x, y });
        break;
      }
    }
  }
  if (candidates.length < 10) return 0;
  const sortedY = candidates.map(point => point.y).sort((a, b) => a - b);
  const middle = sortedY[Math.floor(sortedY.length * 0.3)];
  const points = candidates.filter(point => Math.abs(point.y - middle) <= Math.max(30, paperHeight * 0.06));
  const slope = points.length >= 10 ? fitLine(points) : 0;
  return Math.abs(slope) <= 0.3 ? slope : 0;
};

/** @returns {{left:number,right:number,top:number,bottom:number,horizontalSlope:number}|undefined} */
export const findPaper = ({ width, height, data }, minShare = 0.15) => {
  const rows = new Uint32Array(height), columns = new Uint32Array(width);
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (paperPixel(data[i], data[i + 1], data[i + 2])) {
        mask[y * width + x] = 1;
        rows[y]++;
        columns[x]++;
      }
    }
  const horizontal = range(columns, height * minShare);
  const vertical = range(rows, width * minShare);
  if (!horizontal || !vertical) return undefined;
  const [left, right] = horizontal, [top, bottom] = vertical;
  const paper = { left, right, top, bottom };
  return right - left >= width * 0.45 && bottom - top >= height * 0.45
    ? { ...paper, horizontalSlope: findHorizontalSlope(mask, width, height, paper) }
    : undefined;
};

/** Papierkante -> Lage des in der Kalibrierung vermessenen Druckrahmens. */
export const paperToFrame = (paper, kalibrierung) => ({
  left: paper.left + (paper.right - paper.left) * kalibrierung.frame.left / kalibrierung.referenz.breite,
  right: paper.left + (paper.right - paper.left) * kalibrierung.frame.right / kalibrierung.referenz.breite,
  top: paper.top + (paper.bottom - paper.top) * kalibrierung.frame.top / kalibrierung.referenz.hoehe,
  bottom: paper.top + (paper.bottom - paper.top) * kalibrierung.frame.bottom / kalibrierung.referenz.hoehe,
});

/**
 * Grobe Papierlage fuer Smartphone-Fotos. Sie unterscheidet Foto und Scan und begrenzt die Suche
 * nach dem Druckrahmen; die genaue Lage liefern anschliessend die Ankreuzringe.
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

const largestPaperComponent = (mask, width, height, blockSize, minShare) => {
  const blockWidth = Math.ceil(width / blockSize), blockHeight = Math.ceil(height / blockSize);
  const counts = new Uint16Array(blockWidth * blockHeight);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (mask[y * width + x]) counts[Math.floor(y / blockSize) * blockWidth + Math.floor(x / blockSize)]++;

  const blocks = new Uint8Array(counts.length);
  const minimum = Math.max(0.35, Math.min(0.7, minShare + 0.25));
  for (let by = 0; by < blockHeight; by++)
    for (let bx = 0; bx < blockWidth; bx++) {
      const blockWidthActual = Math.min(blockSize, width - bx * blockSize);
      const blockHeightActual = Math.min(blockSize, height - by * blockSize);
      const blockArea = blockWidthActual * blockHeightActual;
      blocks[by * blockWidth + bx] = counts[by * blockWidth + bx] >= blockArea * minimum ? 1 : 0;
    }

  const visited = new Uint8Array(blocks.length), stack = new Int32Array(blocks.length);
  let largest;
  for (let start = 0; start < blocks.length; start++) {
    if (!blocks[start] || visited[start]) continue;
    let stackSize = 1, area = 0, minX = blockWidth, minY = blockHeight, maxX = 0, maxY = 0;
    stack[0] = start;
    visited[start] = 1;
    while (stackSize) {
      const index = stack[--stackSize], bx = index % blockWidth, by = Math.floor(index / blockWidth);
      area += counts[index];
      minX = Math.min(minX, bx); minY = Math.min(minY, by);
      maxX = Math.max(maxX, bx); maxY = Math.max(maxY, by);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = bx + dx, ny = by + dy;
        if (nx < 0 || ny < 0 || nx >= blockWidth || ny >= blockHeight) continue;
        const neighbor = ny * blockWidth + nx;
        if (blocks[neighbor] && !visited[neighbor]) {
          visited[neighbor] = 1;
          stack[stackSize++] = neighbor;
        }
      }
    }
    if (!largest || area > largest.area) largest = { area, minX, minY, maxX, maxY };
  }
  if (!largest) return undefined;
  const coarse = {
    left: Math.max(0, largest.minX * blockSize - blockSize),
    right: Math.min(width - 1, (largest.maxX + 1) * blockSize - 1 + blockSize),
    top: Math.max(0, largest.minY * blockSize - blockSize),
    bottom: Math.min(height - 1, (largest.maxY + 1) * blockSize - 1 + blockSize),
  };
  const rows = new Uint32Array(coarse.bottom - coarse.top + 1);
  const columns = new Uint32Array(coarse.right - coarse.left + 1);
  for (let y = coarse.top; y <= coarse.bottom; y++)
    for (let x = coarse.left; x <= coarse.right; x++)
      if (mask[y * width + x]) { rows[y - coarse.top]++; columns[x - coarse.left]++; }
  const horizontal = range(columns, (coarse.bottom - coarse.top + 1) * minShare);
  const vertical = range(rows, (coarse.right - coarse.left + 1) * minShare);
  return horizontal && vertical
    ? {
      left: coarse.left + horizontal[0], right: coarse.left + horizontal[1],
      top: coarse.top + vertical[0], bottom: coarse.top + vertical[1],
    }
    : coarse;
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
  const blockSize = Math.max(4, Math.min(12, Math.round(Math.min(width, height) / 250)));
  const component = largestPaperComponent(mask, width, height, blockSize, minShare);
  const horizontal = range(columns, height * minShare), vertical = range(rows, width * minShare);
  const paper = component && horizontal && vertical
    ? {
      // Eine separate helle Fläche wird typischerweise am Bildrand angelegt.
      // Die Projektion liefert die grobe Lage; die zusammenhängende
      // Hauptkomponente begrenzt sie gegen fremde helle Flächen. Eine linke
      // Randlage bleibt unverändert, weil dort die Projektion robuster ist.
      left: horizontal[0] === 0 ? horizontal[0] : Math.max(component.left, horizontal[0]),
      right: Math.min(component.right, horizontal[1]),
      top: Math.max(component.top, vertical[0]),
      bottom: Math.min(component.bottom, vertical[1]),
    }
    : component ?? (horizontal && vertical ? {
      left: horizontal[0], right: horizontal[1], top: vertical[0], bottom: vertical[1],
    } : undefined);
  if (!paper) return undefined;
  return paper.right - paper.left >= width * 0.45 && paper.bottom - paper.top >= height * 0.45
    ? { ...paper, horizontalSlope: findHorizontalSlope(mask, width, height, paper) }
    : undefined;
};

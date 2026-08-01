/**
 * Bildgrundlagen: ImageData (Browser-Canvas oder Testleser) -> Dunkelheitskarte.
 * Darkness 0 = weiss, 1 = schwarz.
 */

/**
 * Durchsichtige Bildbereiche werden ueber Weiss gerechnet, nicht als Schwarz gewertet.
 * Ohne das liefert `canvas.getImageData()` fuer transparente PNG-Raender schwarze Pixel
 * und die Rahmensuche findet Linien, die auf dem Papier nicht existieren.
 */
export const toDarkness = ({ width, height, data }) => {
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i++) {
    const gray = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
    values[i] = (1 - gray) * (data[i * 4 + 3] / 255);
  }
  return { width, height, values };
};

/**
 * Verkleinert eine Dunkelheitskarte um einen ganzzahligen Faktor (Mittelwert je Block).
 *
 * Der Mittelwert bildet nach, wie eine niedriger aufgeloeste Aufnahme desselben Zettels
 * aussaehe. Das Maximum waere naheliegend, um duenne Linien zu erhalten, macht aber
 * kleine Schrift zu geschlossenen Flecken - die Ringsuche findet darin Scheinkreise.
 */
export const downscale = ({ width, height, values }, factor) => {
  if (factor <= 1) return { width, height, values };
  const w = Math.floor(width / factor), h = Math.floor(height / factor);
  const out = new Float32Array(w * h);
  const blockSize = factor * factor;

  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let dy = 0; dy < factor; dy++)
        for (let dx = 0; dx < factor; dx++) sum += values[(y * factor + dy) * width + x * factor + dx];
      out[y * w + x] = sum / blockSize;
    }
  return { width: w, height: h, values: out };
};

export const darknessAt = ({ width, height, values }, x, y) => {
  const px = Math.round(x), py = Math.round(y);
  return px < 0 || py < 0 || px >= width || py >= height ? 0 : values[py * width + px];
};

/** Mittlere Darkness auf dem Kreisumfang. */
export const ringDarkness = (map, cx, cy, r, samples = 48) => {
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const angle = (2 * Math.PI * i) / samples;
    sum += darknessAt(map, cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  return sum / samples;
};

/** Mittlere Darkness der Kreisflaeche - der Fuellgrad eines Ankreuzfelds. */
export const areaDarkness = (map, cx, cy, r) => {
  let sum = 0, count = 0;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      if (dx * dx + dy * dy <= r * r) { sum += darknessAt(map, cx + dx, cy + dy); count++; }
  return count ? sum / count : 0;
};

/**
 * Anteil dunkler Pixel in der Kreisflaeche - robuster gegen Grauschleier als der Mittelwert.
 * Der Schwellwert liegt bewusst niedrig, damit auch blasse Bleistiftstriche noch zaehlen;
 * das gedruckte Papierweiss liegt deutlich darunter.
 */
export const darkRatio = (map, cx, cy, r, threshold = 0.3) => {
  let hits = 0, count = 0;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      if (dx * dx + dy * dy <= r * r) { hits += darknessAt(map, cx + dx, cy + dy) > threshold ? 1 : 0; count++; }
  return count ? hits / count : 0;
};

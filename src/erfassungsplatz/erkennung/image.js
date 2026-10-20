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

/** Dreht ein RGBA-Bild um `turns` Vierteldrehungen im Uhrzeigersinn. */
export const rotateImage = ({ width, height, data }, turns) => {
  const quarter = ((turns % 4) + 4) % 4;
  const swap = quarter % 2 === 1;
  const target = { width: swap ? height : width, height: swap ? width : height };
  const rotated = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [tx, ty] = [[x, y], [height - 1 - y, x], [width - 1 - x, height - 1 - y], [y, width - 1 - x]][quarter];
      rotated.set(data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4), (ty * target.width + tx) * 4);
    }
  return { ...target, data: rotated };
};

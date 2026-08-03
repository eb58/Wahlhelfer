/**
 * Bildbeschaffung im Browser: Datei oder Kameraaufnahme -> ImageData.
 * Das Gegenstueck zu png.js, das dieselbe Struktur in Node liefert.
 */

/**
 * Sehr grosse Aufnahmen kosten nur Rechenzeit; die Ankreuzerkennung braucht sie nicht.
 * Begrenzt wird bewusst die Breite und nicht die laengste Kante: die Groesse eines
 * Ankreuzfelds haengt an der Zettelbreite. Ein sehr langer Zettel (Europawahl) wuerde
 * ueber die laengste Kante so stark verkleinert, dass die Kreise zu klein zum Messen waeren.
 */
export const MAX_WIDTH = 1600;

const createCanvas = (width, height) =>
  typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height });

const toBlobUrl = async canvas => {
  const blob = await (canvas.convertToBlob?.({ type: 'image/png' })
    ?? new Promise(done => canvas.toBlob(done, 'image/png')));
  return globalThis.URL.createObjectURL(blob);
};

/**
 * @param {Blob|File} file Aufnahme aus Kamera oder Dateiauswahl
 * @returns {Promise<{width:number,height:number,data:Uint8ClampedArray}>}
 */
export const toImageData = async file => {
  const bitmap = await createImageBitmap(file);
  try {
    const factor = Math.min(1, MAX_WIDTH / bitmap.width);
    const width = Math.round(bitmap.width * factor), height = Math.round(bitmap.height * factor);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    // Papierweiss als Untergrund: sonst kaemen durchsichtige Bildbereiche als Schwarz an.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  } finally {
    bitmap.close?.();
  }
};

/** Bilddaten als anzeigbare Bildquelle - fuer die Vorschau samt Markierungen. */
export const toImageUrl = async imageData => {
  const canvas = createCanvas(imageData.width, imageData.height);
  canvas.getContext('2d').putImageData(imageData, 0, 0);
  return toBlobUrl(canvas);
};

/**
 * Setzt kleine, unverkleinerte Ausschnitte zu einem kompakten OCR-Bild zusammen.
 * `offsets` beschreibt, wo jeder Streifen im Ausgangsbild lag.
 */
export const toTextstreifenUrl = async (imageData, bereiche) => {
  const source = createCanvas(imageData.width, imageData.height);
  source.getContext('2d').putImageData(imageData, 0, 0);
  const abstand = 20;
  const breite = Math.max(...bereiche.map(bereich => bereich.width));
  const hoehe = bereiche.reduce((summe, bereich) => summe + bereich.height, 0) + abstand * Math.max(0, bereiche.length - 1);
  const canvas = createCanvas(breite, hoehe);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, breite, hoehe);
  const offsets = [];
  let top = 0;
  for (const bereich of bereiche) {
    context.drawImage(source, bereich.left, bereich.top, bereich.width, bereich.height, 0, top, bereich.width, bereich.height);
    offsets.push({ ...bereich, sourceTop: bereich.top, top });
    top += bereich.height + abstand;
  }
  return { imageUrl: await toBlobUrl(canvas), offsets };
};
